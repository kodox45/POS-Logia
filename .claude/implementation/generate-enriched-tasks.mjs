import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE = process.cwd();
const masterPlan = JSON.parse(readFileSync(join(BASE, '.claude/implementation/master-plan.json'), 'utf8'));
const projectAnalysis = JSON.parse(readFileSync(join(BASE, '.claude/implementation/_project-analysis.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(BASE, '.claude/implementation/foundation-manifest.json'), 'utf8'));

const tasksDir = join(BASE, '.claude/implementation/tasks');
mkdirSync(tasksDir, { recursive: true });

const projectSignals = {
  offline_first: projectAnalysis.key_signals.offline_first,
  auth_hint: projectAnalysis.key_signals.auth_hint,
  storage_primary: projectAnalysis.key_signals.storage_primary,
  multi_interface: projectAnalysis.key_signals.multi_interface,
  has_real_time: projectAnalysis.key_signals.has_real_time,
  has_cross_domain: projectAnalysis.key_signals.has_cross_domain,
  naming_convention: projectAnalysis.key_signals.naming_convention
};

function deriveFoundationFiles(task) {
  const files = [];
  const writeScope = task.description.write_scope || [];

  for (const mFile of manifest.files) {
    let inWriteScope = false;
    for (const scope of writeScope) {
      if (scope.endsWith('/')) {
        if (mFile.path.startsWith(scope)) inWriteScope = true;
      } else {
        if (mFile.path === scope) inWriteScope = true;
      }
    }

    if (inWriteScope) {
      const action = mFile.category === 'data-layer' ? 'IMPLEMENT_STUBS'
        : (mFile.category === 'page-stub' || mFile.category === 'state') ? 'ENHANCE'
        : 'ENHANCE';
      files.push({ path: mFile.path, category: mFile.category, lines: mFile.lines, action });
    }
  }

  for (const scope of writeScope) {
    if (!scope.endsWith('/')) {
      const exists = manifest.files.some(f => f.path === scope);
      if (!exists) {
        files.push({ path: scope, category: 'new', lines: 0, action: 'CREATE_NEW' });
      }
    }
  }

  const rs = task.description.read_sources || {};
  const hasEntities = rs.entities && rs.entities.length > 0;
  if (hasEntities) {
    for (const tp of ['src/types/entities.ts', 'src/types/enums.ts', 'src/types/index.ts']) {
      if (!files.some(f => f.path === tp)) {
        const mf = manifest.files.find(f => f.path === tp);
        if (mf) files.push({ path: tp, category: mf.category, lines: mf.lines, action: 'READ_ONLY' });
      }
    }
  }

  if (!files.some(f => f.path === 'src/lib/constants.ts')) {
    const mf = manifest.files.find(f => f.path === 'src/lib/constants.ts');
    if (mf) files.push({ path: mf.path, category: mf.category, lines: mf.lines, action: 'READ_ONLY' });
  }

  return files;
}

let builderCount = 0;
let validationCount = 0;

for (const task of masterPlan.tasks) {
  const enriched = {
    id: task.id,
    subject: task.subject,
    owner: task.owner,
    builder_role: task.builder_role,
    layer: task.layer,
    wave: task.wave,
    goal: task.description.goal,
    domain_packages: task.description.domain_packages,
    write_scope: task.description.write_scope,
    read_sources: task.description.read_sources,
    cross_domain_contracts: task.description.cross_domain_contracts,
    business_rules: task.description.business_rules,
    state_dependencies: task.description.state_dependencies || null,
    db_scope: task.description.db_scope || null,
    acceptance: task.description.acceptance,
    depends_on: task.depends_on,
    on_critical_path: task.on_critical_path,
    _foundation_files: deriveFoundationFiles(task),
    _project_signals: projectSignals
  };
  writeFileSync(join(tasksDir, `${task.id}.json`), JSON.stringify(enriched, null, 2));
  builderCount++;
}

const builderTasks = masterPlan.tasks.filter(t => t.builder_role !== null);

for (const task of builderTasks) {
  const isFrontend = task.builder_role === 'frontend';
  const assignedValidator = isFrontend ? 'validator-frontend' : 'validator-backend';
  const validatorWritePath = isFrontend
    ? '.claude/implementation/validation-frontend.json'
    : '.claude/implementation/validation-backend.json';

  const validationTask = {
    id: `V-${task.id}`,
    subject: `Validate: ${task.subject}`,
    owner: assignedValidator,
    builder_task_id: task.id,
    layer: task.layer,
    wave: task.wave,
    goal: `Validate builder output for ${task.subject}`,
    write_scope: [validatorWritePath],
    acceptance: task.description.acceptance,
    business_rules: task.description.business_rules,
    cross_domain_contracts: task.description.cross_domain_contracts,
    _foundation_files: deriveFoundationFiles(task),
    _project_signals: projectSignals,
    validation_targets: {
      builder_write_scope: task.description.write_scope,
      domain_packages: task.description.domain_packages
    }
  };
  writeFileSync(join(tasksDir, `V-${task.id}.json`), JSON.stringify(validationTask, null, 2));
  validationCount++;

  if (task.layer === 4) {
    const otherValidator = isFrontend ? 'validator-backend' : 'validator-frontend';
    const otherWritePath = isFrontend
      ? '.claude/implementation/validation-backend.json'
      : '.claude/implementation/validation-frontend.json';
    const otherTask = { ...validationTask, id: `V2-${task.id}`, owner: otherValidator, write_scope: [otherWritePath] };
    writeFileSync(join(tasksDir, `V2-${task.id}.json`), JSON.stringify(otherTask, null, 2));
    validationCount++;
  }
}

console.log(`Generated ${builderCount} enriched task files`);
console.log(`Generated ${validationCount} validation task files`);
console.log('Total: ' + (builderCount + validationCount) + ' files');
