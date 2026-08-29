#!/usr/bin/env node
// Validates every SDD JSON registry against its strict schema in sdd/schemas/
// plus cross-registry consistency rules. Run with: pnpm sdd:validate
// Exits non-zero on any error so it can gate CI or a pre-commit hook.
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SDD = resolve(__dirname, '..');
const REPO = resolve(SDD, '..');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);
const warnings = [];
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const compiledCache = new Map();
function compiled(schemaFile) {
  if (!compiledCache.has(schemaFile)) {
    compiledCache.set(
      schemaFile,
      ajv.compile(loadJson(join(SDD, 'schemas', schemaFile))),
    );
  }
  return compiledCache.get(schemaFile);
}

function validate(dataPath, schemaFile) {
  const abs = join(SDD, dataPath);
  if (!existsSync(abs)) {
    fail(dataPath, 'file not found');
    return null;
  }
  let data;
  try {
    data = loadJson(abs);
  } catch (e) {
    fail(dataPath, `invalid JSON: ${e.message}`);
    return null;
  }
  const validateFn = compiled(schemaFile);
  if (!validateFn(data)) {
    for (const err of validateFn.errors) {
      fail(dataPath, `${err.instancePath || '/'} ${err.message}`);
    }
  }
  return data;
}

// ---- 1. Schema validation of every registry ----
const tasksIndex = validate('tasks.json', 'tasks-index.schema.json');
const globalJson = validate('global.json', 'global.schema.json');
const specsIndex = validate('specs/index.json', 'specs-index.schema.json');
const fixesJson = validate('fixes.json', 'fixes.schema.json');
validate('api.json', 'api.schema.json');
validate('schema.json', 'db-schema.schema.json');
validate('components.json', 'components.schema.json');

const cycleFiles = [];
const cycleTasksFiles = [];
for (const spec of readdirSync(join(SDD, 'specs'), { withFileTypes: true })) {
  if (!spec.isDirectory() || !spec.name.startsWith('spec-')) continue;
  const cyclesDir = join(SDD, 'specs', spec.name, 'cycles');
  if (!existsSync(cyclesDir)) continue;
  for (const cyc of readdirSync(cyclesDir)) {
    if (!/^cycle-\d{2}$/.test(cyc)) continue;
    const base = `specs/${spec.name}/cycles/${cyc}`;
    if (existsSync(join(SDD, base, 'cycle.json')))
      cycleFiles.push(`${base}/cycle.json`);
    if (existsSync(join(SDD, base, 'tasks.json')))
      cycleTasksFiles.push(`${base}/tasks.json`);
  }
}
const cycles = new Map(
  cycleFiles.map((f) => [f, validate(f, 'cycle.schema.json')]),
);
const cycleTasks = new Map(
  cycleTasksFiles.map((f) => [f, validate(f, 'cycle-tasks.schema.json')]),
);

// ---- 2. Per-cycle task rules ----
for (const [file, ct] of cycleTasks) {
  if (!ct) continue;
  const ids = new Set();
  for (const t of ct.tasks) {
    if (ids.has(t.id)) fail(file, `duplicate task id ${t.id}`);
    ids.add(t.id);
  }
  for (const t of ct.tasks) {
    for (const dep of t.depends_on) {
      if (!ids.has(dep)) fail(file, `${t.id} depends_on unknown task ${dep}`);
    }
    if (t.user_stories.length === 0 && ct.flow !== 'reduced') {
      fail(file, `${t.id} has empty user_stories but flow is not "reduced"`);
    }
  }
}

// ---- 3. Index ↔ per-cycle consistency (regeneration check) ----
try {
  execFileSync(
    'node',
    [join(__dirname, 'rebuild-tasks-index.mjs'), '--check'],
    {
      stdio: 'pipe',
    },
  );
} catch {
  fail(
    'tasks.json',
    'index is stale vs per-cycle files (run pnpm sdd:rebuild-tasks-index)',
  );
}

// ---- 4. specs/index.json ↔ filesystem ↔ global.json ↔ cycle.json ----
if (specsIndex && globalJson) {
  const completedModules = new Map(
    globalJson.completed_modules.map((m) => [m.spec, m]),
  );
  for (const s of specsIndex.specs) {
    if (!existsSync(join(REPO, s.folder)))
      fail('specs/index.json', `${s.id}: folder does not exist`);
    if (!existsSync(join(REPO, s.file)))
      fail('specs/index.json', `${s.id}: spec file does not exist (${s.file})`);
    if (s.status === 'completed' && !s.completed_at)
      fail('specs/index.json', `${s.id}: completed without completed_at`);
    if (s.status === 'in-progress' && s.completed_at)
      fail('specs/index.json', `${s.id}: in-progress with completed_at set`);
    if (s.status === 'completed' && !completedModules.has(s.id))
      fail(
        'specs/index.json',
        `${s.id}: completed but missing in global.json completed_modules`,
      );
    for (const dep of s.depends_on) {
      if (!specsIndex.specs.some((x) => x.id === dep))
        fail('specs/index.json', `${s.id}: depends_on unknown spec ${dep}`);
    }
  }
  for (const spec of completedModules.keys()) {
    const entry = specsIndex.specs.find((x) => x.id === spec);
    if (!entry)
      fail(
        'global.json',
        `completed module ${spec} not registered in specs/index.json`,
      );
    else if (entry.status !== 'completed')
      fail(
        'global.json',
        `module ${spec} completed in global.json but "${entry.status}" in specs/index.json`,
      );
  }
}

// ---- 5. cycle.json rules ----
const cyclesWithoutTelemetry = [];
const cyclesWithoutProvider = [];
for (const [file, c] of cycles) {
  if (!c) continue;
  if (c.status === 'completed') {
    if (!c.completed_at) fail(file, 'completed without completed_at');
    if (!c.reviewer_report) fail(file, 'completed without reviewer_report');
    if (c.metrics) {
      // A skipped task is resolved (not applicable), not pending. Records written
      // before tasks_skipped existed have no skipped tasks, so ?? 0 leaves their
      // arithmetic exactly as it was.
      const resolved = c.metrics.tasks_completed + (c.metrics.tasks_skipped ?? 0);
      if (resolved < c.metrics.tasks_total)
        fail(
          file,
          `completed with ${resolved}/${c.metrics.tasks_total} tasks resolved (done + skipped)`,
        );
      if (resolved > c.metrics.tasks_total)
        warn(
          file,
          `tasks_completed + tasks_skipped (${resolved}) exceeds tasks_total (${c.metrics.tasks_total})`,
        );
    }
    // Outside the metrics guard on purpose: a cycle closed with metrics: null has no
    // telemetry either, and that is exactly what this warning is for.
    const usage = c.metrics?.usage;
    if (!usage) cyclesWithoutTelemetry.push(file);
    else if (!usage.by_tier || Object.keys(usage.by_tier).length === 0)
      cyclesWithoutProvider.push(file);
  }
  for (const doc of Object.values(c.documents)) {
    if (!existsSync(join(REPO, doc)))
      fail(file, `documents entry does not exist: ${doc}`);
  }
  for (const art of c.artifacts) {
    if (!existsSync(join(REPO, art)))
      fail(file, `artifact does not exist: ${art}`);
  }
}

// Telemetry is mandatory in the protocol but never a hard error here: cycles closed
// before the field existed must keep validating green. Aggregated so an old repo gets
// one line instead of a wall.
const sample = (files) =>
  files.slice(0, 3).join(', ') + (files.length > 3 ? `, +${files.length - 3} more` : '');
if (cyclesWithoutTelemetry.length)
  warn(
    'cycle.json',
    `${cyclesWithoutTelemetry.length} completed cycle(s) without metrics.usage — record tokens + by_tier at close; with no counter available declare an estimate with approx: true (${sample(cyclesWithoutTelemetry)})`,
  );
if (cyclesWithoutProvider.length)
  warn(
    'cycle.json',
    `${cyclesWithoutProvider.length} completed cycle(s) with metrics.usage but no by_tier — declare the model as provider/model, e.g. copilot/claude-sonnet (${sample(cyclesWithoutProvider)})`,
  );

// A cycle that closed with skipped tasks must say so in metrics.tasks_skipped, or the
// Costs/Tasks views read those tasks as pending.
for (const [file, ct] of cycleTasks) {
  if (!ct) continue;
  const skipped = ct.tasks.filter((t) => t.status === 'skipped').length;
  if (skipped === 0) continue;
  const cycleFile = file.replace(/tasks\.json$/, 'cycle.json');
  const cycle = cycles.get(cycleFile);
  if (!cycle || cycle.status !== 'completed' || !cycle.metrics) continue;
  if ((cycle.metrics.tasks_skipped ?? 0) !== skipped)
    warn(
      cycleFile,
      `tasks.json has ${skipped} skipped task(s) but metrics.tasks_skipped is ${cycle.metrics.tasks_skipped ?? 0}`,
    );
}

// ---- 6. fixes.json rules ----
if (fixesJson) {
  const ids = new Set();
  for (const f of fixesJson.fixes) {
    if (ids.has(f.id)) fail('fixes.json', `duplicate fix id ${f.id}`);
    ids.add(f.id);
    if (!existsSync(join(REPO, f.fix_document)))
      fail(
        'fixes.json',
        `${f.id}: fix_document does not exist (${f.fix_document})`,
      );
    if (
      ['implemented', 'validated', 'absorbed'].includes(f.status) &&
      !f.resolved_at
    )
      fail('fixes.json', `${f.id}: status ${f.status} without resolved_at`);
  }
}

// ---- 7. Cycle root whitelist (6 allowed files) ----
const ALLOWED = new Set([
  'brief.yaml',
  'functional.md',
  'planner.md',
  'architect.md',
  'cycle.json',
  'tasks.json',
  'artifacts',
]);
for (const spec of readdirSync(join(SDD, 'specs'), { withFileTypes: true })) {
  if (!spec.isDirectory() || !spec.name.startsWith('spec-')) continue;
  const cyclesDir = join(SDD, 'specs', spec.name, 'cycles');
  if (!existsSync(cyclesDir)) continue;
  for (const cyc of readdirSync(cyclesDir)) {
    if (!/^cycle-\d{2}$/.test(cyc)) continue;
    for (const entry of readdirSync(join(cyclesDir, cyc))) {
      if (!ALLOWED.has(entry))
        fail(
          `specs/${spec.name}/cycles/${cyc}`,
          `disallowed file in cycle root: ${entry} (move to artifacts/)`,
        );
    }
  }
}

// ---- 8. CONTEXTO GATE: additive fragment name format + consolidation threshold ----
const CONTEXT_CATEGORIES = ['apps', 'libs', 'tools'];
const CYCLE_FRAGMENT_RE = /^\d{4}-\d{2}-\d{2}-spec-[a-z0-9-]+-cycle-\d{2}\.md$/;
const FIX_FRAGMENT_RE = /^\d{4}-\d{2}-\d{2}-fix-[a-z0-9-]+\.md$/;
const CONSOLIDATION_THRESHOLD = 5;

function updatesDir(category, name) {
  return join(SDD, 'context', category, name, 'updates');
}

// Consolidation legitimately deletes fragments, so a completed cycle is also satisfied by a
// subproject context consolidated at/after the cycle's completion date.
function consolidatedSince(category, name, completedAt) {
  if (!completedAt) return false;
  const promptPath = join(SDD, 'context', category, name, 'context_prompt.md');
  if (!existsSync(promptPath)) return false;
  const header = /actualizaci[oó]n:.*Fecha:\s*(\d{4}-\d{2}-\d{2})/i.exec(
    readFileSync(promptPath, 'utf8'),
  );
  return header !== null && header[1] >= completedAt;
}

for (const category of CONTEXT_CATEGORIES) {
  const categoryDir = join(SDD, 'context', category);
  if (!existsSync(categoryDir)) continue;
  for (const proj of readdirSync(categoryDir, { withFileTypes: true })) {
    if (!proj.isDirectory()) continue;
    const dir = updatesDir(category, proj.name);
    if (!existsSync(dir)) continue;
    const label = `context/${category}/${proj.name}/updates`;
    const fragments = readdirSync(dir).filter((f) => f !== '.gitkeep');
    for (const entry of fragments) {
      if (!CYCLE_FRAGMENT_RE.test(entry) && !FIX_FRAGMENT_RE.test(entry)) {
        fail(
          label,
          `malformed fragment name: ${entry} (expected YYYY-MM-DD-spec-[gh-user]-[NNN][-slug]-cycle-[XX].md or YYYY-MM-DD-fix-[gh-user]-[seq].md)`,
        );
      }
    }
    if (fragments.length >= CONSOLIDATION_THRESHOLD) {
      warn(
        label,
        `${fragments.length} fragments accumulated (>= ${CONSOLIDATION_THRESHOLD}) — due for consolidation into constitution.md/context_prompt.md`,
      );
    }
  }
}

// ---- 9. CONTEXTO GATE: closed cycle must have its additive fragment ----
// Mechanism went live with this migration; earlier completed cycles predate it and are exempt.
const CONTEXT_GATE_CUTOFF = '2026-08-03';
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

for (const [file, c] of cycles) {
  if (!c || c.status !== 'completed') continue;
  if (c.completed_at && c.completed_at < CONTEXT_GATE_CUTOFF) continue;
  const m =
    /^specs\/(spec-[a-z0-9-]+)\/cycles\/(cycle-\d{2})\/cycle\.json$/.exec(file);
  if (!m) continue;
  const [, specFolder, cycleKey] = m;
  const shortIdMatch = /^spec-([a-z0-9-]+?)-(\d{3})-/.exec(specFolder);
  const shortSpecId = shortIdMatch
    ? `spec-${shortIdMatch[1]}-${shortIdMatch[2]}`
    : specFolder;
  for (const app of c.apps) {
    const [category, name] = app.split('/');
    const dir = updatesDir(category, name);
    const label = `context/${category}/${name}/updates`;
    if (!existsSync(dir)) {
      fail(file, `completed cycle touches ${app} but ${label} does not exist`);
      continue;
    }
    const fragmentRe = new RegExp(
      `^\\d{4}-\\d{2}-\\d{2}-${escapeRegExp(shortSpecId)}(-[a-z0-9-]+)?-${cycleKey}\\.md$`,
    );
    const hasFragment = readdirSync(dir).some((f) => fragmentRe.test(f));
    if (!hasFragment && !consolidatedSince(category, name, c.completed_at)) {
      fail(
        file,
        `completed without an additive context fragment in ${label} (expected YYYY-MM-DD-${shortSpecId}[-slug]-${cycleKey}.md) and the base context_prompt.md header shows no consolidation at/after ${c.completed_at}`,
      );
    }
  }
}

// ---- 10. MEMORIA GATE: journal entry naming + distillation threshold + lessons cap ----
// memory/ ships with the kit since v0.4; older installs may lack it — absence is not an error.
const MEMORY_JOURNAL_DIR = join(SDD, 'memory', 'journal');
const MEMORY_LESSONS = join(SDD, 'memory', 'lessons.md');
const DISTILLATION_THRESHOLD = 5;
const LESSONS_LINE_CAP = 120;

if (existsSync(MEMORY_JOURNAL_DIR)) {
  const entries = readdirSync(MEMORY_JOURNAL_DIR).filter(
    (f) => f !== '.gitkeep',
  );
  for (const entry of entries) {
    if (!CYCLE_FRAGMENT_RE.test(entry) && !FIX_FRAGMENT_RE.test(entry)) {
      fail(
        'memory/journal',
        `malformed journal entry name: ${entry} (expected YYYY-MM-DD-spec-[gh-user]-[NNN][-slug]-cycle-[XX].md or YYYY-MM-DD-fix-[gh-user]-[seq].md)`,
      );
    }
  }
  if (entries.length >= DISTILLATION_THRESHOLD) {
    warn(
      'memory/journal',
      `${entries.length} journal entries accumulated (>= ${DISTILLATION_THRESHOLD}) — due for distillation into memory/lessons.md (orchestrator, single actor)`,
    );
  }
}

if (existsSync(MEMORY_LESSONS)) {
  const lessonsLines = readFileSync(MEMORY_LESSONS, 'utf8').split('\n').length;
  if (lessonsLines > LESSONS_LINE_CAP) {
    warn(
      'memory/lessons.md',
      `${lessonsLines} lines exceed the ${LESSONS_LINE_CAP}-line cap — prune obsolete lessons (this file is read whole at every session start)`,
    );
  }
}

// ---- 11. Pricing (Costs dashboard input) — ships with the kit since v0.4; absence is not an error ----
if (existsSync(join(SDD, 'pricing.json'))) {
  validate('pricing.json', 'pricing.schema.json');
}

// ---- Content catalog: schema + freshness vs filesystem (viewer depends on it) ----
const catalogJson = validate('catalog.json', 'catalog.schema.json');
if (catalogJson) {
  const { buildCatalog } = await import(join(__dirname, 'rebuild-catalog.mjs'));
  const expected = buildCatalog();
  for (const section of ['agents', 'skills', 'prompts', 'schemas', 'memory']) {
    const have = JSON.stringify(catalogJson[section] ?? []);
    const want = JSON.stringify(expected[section]);
    if (have !== want) {
      fail(
        'catalog.json',
        `${section} is stale vs sdd/ filesystem (run pnpm sdd:rebuild-catalog)`,
      );
    }
  }
}

// ---- Portability: global.json owns the project name/description, nobody duplicates it ----
// sdd/ must be copyable into another repo without edits, so no file of the portable kit may
// hardcode what global.json declares. Dev-authored content is exempt on purpose: specs/,
// fixes/ and subproject contexts under context/[apps|libs|tools]/ legitimately name things.
const KIT_FILES = [
  'README.md',
  'context/constitution.md',
  'context/context_prompt.md',
  'dual-harness/AGENTS.md',
  'dual-harness/CLAUDE.md',
];
const KIT_DIRS = [
  'agents',
  'documentation',
  'prompts',
  'skills',
  'schemas',
  'docs',
  'templates',
];
const TEXT_FILE_RE = /\.(md|mdx|json|ya?ml|mjs|c?js|html|css|tsx?)$/;

function walkTextFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTextFiles(path));
    else if (TEXT_FILE_RE.test(entry.name)) out.push(path);
  }
  return out;
}

if (globalJson) {
  // Short values would produce false positives on ordinary prose, so they are skipped.
  const owned = [
    ['project', globalJson.project],
    ['description', globalJson.description],
  ].filter(
    ([, value]) => typeof value === 'string' && value.trim().length >= 5,
  );

  const kitFiles = [
    ...KIT_FILES.map((file) => join(SDD, file)),
    ...KIT_DIRS.flatMap((dir) => walkTextFiles(join(SDD, dir))),
  ].filter((path) => existsSync(path));

  // Word-boundary match: a project named "shop" must not be reported because an app is
  // called "shop-api", and a subproject legitimately named after the repo is not a leak.
  const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ownedRe = owned.map(([prop, value]) => [
    prop,
    value,
    new RegExp(`(?<![A-Za-z0-9_-])${escapeRe(value)}(?![A-Za-z0-9_-])`),
  ]);

  for (const path of kitFiles) {
    const content = readFileSync(path, 'utf8');
    for (const [prop, value, re] of ownedRe) {
      if (re.test(content)) {
        fail(
          path.slice(SDD.length + 1),
          `hardcodes global.json "${prop}" ("${value}") — point to sdd/global.json instead so sdd/ stays portable`,
        );
      }
    }
  }
}

// ---- Report ----
const checked = 8 + cycleFiles.length + cycleTasksFiles.length;
if (warnings.length) {
  console.warn(`\n[validate-sdd] ${warnings.length} warning(s):\n`);
  for (const w of warnings) console.warn('  ⚠ ' + w);
}
if (errors.length) {
  console.error(
    `\n[validate-sdd] ${errors.length} error(s) in ${checked} files:\n`,
  );
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(
  `\n[validate-sdd] OK — ${checked} files valid, cross-checks passed`,
);
