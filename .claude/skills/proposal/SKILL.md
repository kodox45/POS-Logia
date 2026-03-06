---
name: proposal
description: Finals-first sub-agent proposal generator.
  Spawns 4-6 specialized sub-agents that write FINAL files directly,
  with 3-checkpoint validation via T-VALIDATE.
trigger:
  - proposal-request.json
output: .claude/proposal/
strategy: sub-agents
team: 1 Lead + 3 Core (T-ENTITY, T-API, T-SYSTEM) + 1 Integrator (T-INTEGRATE) + 1 Validator (T-VALIDATE) + 1 Optional (T-PROTO-EXTRACT)
version: 5.0
---

# Proposal Generator — Sub-Agents v5.0

## What To Build

Generate 7 technical specification files from BA output:

1. `entities.json` — Data model (entities, attributes, relationships)
2. `api-design.json` — API endpoints or localStorage operations
3. `tech-stack.json` — Technology choices with rationale
4. `architecture.json` — Folder structure, auth flow, screen mapping
5. `integration-map.json` — Cross-domain flow contracts + coverage analysis (ALWAYS produced)
6. `technical-proposal.json` — Consolidated decisions + coverage report
7. `technical-proposal.md` — Human-readable summary (only human-readable file)

**V5 Architecture:** Each agent is spawned as an independent sub-agent via `Agent()` with
`run_in_background: true`. Agents write FINAL files directly to `.claude/proposal/`. The Lead
derives `key_signals` that all agents read for consistent decisions. T-VALIDATE runs at 3
checkpoints (V1, V2, V3) to catch and fix mechanical errors before they cascade to downstream
agents. T-INTEGRATE runs last with a fresh context, validates all outputs, and writes
integration-map.json with resolved flows and coverage analysis.

**Context-optimized design:** Each agent operates well within the ~200K token context limit.
No single agent reads all BA files. Agent templates are in `.claude/agents/t-*.md` files.

---

## 4-Layer Execution Flow with Validation Checkpoints

```
Layer 0:    Lead classifies -> writes _shared-context.json (with key_signals)
Layer 0.5:  T-PROTO-EXTRACT (conditional, background sub-agent)
Layer 1:    T-ENTITY + T-SYSTEM (parallel background sub-agents)
  V1:       T-VALIDATE checkpoint (validate entities + tech-stack + architecture)
Layer 2:    T-API (background sub-agent, reads upstream outputs)
  V2:       T-VALIDATE checkpoint (validate api-design cross-refs)
Layer 3:    T-INTEGRATE (background sub-agent, reads ALL finals)
  V3:       T-VALIDATE final (comprehensive validation of everything)
Layer 4:    Lead reads V3 report -> processes feedback -> writes synthesis
```

---

## Step 0: Detect & Setup

**Inputs:** Trigger file at `.ba/triggers/proposal-request.json`

```
1. READ .ba/triggers/proposal-request.json
2. PARSE sources{} -> file path map
3. ENSURE .claude/proposal/ exists (create if not)
4. ENSURE .claude/proposal/drafts/ exists (for _shared-context.json, _prototype-summary.json, _feedback-*.json)
5. CHECK prototype/index.html exists -> set HAS_PROTOTYPE = true/false
6. CHECK .claude/status/prototype-status.json exists -> set HAS_PROTOTYPE_STATUS = true/false
7. WRITE initial status to trigger's output.status_file:
   { progress: { percentage: 5, step: "Setup", message: "Initializing proposal generation" } }
```

NOTE: No team creation needed. Agents are spawned as independent sub-agents via
`Agent()` with `run_in_background: true`. Coordination happens via completion notifications
(system auto-delivers when agent finishes) and file verification after notification.

**Error:** If trigger is malformed JSON -> BLOCKING error (code PROPOSAL_001), stop.

---

## Step 1: Lead Reads Classification Files

**Inputs:** Selective source files from trigger's `sources{}`

The Lead reads ONLY what it needs for classification — NOT every BA file.

**Full read (required):**
1. `index.json` — project.name, summary.screens count, file paths
2. `nfr.json` — security.authentication, api_response, offline_capability, integrations[]
3. `roles.json` — roles[].id, permissions[], toggleable_permissions, hierarchy
4. `constraints.json` — technical[] (framework preferences), budget, timeline
5. `features.json` — must/should/could_have[] for entity candidate counting + cross-domain analysis
6. `flows.json` — steps[] with screen_ref, action (for cross-domain flow detection)
7. `layout.json` — Navigation structure, interface type

**Skip (teammates read these directly):**
- `screens.json` — Lead only needs count (from index.json summary.screens)
- `components.json` — Only needed by T-SYSTEM for architecture
- `style.json` — Not needed for proposal
- `manifest.json` — Not needed for proposal
- `problem.json` — Domain vocabulary (teammates read if needed)
- `prototype/index.html` — T-PROTO-EXTRACT handles this
- `prototype-status.json` — T-PROTO-EXTRACT handles this

**Pre-condition checks:**
- features.json contains at least 1 must_have feature -> else BLOCKING (PROPOSAL_003)
- roles.json contains at least 1 role -> else BLOCKING (PROPOSAL_004)
- index.json, nfr.json, roles.json, features.json exist -> else BLOCKING (PROPOSAL_001: missing_source)

Update status: `{ percentage: 10, step: "Ingestion", message: "Read classification files" }`

---

## Step 2: Classify & Prepare Shared Context

**Inputs:** index.json, nfr.json, constraints.json, features.json, roles.json, flows.json, layout.json

### App Type Detection

```
IF nfr.security.authentication == false
   AND (nfr.performance.api_response contains "N/A" OR "client-side")
   AND (constraints.technical mentions "no server" OR "single user" OR "offline only")
THEN -> app_type = "client-only"

ELSE IF nfr.integrations[] has 2+ entries (WebSocket, payment, storage, etc.)
THEN -> app_type = "integration-heavy"

ELSE IF nfr.reliability.offline_capability == true
THEN -> app_type = "offline-first"

ELSE -> app_type = "standard-fullstack"
```

### Complexity Tier Detection

```
Count entity candidates from features.json object nouns
  (unique nouns from user_story.action -- skip "view", "monitor", "track" actions)
Count screens from index.json summary.screens (NOT from reading screens.json)
Count roles from roles.json

IF entities <= 5 AND screens <= 2 AND roles == 1
THEN -> complexity = "simple"

ELSE IF entities <= 15 AND screens <= 10 AND roles <= 4
THEN -> complexity = "medium"

ELSE -> complexity = "complex"
```

### Key Signals Derivation

Derive key_signals from classification files to provide shared project understanding:

```
key_signals = {
  offline_first: nfr.reliability.offline_capability == true,
  auth_hint: {
    primary_method: derive from nfr.security.authentication type
      ("username-password" | "oauth" | "api-key" | "none"),
    secondary_method: derive from roles.json PIN/MFA mentions + nfr.security
      ("pin" | "mfa" | "none"),
    session_storage: "indexeddb" if offline_first else "cookie",
    server_dependency: false if offline_first else true
  },
  storage_primary: derive from app_type + offline_capability
    (e.g., "indexeddb-dexie", "postgresql", "localStorage"),
  multi_interface: layout.json has multiple interfaces or interface_count > 1,
  interface_count: count from layout.json,
  has_real_time: nfr.integrations includes any of:
    "WebSocket", "SSE", "Server-Sent Events", "real-time",
    "live updates", "push notifications (server-initiated)",
  has_cross_domain: cross_domain_flows[].length > 0,
  entity_candidate_count: count from features.json object nouns,
  domain_groups: extract from features.json + cross_domain_flows (see derivation below),
  naming_convention: {
    table_name: "camelCase" if storage_primary in ["indexeddb-dexie", "localStorage"] else "snake_case",
    entity_name: "PascalCase",
    attribute_name: "camelCase",
    endpoint_path: "kebab-case"
  }
}
```

### domain_groups Derivation

```
1. FROM features.json: Group features by primary object noun -> domain candidates
   Example: "manage orders" -> "order-management", "manage inventory" -> "inventory"
2. FROM cross_domain_flows[]: Extract unique domain names from steps
3. Merge + deduplicate -> domain_groups[]
```

### naming_convention Derivation

```
IF storage_primary in ["indexeddb-dexie", "localStorage"]:
  table_name = "camelCase"
ELSE:
  table_name = "snake_case"
entity_name = "PascalCase" (always)
attribute_name = "camelCase" (always)
endpoint_path = "kebab-case" (always)
```

### auth_hint Derivation

```
primary_method: from nfr.security.authentication type
secondary_method: from roles.json PIN/MFA mentions + nfr.security
session_storage: "indexeddb" if offline_first else "cookie"
server_dependency: false if offline_first else true
```

### Cross-Domain Flow Analysis

```
1. Extract entity domain groups from features.json:
   - Group features by object noun -> domain candidates
   - Example: "manage orders" -> order-management, "manage inventory" -> inventory

2. Scan flows.json for multi-domain flows:
   FOR EACH flow in flows.json:
     Extract entity nouns from each step's action text
     IF flow touches 2+ domain groups -> cross_domain_flow
     Record: { flow_id, name, domains_touched[], steps with domain labels }

3. Scan features.json business_rules[] for cross-domain side-effects:
   FOR EACH feature's business_rules[]:
     IF rule text references entities from a DIFFERENT domain than the feature's primary entity:
       -> Record as side_effect: { source_feature, source_domain, target_domain, action, rule_text }

4. Detect trigger timing conflicts:
   FOR EACH side_effect:
     Search ALL features for rules mentioning the same action
     IF different features specify different trigger points for the same action:
       -> Record: { action, conflicting_sources: [{ feature, timing, rule_text }] }

IF flows.json unavailable -> set cross_domain_flows = [] (skip gracefully)
IF no cross-domain flows detected -> set cross_domain_flows = [] (simple project)
```

### Write Shared Context

Write `.claude/proposal/drafts/_shared-context.json`:

```json
{
  "project_name": "from index.json",
  "app_type": "client-only | integration-heavy | offline-first | standard-fullstack",
  "complexity_tier": "simple | medium | complex",
  "has_prototype": true,
  "has_prototype_status": false,
  "screen_count": 12,
  "counts": {
    "features_must": 6, "features_should": 4, "features_could": 0,
    "roles": 1, "screens": 2, "entity_candidates": 3
  },
  "key_signals": {
    "offline_first": true,
    "auth_hint": {
      "primary_method": "username-password",
      "secondary_method": "pin",
      "session_storage": "indexeddb",
      "server_dependency": false
    },
    "storage_primary": "indexeddb-dexie",
    "multi_interface": true,
    "interface_count": 4,
    "has_real_time": false,
    "has_cross_domain": true,
    "entity_candidate_count": 18,
    "domain_groups": ["auth", "menu", "inventory", "order-management", "kitchen", "payment", "shift-management", "reporting", "settings"],
    "naming_convention": {
      "table_name": "camelCase",
      "entity_name": "PascalCase",
      "attribute_name": "camelCase",
      "endpoint_path": "kebab-case"
    }
  },
  "source_paths": {
    "features": ".ba/requirements/features.json",
    "roles": ".ba/requirements/roles.json",
    "nfr": ".ba/requirements/nfr.json",
    "screens": ".ba/design/screens.json",
    "...": "..."
  },
  "unavailable_sources": ["manifest"],
  "cross_domain_flows": [
    {
      "flow_id": "UF-xxx",
      "name": "descriptive name",
      "domains_touched": ["order-management", "inventory", "kitchen"],
      "trigger_events": [
        { "event": "order.status -> confirmed", "source_feature": "F-xxx" }
      ],
      "timing_conflicts": [
        { "action": "deduct stock", "sources": [
          { "feature": "F-xxx", "timing": "at order creation", "rule": "..." },
          { "feature": "F-yyy", "timing": "at payment", "rule": "..." }
        ]}
      ],
      "side_effects": [
        { "source_domain": "order-management", "target_domain": "inventory",
          "action": "deduct stock", "source_feature": "F-xxx" }
      ]
    }
  ]
}
```

Include ALL source paths from the trigger's sources{}. This context provides classification,
key_signals, and file locations. Teammates MUST read BA files directly — shared context
is NOT a proxy for BA data.

Update status: `{ percentage: 20, step: "Classification", message: "Classifying architecture and complexity" }`

---

## Step 3: Spawn Prototype Extractor (Conditional)

**ONLY if HAS_PROTOTYPE == true.** If no prototype -> skip to Step 4, keep status at 25%.

```
1. READ .claude/agents/t-proto-extract.md -> store as PROTO_PROMPT
2. Spawn sub-agent:
   Agent({
     prompt: PROTO_PROMPT,
     subagent_type: "general-purpose",
     run_in_background: true
   })
3. Wait for completion notification (system auto-delivers when agent finishes)
4. Verify _prototype-summary.json exists in drafts/ and is valid JSON
   IF file missing -> agent errored. Read notification for error details.
   RETRY: Re-spawn once. If retry also fails -> continue without prototype data.
```

T-PROTO-EXTRACT reads: prototype/index.html, prototype-status.json, _shared-context.json.
Outputs: `.claude/proposal/drafts/_prototype-summary.json` with extracted mock data arrays,
CRUD patterns, field lists, and entity hints for other teammates to consume.

Update status: `{ percentage: 25, step: "Prototype", message: "Extracting prototype data" }`

---

## Step 4: Spawn Core Agents (4-Layer Execution with Validation Checkpoints)

### Phase B: Spawn T-ENTITY + T-SYSTEM (Layer 1)

READ agent template files:

```
.claude/agents/t-entity.md   -> ENTITY_PROMPT
.claude/agents/t-system.md   -> SYSTEM_PROMPT
```

Spawn T-ENTITY and T-SYSTEM in parallel (single message, two Agent calls):

```
Agent({
  prompt: ENTITY_PROMPT,
  subagent_type: "general-purpose",
  run_in_background: true
})

Agent({
  prompt: SYSTEM_PROMPT,
  subagent_type: "general-purpose",
  run_in_background: true
})
```

T-ENTITY extracts entities from BA specs using a 7-step algorithm.
Outputs: `.claude/proposal/entities.json`

T-SYSTEM determines tech stack and designs architecture.
Outputs: `.claude/proposal/tech-stack.json`, `.claude/proposal/architecture.json`

**Wait for both completion notifications** (system auto-delivers when each agent finishes).

**VERIFY after notifications:**
```
FOR EACH file in [entities.json, tech-stack.json, architecture.json]:
  VERIFY file exists AND parses as valid JSON (use Read + JSON validation)
  IF file missing -> agent errored. Read notification for error details.
  RETRY: Re-spawn failed agent (max 1 retry). If retry fails -> BLOCKING error.
```

### Phase B.5: V1 Checkpoint — Validate Layer 1 Outputs

```
READ .claude/agents/t-validate.md -> VALIDATE_PROMPT
APPEND to prompt: "\n\n## CHECKPOINT: V1\n"

Agent({
  prompt: VALIDATE_PROMPT,
  subagent_type: "general-purpose",
  run_in_background: true
})
```

Wait for T-VALIDATE completion notification.

```
READ .claude/proposal/drafts/_validation-report-v1.json
  IF blocking == true -> BLOCKING error (critical unfixable issue in Layer 1 outputs)
  IF fixes_applied[] non-empty -> T-VALIDATE already fixed the files directly
  IF issues_unfixed[] has high severity -> note for later, proceed with caution
PROCEED to Layer 2
```

### Phase C: Spawn T-API (Layer 2)

```
READ .claude/agents/t-api.md -> API_PROMPT

Agent({
  prompt: API_PROMPT,
  subagent_type: "general-purpose",
  run_in_background: true
})
```

T-API reads entities.json + tech-stack.json + BA files to design endpoints.
Outputs: `.claude/proposal/api-design.json`

Wait for T-API completion notification.

**VERIFY after notification:**
```
VERIFY api-design.json exists AND parses as valid JSON
  IF split: verify file_map key exists + each split file exists and parses as valid JSON
  IF file missing -> agent errored. Read notification for error details.
  RETRY: Re-spawn T-API (max 1 retry). If retry fails -> BLOCKING error.
```

### Phase C.5: V2 Checkpoint — Validate Layer 2 Outputs

```
READ .claude/agents/t-validate.md -> VALIDATE_PROMPT (re-read for fresh context)
APPEND to prompt: "\n\n## CHECKPOINT: V2\n"

Agent({
  prompt: VALIDATE_PROMPT,
  subagent_type: "general-purpose",
  run_in_background: true
})
```

Wait for T-VALIDATE completion notification.

```
READ .claude/proposal/drafts/_validation-report-v2.json
  IF blocking == true -> BLOCKING error
  IF fixes_applied[] non-empty -> T-VALIDATE already fixed the files
PROCEED to Layer 3
```

### Phase D: Spawn T-INTEGRATE (Layer 3)

```
READ .claude/agents/t-integrate.md -> INTEGRATE_PROMPT

Agent({
  prompt: INTEGRATE_PROMPT,
  subagent_type: "general-purpose",
  run_in_background: true
})
```

T-INTEGRATE reads ALL final files + BA files, runs 14 checks, writes integration-map.json.
Outputs: `.claude/proposal/integration-map.json`

Wait for T-INTEGRATE completion notification.

**VERIFY after notification:**
```
VERIFY integration-map.json exists AND parses as valid JSON (contains "cross_domain_flows")
  IF file missing -> agent errored. Read notification for error details.
  RETRY: Re-spawn T-INTEGRATE (max 1 retry). If retry fails -> BLOCKING error.
```

### Phase D.5: V3 Checkpoint — Final Comprehensive Validation

```
READ .claude/agents/t-validate.md -> VALIDATE_PROMPT (re-read for fresh context)
APPEND to prompt: "\n\n## CHECKPOINT: V3\n"

Agent({
  prompt: VALIDATE_PROMPT,
  subagent_type: "general-purpose",
  run_in_background: true
})
```

Wait for T-VALIDATE completion notification.

```
READ .claude/proposal/drafts/_validation-report-v3.json
  IF blocking == true -> BLOCKING error (required file missing or fundamentally invalid)
  IF fixes_applied[] non-empty -> T-VALIDATE already fixed the files
```

### Status Updates During Agent Work

| Event | % | Message |
|-------|---|---------|
| T-ENTITY + T-SYSTEM spawned | 25% | Layer 1 agents working |
| Layer 1 complete (both notifications received) | 35% | Layer 1 outputs received |
| V1 checkpoint passed | 40% | Validation V1 passed |
| T-API spawned | 45% | Layer 2 agent working |
| T-API complete (notification received) | 55% | Layer 2 output received |
| V2 checkpoint passed | 60% | Validation V2 passed |
| T-INTEGRATE spawned | 65% | Layer 3 agent working |
| T-INTEGRATE complete (notification received) | 75% | All agent outputs received |
| V3 final validation passed | 80% | Final validation complete |

---

## Step 5: Process Feedback

T-VALIDATE may have already fixed many mechanical issues at V1, V2, and V3 checkpoints.
This step handles remaining feedback from T-INTEGRATE and any unfixed V3 issues.

```
1. READ .claude/proposal/drafts/_validation-report-v3.json
   -> Check issues_unfixed[] for high-severity items that require agent re-generation

2. CHECK .claude/proposal/drafts/ for _feedback-*.json files (from T-INTEGRATE)

IF _feedback-entities.json exists AND issues require re-generation (not just fixes):
  READ .claude/agents/t-entity.md -> ENTITY_PROMPT
  APPEND to prompt: "\n\n## FEEDBACK FROM DOWNSTREAM\n" + feedback file content
  Re-spawn T-ENTITY with feedback prompt:
    Agent({
      prompt: ENTITY_PROMPT + "\n\n## FEEDBACK FROM DOWNSTREAM\n" + feedback_content,
      subagent_type: "general-purpose",
      run_in_background: true
    })
  Wait for completion notification
  VERIFY entities.json exists and is valid JSON
  IF T-API depends on changed entities:
    Re-spawn T-API with same feedback mechanism (max 1 re-run)

IF _feedback-api.json exists AND issues require re-generation:
  READ .claude/agents/t-api.md -> API_PROMPT
  APPEND to prompt: "\n\n## FEEDBACK FROM DOWNSTREAM\n" + feedback file content
  Re-spawn T-API with feedback prompt:
    Agent({
      prompt: API_PROMPT + "\n\n## FEEDBACK FROM DOWNSTREAM\n" + feedback_content,
      subagent_type: "general-purpose",
      run_in_background: true
    })
  Wait for completion notification
  VERIFY api-design.json exists and is valid JSON

IF no feedback files AND no high-severity unfixed issues -> skip to Step 6

MAX total re-runs: 1 per agent (prevent infinite loops)
```

Update status: `{ percentage: 85, step: "Feedback", message: "Processing downstream feedback" }`
(Skip this status update if no feedback files found.)

---

## Step 6: Write Final Synthesis Files

**Inputs:** All final files from `.claude/proposal/` + integration-map.json

The Lead writes synthesis files that consolidate decisions and provide navigation:

### technical-proposal.json — Proposal Index (Lightweight)

This file is a NAVIGATION INDEX, not a content dump. Target: <150 lines.

```
1. COLLECT decisions_requiring_approval from entities.json, api-design.json,
   tech-stack.json, architecture.json -> unified list
   (Lead new decisions get D-100+)
2. COLLECT coverage from integration-map.json coverage section
3. BUILD reading_guide (static role-to-section map)
4. GENERATE statistics: total_entities, total_endpoints, total_decisions, coverage breakdown
```

Write to `.claude/proposal/technical-proposal.json`:

```json
{
  "version": "1.0",
  "project": "{from index.json, kebab-case}",
  "generated_at": "ISO-8601",
  "summary": {
    "entities_count": 0,
    "endpoints_count": 0,
    "estimated_files": 0,
    "decisions_requiring_approval": 0
  },
  "artifacts": {
    "entities": ".claude/proposal/entities.json",
    "api_design": ".claude/proposal/api-design.json",
    "tech_stack": ".claude/proposal/tech-stack.json",
    "architecture": ".claude/proposal/architecture.json",
    "integration_map": ".claude/proposal/integration-map.json"
  },
  "all_decisions_requiring_approval": [
    { "id": "D-xxx", "source": "entities.json", "category": "entities|api|tech_stack|architecture",
      "item": "What needs deciding", "options": [], "default": "", "recommended": "", "rationale": "" }
  ],
  "coverage_summary": {
    "must_have": { "total": 0, "fully_covered": 0, "partially_covered": 0, "gaps": 0 },
    "should_have": { "total": 0, "fully_covered": 0, "partially_covered": 0, "gaps": 0 },
    "could_have": { "total": 0, "fully_covered": 0, "partially_covered": 0, "gaps": 0 }
  },
  "blocking_gaps": [],
  "reading_guide": {
    "entities.json": {
      "full_read_roles": ["backend-builder", "backend-validator"],
      "summary_only_roles": ["frontend-builder", "infra-builder"],
      "key_sections": ["entities[].attributes", "entities[].relationships", "entities[].state_machine"]
    },
    "api-design.json": {
      "navigation": "Use domain_index to filter endpoints by relevant domain",
      "full_read_roles": ["backend-validator"],
      "domain_filtered_roles": ["backend-builder"],
      "summary_only_roles": ["frontend-builder"],
      "key_sections": ["domain_index", "endpoints[].business_rules", "auth"]
    },
    "tech-stack.json": {
      "full_read_roles": ["infra-builder"],
      "section_map": {
        "frontend": ["frontend-builder", "frontend-validator"],
        "backend": ["backend-builder", "backend-validator"],
        "testing": ["all-validators"]
      }
    },
    "architecture.json": {
      "full_read_roles": ["infra-builder"],
      "section_map": {
        "screen_mapping + component_architecture": ["frontend-builder", "frontend-validator"],
        "auth_flow + data_flow": ["backend-builder"],
        "folder_structure": ["infra-builder"]
      }
    },
    "integration-map.json": {
      "full_read_roles": ["backend-builder", "infra-builder"],
      "summary_only_roles": ["frontend-builder"],
      "key_sections": ["cross_domain_flows[].steps", "store_service_map", "timing_resolutions", "coverage"]
    }
  },
  "next_action": {
    "actor": "user",
    "action": "Review proposal and provide approval via BA Agent",
    "response_file": ".claude/approval/approval-response.json"
  }
}
```

CRITICAL: This file MUST NOT duplicate entity lists, endpoint lists, or tech stack details.
Those live in their dedicated files. The ONLY content aggregated here is
all_decisions_requiring_approval (collected from all agent outputs), coverage_summary
(from integration-map.json), and reading_guide (static role-to-section map).

The role types in reading_guide (e.g., "backend-builder", "frontend-validator") are
descriptive categories, NOT actual agent names. The implementation-setup generator
matches its dynamically-created teammates to the closest role type when constructing
task-specific Read directives.

### technical-proposal.md Structure (Human-Readable Summary)

```
Sections:
  Executive Summary (vision, app type, complexity, team composition)
  -> 1. Data Model Overview (entity count, key relationships diagram in ASCII,
       decision highlights -- NOT full entity dump)
  -> 2. API Design Overview (endpoint count by domain_group, auth model summary,
       key business rules with formulas -- NOT full endpoint list)
  -> 3. Technology Decisions (layer/choice/rationale table, override justifications)
  -> 4. Architecture (folder structure tree, auth flow, data flow diagram in ASCII)
  -> 5. Decisions Requiring Approval (full D-xxx table with recommendations)
  -> 6. Coverage Report (priority x status matrix, list of gaps if any,
       list of inferred rules for should/could features)
  -> 7. Next Steps (review -> approve -> implement timeline)

If BLOCKING gaps exist: prominent warning in Executive Summary.

CRITICAL: This is a SUMMARY document. Reference the JSON files for details.
  "See entities.json for full attribute list"
  "See api-design.json endpoints in domain group 'payment' for details"
  Do NOT reproduce full entity/endpoint lists here.
```

### Status Milestones

| File | % | Message |
|------|---|---------|
| technical-proposal.json written | 90% | Writing proposal index |
| technical-proposal.md written | 95% | Writing human-readable summary |

---

## Step 7: Signal Completion

```
1. WRITE .claude/status/proposal-ready.json with:
   operation: "proposal", version: "5.0"
   status.current: "completed", started_at, updated_at, completed_at
   progress: { percentage: 100, step: "Complete", message: "Proposal generated successfully -- 7 files written" }
   proposal: { summary: ".claude/proposal/technical-proposal.md", detailed: "...json",
     artifacts: [entities.json, api-design.json, tech-stack.json, architecture.json,
                 integration-map.json, technical-proposal.json, technical-proposal.md] }
   awaiting: "user_approval"
   decisions_requiring_approval: [from technical-proposal.json all_decisions_requiring_approval]
   next_action: { actor: "user", action: "Review proposal and provide approval via BA Agent" }

2. DELETE trigger file: .ba/triggers/proposal-request.json

3. Drafts directory is KEPT (not deleted) for audit trail.
```

---

## Critical Rules

1. **Teammates read BA files directly** — Teammates read `.ba/` files from paths in shared context. Shared context provides classification, key_signals, and paths only, never a data proxy.

2. **D-xxx ID ranges are strict** — T-ENTITY: D-001 to D-029. T-API: D-030 to D-049. T-SYSTEM: D-050 to D-099. Lead: D-100+. No overlaps.

3. **EP-xxx sequential and globally unique** — T-API assigns endpoint IDs. Sequential numbering, no gaps.

4. **Shared context is classification + key_signals only** — It contains app_type, complexity, key_signals, counts, and file paths. NOT a replacement for reading BA files.

5. **Drafts are kept** — Never delete `.claude/proposal/drafts/`. They serve as audit trail.

6. **Forward slashes in all paths** — Never use backslashes, even on Windows.

7. **Write incrementally for files > 200 lines** — Shell first, then content sections, then closing. Prevents truncation.

8. **Self-verify after writing** — Read back every file, check JSON validity, no truncation, no placeholders.

9. **Every entity needs source_features[]** — No orphan entities without feature provenance.

10. **Every endpoint needs related_entity AND source_features[]** — Endpoints must reference an entity AND trace back to features.

11. **Must-have gaps are BLOCKING** — Flag prominently in proposal, but still generate all files. Do NOT abort.

12. **Client-only apps: api-design.json uses storage_operations** — No REST endpoints, no auth middleware, no server routes.

13. **Always spawn sub-agents** — Do NOT attempt to do all work in the Lead session. Each agent MUST be spawned as a separate sub-agent via `Agent()` with its template file as prompt. No single-session fallback.

14. **File size guardrails:**
    - entities.json: Always monolithic. No split.
    - api-design.json:
      IF complexity_tier == "complex" → ALWAYS split by domain_group (see Split Schema below)
      IF complexity_tier == "medium" AND file > 800 lines → split by domain_group
      IF complexity_tier == "simple" → keep monolithic
    - architecture.json > 500 → move seed_data to separate seed-data.json
    - technical-proposal.json target <150 lines (it's an index)

15. **Spawn sub-agents via Agent tool** — Lead READS `.claude/agents/{name}.md` and passes content VERBATIM as Agent prompt. Every Agent call MUST include: `prompt: {file content}`, `subagent_type: "general-purpose"`, `run_in_background: true`. No `team_name`, no `name` parameter. No interpretation, no paraphrasing, no summarizing of the agent template content.

16. **Agents write FINAL files to .claude/proposal/ directly** — No draft files in the main output directory. Only _shared-context.json, _prototype-summary.json, and _feedback-*.json go in drafts/.

17. **Feedback files go to .claude/proposal/drafts/_feedback-{source}.json** — Downstream agents write these when they find critical issues in upstream outputs.

18. **Max 1 re-run per agent via feedback** — Prevents infinite loops. If re-run doesn't fix the issue, note it in validation_notes and continue.

19. **T-INTEGRATE always runs** — Even simple projects produce a minimal integration-map.json (with empty cross_domain_flows and coverage analysis).

20. **key_signals drive consistency** — All agents read key_signals from _shared-context.json. If offline_first is true, ALL agents must make offline-compatible decisions (no JWT, use Dexie, local-first auth).

21. **T-VALIDATE runs at every checkpoint** — V1 after Layer 1, V2 after Layer 2, V3 after T-INTEGRATE. Lead MUST read the validation report before proceeding to the next layer. If `blocking == true`, stop the pipeline.

22. **Completion notifications are the PRIMARY coordination signal** — The system auto-delivers a notification when each background sub-agent finishes. File-existence check is SECONDARY verification performed after notification is received. Do NOT poll for files in a loop.

23. **Max 1 retry per agent spawn** — If an agent completes without producing its expected output file, re-spawn it once. If the second attempt also fails to produce the file, treat as BLOCKING error.

24. **Global timeout: 5 minutes per layer** — If no completion notification is received within 5 minutes of spawning a layer's agents, treat as BLOCKING error. This prevents infinite waits if a notification is delayed or lost.

---

## api-design.json Split Schema

Split is MANDATORY for complex projects and triggered by size for medium projects.
Endpoints are list-based with no cross-domain structural references, so split is natural.

```
api-design.json (INDEX): {
  version, base_path, auth, domain_index,
  file_map: {
    "orders": { "file": ".claude/proposal/api-design-orders.json", "endpoint_count": N },
    "inventory": { "file": ".claude/proposal/api-design-inventory.json", "endpoint_count": N }
  },
  summary, decisions_requiring_approval
}
api-design-{group}.json (SPLIT FILE): { domain, endpoints[], summary }
```

Split gives each domain agent template more room. V2 testing showed split produced
71 endpoints vs monolithic's 65 — the per-domain focus leads to better coverage.

---

## Teammate File Reference

| File | Teammate | Purpose | Outputs |
|------|----------|---------|---------|
| `.claude/agents/t-entity.md` | T-ENTITY | Entity extraction (7-step algorithm) | `entities.json` |
| `.claude/agents/t-api.md` | T-API | API design (reads entities + tech-stack) | `api-design.json` |
| `.claude/agents/t-system.md` | T-SYSTEM | Tech stack + architecture decisions | `tech-stack.json`, `architecture.json` |
| `.claude/agents/t-integrate.md` | T-INTEGRATE | 14-check validation + integration map + coverage | `integration-map.json` |
| `.claude/agents/t-proto-extract.md` | T-PROTO-EXTRACT | Prototype data extraction (conditional) | `_prototype-summary.json` |
| `.claude/agents/t-validate.md` | T-VALIDATE | 3-checkpoint validation + fix | `_validation-report-v{N}.json` |

All agent templates are pre-deployed in `.claude/agents/`. The Lead reads each file and spawns
an Agent with the exact file content as the prompt. Agents are self-contained — they read
shared context for paths, key_signals, and classification, then read BA files directly for data.
