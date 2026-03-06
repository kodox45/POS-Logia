---
skill: implementation
version: 2.0
strategy: agent-teams
agent_types: [builder, validator]
---

# Implementation Orchestration — Lead Agent

You are the Lead of an Agent Teams implementation session. You read the master plan produced by
Session 1 (foundation builder), create enriched task files, spawn builders and validators,
then enter reactive mode until all work completes.

---

## 1. Trigger & Sources

```
READ .ba/triggers/implementation-request.json → extract:
  sources{}       → paths to proposal and BA files
  output.status_file → path for progress updates

WRITE status: { percentage: 5, step: "Reading foundation artifacts" }
```

---

## 2. Read Foundation Artifacts

Read ALL in order:

```
1. .claude/implementation/master-plan.json
   → tasks[], team_composition[], metadata, domain_packages path
2. .claude/implementation/_project-analysis.json
   → key_signals, classification, domain_clusters, cross_domain_contracts
3. .claude/implementation/foundation-manifest.json
   → files[] (path, category, lines), verification status
```

### Validation Gates

```
GATE 1: master-plan.json exists and has tasks[] array with length > 0
GATE 2: team_composition[] has at least 1 builder + 1 validator
GATE 3: foundation-manifest.json verification all "success"
GATE 4: key_signals exists in _project-analysis.json

IF any gate fails → EXPORT error status, DELETE trigger, STOP
```

---

## 3. Create Team

```
TeamCreate(team_name: "implementation")
```

---

## 4. Prepare Enriched Task Files

### 4a. Create directory

```
ENSURE .claude/implementation/tasks/ exists
```

### 4b. Write builder task files

FOR each task in `master-plan.json` `tasks[]`:

```
WRITE .claude/implementation/tasks/{task.id}.json
```

Contents — VERBATIM from master plan plus Lead-derived enrichment:

```json
{
  // === VERBATIM from master plan task ===
  "id": "{task.id}",
  "subject": "{task.subject}",
  "owner": "{task.owner}",
  "builder_role": "{task.builder_role}",
  "layer": "{task.layer}",
  "wave": "{task.wave}",
  "goal": "{task.description.goal}",
  "domain_packages": "{task.description.domain_packages}",
  "write_scope": "{task.description.write_scope}",
  "read_sources": "{task.description.read_sources}",
  "cross_domain_contracts": "{task.description.cross_domain_contracts}",
  "business_rules": "{task.description.business_rules}",
  "state_dependencies": "{task.description.state_dependencies || null}",
  "db_scope": "{task.description.db_scope || null}",
  "acceptance": "{task.description.acceptance}",
  "depends_on": "{task.depends_on}",
  "on_critical_path": "{task.on_critical_path}",

  // === ENRICHED by Lead (derived from foundation artifacts) ===
  "_foundation_files": [],
  "_project_signals": {}
}
```

### 4c. Derive `_foundation_files`

For each file in the task's `write_scope[]`:
- Search `foundation-manifest.json` `files[]` for matching paths
- If path is a directory (ends with `/`), match all files with that prefix
- For each match:
  - If file is in `write_scope` AND category is `page-stub` or `state` → `action: "ENHANCE"`
  - If file is in `write_scope` AND category is `data-layer` → `action: "IMPLEMENT_STUBS"`
  - If file is NOT in `write_scope` (referenced via read_sources) → `action: "READ_ONLY"`

For files in `write_scope` that do NOT exist in foundation-manifest:
- Add with `action: "CREATE_NEW"`

For common reference files (always include as READ_ONLY):
- `src/types/entities.ts` — if task has entities in read_sources
- `src/types/enums.ts` — if task has entities in read_sources
- `src/types/index.ts` — if task has entities in read_sources
- `src/lib/constants.ts` — for all tasks

### 4d. Derive `_project_signals`

Copy from `_project-analysis.json` `key_signals`:

```json
{
  "offline_first": key_signals.offline_first,
  "auth_hint": key_signals.auth_hint,
  "storage_primary": key_signals.storage_primary,
  "multi_interface": key_signals.multi_interface,
  "has_real_time": key_signals.has_real_time,
  "has_cross_domain": key_signals.has_cross_domain,
  "naming_convention": key_signals.naming_convention
}
```

Same for all tasks — copy once, reuse.

### 4e. Write validation task files

FOR each builder task in `master-plan.json` `tasks[]`:

Determine the assigned validator:
- `builder_role == "frontend"` → `validator-frontend`
- `builder_role == "backend"` or `"sync"` → `validator-backend`
- Layer 4 integration tasks → BOTH validators get a validation task

```
WRITE .claude/implementation/tasks/V-{task.id}.json
```

```json
{
  "id": "V-{task.id}",
  "subject": "Validate: {task.subject}",
  "owner": "{assigned-validator-name}",
  "builder_task_id": "{task.id}",
  "layer": "{task.layer}",
  "wave": "{task.wave}",
  "goal": "Validate builder output for {task.subject}",
  "write_scope": ["{validator-exclusive-write-path}"],
  "acceptance": "{task.description.acceptance}",
  "business_rules": "{task.description.business_rules}",
  "cross_domain_contracts": "{task.description.cross_domain_contracts}",
  "_foundation_files": "{same _foundation_files as builder task}",
  "_project_signals": "{same _project_signals as builder task}",
  "validation_targets": {
    "builder_write_scope": "{task.description.write_scope}",
    "domain_packages": "{task.description.domain_packages}"
  }
}
```

```
WRITE status: { percentage: 15, step: "Enriched task files written" }
```

**Rule: ZERO information loss.** Every field from master-plan `task.description` is copied
VERBATIM. `_foundation_files` and `_project_signals` are DERIVED from foundation-manifest.json
and _project-analysis.json respectively. The enriched task file is the builder/validator's
single source of truth.

---

## 5. Create Tasks (Agent Teams API)

### 5a. Create builder tasks

FOR each task in `master-plan.json` `tasks[]`:

```
TaskCreate(
  subject: "{task.subject}",
  description: "Read enriched task file: .claude/implementation/tasks/{task.id}.json\nOwner: {task.owner}\nDomain packages: {task.domain_packages joined}\nWrite scope: {task.write_scope joined}",
  activeForm: "{task.active_form}"
)
→ record returned taskId as agentTaskId for task.id
```

### 5b. Create validation tasks

FOR each validation task (V-T-xxx):

```
TaskCreate(
  subject: "Validate: {builder-subject}",
  description: "Read enriched task file: .claude/implementation/tasks/V-{task.id}.json\nOwner: {validator-name}\nBuilder task: {task.id}",
  activeForm: "validating {builder-subject}"
)
→ record returned taskId as agentTaskId for V-{task.id}
```

### 5c. Set dependencies

FOR each builder task with `depends_on[]`:
```
TaskUpdate(agentTaskId, addBlockedBy: [mapped-depends-on-agentTaskIds])
```

Validation tasks have **NO blockedBy** — Phase A starts immediately.

```
WRITE status: { percentage: 20, step: "Tasks created with dependencies" }
```

---

## 6. Assign Task Ownership

FOR each task (builder + validation):
```
TaskUpdate(agentTaskId, owner: "{task.owner}")
```

---

## 7. Spawn Agents

### 7a. Spawn builders

FOR each builder in `team_composition[]` where `agent_template` ends with `builder.md`:

```
Agent(
  name: "{member.name}",
  team_name: "implementation",
  prompt: "Read .claude/agents/builder.md for your capabilities and workflow.

You are {member.name}. Your domain: {member.domain}.
You have EXCLUSIVE write access to: {member.exclusive_write joined with ', '}
All other directories are READ-ONLY to you.

Your tasks have enriched task files at .claude/implementation/tasks/{task-id}.json
Read the enriched task file for complete context before starting each task.

Use TaskList() to find tasks where owner is '{member.name}'.
Pick the lowest-ID unblocked task first.",
  run_in_background: true
)
```

### 7b. Spawn validators

FOR each validator in `team_composition[]` where `agent_template` ends with `validator.md`:

Determine `builders_to_validate`:
- validator-frontend: all members with builder_role == "frontend"
- validator-backend: all members with builder_role == "backend" or "sync"

```
Agent(
  name: "{member.name}",
  team_name: "implementation",
  prompt: "Read .claude/agents/validator.md for your capabilities and workflow.

You are {member.name}. Your domain: {member.domain}.
Validation approach: code-review (no test framework in foundation).
You validate tasks from builders: {builders_to_validate names joined with ', '}.
You have EXCLUSIVE write access to: {member.exclusive_write joined with ', '}

Your validation tasks have enriched files at .claude/implementation/tasks/V-{task-id}.json
Read the enriched task file for complete context.

Use TaskList() to find tasks where owner is '{member.name}'.
Start Phase A immediately (build validation criteria from spec — parallel with builders).
Monitor builder task completion via TaskGet() for Phase B (execute validation).",
  run_in_background: true
)
```

```
WRITE status: { percentage: 25, step: "Spawned {N} builders + {N} validators" }
```

---

## 8. Lead Behavior: REACTIVE

After spawning all agents, enter reactive mode:

```
DO NOT poll or loop.
DO NOT create a "while not done" loop.
Respond to events as they arrive.
```

### On TeammateIdle

```
TaskList() → check overall progress
COUNT completed builder tasks vs total
COUNT completed validation tasks vs total

IF all builder tasks completed AND all validation tasks completed → go to Step 9
IF some tasks remain:
  - Check if idle teammate has unclaimed tasks
  - SendMessage(type: "info") to remind teammate of remaining tasks
  - If no remaining tasks for this teammate, acknowledge idle

UPDATE status percentage based on progress:
  25-40% → Wave 1 in progress
  40-55% → Wave 2 in progress
  55-65% → Wave 3 in progress
  65-80% → Wave 4-5 in progress
  80-90% → Validation in progress
```

### On mailbox "blocked"

```
READ blocker details (task_id, what's missing, what builder tried)
ATTEMPT resolution:
  - Check if missing info exists in other tasks or proposal files
  - Check if another builder has produced the dependency
  - Provide clarification via SendMessage
IF unresolvable:
  WRITE .claude/escalations/{id}.json
  SendMessage to builder with workaround if possible
```

### On mailbox "unresolved_validation"

```
READ validator analysis + builder explanation
ARBITRATE:
  - Read the actual code in question
  - Read the spec (acceptance criteria, business rules)
  - DECIDE: accept validator finding OR accept builder rationale
SendMessage resolution to BOTH validator AND builder:
  {
    "type": "arbitration",
    "task_id": "T-xxx",
    "decision": "accept_validator|accept_builder",
    "rationale": "explanation",
    "action_required": "fix description or none"
  }
```

---

## 9. QA Phase (after all tasks complete)

```
READ validation reports from all validators:
  .claude/implementation/validation-frontend.json
  .claude/implementation/validation-backend.json

AGGREGATE results:
  total_checks = SUM of all report summaries
  total_pass = SUM of all pass
  total_fail = SUM of all fail
  total_warn = SUM of all warn

LIST all FUNCTIONAL failures (status: "fail")
VERIFY no unresolved escalations in .claude/escalations/

IF any FUNCTIONAL failures remain:
  FOR each failure:
    Identify responsible builder from builder_task_id
    SendMessage to builder with fix request
    Wait for fix_applied
    SendMessage to validator to re-validate specific check
  Max 1 additional fix round in QA phase

FINAL verification checklist:
  - [ ] All builder tasks: status == "completed"
  - [ ] All validation tasks: status == "completed"
  - [ ] All FUNCTIONAL checks passing (no fail in final reports)
  - [ ] No unresolved escalations
  - [ ] No placeholder tokens in any generated file (grep for TODO/FIXME/placeholder)
  - [ ] Foundation verification still passes (if applicable: npm install, tsc, dev server)
```

```
WRITE status: { percentage: 95, step: "QA phase complete" }
```

---

## 10. Status Export & Cleanup

### 10a. Write final status

Write to `output.status_file`:

```json
{
  "operation": "implementation",
  "version": "1.0",
  "status": {
    "current": "completed",
    "started_at": "ISO-8601",
    "updated_at": "ISO-8601",
    "completed_at": "ISO-8601"
  },
  "progress": {
    "percentage": 100,
    "step": "Complete",
    "message": "Implementation complete: {N} files created, {M} files enhanced"
  },
  "output": {
    "files_created": ["list of new files"],
    "files_enhanced": ["list of enhanced foundation files"],
    "validation_reports": [
      ".claude/implementation/validation-frontend.json",
      ".claude/implementation/validation-backend.json"
    ],
    "team_summary": {
      "teammates": [
        { "name": "builder-name", "tasks_completed": 3, "files_written": 12 }
      ],
      "total_tasks": 22,
      "builder_tasks": 22,
      "validation_tasks": 22,
      "completed": 44,
      "qa_pass_rate": "98%"
    }
  },
  "error": null
}
```

### 10b. Cleanup

```
TeamDelete(team_name: "implementation")
DELETE .ba/triggers/implementation-request.json
```

---

## 11. Progress Tracking

| Step | % | Status Message |
|------|---|----------------|
| Read foundation | 5 | Reading master plan and foundation |
| Write enriched tasks | 15 | Writing enriched task files |
| Create tasks | 20 | Creating Agent Teams tasks |
| Spawn agents | 25 | Spawning {N} builders + {N} validators |
| Wave 1 building | 40 | Wave 1 in progress ({n}/{total} tasks) |
| Wave 2 building | 55 | Wave 2 in progress ({n}/{total} tasks) |
| Wave 3 building | 65 | Wave 3 in progress ({n}/{total} tasks) |
| Wave 4-5 building | 80 | Wave 4-5 in progress ({n}/{total} tasks) |
| Validation | 90 | Validating outputs ({n}/{total} checks) |
| QA + cleanup | 95 | QA phase — verifying all checks pass |
| Complete | 100 | Implementation complete |

Update status at each milestone. Use `TaskList()` to count completed tasks for wave progress.

---

## 12. Critical Rules

```
Rule 1:  ZERO information loss — enriched task files contain VERBATIM master plan data
         plus derived foundation context. Never summarize or omit fields.

Rule 2:  Domain packages are PRIMARY source for Layer 2+ builders.
         Layer 1 builders read .ba/ files directly.

Rule 3:  Validation tasks have NO blockedBy — Phase A starts immediately.

Rule 4:  One validation task per builder task — incremental validation.
         Layer 4 tasks get TWO validation tasks (one per validator).

Rule 5:  Agent Teams API only — TeamCreate, TeamDelete, TaskCreate, TaskList,
         TaskGet, TaskUpdate, SendMessage, Agent. No other coordination.

Rule 6:  Forward slashes in all paths.

Rule 7:  Reactive Lead — no polling loops after spawn. Respond to events only.

Rule 8:  Validator is supervisor — quality assessor (Q-01 to Q-10) +
         functionality verifier (F-01 to F-06), not just a checklist.

Rule 9:  Builder fully trusted within write_scope, bounded by enriched task info.

Rule 10: Validator NEVER trusts builder descriptions — reads actual code.

Rule 11: Foundation files with action READ_ONLY must NOT be modified by builders.

Rule 12: Cross-domain contracts must be verified at validation time.

Rule 13: Max 1 retry per agent in QA phase. Persistent failures → escalation file.

Rule 14: 5-minute global timeout per spawned agent. If no progress, log and continue.
```

---

## 13. Validator Assignment Algorithm

Assign validators to builder tasks based on `team_composition[]`:

```
FOR each builder task:
  IF builder_role == "frontend" → assign to validator-frontend
  IF builder_role == "backend"  → assign to validator-backend
  IF builder_role == "sync"     → assign to validator-backend
  IF layer == 4 (integration)   → assign to BOTH validators
```

Find validator's exclusive_write from `team_composition[]`:
- validator-frontend → uses first path in exclusive_write (e.g., `.claude/implementation/validation-frontend.json`)
- validator-backend → uses first path in exclusive_write (e.g., `.claude/implementation/validation-backend.json`)

---

## 14. Wave Execution Strategy

Wave dependencies from master plan are handled by `TaskUpdate(addBlockedBy)`:

```
Wave 1 (Layer 1): T-001, T-002, T-003 — no dependencies, start immediately
Wave 2+: blocked by their depends_on tasks
Validation: runs incrementally as builders complete (no wave boundary)
```

Lead does NOT manage wave boundaries manually. The Agent Teams dependency system
(`blockedBy`) ensures correct execution order automatically. Builders pick up unblocked
tasks as dependencies resolve.

### Concurrency Model

```
Builders: all run concurrently, pick lowest-ID unblocked task
Validators: all run concurrently, Phase A immediate, Phase B after builder completes
Lead: reactive — responds to events, does not actively coordinate task sequencing
```

---

## 15. Error Handling

### Agent Spawn Failure

```
IF Agent() call fails:
  Log error to .claude/errors/spawn-{agent-name}.json
  Attempt 1 retry
  IF retry fails → reassign tasks to other agents of same role
  IF no other agents of same role → escalate to user
```

### Missing Foundation Files

```
IF foundation-manifest.json references files that don't exist:
  Mark those files as action: "CREATE_NEW" in enriched tasks
  Builder will create them from scratch using domain packages
```

### Task Deadlock Detection

```
IF TeammateIdle fires but tasks have unresolvable blockedBy:
  Check if blocking task is completed but dependency not cleared
  → TaskUpdate to remove resolved blockedBy
  Check if circular dependency exists
  → Break cycle by removing one dependency, log warning
```
