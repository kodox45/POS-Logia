#!/usr/bin/env bash
# validate-draft.sh — TaskCompleted hook for proposal and implementation validation
# Fired on every task completion. Validates:
#   - FINAL proposal files in .claude/proposal/
#   - Intermediate files in .claude/proposal/drafts/
#   - Implementation files in .claude/implementation/
#
# Exit codes:
#   0 = valid (or no files yet)
#   2 = invalid file detected (blocks task completion)

set -euo pipefail

# Read stdin (hook metadata) — drain to avoid broken pipe
cat > /dev/null 2>&1 || true

PROPOSAL_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/proposal"
DRAFTS_DIR="${PROPOSAL_DIR}/drafts"

ERRORS=""

# check_structure FILE — verify non-empty, starts with {, ends with }, valid JSON
check_structure() {
  local file="$1"
  local name
  name=$(basename "$file")

  if [ ! -s "$file" ]; then
    ERRORS="${ERRORS}${name}: file is empty\n"
    return 1
  fi

  local first_char
  first_char=$(head -c 1 "$file")
  if [ "$first_char" != "{" ]; then
    ERRORS="${ERRORS}${name}: does not start with {\n"
    return 1
  fi

  local last_char
  last_char=$(tr -d '[:space:]' < "$file" | tail -c 1)
  if [ "$last_char" != "}" ]; then
    ERRORS="${ERRORS}${name}: does not end with } (possibly truncated)\n"
    return 1
  fi

  # Real JSON parse validation (if python3 available)
  if command -v python3 &> /dev/null; then
    if ! python3 -m json.tool "$file" > /dev/null 2>&1; then
      ERRORS="${ERRORS}${name}: invalid JSON (parse failed)\n"
      return 1
    fi
  fi

  return 0
}

# check_key FILE KEY — verify file contains "KEY"
check_key() {
  local file="$1"
  local key="$2"
  local name
  name=$(basename "$file")

  if ! grep -q "\"${key}\"" "$file"; then
    ERRORS="${ERRORS}${name}: missing required key \"${key}\"\n"
  fi
}

# --- Validate FINAL proposal files in .claude/proposal/ ---

if [ -d "$PROPOSAL_DIR" ]; then

  if [ -f "$PROPOSAL_DIR/entities.json" ]; then
    check_structure "$PROPOSAL_DIR/entities.json" && \
      check_key "$PROPOSAL_DIR/entities.json" "entities"
    # Validate entity IDs exist and follow E-xxx format
    if [ -f "$PROPOSAL_DIR/entities.json" ] && command -v python3 &>/dev/null; then
      python3 -c "
import json, sys
data = json.load(open('$PROPOSAL_DIR/entities.json'))
for e in data.get('entities', []):
    if 'id' not in e:
        print(f'WARN: Entity {e[\"name\"]} missing id field', file=sys.stderr)
        sys.exit(2)
    if not e['id'].startswith('E-'):
        print(f'WARN: Entity {e[\"name\"]} has invalid id: {e[\"id\"]}', file=sys.stderr)
        sys.exit(2)
" 2>&1 || ERRORS="${ERRORS}entities.json: entity ID validation failed\n"
    fi
  fi

  if [ -f "$PROPOSAL_DIR/api-design.json" ]; then
    if check_structure "$PROPOSAL_DIR/api-design.json"; then
      # Check if it's an index (split) or monolithic
      if grep -q '"file_map"' "$PROPOSAL_DIR/api-design.json"; then
        # Split mode: validate index + each split file
        check_key "$PROPOSAL_DIR/api-design.json" "file_map"
        # Validate each split file referenced in file_map
        for split_file in "$PROPOSAL_DIR"/api-design-*.json; do
          if [ -f "$split_file" ]; then
            check_structure "$split_file" && \
              check_key "$split_file" "endpoints"
          fi
        done
      else
        # Monolithic mode: must have endpoints or storage_operations
        if ! grep -q '"endpoints"' "$PROPOSAL_DIR/api-design.json" && \
           ! grep -q '"storage_operations"' "$PROPOSAL_DIR/api-design.json"; then
          ERRORS="${ERRORS}api-design.json: missing \"endpoints\" or \"storage_operations\"\n"
        fi
      fi
    fi
  fi

  if [ -f "$PROPOSAL_DIR/tech-stack.json" ]; then
    check_structure "$PROPOSAL_DIR/tech-stack.json" && \
      check_key "$PROPOSAL_DIR/tech-stack.json" "frontend"
  fi

  if [ -f "$PROPOSAL_DIR/architecture.json" ]; then
    check_structure "$PROPOSAL_DIR/architecture.json" && \
      check_key "$PROPOSAL_DIR/architecture.json" "folder_structure"
  fi

  if [ -f "$PROPOSAL_DIR/integration-map.json" ]; then
    check_structure "$PROPOSAL_DIR/integration-map.json" && \
      check_key "$PROPOSAL_DIR/integration-map.json" "cross_domain_flows"
  fi

  if [ -f "$PROPOSAL_DIR/technical-proposal.json" ]; then
    check_structure "$PROPOSAL_DIR/technical-proposal.json" && \
      check_key "$PROPOSAL_DIR/technical-proposal.json" "all_decisions_requiring_approval"
  fi

  # --- EP-xxx sequential validation ---
  if command -v python3 &>/dev/null; then
    # Collect endpoints from monolithic or split files
    if [ -f "$PROPOSAL_DIR/api-design.json" ]; then
      python3 -c "
import json, sys, glob, os
proposal_dir = '$PROPOSAL_DIR'
api_file = os.path.join(proposal_dir, 'api-design.json')
data = json.load(open(api_file))
ep_ids = []
if 'file_map' in data:
    for info in data['file_map'].values():
        sf = os.path.join(os.path.dirname(api_file), os.path.basename(info['file']))
        if os.path.isfile(sf):
            sd = json.load(open(sf))
            ep_ids.extend(e.get('id','') for e in sd.get('endpoints',[]))
elif 'endpoints' in data:
    ep_ids = [e.get('id','') for e in data.get('endpoints',[])]
elif 'storage_operations' in data:
    sys.exit(0)  # client-only, no EP-xxx
else:
    sys.exit(0)
if not ep_ids:
    sys.exit(0)
for i, eid in enumerate(ep_ids, 1):
    expected = f'EP-{i:03d}'
    if eid != expected:
        print(f'EP-xxx not sequential: expected {expected}, got {eid}', file=sys.stderr)
        sys.exit(2)
" 2>&1 || ERRORS="${ERRORS}api-design: EP-xxx IDs not sequential\n"
    fi
  fi

  # --- Cross-file entity ID check (related_entity_id in endpoints vs E-xxx in entities) ---
  if command -v python3 &>/dev/null; then
    if [ -f "$PROPOSAL_DIR/entities.json" ] && [ -f "$PROPOSAL_DIR/api-design.json" ]; then
      python3 -c "
import json, sys, os
proposal_dir = '$PROPOSAL_DIR'
entities = json.load(open(os.path.join(proposal_dir, 'entities.json')))
entity_ids = {e['id'] for e in entities.get('entities', []) if 'id' in e}
api = json.load(open(os.path.join(proposal_dir, 'api-design.json')))
endpoints = []
if 'file_map' in api:
    for info in api['file_map'].values():
        sf = os.path.join(proposal_dir, os.path.basename(info['file']))
        if os.path.isfile(sf):
            endpoints.extend(json.load(open(sf)).get('endpoints', []))
elif 'endpoints' in api:
    endpoints = api.get('endpoints', [])
else:
    sys.exit(0)
for ep in endpoints:
    reid = ep.get('related_entity_id', '')
    if reid and reid not in entity_ids:
        print(f'EP {ep.get(\"id\",\"?\")}: related_entity_id {reid} not in entities', file=sys.stderr)
        sys.exit(2)
" 2>&1 || ERRORS="${ERRORS}api-design: related_entity_id references invalid entity ID\n"
    fi
  fi

  # --- Completeness gate (when technical-proposal.json exists, ALL files must be present) ---
  if [ -f "$PROPOSAL_DIR/technical-proposal.json" ]; then
    for required in entities.json api-design.json tech-stack.json architecture.json integration-map.json; do
      if [ ! -f "$PROPOSAL_DIR/$required" ]; then
        ERRORS="${ERRORS}COMPLETENESS: $required missing but technical-proposal.json exists\n"
      fi
    done
  fi

  # --- Placeholder/TODO detection in all proposal JSON files ---
  for pfile in "$PROPOSAL_DIR"/*.json; do
    if [ -f "$pfile" ]; then
      if grep -qiE '"(TODO|TBD|FIXME|placeholder|\.\.\.)"' "$pfile"; then
        ERRORS="${ERRORS}$(basename "$pfile"): contains placeholder text\n"
      fi
    fi
  done

  # --- Empty array detection (entities[] and endpoints[] should not be empty in final files) ---
  if command -v python3 &>/dev/null; then
    if [ -f "$PROPOSAL_DIR/entities.json" ]; then
      python3 -c "
import json, sys
data = json.load(open('$PROPOSAL_DIR/entities.json'))
if not data.get('entities', []):
    print('entities.json: entities[] is empty', file=sys.stderr)
    sys.exit(2)
" 2>&1 || ERRORS="${ERRORS}entities.json: entities[] array is empty\n"
    fi
    if [ -f "$PROPOSAL_DIR/api-design.json" ]; then
      python3 -c "
import json, sys
data = json.load(open('$PROPOSAL_DIR/api-design.json'))
if 'file_map' in data:
    if not data['file_map']:
        print('api-design.json: file_map is empty', file=sys.stderr)
        sys.exit(2)
elif 'endpoints' in data:
    if not data['endpoints']:
        print('api-design.json: endpoints[] is empty', file=sys.stderr)
        sys.exit(2)
elif 'storage_operations' in data:
    if not data['storage_operations']:
        print('api-design.json: storage_operations[] is empty', file=sys.stderr)
        sys.exit(2)
" 2>&1 || ERRORS="${ERRORS}api-design.json: primary array is empty\n"
    fi
  fi

  # --- D-xxx range enforcement per source file ---
  if command -v python3 &>/dev/null; then
    python3 -c "
import json, sys, os
proposal_dir = '$PROPOSAL_DIR'
ranges = {
    'entities.json': (1, 29),
    'api-design.json': (30, 49),
    'tech-stack.json': (50, 99),
    'architecture.json': (50, 99),
}
for fname, (lo, hi) in ranges.items():
    fpath = os.path.join(proposal_dir, fname)
    if not os.path.isfile(fpath):
        continue
    data = json.load(open(fpath))
    decisions = data.get('decisions_requiring_approval', [])
    for d in decisions:
        did = d.get('id', '')
        if not did.startswith('D-'):
            continue
        try:
            num = int(did[2:])
        except ValueError:
            print(f'{fname}: invalid D-xxx format: {did}', file=sys.stderr)
            sys.exit(2)
        if num < lo or num > hi:
            print(f'{fname}: {did} out of range D-{lo:03d} to D-{hi:03d}', file=sys.stderr)
            sys.exit(2)
" 2>&1 || ERRORS="${ERRORS}D-xxx IDs out of assigned range\n"
  fi

fi

# --- Validate intermediate files in drafts/ ---

if [ -d "$DRAFTS_DIR" ]; then

  if [ -f "$DRAFTS_DIR/_shared-context.json" ]; then
    check_structure "$DRAFTS_DIR/_shared-context.json" && \
      check_key "$DRAFTS_DIR/_shared-context.json" "key_signals"
  fi

  if [ -f "$DRAFTS_DIR/_prototype-summary.json" ]; then
    check_structure "$DRAFTS_DIR/_prototype-summary.json"
  fi

  # Validate feedback files (basic structure check)
  for feedback_file in "$DRAFTS_DIR"/_feedback-*.json; do
    if [ -f "$feedback_file" ]; then
      check_structure "$feedback_file"
    fi
  done

  # Validate T-VALIDATE report files
  for vreport in "$DRAFTS_DIR"/_validation-report-v*.json; do
    if [ -f "$vreport" ]; then
      check_structure "$vreport"
    fi
  done

fi

# --- Implementation validation ---

IMPL_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/implementation"

if [ -d "$IMPL_DIR" ]; then
  # Validate master-plan.json if it exists
  if [ -f "$IMPL_DIR/master-plan.json" ]; then
    if check_structure "$IMPL_DIR/master-plan.json"; then
      if ! grep -q '"tasks"' "$IMPL_DIR/master-plan.json"; then
        ERRORS="${ERRORS}master-plan.json: missing required key \"tasks\"\n"
      fi
      if ! grep -q '"team_composition"' "$IMPL_DIR/master-plan.json"; then
        ERRORS="${ERRORS}master-plan.json: missing required key \"team_composition\"\n"
      fi
      # v5.0 schema: domain_packages (array), on_critical_path, db_scope
      if command -v python3 &>/dev/null; then
        python3 -c "
import json, sys
data = json.load(open('$IMPL_DIR/master-plan.json'))
tasks = data.get('tasks', [])
for t in tasks:
    tid = t.get('id', '?')
    desc = t.get('description', {})
    layer = t.get('layer', 0)
    role = t.get('builder_role', '')
    owner = t.get('owner', '')
    # domain_packages must be array (not string) for L2+ non-validator tasks
    dp = desc.get('domain_packages', desc.get('domain_package'))
    if layer >= 2 and not owner.startswith('validator'):
        if isinstance(dp, str):
            print(f'{tid}: domain_packages is string, must be array', file=sys.stderr)
            sys.exit(2)
        if dp is not None and not isinstance(dp, list):
            print(f'{tid}: domain_packages has wrong type', file=sys.stderr)
            sys.exit(2)
    # on_critical_path must exist
    if 'on_critical_path' not in t:
        print(f'{tid}: missing on_critical_path field', file=sys.stderr)
        sys.exit(2)
    # backend L2+ tasks must have db_scope
    if role == 'backend' and layer >= 2:
        if not desc.get('db_scope'):
            print(f'{tid}: backend task missing db_scope', file=sys.stderr)
            sys.exit(2)
    # L2 domain tasks: acceptance should use feature-keyed format
    if layer == 2 and not owner.startswith('validator'):
        acc = desc.get('acceptance', {})
        for key in acc:
            if key in ('infra', 'general', 'validation', 'e2e', 'sync'):
                print(f'{tid}: L2 domain task uses generic acceptance key \"{key}\", should use F-xxx', file=sys.stderr)
                sys.exit(2)
" 2>&1 || ERRORS="${ERRORS}master-plan.json: v5.0 schema validation failed\n"
      fi
    fi
  fi

  # Validate approved-context.json if it exists
  if [ -f "$IMPL_DIR/approved-context.json" ]; then
    if check_structure "$IMPL_DIR/approved-context.json"; then
      if ! grep -q '"status"' "$IMPL_DIR/approved-context.json"; then
        ERRORS="${ERRORS}approved-context.json: missing required key \"status\"\n"
      fi
    fi
  fi

  # Validate validation-report.json if it exists
  if [ -f "$IMPL_DIR/validation-report.json" ]; then
    if check_structure "$IMPL_DIR/validation-report.json"; then
      if ! grep -q '"results"' "$IMPL_DIR/validation-report.json"; then
        ERRORS="${ERRORS}validation-report.json: missing required key \"results\"\n"
      fi
    fi
  fi

  # Validate _project-analysis.json if it exists
  if [ -f "$IMPL_DIR/_project-analysis.json" ]; then
    if check_structure "$IMPL_DIR/_project-analysis.json"; then
      check_key "$IMPL_DIR/_project-analysis.json" "classification"
      check_key "$IMPL_DIR/_project-analysis.json" "domain_clusters"
      check_key "$IMPL_DIR/_project-analysis.json" "source_paths"
      check_key "$IMPL_DIR/_project-analysis.json" "key_signals"
    fi
  fi

  # Validate foundation-manifest.json if it exists
  if [ -f "$IMPL_DIR/foundation-manifest.json" ]; then
    if check_structure "$IMPL_DIR/foundation-manifest.json"; then
      check_key "$IMPL_DIR/foundation-manifest.json" "files"
      check_key "$IMPL_DIR/foundation-manifest.json" "verification"
    fi
  fi

  # Validate domain packages (skip _feedback* files)
  if [ -d "$IMPL_DIR/domains" ]; then
    for domain_file in "$IMPL_DIR"/domains/*.json; do
      if [ -f "$domain_file" ]; then
        domain_name=$(basename "$domain_file")
        # Skip feedback files
        if [[ "$domain_name" == _feedback* ]]; then
          continue
        fi
        if check_structure "$domain_file"; then
          check_key "$domain_file" "domain"
          check_key "$domain_file" "entities"
          check_key "$domain_file" "endpoints"
          check_key "$domain_file" "write_scope"
        fi
      fi
    done
  fi

  # Validate T-VALIDATE-FOUNDATION reports (vf prefix)
  if [ -d "$IMPL_DIR/drafts" ]; then
    for vf_report in "$IMPL_DIR"/drafts/_validation-report-vf*.json; do
      if [ -f "$vf_report" ]; then
        if check_structure "$vf_report"; then
          check_key "$vf_report" "checkpoint"
          check_key "$vf_report" "checks_total"
          check_key "$vf_report" "reasoning_checks"
          # Validate reasoning_checks structure
          if command -v python3 &>/dev/null; then
            python3 -c "
import json, sys
data = json.load(open('$vf_report'))
rc = data.get('reasoning_checks', [])
if not isinstance(rc, list):
    print(f'reasoning_checks must be array', file=sys.stderr)
    sys.exit(2)
for check in rc:
    if 'result' not in check or 'reasoning' not in check:
        print(f'reasoning_check {check.get(\"id\",\"?\")} missing result or reasoning', file=sys.stderr)
        sys.exit(2)
    if check['result'] not in ('pass', 'warn', 'concern'):
        print(f'reasoning_check {check.get(\"id\",\"?\")} invalid result: {check[\"result\"]}', file=sys.stderr)
        sys.exit(2)
# Validate checks_total = checks_passed + checks_failed
total = data.get('checks_total', 0)
passed = data.get('checks_passed', 0)
failed = data.get('checks_failed', 0)
if total != passed + failed:
    print(f'checks_total ({total}) != passed ({passed}) + failed ({failed})', file=sys.stderr)
    sys.exit(2)
" 2>&1 || ERRORS="${ERRORS}$(basename "$vf_report"): VF report structure validation failed\n"
          fi
        fi
      fi
    done
  fi

fi

# --- Report ---

if [ -n "$ERRORS" ]; then
  echo -e "Validation failed:\n${ERRORS}" >&2
  exit 2
fi

exit 0
