---
name: foundation-builder
description: Lead orchestrator — classifies project, spawns sub-agents for code gen + domain packages + master plan
trigger: /foundation-builder (via .cc-prompt)
output: Foundation code in src/ + .claude/implementation/
strategy: sub-agents (Lead + T-FOUNDATION + T-VALIDATE-FOUNDATION + T-DOMAIN ×1-4 + T-MASTERPLAN)
version: 5.5
---

# Foundation Builder — Lead Orchestrator

## What This Does

Analyze the approved proposal + BA specification files and produce 4 outputs:
1. **Foundation code** — types, schemas, stores, routing, layouts, utilities in `src/` (and `server/` if fullstack)
2. **Domain packages** — one self-contained JSON per domain cluster in `.claude/implementation/domains/`
3. **Master plan** — structured task registry (v5.0) in `.claude/implementation/master-plan.json`
4. **Foundation manifest** — inventory of generated files in `.claude/implementation/foundation-manifest.json`

**Sub-agent strategy:** You (Lead) classify the project and write `_project-analysis.json`. Then you spawn:
- **T-FOUNDATION** — generates all foundation code files + foundation-manifest.json
- **T-VALIDATE-FOUNDATION** (VF1) — validates foundation code against BA sources, fixes mechanical issues
- **T-DOMAIN** (1-4 batches) — generates self-contained domain package JSON per batch
- **T-VALIDATE-FOUNDATION** (VF2) — validates domain packages against entities/endpoints
- **T-MASTERPLAN** — reads analysis + all domain packages → generates master-plan.json
- **T-VALIDATE-FOUNDATION** (VF3) — validates master plan coverage, golden zone, dependencies

**CDN-shell shortcut:** When `foundation_type == "cdn-shell"`, the Lead does ALL work inline (single `src/index.html` + simple domain package + 2-task plan). No sub-agents spawned.

Do NOT implement domain features — that is Session 2's job.

---

## Step 0: Setup + Recovery

```
ENSURE directories exist (create if missing):
  .claude/implementation/
  .claude/implementation/domains/
  .claude/implementation/drafts/
  .claude/status/
  src/

WRITE initial status to .claude/status/foundation-builder-status.json:
  {
    "operation": "foundation-builder",
    "version": "5.5",
    "status": { "current": "in_progress", "started_at": "{ISO-8601}" },
    "progress": { "percentage": 5, "step": "Setup", "message": "Initializing foundation builder" },
    "output": null,
    "error": null
  }
```

### Recovery Checkpoints

```
CHECK existing outputs to resume interrupted runs:

IF .claude/implementation/_project-analysis.json exists:
  READ the file
  IF valid JSON with "version" and "classification" and "domain_clusters" keys:
    SKIP Steps 1-3, resume at Step 4 (25%)
    LOG: "Resuming from _project-analysis.json checkpoint"

IF .claude/implementation/foundation-manifest.json exists:
  READ the file
  IF valid JSON with "files" and "verification" keys:
    IF .claude/implementation/drafts/_validation-report-vf1.json also exists:
      SKIP Steps 4-5.5, resume at Step 6 (45%)
      LOG: "Resuming from foundation-manifest.json + VF1 checkpoint"
    ELSE:
      SKIP Steps 4-5, resume at Step 5.5 (35%)
      LOG: "Resuming from foundation-manifest.json checkpoint (VF1 pending)"

IF ALL expected domain packages exist (check _project-analysis.domain_clusters):
  FOR EACH cluster in domain_clusters:
    CHECK .claude/implementation/domains/{cluster.domain}.json exists AND valid JSON
  IF ALL present:
    SKIP Steps 6-7, resume at Step 8 (80%)
    LOG: "Resuming from domain packages checkpoint"

Step 8 (master plan) ALWAYS re-runs — it is the final aggregation step.
```

---

## Step 1: Read Classification Files (10%)

Read EXACTLY these 10 files. Extract ONLY the fields listed — do NOT load full entities/endpoints.

| # | File | Path | Extract These Fields |
|---|------|------|---------------------|
| 1 | api-design INDEX | `.claude/proposal/api-design.json` | `domain_index{}` (per-domain entity_count + endpoint_count), `file_map{}` (split file paths), `auth{}` (type, permission_checks) |
| 2 | tech-stack | `.claude/proposal/tech-stack.json` | `frontend.framework.choice`, `frontend.language.choice`, `frontend.state_management.choice`, `frontend.offline_storage`, `frontend.pwa`, `backend` (null check for client-only), `build_required` implicit from frontend |
| 3 | architecture | `.claude/proposal/architecture.json` | `app_type`, `complexity_tier`, `pattern`, `folder_structure{}`, `auth_flow{}`, `screen_mapping[]` (all entries), `seed_data{}` |
| 4 | integration-map | `.claude/proposal/integration-map.json` | `store_service_map[]` (ALL entries: domain_group, client_store, entities[], server_endpoints[], sync_strategy), `cross_domain_flows[]` (ALL entries with steps[]), `timing_resolutions[]`, `coverage{}` |
| 5 | features | `.ba/requirements/features.json` | `features.must_have[]`, `features.should_have[]`, `features.could_have[]` — extract id, title, priority, screen_refs[] per feature |
| 6 | roles | `.ba/requirements/roles.json` | `roles[]` — extract id, name, permissions[] per role |
| 7 | layout | `.ba/design/layout.json` | `interfaces[]` — extract name, type, target_roles, navigation{} per interface |
| 8 | nfr | `.ba/requirements/nfr.json` | `requirements[]` — extract authentication, performance, security, accessibility fields |
| 9 | constraints | `.ba/discovery/constraints.json` | `technical[]`, `organizational[]` |
| 10 | approval | `.claude/approval/approval-response.json` | `status`, `decisions[]`, `modifications[]` |

**Lead does NOT read:** `entities.json` (44K), api-design splits (46K), `screens.json` (9K), `flows.json` (5K), `components.json` (6K), `style.json` (1K), `technical-proposal.json` (1K). These are read by sub-agents directly.

### Missing File Handling

```
REQUIRED files (FAIL if missing):
  api-design.json, tech-stack.json, architecture.json, features.json, approval-response.json

CONDITIONALLY REQUIRED (FAIL for medium+ complexity):
  roles.json, layout.json

OPTIONAL (continue with defaults if missing):
  integration-map.json → set cross_domain_flows=[], store_service_map=[], timing_resolutions=[]
  nfr.json → assume defaults for app_type
  constraints.json → no constraints

IF integration-map.json missing:
  Set cross_domain_flows = [], store_service_map = [], timing_resolutions = []
  Simple/client-only project — no cross-domain contracts needed
```

```
Update status: { percentage: 10, step: "Reading inputs", message: "Classification files loaded" }
```

---

## Step 2: Classify (15%)

### App Type Detection

```
READ tech-stack.json:
  IF backend == null AND app_type == "client-only"
  THEN → app_type = "client-only"

  ELSE IF nfr.json exists AND nfr.integrations has 2+ entries
  THEN → app_type = "integration-heavy"

  ELSE IF architecture.json.app_type == "offline-first"
       OR tech-stack.summary.architecture_pattern contains "offline"
  THEN → app_type = "offline-first"

  ELSE → app_type = "standard-fullstack"
```

### Complexity Tier Detection

```
entity_count = SUM of domain_index[].entity_count from api-design.json
screen_count = count(architecture.json.screen_mapping)
role_count = count(roles.json.roles) OR 1
interface_count = count(layout.json.interfaces) OR 1
domain_group_count = count(api-design.json.domain_index keys) OR 0

IF entity_count <= 5 AND screen_count <= 3 AND role_count == 1
THEN → complexity = "simple"

ELSE IF entity_count <= 15 AND screen_count <= 10 AND role_count <= 4
THEN → complexity = "medium"

ELSE → complexity = "complex"

Post-adjustment:
  IF interface_count > 2 AND complexity == "simple" → bump to "medium"
  IF domain_group_count > 8 AND complexity != "complex" → bump to "complex"
```

### Foundation Type Detection

```
IF app_type == "client-only" AND tech-stack.build_required == false:
  foundation_type = "cdn-shell"

ELSE IF app_type == "client-only" AND tech-stack.build_required == true:
  foundation_type = "client-build"

ELSE IF app_type == "offline-first":
  foundation_type = "offline-first"

ELSE:
  foundation_type = "fullstack"

build_required fallback:
  IF build_required field missing from tech-stack.json:
    IF frontend.framework contains "React" OR "Vue" OR "Svelte" → build_required = true
    IF frontend.framework contains "Alpine" OR "vanilla" → build_required = false
```

### Validation Approach Detection

```
IF tech-stack.testing has unit framework AND e2e framework:
  validation_approach = "hybrid"

ELSE IF tech-stack.testing.unit.choice contains "jest" OR "vitest" OR "mocha":
  validation_approach = "test-framework"

ELSE:
  validation_approach = "code-review"
```

### Team Composition Decision

```
Base team (always):
  builder-frontend-core, validator-frontend

ADD IF app_type != "client-only":
  builder-backend, validator-backend

IF complexity == "complex" AND interface_count > 2:
  Split builder-frontend by interface:
    builder-frontend-core  → infrastructure + shared screens
    builder-frontend-{id}  → per interface (pos, kitchen, admin)

IF complexity == "complex" AND domain_cluster_count > 5:
  Split builder-backend:
    builder-backend-crud   → simpler CRUD domains
    builder-backend-logic  → complex business logic domains

ADD IF app_type == "offline-first":
  builder-sync

ADD IF app_type == "integration-heavy":
  builder-integrations, validator-integration

Team size by complexity:
  simple:                  2 teammates  (1 builder + 1 validator)
  medium:                  5 teammates  (2 frontend + 1 backend + 2 validators)
  complex:                 9 teammates  (4 frontend + 2 backend + 1 sync + 2 validators)
  complex + integrations: 11 teammates  (+ 1 builder-integrations + 1 validator-integration)
```

### Domain Clustering

```
SOURCE: integration-map.json.store_service_map[] + api-design.json.domain_index

IF store_service_map[] is non-empty:
  FOR EACH entry in store_service_map[]:
    cluster = {
      domain: entry.domain_group,
      entity_names: entry.entities,
      store_name: entry.client_store,
      endpoint_ids: entry.server_endpoints,
      endpoint_count: entry.server_endpoints.length,
      sync_strategy: entry.sync_strategy,
      screen_ids: [],  // from architecture.screen_mapping[] where route prefix matches domain
      feature_ids: []  // from features where screen_refs intersect screen_ids
    }
ELSE IF domain_index exists:
  FOR EACH domain in domain_index:
    cluster = {
      domain: domain key,
      entity_names: [],  // extracted from domain_index entry
      store_name: "use" + PascalCase(domain) + "Store",
      endpoint_ids: [],
      endpoint_count: domain_index[domain].endpoint_count,
      sync_strategy: "none",
      screen_ids: [],
      feature_ids: []
    }
ELSE:
  Create single cluster "all" with all entities/endpoints
```

### Wave Computation

```
Build directed dependency graph from cross_domain_flows[]:
  FOR EACH flow in cross_domain_flows:
    FOR consecutive steps with different domains:
      Add edge: step[N].domain → step[N+1].domain

Topological sort → wave assignments:
  Wave 1: domains with no incoming dependencies (auth, settings, base data)
  Wave 2: domains depending only on Wave 1
  Wave 3+: continue until all assigned

Circular dependency resolution:
  IF circular reference detected → assign both to same wave, note in cross_domain_contracts
```

### Apply Approval Modifications

```
READ approval-response.json:
IF status == "approved_with_modifications":
  FOR EACH modification in modifications[]:
    Track renames, rejections, constraint additions
  Store in approval_modifications[] for _project-analysis.json
```

```
Update status: { percentage: 15, step: "Classification", message: "Project classified: {app_type}, {complexity}, {foundation_type}" }
```

---

## Step 3: Write _project-analysis.json (20%)

Write to `.claude/implementation/_project-analysis.json`:

```json
{
  "version": "5.0",
  "classification": {
    "app_type": "client-only | standard-fullstack | offline-first | integration-heavy",
    "complexity_tier": "simple | medium | complex",
    "foundation_type": "cdn-shell | client-build | fullstack | offline-first",
    "validation_approach": "hybrid | test-framework | code-review"
  },
  "counts": {
    "entities": 0,
    "screens": 0,
    "roles": 0,
    "interfaces": 0,
    "domains": 0,
    "features": { "must": 0, "should": 0, "could": 0 },
    "endpoints": 0
  },
  "domain_clusters": [
    {
      "domain": "auth",
      "entity_names": ["User", "Session"],
      "store_name": "useAuthStore",
      "endpoint_ids": ["EP-001", "EP-002"],
      "endpoint_count": 2,
      "screen_ids": ["S-001"],
      "feature_ids": ["F-001"],
      "sync_strategy": "none",
      "wave": 1
    }
  ],
  "wave_assignments": {
    "wave_1": ["auth", "settings"],
    "wave_2": ["inventory", "order-management"]
  },
  "team_composition": [
    { "name": "builder-frontend-core", "role": "builder", "domain": "infrastructure + shared" }
  ],
  "guard_chain": ["AuthGuard", "RoleGuard"],
  "interface_map": {
    "admin": { "layout": "AdminLayout", "screens": ["S-001", "S-002"] }
  },
  "cross_domain_contracts": [
    {
      "flow_id": "UF-001",
      "flow_name": "Order fulfillment",
      "domains_involved": ["order-management", "inventory"],
      "steps": [],
      "side_effects": [],
      "timing_notes": []
    }
  ],
  "key_signals": {
    "offline_first": false,
    "auth_hint": "jwt | session | pin | none",
    "storage_primary": "relational | indexeddb-dexie | localStorage",
    "multi_interface": false,
    "has_real_time": false,
    "has_cross_domain": false,
    "naming_convention": {
      "table_name": "snake_case | camelCase",
      "entity_name": "PascalCase",
      "store_name": "use{PascalCase}Store"
    }
  },
  "timing_resolutions": [],
  "approval_modifications": [],
  "source_paths": {
    "entities": ".claude/proposal/entities.json",
    "api_design_index": ".claude/proposal/api-design.json",
    "api_splits": {},
    "tech_stack": ".claude/proposal/tech-stack.json",
    "architecture": ".claude/proposal/architecture.json",
    "integration_map": ".claude/proposal/integration-map.json",
    "features": ".ba/requirements/features.json",
    "roles": ".ba/requirements/roles.json",
    "layout": ".ba/design/layout.json",
    "screens": ".ba/design/screens.json",
    "nfr": ".ba/requirements/nfr.json",
    "style": ".ba/design/style.json",
    "constraints": ".ba/discovery/constraints.json",
    "approval": ".claude/approval/approval-response.json"
  }
}
```

**CRITICAL:** `_project-analysis.json` contains ONLY names, IDs, counts, and structural relationships. It does NOT contain full entity attributes, endpoint details, or feature descriptions. Sub-agents read the original source files for full data.

### Populate source_paths.api_splits

```
IF api-design.json has file_map{}:
  FOR EACH entry in file_map:
    api_splits[domain_key] = entry.file path
  Example:
    "api_splits": {
      "auth": ".claude/proposal/api-design-auth.json",
      "orders": ".claude/proposal/api-design-orders.json"
    }
ELSE:
  api_splits = {} (monolithic — sub-agents read api-design.json directly)
```

### Verification

```
READ back _project-analysis.json:
  VERIFY: valid JSON, parseable
  VERIFY: version == "5.0"
  VERIFY: classification has all 4 keys
  VERIFY: domain_clusters[] non-empty (at least 1 cluster)
  VERIFY: each cluster has: domain, entity_names, endpoint_count, wave
  VERIFY: source_paths has: entities, api_design_index, tech_stack, architecture, features
  IF issues → FIX and re-verify (max 2 attempts)
```

```
Update status: { percentage: 20, step: "Analysis written", message: "_project-analysis.json complete" }
```

---

## Step 4: CDN-Shell Branch (25%)

```
IF foundation_type == "cdn-shell":
  GENERATE src/index.html INLINE:
    <!DOCTYPE html> shell with:
      - <head>: meta charset, viewport, title from proposal
      - CDN links from tech-stack.json:
        frontend.framework CDN (e.g., Alpine.js @3)
        frontend.css CDN (e.g., Tailwind CDN)
        frontend.icons CDN (e.g., Lucide @0.460.0)
      - <body>: empty container with x-data (Alpine) or id="app" (vanilla)

  WRITE .claude/implementation/foundation-manifest.json:
    {
      "version": "1.0",
      "foundation_type": "cdn-shell",
      "generated_at": "{ISO-8601}",
      "files": [{ "path": "src/index.html", "category": "shell", "lines": N }],
      "verification": { "npm_install": "skipped", "tsc": "skipped", "dev_server": "skipped" },
      "summary": { "total_files": 1, "total_lines": N, "categories": { "shell": 1 } }
    }

  WRITE .claude/implementation/domains/all.json INLINE:
    {
      "domain": "all", "version": "1.0", "wave": 1, "depends_on_domains": [],
      "entities": { "owns": [/* entity names + IDs only, no full attributes */], "reads": [] },
      "endpoints": [],
      "screens": [/* screen_id + name + route from architecture.screen_mapping */],
      "features": [/* id + title + priority + acceptance_criteria from features.json */],
      "cross_domain_contracts": [],
      "state_dependencies": {},
      "write_scope": ["src/index.html"]
    }

  WRITE .claude/implementation/master-plan.json INLINE (2-task CDN plan):
    See "CDN-Shell Master Plan" section below.

  SKIP Steps 5-8.5 entirely.
  GO TO Step 9 (Completion).
```

### CDN-Shell Master Plan

```json
{
  "version": "5.0",
  "generated_at": "{ISO-8601}",
  "project": {
    "name": "{project name}",
    "app_type": "client-only",
    "complexity": "simple",
    "foundation_type": "cdn-shell",
    "validation_approach": "code-review"
  },
  "foundation_manifest": ".claude/implementation/foundation-manifest.json",
  "domain_packages": ".claude/implementation/domains/",
  "team_composition": [
    { "name": "builder-frontend-core", "agent_template": ".claude/agents/builder.md", "builder_role": "frontend", "domain": "all", "exclusive_write": ["src/"] },
    { "name": "validator-frontend", "agent_template": ".claude/agents/validator.md", "builder_role": null, "domain": "validation", "exclusive_write": [".claude/implementation/"] }
  ],
  "tasks": [
    {
      "id": "T-001",
      "subject": "Build complete application UI",
      "owner": "builder-frontend-core",
      "builder_role": "frontend",
      "layer": 1, "wave": 1,
      "description": {
        "goal": "Generate the full application in src/index.html. Single-file CDN app.",
        "domain_packages": [".claude/implementation/domains/all.json"],
        "write_scope": ["src/index.html"],
        "read_sources": { "primary": ".claude/implementation/domains/all.json" },
        "cross_domain_contracts": [],
        "business_rules": [],
        "state_dependencies": {},
        "acceptance": {}
      },
      "depends_on": [],
      "on_critical_path": false,
      "active_form": "Building complete application UI"
    },
    {
      "id": "T-002",
      "subject": "Validate application against specification",
      "owner": "validator-frontend",
      "builder_role": null,
      "layer": 1, "wave": 1,
      "description": {
        "goal": "Verify generated application meets all acceptance criteria via code review.",
        "domain_packages": [".claude/implementation/domains/all.json"],
        "write_scope": [".claude/implementation/validation-checklist.md", ".claude/implementation/validation-report.json"],
        "read_sources": { "primary": ".claude/implementation/domains/all.json" },
        "cross_domain_contracts": [],
        "business_rules": [],
        "state_dependencies": {},
        "acceptance": { "validation": ["All functional checks pass", "No placeholder text"] }
      },
      "depends_on": [],
      "on_critical_path": false,
      "active_form": "Validating application against specification"
    }
  ],
  "metadata": {
    "entity_count": 0, "screen_count": 0, "task_count": 2,
    "layer_count": 1, "wave_count": 1
  }
}
```

Fill in actual values from classification data. `description.business_rules` and `description.acceptance` should be populated from features.json data.

---

## Step 5: Spawn T-FOUNDATION (25%)

```
IF foundation_type == "cdn-shell":
  ALREADY HANDLED in Step 4. Skip this step.

READ .claude/agents/t-foundation.md → store as FOUNDATION_TEMPLATE

BUILD dynamic context to append:
  ---
  ## YOUR CONTEXT (Dynamic — from Lead)

  Project analysis: .claude/implementation/_project-analysis.json

  Source paths (read these files directly):
    entities: {source_paths.entities}
    tech_stack: {source_paths.tech_stack}
    architecture: {source_paths.architecture}
    style: {source_paths.style}
    roles: {source_paths.roles}
    layout: {source_paths.layout}
    nfr: {source_paths.nfr}
  ---

SPAWN Agent(
  description: "Generate foundation code",
  prompt: FOUNDATION_TEMPLATE + "\n\n" + dynamic_context,
  subagent_type: "general-purpose",
  run_in_background: true
)

WAIT for completion notification (system auto-delivers when agent finishes).

VERIFY after notification:
  READ .claude/implementation/foundation-manifest.json
  IF file missing → agent errored. Read notification for error details.
    RETRY: Re-spawn T-FOUNDATION once. If retry fails → BLOCKING error, EXIT.
  IF file exists but invalid JSON → delete file, re-spawn T-FOUNDATION once.
  IF valid:
    VERIFY: verification.npm_install != "failed" AND verification.tsc != "failed"
    IF verification failed:
      LOG warning but continue — Session 2 can retry

Update status: { percentage: 30, step: "Foundation code", message: "T-FOUNDATION complete: {N} files generated" }
```

---

## Step 5.5: VF1 Checkpoint — Validate Foundation (35%)

```
IF foundation_type == "cdn-shell":
  SKIP — CDN-shell has no sub-agent outputs to validate.

READ .claude/agents/t-validate-foundation.md → store as VALIDATE_TEMPLATE

SPAWN Agent(
  description: "Validate foundation output VF1",
  prompt: VALIDATE_TEMPLATE + "\n\n## CHECKPOINT: VF1",
  subagent_type: "general-purpose",
  run_in_background: true
)

WAIT for completion notification.

READ .claude/implementation/drafts/_validation-report-vf1.json
IF file missing → agent errored. LOG warning, continue (validation is non-blocking by default).
IF file exists:
  IF blocking == true → BLOCKING error. EXIT.
  IF checks_failed > 0:
    Count high-severity issues in issues_unfixed[]
    IF high-severity code generation issues > 3:
      LOG: "VF1 found {N} high-severity issues — re-spawning T-FOUNDATION"
      DELETE foundation-manifest.json
      Re-spawn T-FOUNDATION (max 1 total retry)
      WAIT for notification → re-run VF1
    ELSE:
      LOG: "VF1 found {N} issues, {M} fixed. Continuing."
  Check reasoning_checks[] for any "concern" results:
    IF concern found → LOG reasoning for awareness (non-blocking)

Update status: { percentage: 40, step: "VF1 validation", message: "Foundation validated: {passed}/{total} checks" }
```

---

## Step 6: Compute Domain Batches (45%)

```
IF foundation_type == "cdn-shell":
  ALREADY HANDLED in Step 4. Skip this step.

READ _project-analysis.json → domain_clusters[]

Batch computation:
  cluster_count = domain_clusters.length
  IF cluster_count <= 4:  batch_count = 1
  ELSE IF cluster_count <= 7:  batch_count = 2
  ELSE IF cluster_count <= 12: batch_count = 3
  ELSE: batch_count = 4

Sort clusters by: wave ASC, then endpoint_count DESC
Greedy assignment: add clusters to smallest batch, cap at 35 endpoints per batch

OUTPUT: batches[] = [
  { batch_id: 1, domains: ["auth", "settings"], total_endpoints: 12 },
  { batch_id: 2, domains: ["inventory", "order-management"], total_endpoints: 28 }
]
```

---

## Step 7: Spawn T-DOMAIN Batches (55%)

```
IF foundation_type == "cdn-shell":
  ALREADY HANDLED in Step 4. Skip this step.

READ .claude/agents/t-domain.md → store as DOMAIN_TEMPLATE (read ONCE)

FOR EACH batch in batches[]:
  BUILD batch-specific context:
    ---
    ## YOUR BATCH (Dynamic — from Lead)

    batch_id: {batch.batch_id}
    domains: {batch.domains as JSON array}

    Source paths:
      _project_analysis: .claude/implementation/_project-analysis.json
      entities: {source_paths.entities}
      features: {source_paths.features}
      architecture: {source_paths.architecture}
      screens: {source_paths.screens}
      architecture_note: "Read folder_structure{} from architecture.json for backend write_scope paths. If folder_structure is absent, read foundation-manifest.json and extract server path pattern from listed files."
      api_split_paths:
        {FOR EACH domain in batch.domains:
          {domain}: {source_paths.api_splits[domain] OR source_paths.api_design_index}
        }
    ---

  SPAWN Agent(
    description: "Generate domain packages batch {batch.batch_id}",
    prompt: DOMAIN_TEMPLATE + "\n\n" + batch_context,
    subagent_type: "general-purpose",
    run_in_background: true
  )

WAIT for ALL batch completion notifications (system auto-delivers).

VERIFY after all notifications received:
  FOR EACH cluster in ALL domain_clusters:
    READ .claude/implementation/domains/{cluster.domain}.json
    IF file missing → identify which batch failed.
      RETRY: Re-spawn failed batch once. If retry fails → BLOCKING error, EXIT.
    IF file exists but invalid JSON → delete file, re-spawn that batch once.

IF .claude/implementation/domains/_feedback-entities.json exists:
  READ feedback file. LOG any issues found (informational only).

Update status: { percentage: 60, step: "Domain packages", message: "All {N} domain packages generated" }
```

---

## Step 7.5: VF2 Checkpoint — Validate Domain Packages (65%)

```
IF foundation_type == "cdn-shell":
  SKIP — CDN-shell has no domain packages to validate.

READ .claude/agents/t-validate-foundation.md → reuse VALIDATE_TEMPLATE from Step 5.5

SPAWN Agent(
  description: "Validate domain packages VF2",
  prompt: VALIDATE_TEMPLATE + "\n\n## CHECKPOINT: VF2",
  subagent_type: "general-purpose",
  run_in_background: true
)

WAIT for completion notification.

READ .claude/implementation/drafts/_validation-report-vf2.json
IF file missing → agent errored. LOG warning, continue.
IF file exists:
  IF blocking == true → BLOCKING error. EXIT.
  IF checks_failed > 0:
    Count high-severity entity/endpoint mismatches in issues_unfixed[]
    IF high-severity mismatches > 5:
      Identify affected domains from issues_unfixed[].file
      Map affected domains back to their batch_id
      LOG: "VF2 found {N} high-severity mismatches — re-spawning affected batch(es)"
      DELETE affected domain package files
      Re-spawn affected T-DOMAIN batch(es) (max 1 total retry per batch)
      WAIT for notifications → re-run VF2
    ELSE:
      LOG: "VF2 found {N} issues, {M} fixed. Continuing."
  Check reasoning_checks[] for any "concern" results:
    IF concern found → LOG reasoning for awareness (non-blocking)

Update status: { percentage: 70, step: "VF2 validation", message: "Domain packages validated: {passed}/{total} checks" }
```

---

## Step 8: Spawn T-MASTERPLAN (75%)

```
IF foundation_type == "cdn-shell":
  ALREADY HANDLED in Step 4. Skip this step.

READ .claude/agents/t-masterplan.md → store as MASTERPLAN_TEMPLATE

BUILD dynamic context:
  ---
  ## YOUR CONTEXT (Dynamic — from Lead)

  Source paths:
    _project_analysis: .claude/implementation/_project-analysis.json
    features: {source_paths.features}
    integration_map: {source_paths.integration_map}

  Domain packages:
    {FOR EACH cluster in domain_clusters:
      {cluster.domain}: .claude/implementation/domains/{cluster.domain}.json
    }
  ---

SPAWN Agent(
  description: "Generate master plan",
  prompt: MASTERPLAN_TEMPLATE + "\n\n" + dynamic_context,
  subagent_type: "general-purpose",
  run_in_background: true
)

WAIT for completion notification (system auto-delivers when agent finishes).

VERIFY after notification:
  READ .claude/implementation/master-plan.json
  IF file missing → agent errored. Read notification for error details.
    RETRY: Re-spawn T-MASTERPLAN once. If retry fails → BLOCKING error, EXIT.
  IF file exists but invalid JSON → delete file, re-spawn T-MASTERPLAN once.

Update status: { percentage: 80, step: "Master plan", message: "T-MASTERPLAN complete: {N} tasks generated" }
```

---

## Step 8.5: VF3 Checkpoint — Validate Master Plan (85%)

```
IF foundation_type == "cdn-shell":
  SKIP — CDN-shell master plan is trivial (2 tasks), no validation needed.

READ .claude/agents/t-validate-foundation.md → reuse VALIDATE_TEMPLATE

SPAWN Agent(
  description: "Validate master plan VF3",
  prompt: VALIDATE_TEMPLATE + "\n\n## CHECKPOINT: VF3",
  subagent_type: "general-purpose",
  run_in_background: true
)

WAIT for completion notification.

READ .claude/implementation/drafts/_validation-report-vf3.json
IF file missing → agent errored. LOG warning, continue.
IF file exists:
  IF blocking == true:
    IF circular dependencies detected (VF3-C2):
      LOG: "VF3 found circular dependencies — re-spawning T-MASTERPLAN"
      DELETE master-plan.json
      Re-spawn T-MASTERPLAN once. If retry fails → BLOCKING error, EXIT.
    IF required output files missing (VF3-E1):
      BLOCKING error. EXIT.
  ELSE:
    LOG: "VF3 found {N} issues, {M} fixed. Continuing."
    Note: VF3 can now directly fix golden zone violations (G2/G3 task splits)
      and acceptance format issues. Check fixes_applied[] for task restructuring.
  Check reasoning_checks[] for any "concern" results:
    IF concern found → LOG reasoning for awareness (non-blocking)

Update status: { percentage: 90, step: "VF3 validation", message: "Master plan validated: {passed}/{total} checks" }
```

---

## Step 9: Completion (100%)

```
UPDATE foundation-manifest.json (if not cdn-shell):
  READ existing manifest
  ADD "domain_package_count": {N} to summary

WRITE final status to .claude/status/foundation-builder-status.json:
  {
    "operation": "foundation-builder",
    "version": "5.5",
    "status": {
      "current": "completed",
      "started_at": "{from Step 0}",
      "completed_at": "{ISO-8601}"
    },
    "progress": {
      "percentage": 100,
      "step": "Complete",
      "message": "Foundation builder finished. Ready for Session 2."
    },
    "output": {
      "foundation_manifest": ".claude/implementation/foundation-manifest.json",
      "master_plan": ".claude/implementation/master-plan.json",
      "domain_packages": ".claude/implementation/domains/",
      "domain_package_count": "{N}",
      "foundation_files": "{N}",
      "task_count": "{N}",
      "layers": "{L}",
      "waves": "{W}"
    },
    "error": null
  }

DELETE trigger file from .ba/triggers/ (signal to BA that CC is done)
```

Foundation builder session is complete. Exit.

---

## Status Progress Table

| Step | % | Description |
|------|---|-------------|
| 0 | 5 | Setup + recovery check |
| 1 | 10 | Read 10 classification files |
| 2 | 15 | Classify (app_type, complexity, foundation, validation, team, domains, waves) |
| 3 | 20 | Write _project-analysis.json (with key_signals) |
| 4 | 25 | CDN-shell branch (inline) OR continue |
| 5 | 30 | Spawn T-FOUNDATION → wait for notification |
| 5.5 | 40 | VF1: Validate foundation code against BA sources |
| 6 | 45 | Compute domain batches |
| 7 | 60 | Spawn T-DOMAIN batches → wait for notifications |
| 7.5 | 70 | VF2: Validate domain packages against entities/endpoints |
| 8 | 80 | Spawn T-MASTERPLAN → wait for notification |
| 8.5 | 90 | VF3: Validate master plan coverage + golden zone + deps |
| 9 | 100 | Update manifest, write completion status, delete trigger |

---

## Error Handling

```
Notification timeout (5-minute global timeout per layer):
  IF no completion notification within 5 minutes:
    WRITE error status with:
      type: "sub_agent_timeout"
      message: "T-{AGENT} did not complete within 5-minute timeout"
      recoverable: true
      recovery_action: "Re-run /foundation-builder — recovery checkpoints will skip completed steps"
    DELETE trigger file, EXIT.

Sub-agent produced invalid output (after notification received):
  READ the output file
  IF file missing → agent errored without writing output.
    RETRY: Re-spawn the same agent once (max 1 retry per agent).
    IF retry also fails → BLOCKING error, delete trigger, EXIT.
  IF file exists but invalid JSON (truncated/corrupt):
    DELETE the invalid file
    RETRY: Re-spawn agent once.
    IF retry also fails → BLOCKING error, delete trigger, EXIT.
  IF file exists, valid JSON, but missing keys:
    LOG warning, attempt to continue with partial data.

Validation blocking (T-VALIDATE-FOUNDATION):
  IF any _validation-report-vf{N}.json has blocking == true:
    LOG: "VF{N} validation blocking — {summary}"
    IF blocking due to circular deps (VF3-C2) → re-spawn T-MASTERPLAN once.
    IF blocking due to missing files (VF3-E1) → cannot recover, EXIT.
    IF blocking due to missing domain packages (VF2-A1) → re-spawn affected batch once.
    After retry, re-run the same VF checkpoint.
    IF still blocking after retry → WRITE error status, delete trigger, EXIT.

Missing required source file:
  WRITE error status with:
    type: "missing_source"
    message: "Required file not found: {path}"
    recoverable: false
  DELETE trigger file, EXIT immediately.

All errors: delete trigger file to prevent retry loops.
```

---

## Critical Rules

1. **Sub-agents read source files directly.** The Lead passes source_paths, not file contents. Each sub-agent reads the original BA files for full data.
2. **T-VALIDATE-FOUNDATION runs at every checkpoint.** VF1 (45 checks) after T-FOUNDATION, VF2 (24 checks) after T-DOMAIN, VF3 (29 checks) after T-MASTERPLAN. Each checkpoint includes structural validation AND LLM reasoning quality checks. This prevents error cascade.
3. **Max 1 retry per agent spawn.** If an agent fails twice (initial + 1 retry), it is a BLOCKING error. Do not retry indefinitely.
4. **Completion notifications are the PRIMARY coordination signal.** The system auto-delivers notifications when sub-agents finish. Do NOT poll for files.
5. **Global timeout: 5 minutes per layer.** If a sub-agent does not complete within 5 minutes, treat as timeout error.
6. **Spawn sub-agents via Agent tool.** Use `run_in_background: true` and `subagent_type: "general-purpose"`. Pass the agent template file content as prompt, append dynamic context.
7. **Always spawn sub-agents** for non-CDN-shell projects. Never attempt to generate foundation code, domain packages, or master plan inline — they require too much context.
8. **Forward slashes in all paths.** Even on Windows. All source_paths, write_scope, and file references use `/`.
9. **Self-verify after writing.** Read back `_project-analysis.json` after writing. Verify JSON validity, required keys, and non-empty arrays.
10. **Write incrementally for files > 200 lines.** Write structural shell first, then append sections. Prevents truncation.
11. **Drafts kept for audit.** Validation reports in `.claude/implementation/drafts/` are never deleted during the run. They serve as audit trail.
12. **CDN-shell skips all validation checkpoints.** Steps 5.5, 7.5, and 8.5 are skipped for `foundation_type == "cdn-shell"`. The Lead handles everything inline.
13. **key_signals drive consistency.** The `key_signals` object in `_project-analysis.json` ensures naming conventions, storage type, and auth hints are consistent across all sub-agents.
14. **Feedback from T-DOMAIN is informational.** `_feedback-entities.json` is logged but does not block the pipeline. T-VALIDATE-FOUNDATION VF2 performs the authoritative validation.
15. **Recovery checkpoints skip completed work.** On re-run, the Lead checks for existing outputs and skips steps that already produced valid results. VF reports are also recovery checkpoints.
