const SDD_BASE = new URL('../', import.meta.url);

function sddUrl(path) {
  return new URL(path, SDD_BASE).href;
}

const CATALOG = Object.freeze({
  agents: [
    {
      file: 'sdd-orchestrator.agent.md',
      num: '01',
      label: 'Orquestador',
      accent: 'emerald',
    },
    {
      file: 'sdd-functional.agent.md',
      num: '02',
      label: 'Funcional',
      accent: 'sky',
    },
    {
      file: 'sdd-planner.agent.md',
      num: '03',
      label: 'Planner',
      accent: 'violet',
    },
    {
      file: 'sdd-architect.agent.md',
      num: '04',
      label: 'Arquitecto',
      accent: 'amber',
    },
    {
      file: 'sdd-implementor-back.agent.md',
      num: '05',
      label: 'Impl. Backend',
      accent: 'blue',
    },
    {
      file: 'sdd-implementor-front.agent.md',
      num: '06',
      label: 'Impl. Frontend',
      accent: 'pink',
    },
    {
      file: 'sdd-reviewer.agent.md',
      num: '07',
      label: 'Reviewer',
      accent: 'teal',
    },
  ],
  skills: [
    { dir: 'generate-api-contract', file: 'skill.md', category: 'Generator' },
    { dir: 'generate-nestjs-module', file: 'skill.md', category: 'Generator' },
    { dir: 'generate-prisma-schema', file: 'skill.md', category: 'Generator' },
    {
      dir: 'generate-react-component',
      file: 'skill.md',
      category: 'Generator',
    },
    { dir: 'generate-springboot-api', file: 'skill.md', category: 'Generator' },
    { dir: 'sdd-architect', file: 'skill.md', category: 'SDD Agent' },
    { dir: 'sdd-data-schemas', file: 'skill.md', category: 'SDD Utility' },
    { dir: 'sdd-file-structure', file: 'skill.md', category: 'SDD Utility' },
    { dir: 'sdd-functional', file: 'skill.md', category: 'SDD Agent' },
    { dir: 'sdd-implementor-back', file: 'skill.md', category: 'SDD Agent' },
    { dir: 'sdd-implementor-front', file: 'skill.md', category: 'SDD Agent' },
    { dir: 'sdd-orchestrator', file: 'skill.md', category: 'SDD Agent' },
    { dir: 'sdd-planner', file: 'skill.md', category: 'SDD Agent' },
    { dir: 'sdd-reviewer', file: 'skill.md', category: 'SDD Agent' },
  ],
  prompts: [
    {
      file: 'start-sdd-cycle.prompt.md',
      label: 'Inicio de ciclo',
      description:
        'Guía al Orquestador para iniciar un nuevo ciclo SDD. Verifica precondiciones, crea brief.yaml y ciclo.json.',
      trigger: 'Al iniciar un nuevo ciclo SDD',
    },
    {
      file: 'check-spec-before-implement.prompt.md',
      label: 'Verificación SPEC GATE',
      description:
        'Checklist obligatorio que verifica que todos los documentos del ciclo existen antes de implementar.',
      trigger: 'Antes de cualquier implementación',
    },
    {
      file: 'hotfix-bypass-gate.prompt.md',
      label: 'FIX GATE bypass',
      description:
        'Proceso ligero para fixes urgentes. Registra en fixes.json y autoriza implementación sin ciclo completo.',
      trigger: 'Con prefijos [HOTFIX], [BUGFIX], [FIX], [IMPROVEMENT]',
    },
    {
      file: 'review-cycle.prompt.md',
      label: 'Revisión de ciclo',
      description:
        'Guía al Reviewer para cerrar un ciclo SDD. Evalúa entregables, valida specs, ejecuta el CONTEXTO GATE aditivo (escribe el fragmento en updates/ del subproyecto) y marca cycle.json como completed.',
      trigger: 'Al cerrar un ciclo SDD',
    },
  ],
  schemas: [
    {
      file: 'global.schema.json',
      name: 'Global',
      target: 'sdd/global.json',
      writers: 'Orquestador · Reviewer',
    },
    {
      file: 'specs-index.schema.json',
      name: 'Specs Index',
      target: 'sdd/specs/index.json',
      writers: 'Autor de la spec · Reviewer',
    },
    {
      file: 'cycle.schema.json',
      name: 'Cycle',
      target: 'cycles/cycle-XX/cycle.json',
      writers: 'Orquestador · Reviewer',
    },
    {
      file: 'cycle-tasks.schema.json',
      name: 'Cycle Tasks',
      target: 'cycles/cycle-XX/tasks.json',
      writers: 'Planner · Implementadores · Reviewer',
    },
    {
      file: 'tasks-index.schema.json',
      name: 'Tasks Index',
      target: 'sdd/tasks.json',
      writers: 'Generado (rebuild-tasks-index)',
    },
    {
      file: 'api.schema.json',
      name: 'API',
      target: 'sdd/api.json',
      writers: 'Arquitecto · Implementador back · Reviewer',
    },
    {
      file: 'db-schema.schema.json',
      name: 'DB Schema',
      target: 'sdd/schema.json',
      writers: 'Arquitecto · Implementador back · Reviewer',
    },
    {
      file: 'components.schema.json',
      name: 'Components',
      target: 'sdd/components.json',
      writers: 'Arquitecto · Implementador front · Reviewer',
    },
    {
      file: 'fixes.schema.json',
      name: 'Fixes',
      target: 'sdd/fixes.json',
      writers: 'Orquestador (FIX GATE) · dev · Reviewer',
    },
  ],
  contextSeeds: [],
  helpDocs: [
    {
      id: 'install',
      path: 'documentation/es/INSTALL.md',
      label: 'Instalar y actualizar',
      badge: 'Setup',
      description:
        'Cómo instalar el framework en un repo y actualizar un kit ya instalado con update sdd.',
    },
    {
      id: 'how-to',
      path: 'documentation/es/HOW-TO-USE-SDD.md',
      label: 'Cómo usar SDD',
      badge: 'Guía',
      description:
        'Guía paso a paso para usar el sistema SDD: setup, flujo de trabajo, FIX GATE y cheat sheet.',
    },
    {
      id: 'readme',
      path: 'documentation/es/README.md',
      label: 'README SDD',
      badge: 'Referencia',
      description:
        'Referencia completa del sistema SDD: estructura, gates, agentes, skills y artefactos.',
    },
  ],
});

const AGENT_ACCENT_CYCLE = [
  'emerald',
  'sky',
  'violet',
  'amber',
  'blue',
  'pink',
  'teal',
];

function deriveLabelFromFile(file, stripPrefixes, stripSuffix) {
  let base = stripSuffix ? file.replace(stripSuffix, '') : file;
  for (const prefix of stripPrefixes) {
    if (base.startsWith(prefix)) {
      base = base.slice(prefix.length);
      break;
    }
  }
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function enrichAgentManifest(manifestAgents) {
  const known = new Map(CATALOG.agents.map((agent) => [agent.file, agent]));
  const maxKnownNum = Math.max(
    ...CATALOG.agents.map((agent) => Number(agent.num)),
  );
  const unknownFiles = sortBy(
    manifestAgents
      .map((entry) => entry.file)
      .filter((file) => !known.has(file)),
    (file) => file,
  );
  const merged = manifestAgents.map((entry) => {
    if (known.has(entry.file)) return known.get(entry.file);
    const offset = unknownFiles.indexOf(entry.file);
    return {
      file: entry.file,
      num: String(maxKnownNum + 1 + offset).padStart(2, '0'),
      label: deriveLabelFromFile(entry.file, ['sdd-'], /\.agent\.md$/),
      accent:
        AGENT_ACCENT_CYCLE[(maxKnownNum + offset) % AGENT_ACCENT_CYCLE.length],
    };
  });
  return sortBy(merged, (agent) => agent.num);
}

function deriveSkillCategory(dir) {
  if (dir.startsWith('generate-')) return 'Generator';
  if (dir.startsWith('sdd-')) return 'SDD Utility';
  return 'Tool';
}

function enrichSkillManifest(manifestSkills) {
  const known = new Map(CATALOG.skills.map((skill) => [skill.dir, skill]));
  return manifestSkills.map(
    (entry) =>
      known.get(entry.dir) ?? {
        dir: entry.dir,
        file: entry.file,
        category: deriveSkillCategory(entry.dir),
      },
  );
}

function enrichPromptManifest(manifestPrompts) {
  const known = new Map(CATALOG.prompts.map((prompt) => [prompt.file, prompt]));
  return manifestPrompts.map(
    (entry) =>
      known.get(entry.file) ?? {
        file: entry.file,
        label: deriveLabelFromFile(entry.file, [], /\.prompt\.md$/),
        description: '',
        trigger: '',
      },
  );
}

function enrichSchemaManifest(manifestSchemas) {
  const known = new Map(CATALOG.schemas.map((schema) => [schema.file, schema]));
  return manifestSchemas.map(
    (entry) =>
      known.get(entry.file) ?? {
        file: entry.file,
        name: deriveLabelFromFile(entry.file, [], /\.schema\.json$/),
        target: '—',
        writers: '—',
      },
  );
}

function manifestFallbackHint() {
  return `<p class="card-hint" style="margin:-8px 0 16px">No se pudo cargar sdd/catalog.json — mostrando catálogo estático embebido.</p>`;
}

const CYCLE_ROOT_DOCS = [
  'brief.yaml',
  'functional.md',
  'planner.md',
  'architect.md',
  'cycle.json',
  'tasks.json',
];
const MAX_CYCLE_PROBE = 20;

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function stripSddPrefix(path) {
  return path.replace(/^sdd\//, '');
}

function formatHours(hours) {
  if (hours === null || hours === undefined || Number.isNaN(Number(hours)))
    return '—';
  const value = Number(hours);
  return value % 1 === 0 ? `${value}h` : `${value.toFixed(1)}h`;
}

function pad3(num) {
  return String(num).padStart(3, '0');
}

function sortBy(items, keyFn) {
  return [...items].sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return 0;
  });
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

class SddError extends Error {
  constructor(message, kind, path) {
    super(message);
    this.name = 'SddError';
    this.kind = kind;
    this.path = path;
  }
}

const cache = new Map();
let lastLoadedAt = null;

function invalidateCache() {
  cache.clear();
}

async function fetchJson(path) {
  const url = sddUrl(path);
  if (cache.has(url)) return cache.get(url);
  const promise = (async () => {
    let response;
    try {
      response = await fetch(url);
    } catch (err) {
      throw new SddError(`Error de red al pedir ${path}`, 'network', path);
    }
    if (response.status === 404) {
      throw new SddError(`No encontrado: ${path}`, 'not-found', path);
    }
    if (!response.ok) {
      throw new SddError(
        `Error HTTP ${response.status} al pedir ${path}`,
        'http',
        path,
      );
    }
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      lastLoadedAt = new Date();
      return data;
    } catch (err) {
      throw new SddError(`JSON inválido en ${path}`, 'invalid-json', path);
    }
  })();
  cache.set(url, promise);
  return promise;
}

async function fetchText(path) {
  const url = sddUrl(path);
  if (cache.has(url)) return cache.get(url);
  const promise = (async () => {
    let response;
    try {
      response = await fetch(url);
    } catch (err) {
      throw new SddError(`Error de red al pedir ${path}`, 'network', path);
    }
    if (response.status === 404) {
      throw new SddError(`No encontrado: ${path}`, 'not-found', path);
    }
    if (!response.ok) {
      throw new SddError(
        `Error HTTP ${response.status} al pedir ${path}`,
        'http',
        path,
      );
    }
    const text = await response.text();
    lastLoadedAt = new Date();
    return text;
  })();
  cache.set(url, promise);
  return promise;
}

async function resourceExists(path) {
  try {
    const response = await fetch(sddUrl(path), { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

async function loadGlobal() {
  return fetchJson('global.json');
}

async function loadSpecsIndex() {
  return fetchJson('specs/index.json');
}

async function loadFixes() {
  return fetchJson('fixes.json');
}

async function loadSchemaRegistry() {
  return fetchJson('schema.json');
}

async function loadApiRegistry() {
  return fetchJson('api.json');
}

async function loadComponentsRegistry() {
  return fetchJson('components.json');
}

async function loadManifest() {
  return fetchJson('catalog.json');
}

async function loadAssembledTasks() {
  const index = await fetchJson('tasks.json');
  const specs = {};

  const entries = Object.entries(index.specs ?? {}).flatMap(([specId, spec]) =>
    Object.entries(spec.cycles ?? {}).map(([cycleId, entry]) => ({
      specId,
      cycleId,
      entry,
    })),
  );

  const results = await Promise.allSettled(
    entries.map(async ({ specId, cycleId, entry }) => {
      const cycle = await fetchJson(stripSddPrefix(entry.file));
      return { specId, cycleId, cycle };
    }),
  );

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { specId, cycleId, cycle } = result.value;
    specs[specId] ??= { cycles: {} };
    specs[specId].cycles[cycleId] = {
      module: cycle.module,
      app: cycle.apps?.[0],
      apps: cycle.apps,
      flow: cycle.flow,
      user_stories_generated: cycle.user_stories_generated,
      prerequisites: cycle.prerequisites,
      tasks: cycle.tasks,
    };
  }

  return { sdd_version: index.sdd_version, specs };
}

async function loadCycleIndex() {
  const seen = new Map();

  const [tasksIndexResult, specsIndexResult] = await Promise.allSettled([
    fetchJson('tasks.json'),
    loadSpecsIndex(),
  ]);

  if (
    tasksIndexResult.status !== 'fulfilled' &&
    specsIndexResult.status !== 'fulfilled'
  ) {
    throw tasksIndexResult.reason;
  }

  if (tasksIndexResult.status === 'fulfilled') {
    for (const [specId, spec] of Object.entries(
      tasksIndexResult.value.specs ?? {},
    )) {
      const cycleIds = Object.keys(spec.cycles ?? {});
      if (!seen.has(specId)) seen.set(specId, new Set());
      for (const cycleId of cycleIds) seen.get(specId).add(cycleId);
    }
  }

  const specIds =
    specsIndexResult.status === 'fulfilled'
      ? specsIndexResult.value.specs.map((s) => s.id)
      : [];

  const probeResults = await Promise.allSettled(
    specIds.map(async (specId) => {
      const known = seen.get(specId) ?? new Set();
      let highest = 0;
      for (const cycleId of known) {
        const match = /^cycle-(\d+)$/.exec(cycleId);
        if (match) highest = Math.max(highest, Number(match[1]));
      }
      const discovered = [];
      let probeCount = 0;
      let next = highest + 1;
      while (probeCount < MAX_CYCLE_PROBE) {
        const cycleId = `cycle-${String(next).padStart(2, '0')}`;
        const exists = await resourceExists(
          `specs/${specId}/cycles/${cycleId}/cycle.json`,
        );
        probeCount++;
        if (!exists) break;
        discovered.push(cycleId);
        next++;
      }
      return { specId, discovered };
    }),
  );

  for (const result of probeResults) {
    if (result.status !== 'fulfilled') continue;
    const { specId, discovered } = result.value;
    if (!seen.has(specId)) seen.set(specId, new Set());
    for (const cycleId of discovered) seen.get(specId).add(cycleId);
  }

  const index = [];
  for (const [specId, cycleIds] of seen.entries()) {
    for (const cycleId of cycleIds) index.push({ specId, cycleId });
  }
  return index;
}

async function loadCycleJson(specId, cycleId) {
  return fetchJson(`specs/${specId}/cycles/${cycleId}/cycle.json`);
}

async function resolveCycleFiles(specId, cycleId, cycleJson) {
  const known = new Set(
    [
      ...Object.values(cycleJson?.documents ?? {}),
      ...(cycleJson?.artifacts ?? []),
    ].map((p) => stripSddPrefix(p)),
  );

  const files = [];
  const basePath = `specs/${specId}/cycles/${cycleId}`;

  for (const name of CYCLE_ROOT_DOCS) {
    const path = `${basePath}/${name}`;
    if (known.has(path)) {
      files.push({ name, path, kind: 'document' });
      continue;
    }
    const exists = await resourceExists(path);
    if (exists) files.push({ name, path, kind: 'document' });
  }

  for (const artifactPath of cycleJson?.artifacts ?? []) {
    const path = stripSddPrefix(artifactPath);
    const name = path.split('/').pop();
    files.push({ name, path, kind: 'artifact' });
  }

  return files;
}

async function loadMarkdown(path) {
  const key = `markdown:${sddUrl(path)}`;
  if (cache.has(key)) return cache.get(key);
  const promise = fetchText(path).then((source) => {
    const imageBase = sddUrl(path.slice(0, path.lastIndexOf('/') + 1));
    return renderMarkdown(source, { imageBase });
  });
  cache.set(key, promise);
  return promise;
}

const FENCE_MARKER = '@@SDDFENCE';
const INLINE_CODE_TOKEN = '@@SDDCODE';
const INLINE_LINK_TOKEN = '@@SDDLINK';
const HEADING_PATTERN = /^ {0,3}(#{1,6})(?:\s+(.*?))?\s*$/;

function renderMarkdown(source, options = {}) {
  const { imageBase } = options;
  const normalized = normalizeMarkdownSource(source);
  const { text, fences } = parkCodeFences(normalized);
  const blocks = parseBlocks(text.split('\n'));
  const seenIds = new Set();
  return blocks
    .map((block) => renderBlock(block, fences, imageBase, seenIds))
    .join('\n');
}

function normalizeMarkdownSource(source) {
  return String(source).replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
}

function matchFenceOpen(line) {
  const match = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)[ \t]*$/.exec(line);
  if (!match) return null;
  return { char: match[1][0], length: match[1].length, lang: match[2] };
}

function matchFenceClose(line, open) {
  const match = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
  if (!match) return false;
  return match[1][0] === open.char && match[1].length >= open.length;
}

function parkCodeFences(text) {
  const lines = text.split('\n');
  const output = [];
  const fences = new Map();
  let index = 0;
  let i = 0;
  while (i < lines.length) {
    const open = matchFenceOpen(lines[i]);
    if (!open) {
      output.push(lines[i]);
      i++;
      continue;
    }
    const content = [];
    i++;
    while (i < lines.length && !matchFenceClose(lines[i], open)) {
      content.push(lines[i]);
      i++;
    }
    if (i < lines.length) i++;
    const token = `${FENCE_MARKER}${index}@@`;
    fences.set(token, { lang: open.lang, content: content.join('\n') });
    output.push(token);
    index++;
  }
  return { text: output.join('\n'), fences };
}

function isFenceToken(line) {
  return line.startsWith(FENCE_MARKER);
}

function isHeadingLine(line) {
  return HEADING_PATTERN.test(line);
}

function parseHeadingBlock(line) {
  const match = HEADING_PATTERN.exec(line);
  return {
    type: 'heading',
    level: Math.min(match[1].length, 5),
    text: match[2] ?? '',
  };
}

function isHrLine(line) {
  const trimmed = line.trim().replace(/\s+/g, '');
  if (trimmed.length < 3) return false;
  return /^-+$/.test(trimmed) || /^\*+$/.test(trimmed) || /^_+$/.test(trimmed);
}

function isBlockquoteLine(line) {
  return /^ {0,3}>/.test(line);
}

function collectBlockquote(lines, start) {
  const content = [];
  let i = start;
  while (i < lines.length && isBlockquoteLine(lines[i])) {
    content.push(lines[i].replace(/^ {0,3}>\s?/, ''));
    i++;
  }
  return {
    block: { type: 'blockquote', blocks: parseBlocks(content) },
    next: i,
  };
}

function splitTableRow(line) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let current = '';
  for (let idx = 0; idx < trimmed.length; idx++) {
    const char = trimmed[idx];
    if (char === '\\' && trimmed[idx + 1] === '|') {
      current += '|';
      idx++;
      continue;
    }
    if (char === '|') {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function isTableDelimiterRow(line) {
  const trimmed = line.trim();
  if (!trimmed.includes('-')) return false;
  const cells = splitTableRow(trimmed);
  return (
    cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell.trim()))
  );
}

function isTableHeaderStart(lines, i) {
  if (i + 1 >= lines.length) return false;
  if (!lines[i].includes('|')) return false;
  return isTableDelimiterRow(lines[i + 1]);
}

function parseColumnAlign(cell) {
  const trimmed = cell.trim();
  const left = trimmed.startsWith(':');
  const right = trimmed.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return null;
}

function collectTable(lines, start) {
  const headerCells = splitTableRow(lines[start]).map((cell) => cell.trim());
  const aligns = splitTableRow(lines[start + 1]).map(parseColumnAlign);
  const rows = [];
  let i = start + 2;
  while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
    rows.push(splitTableRow(lines[i]).map((cell) => cell.trim()));
    i++;
  }
  return { block: { type: 'table', headerCells, aligns, rows }, next: i };
}

function matchListMarker(line) {
  const match = /^(\s*)([-*+]|\d+[.)])(\s+)(.*)$/.exec(line);
  if (!match) return null;
  return {
    indent: match[1].length,
    ordered: /\d/.test(match[2][0]),
    rest: match[4],
    markerWidth: match[2].length + match[3].length,
  };
}

function isListItemLine(line) {
  return matchListMarker(line) !== null;
}

function getIndent(line) {
  return line.length - line.trimStart().length;
}

function extractTaskMarker(text) {
  const match = /^\[([ xX])\]\s+(.*)$/.exec(text);
  if (!match) return { text, checked: false, isTask: false };
  return {
    text: match[2],
    checked: match[1].toLowerCase() === 'x',
    isTask: true,
  };
}

function looksLikeBlockStart(line) {
  return (
    isFenceToken(line) ||
    isHeadingLine(line) ||
    isHrLine(line) ||
    isBlockquoteLine(line) ||
    isListItemLine(line)
  );
}

function parseListItem(lines, start, indent) {
  const marker = matchListMarker(lines[start]);
  const contentIndent = indent + marker.markerWidth;
  const textParts = [marker.rest];
  let i = start + 1;
  while (
    i < lines.length &&
    lines[i].trim() !== '' &&
    getIndent(lines[i]) >= contentIndent &&
    !looksLikeBlockStart(lines[i].slice(contentIndent))
  ) {
    textParts.push(lines[i].slice(contentIndent).trim());
    i++;
  }
  const childLines = [];
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      childLines.push('');
      i++;
      continue;
    }
    if (getIndent(line) < contentIndent) break;
    childLines.push(line.slice(contentIndent));
    i++;
  }
  while (childLines.length && childLines[childLines.length - 1] === '')
    childLines.pop();
  const taskMarker = extractTaskMarker(textParts.join(' '));
  const nestedBlocks = childLines.length ? parseBlocks(childLines) : [];
  return {
    item: {
      text: taskMarker.text,
      checked: taskMarker.checked,
      isTask: taskMarker.isTask,
      nestedBlocks,
    },
    next: i,
  };
}

function parseListLevel(lines, start, indent) {
  const ordered = matchListMarker(lines[start]).ordered;
  const items = [];
  let i = start;
  while (i < lines.length) {
    const marker = matchListMarker(lines[i]);
    if (!marker || getIndent(lines[i]) !== indent || marker.ordered !== ordered)
      break;
    const { item, next } = parseListItem(lines, i, indent);
    items.push(item);
    i = next;
  }
  return { block: { type: 'list', ordered, items }, next: i };
}

function collectList(lines, start) {
  return parseListLevel(lines, start, getIndent(lines[start]));
}

function collectParagraph(lines, start) {
  const textLines = [];
  let i = start;
  while (
    i < lines.length &&
    lines[i].trim() !== '' &&
    !isFenceToken(lines[i]) &&
    !isHeadingLine(lines[i]) &&
    !isHrLine(lines[i]) &&
    !isBlockquoteLine(lines[i]) &&
    !isListItemLine(lines[i]) &&
    !isTableHeaderStart(lines, i)
  ) {
    textLines.push(lines[i].trim());
    i++;
  }
  return { block: { type: 'paragraph', text: textLines.join(' ') }, next: i };
}

function parseBlocks(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    if (isFenceToken(line)) {
      blocks.push({ type: 'fence', token: line });
      i++;
      continue;
    }
    if (isHeadingLine(line)) {
      blocks.push(parseHeadingBlock(line));
      i++;
      continue;
    }
    if (isHrLine(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }
    if (isBlockquoteLine(line)) {
      const result = collectBlockquote(lines, i);
      blocks.push(result.block);
      i = result.next;
      continue;
    }
    if (isTableHeaderStart(lines, i)) {
      const result = collectTable(lines, i);
      blocks.push(result.block);
      i = result.next;
      continue;
    }
    if (isListItemLine(line)) {
      const result = collectList(lines, i);
      blocks.push(result.block);
      i = result.next;
      continue;
    }
    const result = collectParagraph(lines, i);
    blocks.push(result.block);
    i = result.next;
  }
  return blocks;
}

function decodeNumericEntity(entity) {
  const hex = /^&#x([0-9a-fA-F]+);$/.exec(entity);
  if (hex) return String.fromCodePoint(parseInt(hex[1], 16));
  const dec = /^&#(\d+);$/.exec(entity);
  if (dec) return String.fromCodePoint(parseInt(dec[1], 10));
  return entity;
}

function decodeHtmlEntities(text) {
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/&#x?[0-9a-fA-F]+;/g, decodeNumericEntity);
}

function stripWhitespaceAndControlChars(text) {
  let result = '';
  for (const char of text) {
    if (char.charCodeAt(0) <= 32) continue;
    result += char;
  }
  return result;
}

function sanitizeHref(escapedHref) {
  const decoded = decodeHtmlEntities(escapedHref);
  const normalized = stripWhitespaceAndControlChars(decoded);
  const lower = normalized.toLowerCase();
  if (!normalized) return null;
  if (lower.startsWith('#') || /^(https?:\/\/|mailto:)/.test(lower))
    return escapeHtml(decoded);
  const hasScheme = /^[a-z][a-z0-9+.-]*:/.test(lower);
  if (hasScheme) return null;
  return escapeHtml(decoded);
}

function sanitizeImageSrc(escapedSrc, imageBase) {
  const decoded = decodeHtmlEntities(escapedSrc);
  const normalized = stripWhitespaceAndControlChars(decoded);
  const lower = normalized.toLowerCase();
  if (!normalized || lower.startsWith('#')) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/.test(lower);
  if (hasScheme && !/^https?:\/\//.test(lower)) return null;
  if (/^https?:\/\//.test(lower)) return escapeHtml(normalized);
  if (!imageBase) return null;
  try {
    return escapeHtml(new URL(normalized, imageBase).href);
  } catch {
    return null;
  }
}

function renderEmphasis(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
}

function renderLinkTag(label, href) {
  const labelHtml = renderEmphasis(label);
  const safeHref = sanitizeHref(href);
  if (!safeHref) return labelHtml;
  return `<a href="${safeHref}" rel="noopener noreferrer">${labelHtml}</a>`;
}

function renderImageTag(alt, src, imageBase) {
  const safeSrc = sanitizeImageSrc(src, imageBase);
  if (!safeSrc) return alt;
  return `<img src="${safeSrc}" alt="${alt}" loading="lazy">`;
}

function parkInlineCode(text) {
  const codes = new Map();
  let result = '';
  let index = 0;
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '`') {
      result += text[i];
      i++;
      continue;
    }
    const runStart = i;
    let runLength = 0;
    while (text[i] === '`') {
      runLength++;
      i++;
    }
    const closeSeq = '`'.repeat(runLength);
    const closeIndex = text.indexOf(closeSeq, i);
    if (closeIndex === -1) {
      result += text.slice(runStart, i);
      continue;
    }
    const content = text.slice(i, closeIndex);
    const token = `${INLINE_CODE_TOKEN}${index}@@`;
    codes.set(token, `<code>${content.trim()}</code>`);
    result += token;
    index++;
    i = closeIndex + runLength;
  }
  return { text: result, codes };
}

function parkInlineLinks(text, imageBase) {
  const links = new Map();
  let index = 0;
  let result = text.replace(
    /(!?)\[([^\]]*)\]\(([^)]*)\)/g,
    (match, bang, label, href) => {
      const token = `${INLINE_LINK_TOKEN}${index}@@`;
      links.set(
        token,
        bang
          ? renderImageTag(label, href, imageBase)
          : renderLinkTag(label, href),
      );
      index++;
      return token;
    },
  );
  result = result.replace(
    /&lt;((?:https?:\/\/|mailto:)[^ &]+)&gt;/g,
    (match, href) => {
      const token = `${INLINE_LINK_TOKEN}${index}@@`;
      links.set(token, renderLinkTag(href, href));
      index++;
      return token;
    },
  );
  return { text: result, links };
}

function restoreTokens(text, tokenMap) {
  let result = text;
  for (const [token, html] of tokenMap) {
    result = result.split(token).join(html);
  }
  return result;
}

function renderInline(text, imageBase) {
  const escaped = escapeHtml(text);
  const { text: withoutCode, codes } = parkInlineCode(escaped);
  const { text: withoutLinks, links } = parkInlineLinks(withoutCode, imageBase);
  const emphasized = renderEmphasis(withoutLinks);
  return restoreTokens(restoreTokens(emphasized, links), codes);
}

function alignAttr(align) {
  return align ? ` style="text-align:${align}"` : '';
}

function renderFenceBlock(block, fences) {
  const fence = fences.get(block.token);
  if (!fence) return '';
  const langClass = fence.lang
    ? ` class="language-${escapeHtml(fence.lang)}"`
    : '';
  return `<pre><code${langClass}>${escapeHtml(fence.content)}</code></pre>`;
}

function headingAnchorId(text, seenIds) {
  const base = decodeHtmlEntities(text)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/ /g, '-');
  let candidate = base || 'seccion';
  let suffix = 1;
  while (seenIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  seenIds.add(candidate);
  return candidate;
}

function renderHeadingBlock(block, imageBase, seenIds) {
  const anchor = seenIds
    ? ` id="${escapeHtml(headingAnchorId(block.text, seenIds))}"`
    : '';
  return `<h${block.level}${anchor}>${renderInline(block.text, imageBase)}</h${block.level}>`;
}

function renderBlockquoteBlock(block, fences, imageBase) {
  const inner = block.blocks
    .map((child) => renderBlock(child, fences, imageBase))
    .join('\n');
  return `<blockquote>${inner}</blockquote>`;
}

function renderTableBlock(block, imageBase) {
  const head = block.headerCells
    .map(
      (cell, idx) =>
        `<th${alignAttr(block.aligns[idx])}>${renderInline(cell, imageBase)}</th>`,
    )
    .join('');
  const body = block.rows
    .map(
      (row) =>
        `<tr>${row.map((cell, idx) => `<td${alignAttr(block.aligns[idx])}>${renderInline(cell, imageBase)}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<div class="table-wrapper"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderListItem(item, fences, imageBase) {
  const nested = item.nestedBlocks
    .map((child) => renderBlock(child, fences, imageBase))
    .join('');
  if (item.isTask) {
    const checkedAttr = item.checked ? ' checked' : '';
    return `<li class="task-list-item"><input type="checkbox" disabled${checkedAttr}>${renderInline(item.text, imageBase)}${nested}</li>`;
  }
  return `<li>${renderInline(item.text, imageBase)}${nested}</li>`;
}

function renderListBlock(block, fences, imageBase) {
  const tag = block.ordered ? 'ol' : 'ul';
  const items = block.items
    .map((item) => renderListItem(item, fences, imageBase))
    .join('');
  return `<${tag}>${items}</${tag}>`;
}

function renderParagraphBlock(block, imageBase) {
  return `<p>${renderInline(block.text, imageBase)}</p>`;
}

function renderBlock(block, fences, imageBase, seenIds) {
  switch (block.type) {
    case 'fence':
      return renderFenceBlock(block, fences);
    case 'heading':
      return renderHeadingBlock(block, imageBase, seenIds);
    case 'hr':
      return '<hr>';
    case 'blockquote':
      return renderBlockquoteBlock(block, fences, imageBase);
    case 'table':
      return renderTableBlock(block, imageBase);
    case 'list':
      return renderListBlock(block, fences, imageBase);
    case 'paragraph':
      return renderParagraphBlock(block, imageBase);
    default:
      return '';
  }
}

const ICONS = {
  dashboard: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1.5" y="1.5" width="5" height="5" rx="1" /><rect x="9.5" y="1.5" width="5" height="5" rx="1" /><rect x="1.5" y="9.5" width="5" height="5" rx="1" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" /></svg>`,
  planning: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1.5" y="10" width="3" height="4.5" rx="0.5" /><rect x="6.5" y="6.5" width="3" height="8" rx="0.5" /><rect x="11.5" y="2" width="3" height="12.5" rx="0.5" /><line x1="1.5" y1="14.5" x2="14.5" y2="14.5" /></svg>`,
  file: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 1.5H3.5A1 1 0 0 0 2.5 2.5v11A1 1 0 0 0 3.5 14.5h9A1 1 0 0 0 13.5 13.5V6L9 1.5Z" /><path d="M9 1.5V6h4.5" /><line x1="5" y1="9" x2="11" y2="9" /><line x1="5" y1="11.5" x2="8.5" y2="11.5" /></svg>`,
  cycle: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.64-3.9" /><polyline points="13.5 2 13.5 5.5 10 5.5" /></svg>`,
  task: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1.5 4 4 6.5 7 3" /><line x1="9" y1="4.75" x2="14.5" y2="4.75" /><polyline points="1.5 9.5 4 12 7 8.5" /><line x1="9" y1="10.25" x2="14.5" y2="10.25" /></svg>`,
  fix: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 2.5 9 7l-2.5-.5L6 9l1.5 1.5 1-2.5 4.5-4.5Z" /><path d="M2.5 13.5l3.5-3.5" /></svg>`,
  context: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3.5C2 2.67 2.67 2 3.5 2h4L10 4.5V7" /><path d="M10 4.5H7.5A1.5 1.5 0 0 1 6 3V2" /><rect x="6" y="7" width="8" height="7" rx="1" /><line x1="8" y1="10" x2="12" y2="10" /><line x1="8" y1="12" x2="11" y2="12" /></svg>`,
  agent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="5.5" r="2.5" /><path d="M3 14c0-2.76 2.24-5 5-5s5 2.24 5 5" /><circle cx="8" cy="8" r="7" /></svg>`,
  skill: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="8,1.5 10,6 14.5,6 11,9 12.5,13.5 8,11 3.5,13.5 5,9 1.5,6 6,6" /></svg>`,
  prompt: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 2.5h12v8.5H9.5L7 13.5V11H2z" /><line x1="5" y1="5.5" x2="11" y2="5.5" /><line x1="5" y1="7.5" x2="9" y2="7.5" /></svg>`,
  database: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="8" cy="4.5" rx="5.5" ry="2" /><path d="M2.5 4.5V12c0 1.1 2.46 2 5.5 2s5.5-.9 5.5-2V4.5" /><path d="M2.5 8.25c0 1.1 2.46 2 5.5 2s5.5-.9 5.5-2" /></svg>`,
  api: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 5.5h4l2 2-2 2h-4" /><path d="M14.5 5.5h-4l-2 2 2 2h4" /><line x1="6" y1="3" x2="6" y2="13" /><line x1="10" y1="3" x2="10" y2="13" /></svg>`,
  components: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" /><rect x="9" y="1.5" width="5.5" height="5.5" rx="1" /><rect x="1.5" y="9" width="5.5" height="5.5" rx="1" /><path d="M9 11.75h5.5M11.75 9v5.5" /></svg>`,
  schemaFix: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.5L2 4v4.5c0 3 2.5 5.5 6 6 3.5-.5 6-3 6-6V4L8 1.5Z" /><polyline points="5.5,8 7,9.5 10.5,6" /></svg>`,
  help: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6.5" /><path d="M6.5 6.5a1.5 1.5 0 0 1 3 .5c0 1-1.5 1.5-1.5 2.5" /><circle cx="8" cy="11.5" r="0.5" fill="currentColor" stroke="none" /></svg>`,
  empty: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="24" cy="24" r="18" stroke-dasharray="4 3" /><line x1="16" y1="24" x2="32" y2="24" /></svg>`,
  close: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><line x1="2" y1="2" x2="14" y2="14" /><line x1="14" y1="2" x2="2" y2="14" /></svg>`,
  refresh: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.9-4.16" /><polyline points="13.5 1.5 13.5 4.5 10.5 4.5" /></svg>`,
  costs: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 2v12h12" /><path d="M5 10.5v-3" /><path d="M8.5 10.5v-6" /><path d="M12 10.5v-4.5" /></svg>`,
};

function icon(name) {
  return ICONS[name] ?? ICONS.empty;
}

const STATUS_META = {
  completed: { label: 'Completado', tone: 'emerald' },
  done: { label: 'Hecho', tone: 'emerald' },
  implemented: { label: 'Implementado', tone: 'emerald' },
  resolved: { label: 'Resuelto', tone: 'emerald' },
  validated: { label: 'Validado', tone: 'emerald' },
  migrated: { label: 'Migrado', tone: 'emerald' },
  approved: { label: 'Aprobado', tone: 'teal' },
  'in-progress': { label: 'En progreso', tone: 'amber' },
  open: { label: 'Abierto', tone: 'amber' },
  updated: { label: 'Actualizado', tone: 'amber' },
  pending: { label: 'Pendiente', tone: 'zinc' },
  planned: { label: 'Planificado', tone: 'zinc' },
  draft: { label: 'Borrador', tone: 'zinc' },
  defined: { label: 'Definido', tone: 'zinc' },
  archived: { label: 'Archivado', tone: 'zinc-mute' },
  skipped: { label: 'Omitido', tone: 'zinc-mute' },
  deprecated: { label: 'Obsoleto', tone: 'zinc-mute' },
  cancelled: { label: 'Cancelado', tone: 'rose' },
  absorbed: { label: 'Absorbido', tone: 'sky' },
};

function pageHeader({ title, meta, subtitle } = {}) {
  return `
    <header class="page-header">
      <div class="page-header-top">
        <h1 class="page-title">${escapeHtml(title ?? '')}</h1>
        ${meta ? `<span class="page-meta">${escapeHtml(meta)}</span>` : ''}
      </div>
      ${subtitle ? `<p class="page-subtitle">${escapeHtml(subtitle)}</p>` : ''}
    </header>
  `;
}

function skeleton(width, height, extraClass = '') {
  const w = typeof width === 'number' ? `${width}px` : width;
  const h = typeof height === 'number' ? `${height}px` : height;
  const className = extraClass
    ? `skel animate-shimmer ${extraClass}`
    : 'skel animate-shimmer';
  return `<span class="${className}" style="width:${w};height:${h}"></span>`;
}

function skeletonRow() {
  return `
    <div class="skeleton-row">
      <div class="skeleton-row-main">
        ${skeleton(32, 12)}
        ${skeleton(192, 12)}
      </div>
      ${skeleton(80, 20)}
    </div>
  `;
}

function skeletonStat() {
  return `
    <div class="skeleton-stat">
      ${skeleton(40, 28, 'skeleton-stat-value')}
      ${skeleton(64, 12)}
    </div>
  `;
}

function skeletonLines(widths = ['75%', '100%', '83%', '67%']) {
  return `<div class="skeleton-lines">${widths.map((width) => skeleton(width, 16)).join('')}</div>`;
}

function skeletonRows(count = 5) {
  return Array.from({ length: count }, () => skeletonRow()).join('');
}

function emptyState(title, hint) {
  return `
    <div class="empty-state">
      <span class="empty-state-icon">${icon('empty')}</span>
      <p class="empty-state-title">${escapeHtml(title)}</p>
      ${hint ? `<p class="empty-state-hint">${escapeHtml(hint)}</p>` : ''}
    </div>
  `;
}

function errorState(error) {
  const message =
    error instanceof SddError ? error.message : 'Ocurrió un error inesperado.';
  return `
    <div class="error-state">
      <span class="error-state-icon">${icon('empty')}</span>
      <p class="error-state-title">No se pudo cargar la vista</p>
      <p class="error-state-message">${escapeHtml(message)}</p>
    </div>
  `;
}

function liveIndicator({ live, project, version, updatedAt }) {
  const dotClass = live ? 'live-dot live-dot--on' : 'live-dot';
  const labelClass = live ? 'live-label live-label--on' : 'live-label';
  const labelText = live ? 'LOCAL · LIVE' : 'PRODUCTION';
  const ping = live ? `<span class="live-ping"></span>` : '';
  return `
    <div class="live">
      <span class="${dotClass}">${ping}</span>
      <span class="${labelClass}">${labelText}</span>
    </div>
    ${updatedAt ? `<p class="live-meta">${escapeHtml(updatedAt)}</p>` : ''}
    <p class="live-version">${escapeHtml(project)} · v${escapeHtml(version)}</p>
  `;
}

function badge(text, variant) {
  const meta = STATUS_META[String(text).toLowerCase()];
  if (!meta) {
    const className = variant ? `badge ${variant}` : 'badge';
    return `<span class="${className}">${escapeHtml(text)}</span>`;
  }
  return `<span class="badge badge--${meta.tone}"><span class="badge-dot"></span>${escapeHtml(meta.label)}</span>`;
}

function card({ title, subtitle, value, hint } = {}) {
  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">${escapeHtml(title ?? '')}</span>
      </div>
      ${subtitle ? `<p class="card-subtitle">${escapeHtml(subtitle)}</p>` : ''}
      ${value !== undefined && value !== null ? `<p class="card-value">${escapeHtml(String(value))}</p>` : ''}
      ${hint ? `<p class="card-hint">${escapeHtml(hint)}</p>` : ''}
    </div>
  `;
}

function dataTable(columns, rows) {
  const head = columns
    .map((column) => `<th>${escapeHtml(column.label)}</th>`)
    .join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${columns.map((column) => `<td>${column.render(row)}</td>`).join('')}</tr>`,
    )
    .join('');
  return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function handleModalKeydown(event) {
  if (event.key === 'Escape') closeModal();
}

function lockScroll() {
  document.documentElement.classList.add('is-modal-open');
}

function unlockScroll() {
  document.documentElement.classList.remove('is-modal-open');
}

const MODAL_SIZE_CLASS = { md: 'modal--md', lg: 'modal--lg', xl: 'modal--xl' };

function normalizeModalArgs(a, b, c) {
  if (a !== null && typeof a === 'object' && !Array.isArray(a)) return a;
  return { title: a, bodyHtml: b, ...(c || {}) };
}

function modalTabBarHtml(tabs, activeId) {
  const items = tabs
    .map((tab) => {
      const isActive = tab.id === activeId;
      const classes = ['modal-tab'];
      if (isActive) classes.push('modal-tab--active');
      const disabledAttr = tab.disabled ? 'disabled' : '';
      const label = tab.disabled
        ? `${escapeHtml(tab.label)} —`
        : escapeHtml(tab.label);
      return `<button type="button" class="${classes.join(' ')}" data-tab="${escapeHtml(tab.id)}" ${disabledAttr} role="tab" aria-selected="${isActive}">${label}</button>`;
    })
    .join('');
  return `<div class="modal-tabs" role="tablist">${items}</div>`;
}

let activeModal = null;
let modalToken = 0;

function openModal(a, b, c) {
  const opts = normalizeModalArgs(a, b, c);
  const {
    title = '',
    subtitle = '',
    size = 'lg',
    bodyHtml = '',
    tabs = null,
    activeTabId = null,
  } = opts;
  closeModal();
  modalToken += 1;
  const token = modalToken;
  const sizeClass = MODAL_SIZE_CLASS[size] ?? MODAL_SIZE_CLASS.lg;
  const hasTabs = Array.isArray(tabs) && tabs.length > 0;
  const initialTabId = hasTabs
    ? (activeTabId ?? tabs.find((tab) => !tab.disabled)?.id ?? tabs[0].id)
    : null;

  const backdrop = document.createElement('div');
  backdrop.id = 'sdd-modal-backdrop';
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal ${sizeClass}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="modal-header">
        <div class="modal-header-text">
          <h2 class="modal-title">${escapeHtml(title)}</h2>
          ${subtitle ? `<p class="modal-subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <button class="icon-button" type="button" data-modal-close aria-label="Cerrar">${icon('close')}</button>
      </div>
      ${hasTabs ? modalTabBarHtml(tabs, initialTabId) : ''}
      <div class="modal-body" data-modal-body>${hasTabs ? skeletonLines() : bodyHtml}</div>
    </div>
  `;
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeModal();
  });
  backdrop
    .querySelector('[data-modal-close]')
    .addEventListener('click', closeModal);
  document.addEventListener('keydown', handleModalKeydown);
  document.body.append(backdrop);
  lockScroll();

  activeModal = {
    token,
    root: backdrop,
    bodyEl: backdrop.querySelector('[data-modal-body]'),
    tabs: hasTabs ? tabs : null,
    tabCache: new Map(),
    activeTabId: initialTabId,
  };

  if (hasTabs) {
    backdrop.addEventListener('click', (event) => {
      const tabButton = event.target.closest('[data-tab]');
      if (!tabButton || tabButton.disabled || !backdrop.contains(tabButton))
        return;
      loadModalTab(token, tabButton.dataset.tab);
    });
    loadModalTab(token, initialTabId);
  }
}

function paintModalTabBar(token) {
  if (!activeModal || activeModal.token !== token) return;
  const tabBarEl = activeModal.root.querySelector('.modal-tabs');
  if (!tabBarEl) return;
  tabBarEl.outerHTML = modalTabBarHtml(
    activeModal.tabs,
    activeModal.activeTabId,
  );
}

async function loadModalTab(token, tabId) {
  if (!activeModal || activeModal.token !== token) return;
  const tab = activeModal.tabs.find((entry) => entry.id === tabId);
  if (!tab || tab.disabled) return;
  activeModal.activeTabId = tabId;
  paintModalTabBar(token);
  if (activeModal.tabCache.has(tabId)) {
    setModalBody(token, activeModal.tabCache.get(tabId));
    return;
  }
  setModalBody(token, skeletonLines());
  try {
    const html = await tab.load();
    if (
      !activeModal ||
      activeModal.token !== token ||
      activeModal.activeTabId !== tabId
    )
      return;
    activeModal.tabCache.set(tabId, html);
    setModalBody(token, html);
  } catch (error) {
    if (
      !activeModal ||
      activeModal.token !== token ||
      activeModal.activeTabId !== tabId
    )
      return;
    setModalBody(token, errorState(error));
  }
}

function setModalBody(token, html) {
  if (!activeModal || activeModal.token !== token) return;
  activeModal.bodyEl.innerHTML = html;
}

function openAsyncModal({ title, subtitle, size, skeletonHtml, load }) {
  openModal({
    title,
    subtitle,
    size,
    bodyHtml: skeletonHtml ?? skeletonLines(),
  });
  const token = modalToken;
  load().then(
    (html) => setModalBody(token, html),
    (error) => setModalBody(token, errorState(error)),
  );
}

function closeModal() {
  const backdrop = document.getElementById('sdd-modal-backdrop');
  if (backdrop) backdrop.remove();
  document.removeEventListener('keydown', handleModalKeydown);
  activeModal = null;
  unlockScroll();
}

async function renderDashboard(container, params) {
  const [globalResult, specsResult, tasksResult, fixesResult, contextResult] =
    await Promise.allSettled([
      loadGlobal(),
      loadSpecsIndex(),
      loadAssembledTasks(),
      loadFixes(),
      loadContextCatalog(),
    ]);

  const globalData =
    globalResult.status === 'fulfilled' ? globalResult.value : null;
  const specsData =
    specsResult.status === 'fulfilled' ? specsResult.value : null;
  const tasksData =
    tasksResult.status === 'fulfilled' ? tasksResult.value : null;
  const fixesData =
    fixesResult.status === 'fulfilled' ? fixesResult.value : null;
  const contextEntries =
    contextResult.status === 'fulfilled' ? contextResult.value : [];
  const contextError =
    contextResult.status === 'rejected' ? contextResult.reason : null;
  const totalCycles = tasksData ? countAssembledCycles(tasksData) : null;

  container.innerHTML = `
    ${renderDashboardHeader(globalData, totalCycles)}
    ${renderDashboardKpis(specsData, totalCycles, globalData, fixesData)}
    <section style="display:flex;flex-wrap:wrap;gap:24px">
      <div style="flex:2 1 420px;display:flex;flex-direction:column;gap:24px;min-width:0">
        ${renderDashboardAppsSection(globalData, contextEntries)}
        ${renderDashboardLibsSection(contextEntries, contextError)}
      </div>
      <div style="flex:1 1 240px;min-width:0">
        ${renderDashboardMonorepoPanel(globalData)}
      </div>
    </section>
  `;

  attachDashboardCardHandlers(container, contextEntries);
}

function renderDashboardHeader(globalData, totalCycles) {
  if (!globalData) {
    return emptyState(
      'Sin datos del proyecto',
      'No se pudo cargar global.json',
    );
  }
  const inProgressCount = globalData.in_progress_modules?.length ?? 0;
  const overallStatus =
    inProgressCount > 0
      ? 'in-progress'
      : (totalCycles ?? 0) > 0
        ? 'completed'
        : 'pending';
  const syncLabel = lastLoadedAt
    ? new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(lastLoadedAt)
    : null;
  return `
    <header class="page-header">
      <div class="page-header-top">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;flex-wrap:wrap">
          <h1 class="page-title page-title--lg">${escapeHtml(globalData.project ?? '—')}</h1>
          ${badge(overallStatus)}
        </div>
        <button type="button" data-dashboard-refresh style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:var(--radius-md);border:1px solid var(--border);background:transparent;color:var(--text-faint);font-size:var(--text-12);cursor:pointer">${icon('refresh')}Actualizar</button>
      </div>
      <p class="page-subtitle">${escapeHtml(globalData.description ?? '')}</p>
      ${syncLabel ? `<p style="margin-top:12px;font-family:var(--font-mono);font-size:var(--text-10);color:var(--text-subtle)">Última sincronización: ${escapeHtml(syncLabel)}</p>` : ''}
    </header>
  `;
}

function countAssembledCycles(tasksData) {
  return Object.values(tasksData?.specs ?? {}).reduce(
    (sum, spec) => sum + Object.keys(spec.cycles ?? {}).length,
    0,
  );
}

function dashboardStatCell({ value, label, href, accent = false, sub = '' }) {
  const valueColor = accent
    ? 'rgb(var(--rgb-emerald-400))'
    : 'var(--text-strong)';
  // El dato secundario va en su propia línea: metido dentro del valor obligaba
  // a partir el número en dos renglones en las tarjetas angostas.
  const subHtml = sub
    ? `<div class="tile-sub${accent ? ' tile-sub--accent' : ''}">${escapeHtml(String(sub))}</div>`
    : '';
  return `
    <a class="tile" href="${escapeHtml(href)}" style="display:block;text-decoration:none">
      <div style="font-family:var(--font-mono);font-size:var(--text-24);font-weight:var(--weight-semibold);white-space:nowrap;color:${valueColor}">${escapeHtml(String(value))}</div>
      <div style="margin-top:4px;font-family:var(--font-mono);font-size:var(--text-10);text-transform:uppercase;letter-spacing:var(--tracking-widest);color:var(--text-faint)">${escapeHtml(label)}</div>
      ${subHtml}
    </a>
  `;
}

function renderDashboardKpis(specsData, totalCycles, globalData, fixesData) {
  const totalSpecs = specsData?.specs?.length ?? '—';
  const cyclesValue = totalCycles ?? '—';
  const inProgressCount = globalData?.in_progress_modules?.length ?? '—';
  const totalFixes = fixesData?.fixes?.length ?? '—';

  const cells = [
    dashboardStatCell({ value: totalSpecs, label: 'Specs', href: '#/specs' }),
    dashboardStatCell({
      value: cyclesValue,
      label: 'Ciclos',
      href: '#/cycles',
    }),
    dashboardStatCell({
      value: inProgressCount,
      label: 'En progreso',
      href: '#/specs',
      accent: typeof inProgressCount === 'number' && inProgressCount > 0,
    }),
    dashboardStatCell({ value: totalFixes, label: 'Fixes', href: '#/fixes' }),
  ];

  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px">${cells.join('')}</div>`;
}

function dashboardLoadingSkeleton() {
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:24px">
      ${skeletonStat()}${skeletonStat()}${skeletonStat()}${skeletonStat()}
    </div>
    ${skeletonRows(4)}
  `;
}

function dashboardAppStatus(globalData, appKey) {
  const key = appKey.startsWith('apps/') ? appKey : `apps/${appKey}`;
  const isInGroup = (modules) =>
    (modules ?? []).some((moduleEntry) =>
      (moduleEntry.apps ?? []).includes(key),
    );
  if (isInGroup(globalData?.completed_modules)) return 'completed';
  if (isInGroup(globalData?.in_progress_modules)) return 'in-progress';
  return 'pending';
}

function dashboardStatusChip(status) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  return `<span class="badge badge--${meta.tone}">${escapeHtml(meta.label)}</span>`;
}

function dashboardInferTech(description) {
  const text = String(description).toLowerCase();
  if (
    text.includes('springboot') ||
    text.includes('spring boot') ||
    text.includes('java')
  )
    return 'Java';
  if (text.includes('react')) return 'React';
  return 'TS';
}

function dashboardTruncateAfterEmDash(description) {
  const text = String(description);
  const parts = text.split('—');
  return parts.length > 1 ? parts[1].trim() : text;
}

function dashboardContextKey(category, name) {
  return `${category}:${name}`;
}

function findDashboardContextEntry(contextEntries, category, name) {
  return contextEntries.find(
    (entry) => entry.category === category && entry.name === name,
  );
}

function dashboardSectionHeading(title, meta) {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h2 style="font-size:var(--text-12);font-weight:var(--weight-semibold);text-transform:uppercase;letter-spacing:var(--tracking-widest);color:var(--text-faint)">${escapeHtml(title)}</h2>
      <span style="font-family:var(--font-mono);font-size:var(--text-10);color:var(--text-subtle)">${escapeHtml(meta)}</span>
    </div>
  `;
}

function dashboardAppRow(name, description, status, index, contextEntries) {
  const ref = deriveMonorepoAppRef(name, description);
  const entry = findDashboardContextEntry(
    contextEntries,
    ref.category,
    ref.name,
  );
  const rowAttrs = entry
    ? ` tabindex="0" role="button" data-dashboard-context="${escapeHtml(dashboardContextKey(ref.category, ref.name))}" style="cursor:pointer" aria-label="Ver contexto de ${escapeHtml(name)}"`
    : '';
  return `
    <div class="row"${rowAttrs}>
      <span class="row-lead" style="font-family:var(--font-mono);font-size:var(--text-12);color:var(--text-subtle)">${String(index + 1).padStart(2, '0')}</span>
      <div class="row-main">
        <p style="font-family:var(--font-mono);font-size:var(--text-14);color:var(--text-bright);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(name)}</p>
        <p style="font-size:var(--text-11);color:var(--text-subtle);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(dashboardInferTech(description))} · ${escapeHtml(dashboardTruncateAfterEmDash(description))}</p>
      </div>
      <span class="row-trail">
        ${dashboardStatusChip(status)}
        ${entry ? `<span class="row-chevron">›</span>` : ''}
      </span>
    </div>
  `;
}

function dashboardLibRow(entry, index) {
  return `
    <div class="row" tabindex="0" role="button" data-dashboard-context="${escapeHtml(dashboardContextKey(entry.category, entry.name))}" style="cursor:pointer" aria-label="Ver contexto de ${escapeHtml(entry.name)}">
      <span class="row-lead" style="font-family:var(--font-mono);font-size:var(--text-12);color:var(--text-subtle)">${String(index + 1).padStart(2, '0')}</span>
      <div class="row-main">
        <p style="font-family:var(--font-mono);font-size:var(--text-14);color:var(--text-bright)">${escapeHtml(entry.name)}</p>
      </div>
      <span class="row-chevron">›</span>
    </div>
  `;
}

function renderDashboardAppsSection(globalData, contextEntries) {
  if (!globalData) {
    return `<div>${dashboardSectionHeading('Apps', '—')}${emptyState('No se pudo cargar global.json', 'No se pudo determinar la lista de apps del monorepo.')}</div>`;
  }
  const apps = Object.entries(globalData?.monorepo?.apps ?? {});
  const body =
    apps.length === 0
      ? emptyState(
          'Sin apps registradas',
          'global.json.monorepo.apps está vacío.',
        )
      : apps
          .map(([name, description], index) =>
            dashboardAppRow(
              name,
              description,
              dashboardAppStatus(globalData, name),
              index,
              contextEntries,
            ),
          )
          .join('');
  return `<div>${dashboardSectionHeading('Apps', `${apps.length} proyectos`)}${body}</div>`;
}

function renderDashboardLibsSection(contextEntries, contextError) {
  const libs = contextEntries.filter((entry) => entry.category === 'libs');
  const body = contextError
    ? errorState(contextError)
    : libs.length === 0
      ? emptyState(
          'Sin libs registradas',
          'No hay subproyectos de categoría libs con contexto disponible.',
        )
      : libs.map((entry, index) => dashboardLibRow(entry, index)).join('');
  return `<div>${dashboardSectionHeading('Libs', contextError ? '—' : `${libs.length} librerías`)}${body}</div>`;
}

function dashboardCyclesCompletedTotal(globalData) {
  return (globalData?.completed_modules ?? []).reduce(
    (sum, moduleEntry) => sum + (moduleEntry.cycles_completed ?? 0),
    0,
  );
}

function dashboardMonorepoField(label, value) {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid rgb(var(--rgb-zinc-800) / 0.4)">
      <span style="font-size:var(--text-11);color:var(--text-faint)">${escapeHtml(label)}</span>
      <span style="font-family:var(--font-mono);font-size:var(--text-11);color:var(--text-muted);text-align:right">${escapeHtml(value)}</span>
    </div>
  `;
}

function renderDashboardMonorepoPanel(globalData) {
  if (!globalData)
    return emptyState(
      'Sin datos del monorepo',
      'No se pudo cargar global.json',
    );
  const fields = [
    ['Tool', globalData.monorepo?.tool ?? '—'],
    ['Package manager', globalData.monorepo?.package_manager ?? '—'],
    ['Ciclos completados', String(dashboardCyclesCompletedTotal(globalData))],
    ['Versión', globalData.version ?? '—'],
  ];
  // Miraba pending + in_progress: un proyecto con TODO terminado (pending 0,
  // in_progress 0, completed N) caía acá y decía que el ciclo no había empezado.
  const hasNotStarted =
    (globalData.completed_modules ?? []).length === 0 &&
    (globalData.in_progress_modules ?? []).length === 0;
  const note = hasNotStarted
    ? `<div style="margin-top:16px;padding:16px;border-radius:var(--radius-lg);border:1px solid var(--border);background:rgb(var(--rgb-zinc-900) / 0.4)"><p style="font-size:var(--text-11);color:var(--text-faint);line-height:var(--leading-relaxed)">El ciclo SDD aún no ha iniciado. Todos los módulos están en estado <span style="font-family:var(--font-mono);color:var(--text-muted)">pending</span>.</p></div>`
    : '';
  return `
    <div>
      <h2 style="font-size:var(--text-12);font-weight:var(--weight-semibold);text-transform:uppercase;letter-spacing:var(--tracking-widest);color:var(--text-faint);margin-bottom:12px">Monorepo</h2>
      <div>${fields.map(([label, value]) => dashboardMonorepoField(label, value)).join('')}</div>
      ${note}
    </div>
  `;
}

function attachDashboardCardHandlers(container, contextEntries) {
  const entryByKey = new Map(
    contextEntries.map((entry) => [
      dashboardContextKey(entry.category, entry.name),
      entry,
    ]),
  );
  for (const rowEl of container.querySelectorAll('[data-dashboard-context]')) {
    const entry = entryByKey.get(rowEl.dataset.dashboardContext);
    const open = () => openDashboardContextModal(entry);
    rowEl.addEventListener('click', open);
    rowEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      open();
    });
  }
  const refreshButton = container.querySelector('[data-dashboard-refresh]');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      invalidateCache();
      onRoute();
    });
  }
}

function openDashboardContextModal(entry) {
  if (!entry) {
    openModal('Contexto', emptyState('Sin contexto SDD'));
    return;
  }
  openContextDocModal(entry);
}

async function renderPlanning(container, params) {
  const [tasksResult, specsResult, fixesResult] = await Promise.allSettled([
    loadAssembledTasks(),
    loadSpecsIndex(),
    loadFixes(),
  ]);

  const specsIndex =
    specsResult.status === 'fulfilled' ? specsResult.value : null;
  const specGroups =
    tasksResult.status === 'fulfilled'
      ? planningBuildSpecGroups(tasksResult.value, specsIndex)
      : null;
  const fixList =
    fixesResult.status === 'fulfilled' ? (fixesResult.value.fixes ?? []) : null;

  const allTasks = specGroups
    ? specGroups.flatMap((group) =>
        group.cycles.flatMap((cycle) => cycle.tasks),
      )
    : null;
  const taskStats = allTasks ? planningItemStats(allTasks) : null;
  const fixStats = fixList ? planningFixStats(fixList) : null;

  container.innerHTML = `
    ${planningHeader()}
    ${planningKpisSection(taskStats, fixStats)}
    ${planningProgressSection(taskStats, fixStats)}
    ${planningSpecSection(specGroups)}
    ${planningFixesSection(fixList)}
    ${planningLegend()}
  `;

  bindPlanningInteractions(container);
}

function planningHeader() {
  return pageHeader({
    title: 'Planificación',
    subtitle:
      'Horas, story points y progreso derivados de tasks.json, specs/index.json y fixes.json.',
  });
}

function planningChevron(open) {
  return `<svg data-chevron viewBox="0 0 10 6" width="10" height="6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="flex-shrink:0;transition:transform 0.2s;transform:rotate(${open ? 0 : -90}deg);color:var(--text-faint)"><path d="M1 1l4 4 4-4"></path></svg>`;
}

function planningDomId(prefix, ...parts) {
  return [prefix, ...parts].join('-').replace(/[^a-zA-Z0-9_-]/g, '-');
}

function planningHoursSummaryRow(doneHours, totalHours, extraHtml) {
  return `
    <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;padding:10px 16px;background:rgb(var(--rgb-zinc-900) / 0.15);">
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="card-hint" style="margin:0;text-transform:uppercase;letter-spacing:0.05em;">Horas estimadas</span>
        ${planningHoursBar(doneHours, totalHours)}
      </div>
      ${extraHtml ?? ''}
    </div>
  `;
}

function bindPlanningInteractions(container) {
  container.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-toggle]');
    if (!toggle || !container.contains(toggle)) return;
    const target = document.getElementById(toggle.getAttribute('data-toggle'));
    if (!target) return;
    const wasHidden = target.hidden;
    target.hidden = !wasHidden;
    toggle.setAttribute('aria-expanded', String(wasHidden));
    const chevron = toggle.querySelector('[data-chevron]');
    if (chevron) chevron.style.transform = `rotate(${wasHidden ? 0 : -90}deg)`;
  });
}

function planningLegend() {
  const items = [
    { color: 'var(--ok)', label: 'done / completed' },
    { color: 'var(--warn)', label: 'in-progress' },
    { color: 'var(--text-faint)', label: 'pending' },
    { color: 'rgb(var(--rgb-violet-400))', label: 'SP — story points' },
    { color: 'rgb(var(--rgb-rose-500))', label: 'HOTFIX' },
  ];
  return `
    <div style="border-radius:var(--radius-lg);border:1px solid rgb(var(--rgb-zinc-800) / 0.4);background:rgb(var(--rgb-zinc-900) / 0.1);padding:16px 20px;">
      <p class="card-hint" style="margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">Referencias</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px 24px;">
        ${items
          .map(
            (item) => `
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="width:8px;height:8px;border-radius:999px;background:${item.color};flex-shrink:0;"></span>
            <span class="card-hint" style="margin:0;">${escapeHtml(item.label)}</span>
          </div>
        `,
          )
          .join('')}
      </div>
    </div>
  `;
}

function planningSumHours(items) {
  return items.reduce(
    (sum, item) => sum + (Number(item.estimation_hours) || 0),
    0,
  );
}

function planningSumPoints(items) {
  return items.reduce((sum, item) => sum + (Number(item.story_points) || 0), 0);
}

function planningCountDone(items) {
  return items.filter((item) => item.status === 'done').length;
}

function planningDoneFraction(items) {
  if (items.length === 0) return 0;
  return planningCountDone(items) / items.length;
}

function planningFixIsCompleted(fix) {
  return ['implemented', 'validated', 'absorbed'].includes(fix.status);
}

function planningItemStats(items) {
  const doneItems = items.filter((item) => item.status === 'done');
  return {
    total: items.length,
    done: doneItems.length,
    hours: planningSumHours(items),
    doneHours: planningSumHours(doneItems),
    points: planningSumPoints(items),
    donePoints: planningSumPoints(doneItems),
  };
}

function planningFixStats(fixList) {
  const doneFixes = fixList.filter(planningFixIsCompleted);
  return {
    total: fixList.length,
    done: doneFixes.length,
    hours: planningSumHours(fixList),
    doneHours: planningSumHours(doneFixes),
  };
}

function planningBuildSpecGroups(assembled, specsIndex) {
  return sortBy(
    Object.entries(assembled?.specs ?? {}),
    ([specId]) => specId,
  ).map(([specId, spec]) => ({
    specId,
    title: findSpecTitle(specsIndex, specId) ?? specId,
    cycles: sortBy(
      Object.entries(spec.cycles ?? {}),
      ([cycleId]) => cycleId,
    ).map(([cycleId, cycle]) => ({
      cycleId,
      tasks: cycle.tasks ?? [],
    })),
  }));
}

function planningProgressColor(fraction) {
  if (fraction >= 1) return 'var(--ok)';
  if (fraction > 0) return 'var(--warn)';
  return 'var(--border-soft)';
}

function planningProgressBar(fraction) {
  const pct = Math.round(Math.min(Math.max(fraction, 0), 1) * 100);
  return `<div style="height:4px;border-radius:999px;background:var(--surface-2);overflow:hidden;"><div style="height:100%;width:${pct}%;border-radius:999px;background:${planningProgressColor(fraction)};"></div></div>`;
}

function planningHoursBar(doneHours, totalHours) {
  const fraction = totalHours > 0 ? doneHours / totalHours : 0;
  const pct = Math.round(fraction * 100);
  return `
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="flex:1;min-width:60px;">${planningProgressBar(fraction)}</div>
      <span class="card-hint" style="margin:0;white-space:nowrap;">${escapeHtml(`${formatHours(doneHours)} / ${formatHours(totalHours)} (${pct}%)`)}</span>
    </div>
  `;
}

function planningStatusDotColor(status) {
  if (status === 'done') return 'var(--ok)';
  if (status === 'in-progress') return 'var(--warn)';
  return 'var(--border-soft)';
}

function planningStatusDot(status) {
  return `<span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:${planningStatusDotColor(status)};flex-shrink:0;"></span>`;
}

function planningFixStatusDot(fix) {
  return planningStatusDot(planningFixIsCompleted(fix) ? 'done' : fix.status);
}

function planningKpisSection(taskStats, fixStats) {
  if (!taskStats && !fixStats) {
    return emptyState(
      'Sin datos de planificación',
      'No se pudo cargar tasks.json ni fixes.json.',
    );
  }
  const totalHours = (taskStats?.hours ?? 0) + (fixStats?.hours ?? 0);
  const doneHours = (taskStats?.doneHours ?? 0) + (fixStats?.doneHours ?? 0);
  const totalItems = (taskStats?.total ?? 0) + (fixStats?.total ?? 0);
  const doneItems = (taskStats?.done ?? 0) + (fixStats?.done ?? 0);
  const velocityPct =
    totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  const cards = [
    card({
      title: 'Horas totales',
      value: formatHours(totalHours),
      hint: `${formatHours(doneHours)} completadas · fixes incl.`,
    }),
    card({
      title: 'Story Points',
      value: taskStats ? taskStats.points : '—',
      hint: taskStats ? `${taskStats.donePoints} completados` : 'no disponible',
    }),
    card({
      title: 'Tareas + Fixes',
      value: `${doneItems} / ${totalItems}`,
      hint: `${velocityPct}% completado`,
    }),
    card({
      title: 'Fixes registrados',
      value: fixStats ? fixStats.total : '—',
      hint: fixStats
        ? `${formatHours(fixStats.hours)} estimadas`
        : 'no disponible',
    }),
  ];
  return `<div class="card-grid">${cards.join('')}</div>`;
}

function planningProgressSection(taskStats, fixStats) {
  const totalItems = (taskStats?.total ?? 0) + (fixStats?.total ?? 0);
  if (totalItems === 0) return '';
  const doneItems = (taskStats?.done ?? 0) + (fixStats?.done ?? 0);
  const fraction = doneItems / totalItems;
  const pct = Math.round(fraction * 100);
  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Progreso global</span>
        ${badge(`${pct}%`)}
      </div>
      <p class="card-hint">${escapeHtml(`${doneItems} de ${totalItems} items (tareas + fixes)`)}</p>
      ${planningProgressBar(fraction)}
    </div>
  `;
}

const PLANNING_TASK_COLUMNS = [
  { label: '', render: (task) => planningStatusDot(task.status) },
  { label: 'ID', render: (task) => `<code>${escapeHtml(task.id)}</code>` },
  { label: 'Título', render: (task) => escapeHtml(task.title ?? '—') },
  {
    label: 'Historias',
    render: (task) =>
      task.user_stories?.length
        ? task.user_stories
            .map((hu) => `<code>${escapeHtml(hu)}</code>`)
            .join(' ')
        : '—',
  },
  {
    label: 'SP',
    render: (task) =>
      task.story_points === undefined || task.story_points === null
        ? '—'
        : String(task.story_points),
  },
  {
    label: 'Horas',
    render: (task) => escapeHtml(formatHours(task.estimation_hours)),
  },
];

function planningCycleCard(specId, cycleId, tasks, defaultOpen) {
  const stats = planningItemStats(tasks);
  const fraction = planningDoneFraction(tasks);
  const body =
    tasks.length === 0
      ? emptyState('Sin tareas en este ciclo')
      : dataTable(PLANNING_TASK_COLUMNS, tasks);
  const contentId = planningDomId('planning-cycle', specId, cycleId);
  return `
    <div style="border-radius:var(--radius-lg);border:1px solid rgb(var(--rgb-zinc-800) / 0.4);overflow:hidden;">
      <button type="button" data-toggle="${contentId}" aria-expanded="${defaultOpen}" aria-controls="${contentId}" style="all:unset;box-sizing:border-box;cursor:pointer;text-align:left;display:flex;align-items:center;gap:12px;width:100%;padding:10px 14px;background:rgb(var(--rgb-zinc-900) / 0.3);">
        ${planningChevron(defaultOpen)}
        <span style="flex:1;min-width:0;font-family:var(--font-mono);font-size:var(--text-12);color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(cycleId)}</span>
        <span class="card-hint" style="margin:0;white-space:nowrap;">${stats.done}/${stats.total} tareas</span>
        ${stats.points > 0 ? `<span style="font-family:var(--font-mono);font-size:var(--text-10);color:rgb(var(--rgb-violet-400) / 0.7);white-space:nowrap;">${stats.points} SP</span>` : ''}
        <span class="card-hint" style="margin:0;white-space:nowrap;">${escapeHtml(formatHours(stats.hours))}</span>
        <span style="width:80px;flex-shrink:0;">${planningProgressBar(fraction)}</span>
      </button>
      <div id="${contentId}" ${defaultOpen ? '' : 'hidden'}>
        ${planningHoursSummaryRow(
          stats.doneHours,
          stats.hours,
          stats.points > 0
            ? `<div class="card-hint" style="margin:0;">Story points: ${stats.donePoints} / ${stats.points}</div>`
            : '',
        )}
        ${body}
      </div>
    </div>
  `;
}

function planningSpecCard(group) {
  const allTasks = group.cycles.flatMap((cycle) => cycle.tasks);
  const stats = planningItemStats(allTasks);
  const fraction = planningDoneFraction(allTasks);
  const contentId = planningDomId('planning-spec', group.specId);
  return `
    <div style="border-radius:var(--radius-xl);border:1px solid rgb(var(--rgb-zinc-800) / 0.6);overflow:hidden;">
      <button type="button" data-toggle="${contentId}" aria-expanded="false" aria-controls="${contentId}" style="all:unset;box-sizing:border-box;cursor:pointer;text-align:left;display:flex;align-items:flex-start;gap:16px;width:100%;padding:16px 20px;background:rgb(var(--rgb-zinc-900) / 0.3);">
        ${planningChevron(false)}
        <div style="flex:1;min-width:0;">
          <p class="card-hint" style="margin:0;letter-spacing:0.05em;">${escapeHtml(group.specId)}</p>
          <p style="margin:2px 0 0;font-size:var(--text-14);color:var(--text-bright);font-weight:var(--weight-medium);">${escapeHtml(group.title)}</p>
          <div style="margin-top:10px;">${planningProgressBar(fraction)}</div>
        </div>
        <div style="flex-shrink:0;display:flex;gap:16px;align-items:flex-start;">
          <div style="text-align:right;">
            <p class="card-hint" style="margin:0;text-transform:uppercase;">Horas</p>
            <p style="margin:0;font-family:var(--font-mono);font-size:var(--text-14);color:var(--text-dim);">${escapeHtml(formatHours(stats.doneHours))} <span style="color:var(--text-ghost);">/ ${escapeHtml(formatHours(stats.hours))}</span></p>
          </div>
          ${
            stats.points > 0
              ? `<div style="text-align:right;">
            <p class="card-hint" style="margin:0;text-transform:uppercase;">SP</p>
            <p style="margin:0;font-family:var(--font-mono);font-size:var(--text-14);color:rgb(var(--rgb-violet-400));">${stats.donePoints} <span style="color:var(--text-ghost);">/ ${stats.points}</span></p>
          </div>`
              : ''
          }
          <div style="text-align:right;">
            <p class="card-hint" style="margin:0;text-transform:uppercase;">Progreso</p>
            <p style="margin:0;font-family:var(--font-mono);font-size:var(--text-14);color:${fraction >= 1 ? 'var(--ok)' : 'var(--warn)'};">${Math.round(fraction * 100)}%</p>
          </div>
        </div>
      </button>
      <div id="${contentId}" hidden style="padding:12px;background:rgb(var(--rgb-black) / 0.15);">
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${group.cycles.map((cycle, index) => planningCycleCard(group.specId, cycle.cycleId, cycle.tasks, index === 0)).join('')}
        </div>
      </div>
    </div>
  `;
}

function planningSpecSection(specGroups) {
  if (!specGroups) {
    return emptyState('Sin datos de tareas', 'No se pudo cargar tasks.json.');
  }
  if (specGroups.length === 0) {
    return emptyState(
      'Sin specs registradas en tasks.json',
      'El desglose aparece cuando un ciclo SDD genera su tasks.json.',
    );
  }
  return `<div style="display:flex;flex-direction:column;gap:12px;">${specGroups.map((group) => planningSpecCard(group)).join('')}</div>`;
}

function planningFixCard(fix) {
  return `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border);">
      ${planningFixStatusDot(fix)}
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
          <span class="card-hint" style="margin:0;">${escapeHtml(fix.id)}</span>
          <span style="font-size:var(--text-14);color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(fix.title ?? '—')}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap;">
          ${badge(fix.type ?? '—', fixTypeClass(fix.type))}
          ${fix.spec_id ? `<span class="card-hint" style="margin:0;">${escapeHtml(fix.spec_id.replace(/^spec-/, ''))}</span>` : ''}
          ${fix.cycle ? `<span class="card-hint" style="margin:0;">${escapeHtml(fix.cycle)}</span>` : ''}
        </div>
      </div>
      <span class="card-hint" style="margin:0;white-space:nowrap;">${fix.estimation_hours != null ? escapeHtml(formatHours(fix.estimation_hours)) : '—'}</span>
    </div>
  `;
}

function planningFixesSection(fixList) {
  if (!fixList) {
    return emptyState('Sin datos de fixes', 'No se pudo cargar fixes.json.');
  }
  if (fixList.length === 0) {
    return emptyState(
      'Sin fixes registrados',
      'Los fixes aparecen al usar los prefijos [HOTFIX], [BUGFIX], [FIX] o [IMPROVEMENT] para bypasear el SPEC GATE.',
    );
  }
  const stats = planningFixStats(fixList);
  const fraction = stats.total > 0 ? stats.done / stats.total : 0;
  const contentId = 'planning-fixes';
  return `
    <div style="border-radius:var(--radius-xl);border:1px solid rgb(var(--rgb-zinc-800) / 0.6);overflow:hidden;">
      <button type="button" data-toggle="${contentId}" aria-expanded="false" aria-controls="${contentId}" style="all:unset;box-sizing:border-box;cursor:pointer;text-align:left;display:flex;align-items:flex-start;gap:16px;width:100%;padding:16px 20px;background:rgb(var(--rgb-zinc-900) / 0.3);">
        ${planningChevron(false)}
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-family:var(--font-mono);font-size:var(--text-12);color:var(--text-dim);">Fixes &amp; Mejoras</span>
            ${badge(`${fixList.length} fix${fixList.length === 1 ? '' : 'es'}`)}
          </div>
          <div style="margin-top:10px;">${planningProgressBar(fraction)}</div>
        </div>
        <div style="flex-shrink:0;text-align:right;">
          <p class="card-hint" style="margin:0;text-transform:uppercase;">Progreso</p>
          <p style="margin:0;font-family:var(--font-mono);font-size:var(--text-14);color:${fraction >= 1 ? 'var(--ok)' : 'var(--warn)'};">${Math.round(fraction * 100)}%</p>
          <p class="card-hint" style="margin:2px 0 0;">${stats.done}/${stats.total} completados</p>
        </div>
      </button>
      <div id="${contentId}" hidden>
        ${planningHoursSummaryRow(stats.doneHours, stats.hours)}
        <div>${fixList.map((fix) => planningFixCard(fix)).join('')}</div>
      </div>
    </div>
  `;
}

function specStatusClass(status) {
  if (status === 'completed') return 'status--done';
  if (status === 'cancelled') return 'status--skipped';
  return `status--${status ?? 'pending'}`;
}

function cyclesBySpec(cycleIndex) {
  const map = new Map();
  for (const { specId, cycleId } of cycleIndex) {
    if (!map.has(specId)) map.set(specId, []);
    map.get(specId).push(cycleId);
  }
  for (const cycleIds of map.values()) cycleIds.sort();
  return map;
}

function specsHeader(total) {
  return pageHeader({
    title: 'Specs',
    meta: `${total} registrada${total === 1 ? '' : 's'}`,
    subtitle:
      'Especificaciones técnicas registradas en sdd/specs/index.json, convención spec-[gh-user]-[NNN]-[slug].',
  });
}

function specsListHeaderRow() {
  return `
    <div style="display:flex;align-items:center;gap:16px;padding:8px 4px;border-bottom:1px solid var(--border);">
      <span class="card-hint" style="margin:0;width:34px;flex-shrink:0;text-transform:uppercase;letter-spacing:0.05em;">ID</span>
      <span class="card-hint" style="margin:0;flex:1;text-transform:uppercase;letter-spacing:0.05em;">Título</span>
      <span class="card-hint" style="margin:0;flex-shrink:0;text-transform:uppercase;letter-spacing:0.05em;">Estado</span>
    </div>
  `;
}

function renderSpecRow(spec, index) {
  const number = String(index + 1).padStart(3, '0');
  const stagger = `stagger-${Math.min(index + 1, 8)}`;
  const subMeta = [spec.module, spec.file].filter(Boolean).join(' · ');
  return `
    <div class="row animate-fade-in-up ${stagger}" tabindex="0" role="button" data-row="${index}" aria-label="Ver detalle de ${escapeHtml(spec.title ?? spec.id)}">
      <span class="row-lead" style="width:34px;font-family:var(--font-mono);font-size:var(--text-12);color:rgb(var(--rgb-emerald-500) / 0.6);">${number}</span>
      <span class="row-main">
        <span style="font-size:var(--text-14);color:var(--text-bright);font-weight:var(--weight-medium);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(spec.title ?? spec.id)}</span>
        ${subMeta ? `<span style="font-family:var(--font-mono);font-size:var(--text-10);color:var(--text-faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(subMeta)}</span>` : ''}
      </span>
      <span class="row-trail">
        ${badge(spec.status ?? '—', specStatusClass(spec.status))}
        <span class="row-chevron">›</span>
      </span>
    </div>
  `;
}

function specsFileConventionPanel() {
  return `
    <div style="border-radius:var(--radius-lg);border:1px solid rgb(var(--rgb-zinc-800) / 0.6);background:rgb(var(--rgb-zinc-900) / 0.2);padding:16px 20px;">
      <p class="card-hint" style="margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;">Convención de archivos</p>
      <p style="margin:0;font-family:var(--font-mono);font-size:var(--text-12);">
        <span style="color:rgb(var(--rgb-emerald-400) / 0.7);">sdd/specs/</span><span style="color:var(--text-muted);">spec-[gh-user]-[NNN]-[slug]/</span>
      </p>
      <p class="card-hint" style="margin-top:6px;">Cada spec tiene un ID único por autor registrado en <code>sdd/specs/index.json</code>. NNN es el contador personal del dev.</p>
    </div>
  `;
}

function bindSpecsInteractions(container, specs, cyclesMap) {
  const openFromRow = (row) => {
    const spec = specs[Number(row.dataset.row)];
    if (!spec) return;
    openSpecDetailModal(spec, cyclesMap.get(spec.id) ?? []);
  };
  container.addEventListener('click', (event) => {
    const row = event.target.closest('[data-row]');
    if (!row || !container.contains(row)) return;
    openFromRow(row);
  });
  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const row = event.target.closest('[data-row]');
    if (!row || !container.contains(row)) return;
    event.preventDefault();
    openFromRow(row);
  });
}

function specField(label, valueHtml) {
  return `
    <div>
      <p class="card-hint" style="margin:0 0 2px;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(label)}</p>
      <p style="margin:0;font-family:var(--font-mono);font-size:var(--text-12);color:var(--text-dim);">${valueHtml}</p>
    </div>
  `;
}

function specDetailsTab(spec, cycleNames) {
  return `
    <div style="display:flex;flex-direction:column;gap:14px;">
      ${badge(spec.status ?? '—', specStatusClass(spec.status))}
      ${specField('ID', `<code>${escapeHtml(spec.id)}</code>`)}
      ${spec.author ? specField('Autor', escapeHtml(spec.author)) : ''}
      ${spec.slug ? specField('Slug', escapeHtml(spec.slug)) : ''}
      ${specField('Módulo', escapeHtml(spec.module ?? '—'))}
      ${specField('App', escapeHtml(spec.app ?? '—'))}
      ${specField('Creada', escapeHtml(spec.created_at ?? '—'))}
      ${specField('Completada', escapeHtml(spec.completed_at ?? '—'))}
      ${
        (spec.depends_on ?? []).length > 0
          ? specField(
              'Depende de',
              spec.depends_on
                .map((dep) => `<code>${escapeHtml(dep)}</code>`)
                .join(' '),
            )
          : ''
      }
      ${
        spec.file
          ? specField(
              'Archivo',
              `<span style="color:rgb(var(--rgb-emerald-400) / 0.7);word-break:break-all;">${escapeHtml(spec.file)}</span>`,
            )
          : ''
      }
      ${
        cycleNames.length > 0
          ? `
        <div>
          <p class="card-hint" style="margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;">Ciclos (${cycleNames.length})</p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${cycleNames
              .map(
                (name) =>
                  `<span class="chip chip--sm" style="color:var(--text-dim);background:rgb(var(--rgb-zinc-900) / 0.5);">${escapeHtml(name)}</span>`,
              )
              .join('')}
          </div>
        </div>
      `
          : ''
      }
    </div>
  `;
}

function specSkeletonLines() {
  const widths = [92, 100, 84, 96, 70, 88];
  return `
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${widths.map((width) => `<div class="animate-shimmer" style="height:12px;width:${width}%;border-radius:4px;"></div>`).join('')}
    </div>
  `;
}

function specTabButton(tab, active) {
  return `<button type="button" data-spec-tab="${tab.id}" style="all:unset;cursor:pointer;padding:8px 14px;font-family:var(--font-mono);font-size:var(--text-12);border-bottom:2px solid ${active ? 'var(--accent)' : 'transparent'};color:${active ? 'rgb(var(--rgb-emerald-400))' : 'var(--text-faint)'};margin-bottom:-1px;">${escapeHtml(tab.label)}</button>`;
}

function bindSpecModalTabs(spec) {
  const backdrop = document.getElementById('sdd-modal-backdrop');
  const root = backdrop?.querySelector('[data-spec-modal]');
  if (!root) return;
  const specPanel = root.querySelector('[data-tab-panel="spec"]');
  let specMdLoaded = false;

  const activate = async (tabId) => {
    root.dataset.activeTab = tabId;
    for (const button of root.querySelectorAll('[data-spec-tab]')) {
      const isActive = button.dataset.specTab === tabId;
      button.style.borderColor = isActive ? 'var(--accent)' : 'transparent';
      button.style.color = isActive
        ? 'rgb(var(--rgb-emerald-400))'
        : 'var(--text-faint)';
    }
    for (const panel of root.querySelectorAll('[data-tab-panel]')) {
      panel.hidden = panel.dataset.tabPanel !== tabId;
    }
    if (tabId !== 'spec' || specMdLoaded) return;
    specMdLoaded = true;
    if (!spec.file) {
      specPanel.innerHTML = `<p class="card-hint" style="margin:0;">No hay archivo de spec definido.</p>`;
      return;
    }
    specPanel.innerHTML = specSkeletonLines();
    try {
      const html = await loadMarkdown(stripSddPrefix(spec.file));
      if (root.dataset.activeTab !== 'spec') return;
      specPanel.innerHTML = `<div class="markdown">${html}</div>`;
    } catch (error) {
      specPanel.innerHTML = errorState(error);
    }
  };

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-spec-tab]');
    if (!button) return;
    activate(button.dataset.specTab);
  });
}

async function openSpecDetailModal(spec, cycleNames) {
  const tabs = [
    { id: 'details', label: 'Detalles' },
    { id: 'spec', label: 'Especificación' },
  ];
  const bodyHtml = `
    <div data-spec-modal data-active-tab="details">
      <div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:16px;">
        ${tabs.map((tab) => specTabButton(tab, tab.id === 'details')).join('')}
      </div>
      <div data-tab-panel="details">${specDetailsTab(spec, cycleNames)}</div>
      <div data-tab-panel="spec" hidden></div>
    </div>
  `;
  openModal(spec.title ?? spec.id, bodyHtml, { size: 'xl' });
  bindSpecModalTabs(spec);
}

async function renderSpecs(container, params) {
  let specsIndex;
  try {
    specsIndex = await loadSpecsIndex();
  } catch (error) {
    container.innerHTML = errorState(error);
    return;
  }
  const specs = specsIndex.specs ?? [];
  const cycleIndex = await loadCycleIndex().catch(() => []);
  const cyclesMap = cyclesBySpec(cycleIndex);

  if (specs.length === 0) {
    container.innerHTML = `
      ${specsHeader(0)}
      ${emptyState(
        'Sin specs registradas',
        'Las especificaciones técnicas aparecen aquí una vez registradas en sdd/specs/index.json. El ciclo SDD aún no ha iniciado.',
      )}
    `;
    return;
  }

  container.innerHTML = `
    ${specsHeader(specs.length)}
    <div>
      ${specsListHeaderRow()}
      ${specs.map((spec, index) => renderSpecRow(spec, index)).join('')}
    </div>
    ${specsFileConventionPanel()}
  `;

  bindSpecsInteractions(container, specs, cyclesMap);
}

function cyclesHeader(total, groupCount) {
  return pageHeader({
    title: 'Ciclos',
    meta: `${total} ciclo${total === 1 ? '' : 's'} en ${groupCount} spec${groupCount === 1 ? '' : 's'}`,
    subtitle:
      'Historial de ciclos SDD — cada ciclo representa una unidad de trabajo completa, de brief.yaml a cycle.json completed.',
  });
}

function listSearchBox(placeholder, value) {
  return `
    <div style="position:relative;">
      <span style="position:absolute; top:0; bottom:0; left:12px; display:flex; align-items:center; pointer-events:none; color: var(--text-subtle);">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6.5" cy="6.5" r="4.5" /><path d="M10.5 10.5l3 3" stroke-linecap="round" /></svg>
      </span>
      <input type="text" data-list-search value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"
        style="width:100%; box-sizing:border-box; background: rgb(var(--rgb-zinc-900) / 0.6); border:1px solid var(--border); border-radius: var(--radius-lg); padding:8px 32px; font-family: var(--font-mono); font-size: var(--text-14); color: var(--text-muted);" />
      <button type="button" data-list-search-clear ${value ? '' : 'hidden'} aria-label="Limpiar búsqueda"
        style="position:absolute; top:0; bottom:0; right:12px; background:none; border:none; padding:0; color: var(--text-subtle); cursor:pointer;">
        <span style="display:flex; align-items:center; justify-content:center; width:100%; height:100%">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 2l12 12M14 2L2 14" stroke-linecap="round" /></svg>
        </span>
      </button>
    </div>
  `;
}

function bindListSearch(container, onChange) {
  const input = container.querySelector('[data-list-search]');
  const clearBtn = container.querySelector('[data-list-search-clear]');
  if (!input) return;
  input.addEventListener('input', () => {
    if (clearBtn) clearBtn.hidden = input.value === '';
    onChange(input.value);
  });
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.hidden = true;
      onChange('');
      input.focus();
    });
  }
}

function specStatusChip(status) {
  if (!status) return '';
  return `<span style="font-family:var(--font-mono); font-size:var(--text-10); padding:2px 6px; border-radius:var(--radius-sm); border:1px solid var(--border); color:var(--text-subtle); white-space:nowrap;">${escapeHtml(status)}</span>`;
}

function groupHeaderButton(
  { eyebrow, title, subtitle, meta, statusChip },
  contentId,
  groupAttr,
  collapsed,
) {
  return `
    <button type="button" data-toggle="${contentId}" ${groupAttr} aria-expanded="${!collapsed}" aria-controls="${contentId}"
      style="all:unset; box-sizing:border-box; cursor:pointer; text-align:left; display:flex; align-items:center; gap:12px; width:100%; padding-bottom:8px; border-bottom:1px solid var(--border);">
      ${planningChevron(!collapsed)}
      <span style="flex:1; min-width:0;">
        <p class="card-hint" style="margin:0; text-transform:uppercase; letter-spacing:0.05em;">${escapeHtml(eyebrow)}</p>
        <p style="margin:2px 0 0; font-size:var(--text-14); color:var(--text-bright); font-weight:var(--weight-medium); overflow-wrap:break-word;">${escapeHtml(title)}</p>
        ${subtitle ? `<p class="card-hint" style="margin:2px 0 0; font-family:var(--font-mono);">${escapeHtml(subtitle)}</p>` : ''}
      </span>
      <span style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
        ${statusChip ?? ''}
        <span class="card-hint" style="margin:0; white-space:nowrap;">${escapeHtml(meta)}</span>
      </span>
    </button>
  `;
}

function cycleStatusClass(status) {
  if (status === 'completed') return 'status--done';
  if (status === 'in-progress') return 'status--in-progress';
  return 'status--pending';
}

function cycleDisplayNumber(cycleId, cycle) {
  const match = /^cycle-(\d+)$/.exec(cycleId);
  if (match) return match[1];
  return cycle?.cycle !== undefined ? String(cycle.cycle) : cycleId;
}

function renderCycleApps(apps) {
  if (!apps || apps.length === 0) return '';
  return `<p class="card-hint">${apps.map((app) => `<code>${escapeHtml(app)}</code>`).join(' ')}</p>`;
}

function renderCycleObjectives(objectives) {
  if (!objectives || objectives.length === 0) return '';
  const items = objectives
    .map((objective) => `<li>${escapeHtml(objective)}</li>`)
    .join('');
  return `<p class="card-hint">Objetivos (${objectives.length})</p><ul>${items}</ul>`;
}

function renderCycleMetrics(metrics) {
  if (!metrics) return '';
  const filesTotal =
    metrics.files_created.length +
    metrics.files_modified.length +
    metrics.files_deleted.length;
  return `<p class="card-hint">${escapeHtml(`${metrics.tasks_completed}/${metrics.tasks_total} tareas · ${metrics.story_points} SP · ${filesTotal} archivo${filesTotal === 1 ? '' : 's'}`)}</p>`;
}

function renderCycleCard({ specId, cycleId, cycle }, index, animate) {
  const staggerClass = animate
    ? ` animate-fade-in-up stagger-${Math.min(index + 1, 8)}`
    : '';
  if (!cycle) {
    return `
      <div class="tile${staggerClass}" tabindex="0" role="button" style="cursor:pointer" data-spec-id="${escapeHtml(specId)}" data-cycle-id="${escapeHtml(cycleId)}" aria-label="Ver detalle de ${escapeHtml(cycleId)}">
        <div class="card-header">
          <span class="card-title">${escapeHtml(cycleId)}</span>
          ${badge('no disponible', 'status--skipped')}
        </div>
        <p class="card-hint">No se pudo cargar cycle.json para este ciclo.</p>
      </div>
    `;
  }
  const number = cycleDisplayNumber(cycleId, cycle);
  return `
    <div class="tile${staggerClass}" tabindex="0" role="button" style="cursor:pointer" data-spec-id="${escapeHtml(specId)}" data-cycle-id="${escapeHtml(cycleId)}" aria-label="Ver detalle de ${escapeHtml(`Ciclo ${number} — ${cycle.module ?? '—'}`)}">
      <div class="card-header">
        <span class="card-title">${escapeHtml(`Ciclo ${number} — ${cycle.module ?? '—'}`)}</span>
        ${badge(cycle.status ?? '—', cycleStatusClass(cycle.status))}
      </div>
      <p class="card-subtitle">${escapeHtml(cycle.phase ?? '—')}</p>
      ${renderCycleApps(cycle.apps)}
      <p class="card-hint">${escapeHtml(`Inicio: ${cycle.started_at ?? '—'} · Fin: ${cycle.completed_at ?? '—'}`)}</p>
      ${renderCycleObjectives(cycle.objectives)}
      ${renderCycleMetrics(cycle.metrics)}
    </div>
  `;
}

function collectCycleSpecGroups(items, specsIndex) {
  const groups = groupBy(items, (item) => item.specId);
  const collected = [...groups.entries()].map(([specId, cycles]) => ({
    specId,
    title: findSpecTitle(specsIndex, specId) ?? specId,
    status: findSpecStatus(specsIndex, specId),
    cycles: sortBy(cycles, (item) => item.cycleId),
  }));
  return sortBy(collected, (group) => group.specId);
}

function cycleMatchesQuery(item, q) {
  return (
    item.specId.toLowerCase().includes(q) ||
    item.cycleId.toLowerCase().includes(q) ||
    (item.cycle?.module ?? '').toLowerCase().includes(q) ||
    (item.cycle?.status ?? '').toLowerCase().includes(q)
  );
}

function renderCycleSpecSection(group, displayCycles, collapsed, animate) {
  const contentId = planningDomId('cycles-spec', group.specId);
  const meta =
    displayCycles.length === group.cycles.length
      ? `${group.cycles.length} ciclo${group.cycles.length === 1 ? '' : 's'}`
      : `${displayCycles.length} / ${group.cycles.length} ciclo${group.cycles.length === 1 ? '' : 's'}`;
  return `
    <div>
      ${groupHeaderButton(
        {
          eyebrow: 'Spec',
          title: group.title,
          subtitle: group.specId,
          meta,
          statusChip: specStatusChip(group.status),
        },
        contentId,
        `data-spec-group="${escapeHtml(group.specId)}"`,
        collapsed,
      )}
      <div id="${contentId}" ${collapsed ? 'hidden' : ''}>
        <div style="padding-left:12px; border-left:1px solid rgb(var(--rgb-zinc-800) / 0.6); margin-top:12px; display:flex; flex-direction:column; gap:12px;">
          ${displayCycles.map((item, idx) => renderCycleCard(item, idx, animate)).join('')}
        </div>
      </div>
    </div>
  `;
}

async function renderCycles(container, params) {
  let cycleIndex;
  try {
    cycleIndex = await loadCycleIndex();
  } catch (error) {
    container.innerHTML = errorState(error);
    return;
  }

  if (cycleIndex.length === 0) {
    container.innerHTML = `
      ${cyclesHeader(0, 0)}
      ${emptyState('Sin ciclos iniciados', 'Los ciclos SDD aparecerán aquí una vez que el Orquestador cree el primer sdd/specs/{spec-id}/cycles/cycle-01/brief.yaml.')}
      ${cycleRolesPanel()}
    `;
    return;
  }

  const specsIndex = await loadSpecsIndex().catch(() => null);

  const results = await Promise.allSettled(
    cycleIndex.map(({ specId, cycleId }) => loadCycleJson(specId, cycleId)),
  );
  const items = cycleIndex.map(({ specId, cycleId }, index) => ({
    specId,
    cycleId,
    cycle: results[index].status === 'fulfilled' ? results[index].value : null,
  }));

  const groups = collectCycleSpecGroups(items, specsIndex);
  const state = { query: '', expandedSpecs: new Set() };

  function visibleGroups() {
    const q = state.query.trim().toLowerCase();
    if (!q)
      return groups.map((group) => ({ group, displayCycles: group.cycles }));
    return groups
      .map((group) => ({
        group,
        displayCycles: group.cycles.filter((item) =>
          cycleMatchesQuery(item, q),
        ),
      }))
      .filter((entry) => entry.displayCycles.length > 0);
  }

  function bindCycleCardClicks(scopeEl) {
    scopeEl.querySelectorAll('[data-cycle-id]').forEach((cardEl) => {
      const specId = cardEl.dataset.specId;
      const cycleId = cardEl.dataset.cycleId;
      const item = items.find(
        (entry) => entry.specId === specId && entry.cycleId === cycleId,
      );
      if (!item) return;
      const open = () => openCycleDetailModal(item);
      cardEl.addEventListener('click', open);
      cardEl.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        open();
      });
    });
  }

  function paintList() {
    const listRoot = container.querySelector('[data-list-root]');
    if (!listRoot) return;
    const entries = visibleGroups();
    listRoot.innerHTML =
      entries.length === 0
        ? emptyState(
            'Sin resultados',
            `No se encontraron ciclos que coincidan con "${state.query}".`,
          )
        : entries
            .map(({ group, displayCycles }) =>
              renderCycleSpecSection(
                group,
                displayCycles,
                state.query ? false : !state.expandedSpecs.has(group.specId),
                false,
              ),
            )
            .join('');
    bindCycleCardClicks(listRoot);
  }

  const initialEntries = groups.map((group) => ({
    group,
    displayCycles: group.cycles,
  }));

  container.innerHTML = `
    ${cyclesHeader(items.length, groups.length)}
    ${listSearchBox('Buscar por spec, ciclo, título o estado…', '')}
    <div data-list-root>${initialEntries
      .map(({ group, displayCycles }) =>
        renderCycleSpecSection(
          group,
          displayCycles,
          !state.expandedSpecs.has(group.specId),
          true,
        ),
      )
      .join('')}</div>
  `;

  attachCycleCardHandlers(container, items);

  container.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-toggle]');
    if (
      !toggle ||
      !container.contains(toggle) ||
      toggle.dataset.specGroup === undefined
    )
      return;
    const target = document.getElementById(toggle.getAttribute('data-toggle'));
    if (!target) return;
    const wasHidden = target.hidden;
    target.hidden = !wasHidden;
    toggle.setAttribute('aria-expanded', String(wasHidden));
    const chevron = toggle.querySelector('[data-chevron]');
    if (chevron) chevron.style.transform = `rotate(${wasHidden ? 0 : -90}deg)`;
    const collapsedNow = !wasHidden;
    if (collapsedNow) state.expandedSpecs.delete(toggle.dataset.specGroup);
    else state.expandedSpecs.add(toggle.dataset.specGroup);
  });

  bindListSearch(container, (value) => {
    state.query = value;
    paintList();
  });
}

function attachCycleCardHandlers(container, items) {
  for (const cardEl of container.querySelectorAll('[data-cycle-id]')) {
    const specId = cardEl.dataset.specId;
    const cycleId = cardEl.dataset.cycleId;
    const item = items.find(
      (entry) => entry.specId === specId && entry.cycleId === cycleId,
    );
    if (!item) continue;
    const open = () => openCycleDetailModal(item);
    cardEl.addEventListener('click', open);
    cardEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      open();
    });
  }
  container.insertAdjacentHTML('beforeend', cycleRolesPanel());
}

let cycleModalToken = 0;

const CYCLE_EYEBROW_STYLE =
  'font-family: var(--font-mono); font-size: var(--text-10); text-transform: uppercase; letter-spacing: var(--tracking-widest); color: var(--text-subtle); margin: 0 0 8px';
const CYCLE_HINT_STYLE =
  'font-size: var(--text-11); color: var(--text-faint); margin: 0';
const CYCLE_PANEL_STYLE =
  'border: 1px solid rgb(var(--rgb-zinc-800) / 0.6); border-radius: var(--radius-xl); background: rgb(var(--rgb-zinc-900) / 0.2); padding: 16px 20px';

const CYCLE_ROLES = [
  ['01', 'Orquestador', 'brief.yaml + cycle.json'],
  ['02', 'Funcional', 'functional.md'],
  ['03', 'Planner', 'planner.md'],
  ['04', 'Arquitecto', 'architect.md'],
  ['05', 'Impl. Back', '—'],
  ['06', 'Impl. Front', '—'],
  ['07', 'Reviewer', 'CONTEXTO GATE → completed'],
];

function cycleRoleRow([num, role, artifact]) {
  return `
    <div style="display:flex; align-items:center; gap:8px">
      <span style="width:20px; flex-shrink:0; font-family: var(--font-mono); font-size: var(--text-10); color: rgb(var(--rgb-emerald-500) / 0.5)">${escapeHtml(num)}</span>
      <span style="font-size: var(--text-11); color: var(--text-dim)">${escapeHtml(role)}</span>
      <span style="margin-left:auto; font-family: var(--font-mono); font-size: var(--text-10); color: var(--text-subtle)">${escapeHtml(artifact)}</span>
    </div>
  `;
}

function cycleRolesPanel() {
  return `
    <div style="${CYCLE_PANEL_STYLE}">
      <p style="${CYCLE_EYEBROW_STYLE}">Agentes del ciclo</p>
      <div style="display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 32px">
        ${CYCLE_ROLES.map(cycleRoleRow).join('')}
      </div>
    </div>
  `;
}

function cycleDocRenderMode(name) {
  if (name.endsWith('.md')) return 'markdown';
  if (name.endsWith('.json')) return 'json';
  return 'raw';
}

function cycleJsonFieldRow(label, valueHtml) {
  return `
    <div style="display:flex; align-items:flex-start; gap:16px; padding:12px 16px; border-bottom:1px solid rgb(var(--rgb-zinc-800) / 0.6)">
      <span style="width:96px; flex-shrink:0; font-family: var(--font-mono); font-size: var(--text-10); text-transform: uppercase; letter-spacing: var(--tracking-widest); color: var(--text-subtle)">${escapeHtml(label)}</span>
      <div style="flex:1; min-width:0">${valueHtml}</div>
    </div>
  `;
}

function cycleJsonMono(text, color = 'var(--text-muted)') {
  return `<span style="font-family: var(--font-mono); font-size: var(--text-12); color: ${color}">${escapeHtml(String(text))}</span>`;
}

function cycleJsonView(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return `<pre><code>${escapeHtml(JSON.stringify(data, null, 2))}</code></pre>`;
  }

  const fields = [];
  if (data.cycle !== undefined)
    fields.push(
      cycleJsonFieldRow(
        'Ciclo',
        cycleJsonMono(`#${data.cycle}`, 'var(--text-bright)'),
      ),
    );
  else if (data.id)
    fields.push(
      cycleJsonFieldRow('ID', cycleJsonMono(data.id, 'var(--text-bright)')),
    );
  if (data.module)
    fields.push(cycleJsonFieldRow('Módulo', cycleJsonMono(data.module)));
  else if (data.title)
    fields.push(
      cycleJsonFieldRow(
        'Título',
        `<span style="font-size: var(--text-12); color: var(--text-bright)">${escapeHtml(data.title)}</span>`,
      ),
    );
  if (data.app)
    fields.push(
      cycleJsonFieldRow('App', cycleJsonMono(data.app, 'var(--text-faint)')),
    );
  fields.push(
    cycleJsonFieldRow(
      'Estado',
      badge(data.status ?? '—', cycleStatusClass(data.status)),
    ),
  );
  if (data.spec)
    fields.push(
      cycleJsonFieldRow('Spec', cycleJsonMono(data.spec, 'var(--text-faint)')),
    );
  if (data.started_at)
    fields.push(cycleJsonFieldRow('Inicio', cycleJsonMono(data.started_at)));
  if (data.completed_at)
    fields.push(
      cycleJsonFieldRow('Completado', cycleJsonMono(data.completed_at)),
    );

  const reviewerReport =
    data.reviewer_report !== undefined && data.reviewer_report !== null
      ? `
        <div>
          <p style="${CYCLE_EYEBROW_STYLE}">Reporte del reviewer</p>
          <div style="${CYCLE_PANEL_STYLE}">
            <p style="margin:0; font-size: var(--text-12); color: var(--text-muted); line-height: var(--leading-relaxed); white-space: pre-wrap">${escapeHtml(
              typeof data.reviewer_report === 'string'
                ? data.reviewer_report
                : JSON.stringify(data.reviewer_report, null, 2),
            )}</p>
          </div>
        </div>
      `
      : '';

  const artifacts =
    Array.isArray(data.artifacts) && data.artifacts.length > 0
      ? `
        <div>
          <p style="${CYCLE_EYEBROW_STYLE}">${escapeHtml(`Artefactos (${data.artifacts.length})`)}</p>
          <div style="display:flex; flex-direction:column; gap:6px">
            ${data.artifacts
              .map(
                (artifact) => `
                  <div style="display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius: var(--radius-md); border:1px solid rgb(var(--rgb-amber-500) / 0.2); background: rgb(var(--rgb-amber-500) / 0.05)">
                    <span style="width:4px; height:4px; border-radius:999px; background: rgb(var(--rgb-amber-500)); flex-shrink:0"></span>
                    <span style="font-family: var(--font-mono); font-size: var(--text-12); color: rgb(var(--rgb-amber-400))">${escapeHtml(typeof artifact === 'string' ? artifact : JSON.stringify(artifact))}</span>
                  </div>
                `,
              )
              .join('')}
          </div>
        </div>
      `
      : '';

  return `
    <div style="display:flex; flex-direction:column; gap:20px">
      <div style="border:1px solid rgb(var(--rgb-zinc-800) / 0.6); border-radius: var(--radius-xl); overflow:hidden">${fields.join('')}</div>
      ${reviewerReport}
      ${artifacts}
    </div>
  `;
}

const CYCLE_TASK_STATUS_META = {
  done: {
    dot: 'rgb(var(--rgb-emerald-500))',
    text: 'rgb(var(--rgb-emerald-400))',
    label: 'hecho',
  },
  'in-progress': {
    dot: 'rgb(var(--rgb-amber-400))',
    text: 'rgb(var(--rgb-amber-400))',
    label: 'en progreso',
  },
  skipped: {
    dot: 'rgb(var(--rgb-zinc-600))',
    text: 'var(--text-faint)',
    label: 'omitido',
  },
  pending: {
    dot: 'rgb(var(--rgb-zinc-500))',
    text: 'var(--text-dim)',
    label: 'pendiente',
  },
};

function cycleTaskStatusMeta(status) {
  return CYCLE_TASK_STATUS_META[status] ?? CYCLE_TASK_STATUS_META.pending;
}

function toggleCycleTaskFiles(toggle) {
  const wrapper = toggle.closest('[data-files-label]');
  const list = wrapper?.querySelector('.cycle-task-file-list');
  if (!wrapper || !list) return;
  const isOpen = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!isOpen));
  list.style.display = isOpen ? 'none' : 'flex';
  toggle.textContent = `${isOpen ? '▸' : '▾'} ${wrapper.dataset.filesLabel}`;
}

function cycleTaskFilesToggle(files) {
  if (files.length === 0) return '';
  const label = `${files.length} archivo${files.length === 1 ? '' : 's'}`;
  return `
    <div style="margin-top:8px; padding-left:16px" data-files-label="${escapeHtml(label)}">
      <button type="button" data-files-toggle aria-expanded="false" style="background:none; border:none; padding:0; cursor:pointer; font-family: var(--font-mono); font-size: var(--text-10); color: var(--text-subtle)">${escapeHtml(`▸ ${label}`)}</button>
      <div class="cycle-task-file-list" style="display:none; margin-top:6px; flex-direction:column; gap:4px">
        ${files
          .map(
            (file) =>
              `<span title="${escapeHtml(file)}" style="font-family: var(--font-mono); font-size: var(--text-10); color: var(--text-faint); overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${escapeHtml(file)}</span>`,
          )
          .join('')}
      </div>
    </div>
  `;
}

function cycleTaskRow(task) {
  const meta = cycleTaskStatusMeta(task.status);
  const userStories = task.user_stories ?? [];
  const dependsOn = task.depends_on ?? [];
  const files = task.files ?? [];

  return `
    <div style="${CYCLE_PANEL_STYLE}">
      <div style="display:flex; align-items:flex-start; gap:10px">
        <span style="width:6px; height:6px; margin-top:6px; border-radius:999px; flex-shrink:0; background:${meta.dot}"></span>
        <div style="flex:1; min-width:0">
          <div style="display:flex; align-items:baseline; gap:8px; flex-wrap:wrap">
            <span style="font-family: var(--font-mono); font-size: var(--text-10); color: var(--text-faint)">${escapeHtml(task.id)}</span>
            <span style="font-size: var(--text-12); color: var(--text-bright)">${escapeHtml(task.title)}</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:6px">
            <span style="font-family: var(--font-mono); font-size: var(--text-10); color: ${meta.text}">${escapeHtml(meta.label)}</span>
            ${userStories.map((hu) => `<span class="chip chip--sm">${escapeHtml(hu)}</span>`).join('')}
            ${
              dependsOn.length
                ? `<span style="font-family: var(--font-mono); font-size: var(--text-10); color: var(--text-ghost)">${escapeHtml(`← ${dependsOn.join(', ')}`)}</span>`
                : ''
            }
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px; flex-shrink:0">
          ${task.story_points !== undefined ? `<span class="chip chip--sm">${escapeHtml(`${task.story_points} SP`)}</span>` : ''}
          ${task.estimation_hours !== undefined ? `<span class="chip chip--sm">${escapeHtml(formatHours(task.estimation_hours))}</span>` : ''}
        </div>
      </div>
      ${cycleTaskFilesToggle(files)}
    </div>
  `;
}

function cycleTasksSummary(data, totals) {
  const pct =
    totals.count > 0 ? Math.round((totals.done / totals.count) * 100) : 0;
  const flowChip =
    data.flow === 'reduced'
      ? `<span class="chip chip--sm" style="font-family: var(--font-mono)">flow: reduced</span>`
      : '';
  const appsChips = (data.apps ?? [])
    .map(
      (app) =>
        `<span class="chip chip--sm" style="font-family: var(--font-mono)">${escapeHtml(app)}</span>`,
    )
    .join('');
  return `
    <div style="${CYCLE_PANEL_STYLE}; display:flex; flex-direction:column; gap:12px">
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
        <span style="font-family: var(--font-mono); font-size: var(--text-12); color: var(--text-bright)">${escapeHtml(data.module ?? '—')}</span>
        ${flowChip}
        ${appsChips}
        <span style="margin-left:auto; font-family: var(--font-mono); font-size: var(--text-10); color: var(--text-faint)">${escapeHtml(
          `${totals.storyPoints} SP · ${formatHours(totals.hours)} estimadas`,
        )}</span>
      </div>
      <div style="display:flex; align-items:center; gap:12px">
        <div style="flex:1; height:6px; border-radius:999px; background: rgb(var(--rgb-zinc-800)); overflow:hidden">
          <div style="height:100%; border-radius:999px; background: var(--accent); width:${pct}%"></div>
        </div>
        <span style="font-family: var(--font-mono); font-size: var(--text-10); color: var(--text-faint); flex-shrink:0">${escapeHtml(
          `${totals.done}/${totals.count} tasks · ${pct}%`,
        )}</span>
      </div>
    </div>
  `;
}

function cycleTasksView(data) {
  if (!data || !Array.isArray(data.tasks)) {
    return `<pre><code>${escapeHtml(JSON.stringify(data, null, 2))}</code></pre>`;
  }
  const totals = sumTaskTotals([{ tasks: data.tasks }]);
  return `
    <div style="display:flex; flex-direction:column; gap:16px">
      ${cycleTasksSummary(data, totals)}
      <div style="display:flex; flex-direction:column; gap:8px">
        ${data.tasks.map((task) => cycleTaskRow(task)).join('')}
      </div>
    </div>
  `;
}

async function loadCycleDocSection(file, cycleJson) {
  try {
    if (file.name === 'cycle.json') {
      const data = cycleJson ?? (await fetchJson(file.path));
      return { file, html: cycleJsonView(data) };
    }
    if (file.name === 'tasks.json') {
      const data = await fetchJson(file.path);
      return { file, html: cycleTasksView(data) };
    }
    const mode = cycleDocRenderMode(file.name);
    if (mode === 'markdown') {
      return {
        file,
        html: `<div class="markdown">${await loadMarkdown(file.path)}</div>`,
      };
    }
    if (mode === 'json') {
      const data = await fetchJson(file.path);
      return {
        file,
        html: `<pre><code>${escapeHtml(JSON.stringify(data, null, 2))}</code></pre>`,
      };
    }
    const text = await fetchText(file.path);
    return { file, html: `<pre><code>${escapeHtml(text)}</code></pre>` };
  } catch {
    return { file, html: null };
  }
}

function cycleDocLabel(file) {
  return file.kind === 'artifact' ? `${file.name} · artifact` : file.name;
}

function cycleModalResumenChip(text) {
  return `<span class="chip chip--sm" style="font-family: var(--font-mono)">${escapeHtml(text)}</span>`;
}

const ACTIVITY_TONES = Object.freeze({
  emerald: 'rgb(var(--rgb-emerald-400))',
  amber: 'rgb(var(--rgb-amber-400))',
  muted: 'var(--text-muted)',
  faint: 'var(--text-faint)',
});

/**
 * Actividad del ciclo reconstruida SOLO desde los registros (cycle.json +
 * tasks.json): qué agente abrió, qué documentos existen, cada task con sus
 * tokens/tier si el implementador los registró, y el cierre del reviewer.
 * Es la versión real del feed que el sitio muestra como demo — acá no se
 * inventa nada: si un dato no está en los registros, la línea no aparece.
 */
function cycleActivityFeed(cycle, tasks, cycleId) {
  if (!cycle) return '';
  const rows = [];
  const push = (actor, text, tone) => rows.push({ actor, text, tone });

  push(
    'sdd-orchestrator',
    `abre ${cycleId} (${cycle.module ?? '—'}) · brief + cycle.json`,
    'emerald',
  );
  const docs = cycle.documents ?? {};
  if (docs.functional)
    push('sdd-functional', 'functional.md — requisitos y user stories', 'muted');
  if (docs.planner)
    push('sdd-planner', 'planner.md — tasks y estimaciones', 'muted');
  if (docs.architect)
    push('sdd-architect', 'architect.md — diseño validado', 'muted');

  for (const task of tasks?.tasks ?? []) {
    const u = task.usage;
    const tokens = u
      ? ` · ${costsTokensFormat.format((u.tokens_in ?? 0) + (u.tokens_out ?? 0))} tokens${u.model_tier ? ` (${u.model_tier})` : ''}`
      : '';
    const tone =
      task.status === 'done'
        ? 'emerald'
        : task.status === 'in-progress'
          ? 'amber'
          : 'faint';
    push(task.id, `${task.status} · ${task.title}${tokens}`, tone);
  }

  if (cycle.status === 'completed') {
    const rep = cycle.reviewer_report;
    const verdict =
      rep && typeof rep === 'object'
        ? rep.approved
          ? 'aprobado'
          : 'con observaciones'
        : 'sin reviewer_report';
    push(
      'sdd-reviewer',
      `cierra ${cycleId} ✓ · ${verdict} · CONTEXTO + MEMORIA GATE`,
      'emerald',
    );
  }

  const lines = rows
    .map(
      (row) => `
        <div style="display:flex; gap:10px; align-items:baseline; min-width:0">
          <span style="flex:0 0 auto; font-family: var(--font-mono); font-size: var(--text-11); color:${ACTIVITY_TONES[row.tone]}">${escapeHtml(row.actor)}</span>
          <span style="min-width:0; font-family: var(--font-mono); font-size: var(--text-11); color: var(--text-muted); overflow-wrap:break-word">${escapeHtml(row.text)}</span>
        </div>`,
    )
    .join('');
  return `
    <div>
      <p style="${CYCLE_EYEBROW_STYLE}">Actividad del ciclo — derivada de los registros</p>
      <div style="display:flex; flex-direction:column; gap:8px; padding:12px 14px; border:1px solid var(--border); border-radius: var(--radius-lg)">${lines}</div>
    </div>
  `;
}

function cycleModalResumenView(specId, cycleId, cycle, files, onTabIndex, tasks) {
  const docsBlock = files.length
    ? `
      <div>
        <p style="${CYCLE_EYEBROW_STYLE}">${escapeHtml(`Documentos (${files.length})`)}</p>
        <div style="display:flex; flex-wrap:wrap; gap:8px">
          ${files
            .map(
              (file, index) =>
                `<button type="button" class="chip chip--sm" data-cycle-tab="${onTabIndex(index)}" style="cursor:pointer; background:none; font-family: var(--font-mono)">${escapeHtml(cycleDocLabel(file))}</button>`,
            )
            .join('')}
        </div>
      </div>
    `
    : '';

  if (!cycle) {
    return `
      <div style="display:flex; flex-direction:column; gap:16px">
        <p style="${CYCLE_HINT_STYLE}">${escapeHtml(`${specId} · ${cycleId}`)}</p>
        <p style="${CYCLE_HINT_STYLE}">No se pudo cargar cycle.json para este ciclo.</p>
        ${docsBlock}
      </div>
    `;
  }

  const number = cycleDisplayNumber(cycleId, cycle);
  const specChip = cycle.spec
    ? cycleModalResumenChip(`spec: ${cycle.spec}`)
    : '';

  const dateFields = [];
  if (cycle.started_at) {
    dateFields.push(`
      <div>
        <p style="${CYCLE_EYEBROW_STYLE}">Inicio</p>
        <p style="margin:0; font-family: var(--font-mono); font-size: var(--text-12); color: var(--text-muted)">${escapeHtml(cycle.started_at)}</p>
      </div>
    `);
  }
  if (cycle.completed_at) {
    dateFields.push(`
      <div>
        <p style="${CYCLE_EYEBROW_STYLE}">Fin</p>
        <p style="margin:0; font-family: var(--font-mono); font-size: var(--text-12); color: var(--text-muted)">${escapeHtml(cycle.completed_at)}</p>
      </div>
    `);
  }

  const artifactsBlock =
    Array.isArray(cycle.artifacts) && cycle.artifacts.length > 0
      ? `
        <div>
          <p style="${CYCLE_EYEBROW_STYLE}">${escapeHtml(`Artefactos (${cycle.artifacts.length})`)}</p>
          <div style="display:flex; flex-direction:column; gap:4px">
            ${cycle.artifacts
              .map(
                (artifact) => `
                  <span style="display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius: var(--radius-md); border:1px solid rgb(var(--rgb-amber-500) / 0.2); background: rgb(var(--rgb-amber-500) / 0.05)">
                    <span style="width:4px; height:4px; border-radius:999px; background: rgb(var(--rgb-amber-500)); flex-shrink:0"></span>
                    <span style="font-family: var(--font-mono); font-size: var(--text-12); color: rgb(var(--rgb-amber-400))">${escapeHtml(String(artifact))}</span>
                  </span>
                `,
              )
              .join('')}
          </div>
        </div>
      `
      : '';

  return `
    <div style="display:flex; flex-direction:column; gap:20px">
      <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap">
        ${badge(cycle.status ?? '—', cycleStatusClass(cycle.status))}
        <span style="font-family: var(--font-mono); font-size: var(--text-10); color: var(--text-faint)">${escapeHtml(`Ciclo #${number}`)}</span>
        ${specChip}
      </div>
      ${dateFields.length ? `<div style="display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:16px">${dateFields.join('')}</div>` : ''}
      ${cycleActivityFeed(cycle, tasks, cycleId)}
      ${docsBlock}
      ${artifactsBlock}
    </div>
  `;
}

function cycleModalTabBar(tabs, activeIndex) {
  return `
    <div class="cycle-tabs" role="tablist">
      ${tabs
        .map((tab, index) => {
          const active = index === activeIndex;
          return `<button type="button" class="cycle-tab${active ? ' cycle-tab--active' : ''}" role="tab" aria-selected="${active}" data-cycle-tab="${index}" style="flex-shrink:0; padding:8px 12px; margin-bottom:-1px; background:none; cursor:pointer; font-family: var(--font-mono); font-size: var(--text-12); font-weight: var(--weight-medium); border:none; border-bottom:2px solid ${active ? 'var(--accent)' : 'transparent'}; color:${active ? 'rgb(var(--rgb-emerald-400))' : 'var(--text-faint)'}">${escapeHtml(tab.label)}</button>`;
        })
        .join('')}
    </div>
  `;
}

async function openCycleDetailModal(item) {
  const { specId, cycleId, cycle } = item;
  const number = cycleDisplayNumber(cycleId, cycle);
  const title = cycle ? `Ciclo ${number} — ${cycle.module ?? '—'}` : cycleId;

  openModal({ title, size: 'xl', bodyHtml: skeletonLines() });
  const openId = modalToken;

  const [files, cycleTasks] = await Promise.all([
    resolveCycleFiles(specId, cycleId, cycle ?? {}).catch(() => []),
    fetchJson(`specs/${specId}/cycles/${cycleId}/tasks.json`).catch(() => null),
  ]);
  if (!activeModal || activeModal.token !== openId) return;

  const tabs = [
    { id: '__resumen__', label: 'Resumen' },
    ...files.map((file) => ({
      id: file.path,
      label: cycleDocLabel(file),
      file,
    })),
  ];
  const token = ++cycleModalToken;
  const cache = new Map();
  let activeIndex = 0;

  setModalBody(
    openId,
    `
      ${cycleModalTabBar(tabs, activeIndex)}
      <div data-cycle-tab-panel>${cycleModalResumenView(specId, cycleId, cycle, files, (index) => index + 1, cycleTasks)}</div>
    `,
  );

  const backdrop = document.getElementById('sdd-modal-backdrop');
  if (!backdrop) return;

  const setActiveTabButtons = (index) => {
    for (const btn of backdrop.querySelectorAll('.cycle-tab[data-cycle-tab]')) {
      const active = Number(btn.dataset.cycleTab) === index;
      btn.classList.toggle('cycle-tab--active', active);
      btn.style.borderBottomColor = active ? 'var(--accent)' : 'transparent';
      btn.style.color = active
        ? 'rgb(var(--rgb-emerald-400))'
        : 'var(--text-faint)';
      btn.setAttribute('aria-selected', String(active));
    }
  };

  const selectTab = async (index) => {
    if (token !== cycleModalToken || index === activeIndex || !tabs[index])
      return;
    activeIndex = index;
    setActiveTabButtons(index);
    const bodyEl = backdrop.querySelector('.modal-body');
    if (bodyEl) bodyEl.scrollTop = 0;
    const panelEl = backdrop.querySelector('[data-cycle-tab-panel]');
    if (!panelEl) return;

    if (index === 0) {
      panelEl.innerHTML = cycleModalResumenView(
        specId,
        cycleId,
        cycle,
        files,
        (fileIndex) => fileIndex + 1,
        cycleTasks,
      );
      return;
    }

    const tab = tabs[index];
    if (cache.has(tab.id)) {
      panelEl.innerHTML = cache.get(tab.id);
      return;
    }

    panelEl.innerHTML = skeletonLines();
    const section = await loadCycleDocSection(tab.file, cycle);
    if (token !== cycleModalToken || activeIndex !== index) return;
    const html = section.html ?? emptyState('No disponible', section.file.path);
    cache.set(tab.id, html);
    panelEl.innerHTML = html;
  };

  backdrop.addEventListener('click', (event) => {
    const tabTarget = event.target.closest('[data-cycle-tab]');
    if (tabTarget && backdrop.contains(tabTarget)) {
      selectTab(Number(tabTarget.dataset.cycleTab));
      return;
    }
    const toggleTarget = event.target.closest('[data-files-toggle]');
    if (toggleTarget && backdrop.contains(toggleTarget)) {
      toggleCycleTaskFiles(toggleTarget);
    }
  });
}

function sumTaskTotals(groups) {
  const tasks = groups.flatMap((group) => group.tasks ?? []);
  const hours = tasks.reduce(
    (sum, task) => sum + (Number(task.estimation_hours) || 0),
    0,
  );
  const storyPoints = tasks.reduce(
    (sum, task) => sum + (Number(task.story_points) || 0),
    0,
  );
  const done = tasks.filter((task) => task.status === 'done').length;
  return { count: tasks.length, hours, storyPoints, done };
}

function collectTaskSpecGroups(assembled, specsIndex) {
  return Object.entries(assembled?.specs ?? {}).map(([specId, spec]) => {
    const cycles = sortBy(
      Object.entries(spec.cycles ?? {}),
      ([cycleId]) => cycleId,
    ).map(([cycleId, cycle]) => {
      const tasks = cycle.tasks ?? [];
      return {
        cycleId,
        module: cycle.module,
        tasks,
        totals: sumTaskTotals([{ tasks }]),
      };
    });
    return {
      specId,
      title: findSpecTitle(specsIndex, specId) ?? specId,
      status: findSpecStatus(specsIndex, specId),
      cycles,
      totals: sumTaskTotals(cycles),
    };
  });
}

function taskStatusClass(status) {
  return `status--${status ?? 'pending'}`;
}

function renderTaskTagList(items) {
  if (!items || items.length === 0) return '—';
  return items.map((item) => `<code>${escapeHtml(item)}</code>`).join(' ');
}

function taskTypeTone(type) {
  if (type === 'BE') return 'blue';
  if (type === 'FE') return 'violet';
  if (type === 'INFRA') return 'orange';
  return 'blue';
}

function taskTypeLabel(type) {
  if (type === 'BE') return 'Backend';
  if (type === 'FE') return 'Frontend';
  if (type === 'INFRA') return 'Infraestructura';
  return null;
}

function taskTypeBadge(type) {
  if (!type) return '';
  return `<span class="chip chip--sm chip--${taskTypeTone(type)}">${escapeHtml(type)}</span>`;
}

function taskTable(columns, tasks) {
  const head = columns
    .map((column) => `<th>${escapeHtml(column.label)}</th>`)
    .join('');
  const body = tasks
    .map(
      (task) =>
        `<tr data-task-row>${columns.map((column) => `<td>${column.render(task)}</td>`).join('')}</tr>`,
    )
    .join('');
  return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

const TASK_TABLE_COLUMNS = [
  { label: 'ID', render: (task) => `<code>${escapeHtml(task.id)}</code>` },
  { label: 'Tipo', render: (task) => taskTypeBadge(task.type) || '—' },
  { label: 'Título', render: (task) => escapeHtml(task.title ?? '—') },
  {
    label: 'Estado',
    render: (task) =>
      badge(task.status ?? 'pending', taskStatusClass(task.status)),
  },
  {
    label: 'Estimación',
    render: (task) => escapeHtml(formatHours(task.estimation_hours)),
  },
  {
    label: 'SP',
    render: (task) =>
      escapeHtml(
        task.story_points === undefined || task.story_points === null
          ? '—'
          : String(task.story_points),
      ),
  },
  {
    label: 'Historias',
    render: (task) => renderTaskTagList(task.user_stories),
  },
  { label: 'Depende de', render: (task) => renderTaskTagList(task.depends_on) },
  { label: 'Archivos', render: (task) => renderTaskTagList(task.files) },
];

function tasksHeader(totals, groupCount) {
  return pageHeader({
    title: 'Tareas',
    meta: `${totals.count} tarea${totals.count === 1 ? '' : 's'} en ${groupCount} spec${groupCount === 1 ? '' : 's'}`,
    subtitle: `Tareas técnicas agrupadas por spec y ciclo SDD · ${totals.done} de ${totals.count} completadas · ${formatHours(totals.hours)} estimadas · ${totals.storyPoints} SP`,
  });
}

function taskDetailFieldRow(label, valueHtml) {
  return `
    <div style="padding:10px 0; border-bottom:1px solid rgb(var(--rgb-zinc-800) / 0.6);">
      <p style="font-family:var(--font-mono); font-size:var(--text-10); text-transform:uppercase; letter-spacing:0.05em; color:var(--text-subtle); margin:0 0 4px;">${escapeHtml(label)}</p>
      <div style="font-size:var(--text-14); color:var(--text-muted);">${valueHtml}</div>
    </div>
  `;
}

function openTaskDetailModal(task, specId, cycleId) {
  const rows = [
    taskDetailFieldRow('ID', `<code>${escapeHtml(task.id)}</code>`),
    taskDetailFieldRow('Spec', `<code>${escapeHtml(specId)}</code>`),
    taskDetailFieldRow('Ciclo', `<code>${escapeHtml(cycleId)}</code>`),
  ];
  const typeLabel = taskTypeLabel(task.type);
  if (typeLabel) rows.push(taskDetailFieldRow('Tipo', escapeHtml(typeLabel)));
  const body = `
    <p style="display:flex; gap:8px; flex-wrap:wrap; margin:0 0 16px;">${taskTypeBadge(task.type)}${badge(task.status ?? 'pending', taskStatusClass(task.status))}</p>
    <div>${rows.join('')}</div>
  `;
  openModal(task.title ?? task.id, body, { subtitle: task.id, size: 'md' });
}

function taskMatchesQuery(task, specId, cycleId, q) {
  return (
    (task.id ?? '').toLowerCase().includes(q) ||
    (task.title ?? '').toLowerCase().includes(q) ||
    (task.type ?? '').toLowerCase().includes(q) ||
    (task.status ?? '').toLowerCase().includes(q) ||
    cycleId.toLowerCase().includes(q) ||
    specId.toLowerCase().includes(q)
  );
}

function renderTaskCycleBlock(specId, cycle, collapsed, animate) {
  const displayTasks = cycle.displayTasks;
  const body =
    displayTasks.length === 0
      ? emptyState('Sin tareas en este ciclo')
      : taskTable(TASK_TABLE_COLUMNS, displayTasks);
  const contentId = planningDomId('tasks-cycle', specId, cycle.cycleId);
  const meta =
    displayTasks.length === cycle.tasks.length
      ? `${cycle.tasks.length} tarea${cycle.tasks.length === 1 ? '' : 's'}`
      : `${displayTasks.length} / ${cycle.tasks.length} tarea${cycle.tasks.length === 1 ? '' : 's'}`;
  return `
    <div class="${animate ? 'animate-fade-in-up' : ''}">
      ${groupHeaderButton(
        {
          eyebrow: 'Ciclo',
          title: cycle.cycleId,
          subtitle: cycle.module ?? null,
          meta,
        },
        contentId,
        `data-cycle-group="${escapeHtml(`${specId}::${cycle.cycleId}`)}"`,
        collapsed,
      )}
      <div id="${contentId}" data-task-cycle-body data-spec-id="${escapeHtml(specId)}" data-cycle-id="${escapeHtml(cycle.cycleId)}" ${collapsed ? 'hidden' : ''} style="margin-top:12px;">
        ${body}
      </div>
    </div>
  `;
}

function renderTaskSpecSection(
  group,
  displayCycles,
  collapsedSpec,
  queryActive,
  collapsedCycles,
  animate,
) {
  const contentId = planningDomId('tasks-spec', group.specId);
  return `
    <div>
      ${groupHeaderButton(
        {
          eyebrow: 'Spec',
          title: group.title,
          subtitle: group.specId,
          meta: `${group.totals.done}/${group.totals.count} tareas`,
          statusChip: specStatusChip(group.status),
        },
        contentId,
        `data-spec-group="${escapeHtml(group.specId)}"`,
        collapsedSpec,
      )}
      <div id="${contentId}" ${collapsedSpec ? 'hidden' : ''}>
        <div style="padding-left:12px; border-left:1px solid rgb(var(--rgb-zinc-800) / 0.6); margin-top:12px; display:flex; flex-direction:column; gap:16px;">
          ${displayCycles
            .map((cycle) => {
              const key = `${group.specId}::${cycle.cycleId}`;
              const cycleCollapsed = queryActive
                ? false
                : collapsedCycles.has(key);
              return renderTaskCycleBlock(
                group.specId,
                cycle,
                cycleCollapsed,
                animate,
              );
            })
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function tasksSpecGatePanel() {
  return `
    <div style="${CYCLE_PANEL_STYLE}">
      <p style="${CYCLE_EYEBROW_STYLE}">SPEC GATE</p>
      <p style="font-size:var(--text-11); color:var(--text-dim); line-height:1.6; margin:0;">${escapeHtml(
        'Una tarea no puede implementarse sin TODOS los documentos del ciclo generados: brief.yaml, functional.md, planner.md, architect.md, cycle.json y tasks.json.',
      )}</p>
    </div>
  `;
}

async function renderTasks(container, params) {
  let assembled;
  try {
    assembled = await loadAssembledTasks();
  } catch (error) {
    container.innerHTML = errorState(error);
    return;
  }
  const specsIndex = await loadSpecsIndex().catch(() => null);
  const specGroups = collectTaskSpecGroups(assembled, specsIndex);
  const totals = sumTaskTotals(specGroups.flatMap((group) => group.cycles));

  if (specGroups.length === 0) {
    container.innerHTML = `
      ${tasksHeader(totals, 0)}
      ${emptyState(
        'Sin tareas registradas',
        'Las tareas técnicas son generadas por el agente Planner y aparecen aquí una vez que el primer ciclo SDD ha iniciado.',
      )}
      ${tasksSpecGatePanel()}
    `;
    return;
  }

  const state = {
    query: '',
    expandedSpecs: new Set(),
    collapsedCycles: new Set(),
  };
  for (const group of specGroups) {
    for (const cycle of group.cycles)
      state.collapsedCycles.add(`${group.specId}::${cycle.cycleId}`);
  }

  function visibleGroups() {
    const q = state.query.trim().toLowerCase();
    if (!q) {
      return specGroups.map((group) => ({
        group,
        displayCycles: group.cycles.map((cycle) => ({
          ...cycle,
          displayTasks: cycle.tasks,
        })),
      }));
    }
    return specGroups
      .map((group) => {
        const displayCycles = group.cycles
          .map((cycle) => ({
            ...cycle,
            displayTasks: cycle.tasks.filter((task) =>
              taskMatchesQuery(task, group.specId, cycle.cycleId, q),
            ),
          }))
          .filter((cycle) => cycle.displayTasks.length > 0);
        return { group, displayCycles };
      })
      .filter((entry) => entry.displayCycles.length > 0);
  }

  function paintList() {
    const listRoot = container.querySelector('[data-list-root]');
    if (!listRoot) return;
    const entries = visibleGroups();
    listRoot.innerHTML =
      entries.length === 0
        ? emptyState(
            'Sin resultados',
            `No se encontraron tareas que coincidan con "${state.query}".`,
          )
        : entries
            .map(({ group, displayCycles }) =>
              renderTaskSpecSection(
                group,
                displayCycles,
                state.query ? false : !state.expandedSpecs.has(group.specId),
                Boolean(state.query),
                state.collapsedCycles,
                false,
              ),
            )
            .join('');
  }

  const initialEntries = specGroups.map((group) => ({
    group,
    displayCycles: group.cycles.map((cycle) => ({
      ...cycle,
      displayTasks: cycle.tasks,
    })),
  }));

  container.innerHTML = `
    ${tasksHeader(totals, specGroups.length)}
    ${listSearchBox('Buscar por ID, título, tipo, estado, ciclo o spec…', '')}
    <div data-list-root>${initialEntries
      .map(({ group, displayCycles }) =>
        renderTaskSpecSection(
          group,
          displayCycles,
          !state.expandedSpecs.has(group.specId),
          false,
          state.collapsedCycles,
          true,
        ),
      )
      .join('')}</div>
    ${tasksSpecGatePanel()}
  `;

  container.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-toggle]');
    if (toggle && container.contains(toggle)) {
      const target = document.getElementById(
        toggle.getAttribute('data-toggle'),
      );
      if (!target) return;
      const wasHidden = target.hidden;
      target.hidden = !wasHidden;
      toggle.setAttribute('aria-expanded', String(wasHidden));
      const chevron = toggle.querySelector('[data-chevron]');
      if (chevron)
        chevron.style.transform = `rotate(${wasHidden ? 0 : -90}deg)`;
      const collapsedNow = !wasHidden;
      if (toggle.dataset.specGroup !== undefined) {
        if (collapsedNow) state.expandedSpecs.delete(toggle.dataset.specGroup);
        else state.expandedSpecs.add(toggle.dataset.specGroup);
      } else if (toggle.dataset.cycleGroup !== undefined) {
        if (collapsedNow) state.collapsedCycles.add(toggle.dataset.cycleGroup);
        else state.collapsedCycles.delete(toggle.dataset.cycleGroup);
      }
      return;
    }
    const row = event.target.closest('[data-task-row]');
    if (!row || !container.contains(row)) return;
    const body = row.closest('[data-task-cycle-body]');
    if (!body) return;
    const specId = body.dataset.specId;
    const cycleId = body.dataset.cycleId;
    const rows = Array.from(body.querySelectorAll('[data-task-row]'));
    const rowIndex = rows.indexOf(row);
    const entries = visibleGroups();
    const groupEntry = entries.find((entry) => entry.group.specId === specId);
    const cycleEntry = groupEntry?.displayCycles.find(
      (cycle) => cycle.cycleId === cycleId,
    );
    const task = cycleEntry?.displayTasks[rowIndex];
    if (task) openTaskDetailModal(task, specId, cycleId);
  });

  bindListSearch(container, (value) => {
    state.query = value;
    paintList();
  });
}

const FIX_REPO_LEVEL_KEY = '__repo__';

function findSpecTitle(specsIndex, specId) {
  return specsIndex?.specs?.find((spec) => spec.id === specId)?.title ?? null;
}

function findSpecStatus(specsIndex, specId) {
  return specsIndex?.specs?.find((spec) => spec.id === specId)?.status ?? null;
}

function collectFixGroups(fixesRegistry, specsIndex) {
  const list = fixesRegistry?.fixes ?? [];
  const groups = groupBy(list, (fix) => fix.spec_id ?? FIX_REPO_LEVEL_KEY);
  const orderedKeys = [
    FIX_REPO_LEVEL_KEY,
    ...[...groups.keys()].filter((key) => key !== FIX_REPO_LEVEL_KEY),
  ].filter((key) => groups.has(key));
  return orderedKeys.map((key) => {
    const isRepo = key === FIX_REPO_LEVEL_KEY;
    return {
      key,
      isRepo,
      specId: isRepo ? null : key,
      title: isRepo
        ? 'Fixes globales (sin spec asociada)'
        : (findSpecTitle(specsIndex, key) ?? key),
      status: isRepo ? null : findSpecStatus(specsIndex, key),
      fixes: groups.get(key),
    };
  });
}

function fixesHeader(total) {
  return pageHeader({
    title: 'Fixes',
    meta: `${total} registrado${total === 1 ? '' : 's'}`,
    subtitle: 'Registro de fixes fuera del flujo SDD normal (FIX GATE).',
  });
}

async function renderFixes(container, params) {
  let fixesRegistry;
  try {
    fixesRegistry = await loadFixes();
  } catch (error) {
    container.innerHTML = errorState(error);
    return;
  }
  const specsIndex = await loadSpecsIndex().catch(() => null);
  const groups = collectFixGroups(fixesRegistry, specsIndex);
  const total = groups.reduce((sum, group) => sum + group.fixes.length, 0);

  if (total === 0) {
    container.innerHTML = `
      ${fixesHeader(0)}
      ${emptyState(
        'Sin fixes registrados',
        'Los fixes aparecen aquí cuando se usan los prefijos [HOTFIX], [BUGFIX], [FIX] o [IMPROVEMENT] para bypasear el SPEC GATE.',
      )}
      ${fixGatePrefixesPanel()}
    `;
    return;
  }

  const state = { query: '', expandedSpecs: new Set() };

  function visibleGroups() {
    const q = state.query.trim().toLowerCase();
    if (!q)
      return groups.map((group) => ({ group, displayFixes: group.fixes }));
    return groups
      .map((group) => ({
        group,
        displayFixes: group.fixes.filter((fix) => fixMatchesQuery(fix, q)),
      }))
      .filter((entry) => entry.displayFixes.length > 0);
  }

  function paintList() {
    const listRoot = container.querySelector('[data-list-root]');
    if (!listRoot) return;
    const entries = visibleGroups();
    listRoot.innerHTML =
      entries.length === 0
        ? emptyState(
            'Sin resultados',
            `No se encontraron fixes que coincidan con "${state.query}".`,
          )
        : entries
            .map(({ group, displayFixes }) =>
              renderFixGroupSection(
                group,
                displayFixes,
                state.query ? false : !state.expandedSpecs.has(group.key),
                false,
              ),
            )
            .join('');
  }

  const initialEntries = groups.map((group) => ({
    group,
    displayFixes: group.fixes,
  }));

  container.innerHTML = `
    ${fixesHeader(total)}
    ${listSearchBox('Buscar por ID, título, tipo, estado, autor o spec…', '')}
    <div data-list-root>${initialEntries
      .map(({ group, displayFixes }) =>
        renderFixGroupSection(
          group,
          displayFixes,
          !state.expandedSpecs.has(group.key),
          true,
        ),
      )
      .join('')}</div>
    ${fixGatePrefixesPanel()}
  `;

  container.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-toggle]');
    if (toggle && container.contains(toggle)) {
      const target = document.getElementById(
        toggle.getAttribute('data-toggle'),
      );
      if (!target) return;
      const wasHidden = target.hidden;
      target.hidden = !wasHidden;
      toggle.setAttribute('aria-expanded', String(wasHidden));
      const chevron = toggle.querySelector('[data-chevron]');
      if (chevron)
        chevron.style.transform = `rotate(${wasHidden ? 0 : -90}deg)`;
      const collapsedNow = !wasHidden;
      if (collapsedNow) state.expandedSpecs.delete(toggle.dataset.specGroup);
      else state.expandedSpecs.add(toggle.dataset.specGroup);
      return;
    }
    const row = event.target.closest('[data-fix-row]');
    if (!row || !container.contains(row)) return;
    const entries = visibleGroups();
    const groupEntry = entries.find((entry) =>
      entry.displayFixes.some((fix) => fix.id === row.dataset.fixId),
    );
    const fix = groupEntry?.displayFixes.find(
      (item) => item.id === row.dataset.fixId,
    );
    if (!fix) return;
    const specTitle = groupEntry.group.isRepo ? null : groupEntry.group.title;
    openFixDetailModal(fix, specTitle);
  });

  bindListSearch(container, (value) => {
    state.query = value;
    paintList();
  });
}

function fixTypeClass(type) {
  return `fix--${(type ?? 'fix').toLowerCase()}`;
}

function fixTypeTone(type) {
  const key = (type ?? 'FIX').toUpperCase();
  if (key === 'HOTFIX') return 'red';
  if (key === 'BUGFIX') return 'orange';
  if (key === 'IMPROVEMENT') return 'teal';
  return 'amber';
}

function fixTypeBadge(type) {
  const label = (type ?? 'FIX').toUpperCase();
  return `<span class="chip chip--sm chip--${fixTypeTone(type)}">${escapeHtml(label)}</span>`;
}

const FIX_GATE_PREFIXES = [
  {
    prefix: '[HOTFIX]',
    desc: 'Producción bloqueada, regresión crítica, dato corrupto',
    tone: 'red',
  },
  {
    prefix: '[BUGFIX]',
    desc: 'Error confirmado en desarrollo o testing',
    tone: 'orange',
  },
  {
    prefix: '[FIX]',
    desc: 'Alias genérico — el orquestador pedirá clasificar',
    tone: 'amber',
  },
  { prefix: '[IMPROVEMENT]', desc: 'Mejora menor out-of-spec', tone: 'teal' },
];

function fixGatePrefixRow({ prefix, desc, tone }) {
  return `
    <div style="display:flex; align-items:flex-start; gap:12px;">
      <span style="width:112px; flex-shrink:0; font-family:var(--font-mono); font-size:var(--text-11); font-weight:var(--weight-semibold); color:rgb(var(--rgb-${tone}-400));">${escapeHtml(prefix)}</span>
      <span style="font-size:var(--text-11); color:var(--text-faint);">${escapeHtml(desc)}</span>
    </div>
  `;
}

function fixGatePrefixesPanel() {
  return `
    <div style="${CYCLE_PANEL_STYLE}">
      <p style="${CYCLE_EYEBROW_STYLE}">Prefijos FIX GATE</p>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${FIX_GATE_PREFIXES.map(fixGatePrefixRow).join('')}
      </div>
    </div>
  `;
}

function fixMatchesQuery(fix, q) {
  return (
    (fix.id ?? '').toLowerCase().includes(q) ||
    (fix.title ?? '').toLowerCase().includes(q) ||
    (fix.type ?? '').toLowerCase().includes(q) ||
    (fix.status ?? '').toLowerCase().includes(q) ||
    (fix.spec_id ?? '').toLowerCase().includes(q) ||
    (fix.author ?? '').toLowerCase().includes(q)
  );
}

function renderFixCard(fix, index, animate) {
  const staggerClass = animate
    ? ` animate-fade-in-up stagger-${Math.min(index + 1, 8)}`
    : '';
  return `
    <button type="button" class="row${staggerClass}" data-fix-row data-fix-id="${escapeHtml(fix.id)}"
      style="align-items:flex-start; width:100%; text-align:left; background:none; border:none; cursor:pointer; color:inherit; font:inherit; border-bottom:1px solid var(--border);"
      aria-label="Ver detalle de ${escapeHtml(fix.title ?? fix.id)}">
      <span style="display:flex; align-items:flex-start; gap:16px; min-width:0;">
        <span style="width:64px; flex-shrink:0; font-family:var(--font-mono); font-size:var(--text-10); color:rgb(var(--rgb-emerald-500) / 0.6); padding-top:2px;">${escapeHtml(fix.id)}</span>
        <span style="min-width:0;">
          <span style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            ${fixTypeBadge(fix.type)}
            ${fix.cycle ? `<span class="card-hint" style="margin:0;">ciclo: ${escapeHtml(fix.cycle)}</span>` : ''}
          </span>
          <span style="display:block; font-size:var(--text-14); color:var(--text-muted); overflow-wrap:break-word;">${escapeHtml(fix.title ?? '—')}</span>
          <span style="display:block; font-family:var(--font-mono); font-size:var(--text-10); color:var(--text-subtle); margin-top:4px;">${escapeHtml(fix.created_at ?? '—')}</span>
        </span>
      </span>
      <span style="flex-shrink:0;">${badge(fix.status ?? '—', fixStatusClass(fix.status))}</span>
    </button>
  `;
}

function renderFixGroupSection(group, displayFixes, collapsed, animate) {
  const contentId = planningDomId('fixes-group', group.key);
  const meta =
    displayFixes.length === group.fixes.length
      ? `${group.fixes.length} fix${group.fixes.length === 1 ? '' : 'es'}`
      : `${displayFixes.length} / ${group.fixes.length} fix${group.fixes.length === 1 ? '' : 'es'}`;
  return `
    <div>
      ${groupHeaderButton(
        {
          eyebrow: group.isRepo ? 'Nivel repositorio' : 'Spec',
          title: group.title,
          subtitle: group.isRepo ? null : group.specId,
          meta,
          statusChip: specStatusChip(group.status),
        },
        contentId,
        `data-spec-group="${escapeHtml(group.key)}"`,
        collapsed,
      )}
      <div id="${contentId}" ${collapsed ? 'hidden' : ''} style="padding-left:12px; border-left:1px solid rgb(var(--rgb-zinc-800) / 0.6); margin-top:8px;">
        ${displayFixes.map((fix, idx) => renderFixCard(fix, idx, animate)).join('')}
      </div>
    </div>
  `;
}

function fixStatusClass(status) {
  if (status === 'validated') return 'status--implemented';
  if (status === 'absorbed') return 'status--skipped';
  return `status--${status ?? 'pending'}`;
}

function openFixDetailModal(fix, specTitle) {
  const path = stripSddPrefix(fix.fix_document ?? '');
  openAsyncModal({
    title: fix.title ?? fix.id,
    subtitle: fix.id,
    size: 'lg',
    load: async () => {
      const html = path ? await loadMarkdown(path).catch(() => null) : null;
      const markdownSection =
        html === null
          ? emptyState('No disponible', path || 'sin fix_document')
          : `<div class="markdown">${html}</div>`;
      return fixDetailBody(fix, specTitle, markdownSection);
    },
  });
}

function fixAffectedFilesSection(fix) {
  const files = fix.affected_files ?? [];
  if (files.length === 0) return '';
  const items = files
    .map((file) => `<li><code>${escapeHtml(file)}</code></li>`)
    .join('');
  return `<p class="card-hint">Archivos afectados (${files.length})</p><ul>${items}</ul>`;
}

function fixRelatedModulesSection(fix) {
  const modules = fix.related_modules ?? [];
  if (modules.length === 0) return '';
  return `<p class="card-hint">Módulos: ${modules.map((module) => escapeHtml(module)).join(' · ')}</p>`;
}

function fixDetailBody(fix, specTitle, markdownSection) {
  return `
    <p style="display:flex; gap:8px; flex-wrap:wrap; margin:0 0 12px;">${fixTypeBadge(fix.type)}${badge(fix.status ?? '—', fixStatusClass(fix.status))}${fix.severity ? badge(fix.severity) : ''}</p>
    <p class="card-hint">${escapeHtml(`Creado: ${fix.created_at ?? '—'} · Resuelto: ${fix.resolved_at ?? '—'} · Validado: ${fix.validated_at ?? '—'}`)}</p>
    ${fix.cycle ? `<p class="card-hint">${escapeHtml(`Ciclo: ${fix.cycle}`)}</p>` : ''}
    ${specTitle ? `<p class="card-hint">${escapeHtml(`Spec: ${specTitle}`)}</p>` : ''}
    <p class="card-hint">${escapeHtml(`Estimación: ${formatHours(fix.estimation_hours)}`)}</p>
    ${fix.description ? `<p class="card-subtitle" style="margin-top:12px;">${escapeHtml(fix.description)}</p>` : ''}
    ${fix.justification && fix.justification !== fix.description ? `<p class="card-hint">${escapeHtml(fix.justification)}</p>` : ''}
    ${fixRelatedModulesSection(fix)}
    ${fixAffectedFilesSection(fix)}
    ${markdownSection}
  `;
}

const CONTEXT_DOC_LABELS = {
  'constitution.md': 'Constitution',
  'context_prompt.md': 'Context Prompt',
};

const CONTEXT_CATEGORY_LABELS = {
  global: 'Global',
  apps: 'Apps',
  libs: 'Libs',
  tools: 'Tools',
};

const CONTEXT_CATEGORY_ORDER = ['global', 'apps', 'libs', 'tools'];
const CONTEXT_DOCS = ['context_prompt.md', 'constitution.md'];
const MAX_CONTEXT_CANDIDATES = 40;

function contextDocPath(category, name, file) {
  const prefix =
    category === 'global' ? 'context' : `context/${category}/${name}`;
  return `${prefix}/${file}`;
}

function parseAppRef(ref) {
  if (typeof ref !== 'string') return null;
  const prefixed = /^(apps|libs)\/([a-z][a-z0-9-]*)$/.exec(ref);
  if (prefixed) return { category: prefixed[1], name: prefixed[2] };
  if (/^[a-z][a-z0-9-]*$/.test(ref)) return { category: 'apps', name: ref };
  return null;
}

function deriveMonorepoAppRef(name, description) {
  const contextOverride =
    /sdd\/context\/(apps|libs|tools)\/([a-z][a-z0-9-]*)\//.exec(
      String(description ?? ''),
    );
  if (contextOverride)
    return { category: contextOverride[1], name: contextOverride[2] };
  return { category: 'apps', name };
}

function addContextCandidate(candidates, category, name) {
  if (!['apps', 'libs', 'tools'].includes(category)) return;
  if (!/^[a-z][a-z0-9-]*$/.test(String(name))) return;
  const key = `${category}/${name}`;
  if (candidates.has(key)) return;
  if (candidates.size >= MAX_CONTEXT_CANDIDATES) return;
  candidates.set(key, { category, name });
}

function addParsedContextCandidate(candidates, ref, knownAppNames) {
  const parsed = parseAppRef(ref);
  if (!parsed) return;
  if (
    parsed.category === 'apps' &&
    knownAppNames &&
    !knownAppNames.has(parsed.name)
  )
    return;
  addContextCandidate(candidates, parsed.category, parsed.name);
}

function collectContextCandidates({
  global,
  specsIndex,
  api,
  schema,
  components,
}) {
  const candidates = new Map();
  const knownAppNames = new Set();

  for (const [name, description] of Object.entries(
    global?.monorepo?.apps ?? {},
  )) {
    const ref = deriveMonorepoAppRef(name, description);
    addContextCandidate(candidates, ref.category, ref.name);
    if (ref.category === 'apps') knownAppNames.add(ref.name);
  }

  const monorepoLibs = global?.monorepo?.libs;
  if (monorepoLibs && typeof monorepoLibs === 'object') {
    for (const name of Object.keys(monorepoLibs))
      addContextCandidate(candidates, 'libs', name);
  }

  const modules = [
    ...(global?.completed_modules ?? []),
    ...(global?.in_progress_modules ?? []),
    ...(global?.pending_modules ?? []),
  ];
  for (const module of modules) {
    for (const ref of module?.apps ?? [])
      addParsedContextCandidate(candidates, ref, knownAppNames);
  }

  for (const spec of specsIndex?.specs ?? []) {
    for (const ref of [spec?.app, ...(spec?.apps ?? [])].filter(Boolean)) {
      addParsedContextCandidate(candidates, ref, knownAppNames);
    }
  }

  for (const registry of [api, schema, components]) {
    for (const key of Object.keys(registry ?? {})) {
      if (key.startsWith('$') || key.startsWith('_')) continue;
      addParsedContextCandidate(candidates, key, knownAppNames);
    }
  }

  for (const seed of CATALOG.contextSeeds)
    addContextCandidate(candidates, seed.category, seed.name);

  return [...candidates.values()];
}

function extractContextFreshness(text) {
  const match = /Última actualización:\s*([^|\n]+)/.exec(text);
  return match ? match[1].trim() : null;
}

async function probeContextEntry(category, name) {
  const docs = await Promise.all(
    CONTEXT_DOCS.map(async (file) => {
      const path = contextDocPath(category, name, file);
      const available = await resourceExists(path);
      return { file, path, key: `${category}:${name}:${file}`, available };
    }),
  );
  return { category, name, docs };
}

async function loadContextCatalog() {
  const settledValue = (result) =>
    result.status === 'fulfilled' ? result.value : null;
  const registryResults = await Promise.allSettled([
    loadGlobal(),
    loadSpecsIndex(),
    loadApiRegistry(),
    loadSchemaRegistry(),
    loadComponentsRegistry(),
  ]);
  if (registryResults.every((result) => result.status === 'rejected')) {
    throw registryResults[0].reason;
  }
  const [
    globalResult,
    specsIndexResult,
    apiResult,
    schemaResult,
    componentsResult,
  ] = registryResults;

  const candidates = collectContextCandidates({
    global: settledValue(globalResult),
    specsIndex: settledValue(specsIndexResult),
    api: settledValue(apiResult),
    schema: settledValue(schemaResult),
    components: settledValue(componentsResult),
  });

  const [globalEntry, ...probedEntries] = await Promise.all([
    probeContextEntry('global', 'global'),
    ...candidates.map((candidate) =>
      probeContextEntry(candidate.category, candidate.name),
    ),
  ]);

  const entries = [
    globalEntry,
    ...probedEntries.filter((entry) => entry.docs.some((doc) => doc.available)),
  ];

  const withFreshness = await Promise.all(
    entries.map(async (entry) => {
      const promptDoc = entry.docs.find(
        (doc) => doc.file === 'context_prompt.md' && doc.available,
      );
      if (!promptDoc) return { ...entry, freshness: null };
      const text = await fetchText(promptDoc.path).catch(() => null);
      return {
        ...entry,
        freshness: text ? extractContextFreshness(text) : null,
      };
    }),
  );

  return sortBy(
    withFreshness,
    (entry) =>
      `${CONTEXT_CATEGORY_ORDER.indexOf(entry.category)}:${entry.name}`,
  );
}

const contextCollapsedCategories = new Set();
const contextCollapsedEntries = new Set();

function contextChevron(open) {
  return `<svg viewBox="0 0 10 6" width="10" height="6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;transition:transform 0.2s;transform:rotate(${open ? 0 : -90}deg);color:var(--text-faint)"><path d="M1 1l4 4 4-4"></path></svg>`;
}

function contextEntryPath(entry) {
  return entry.category === 'global'
    ? 'sdd/context/'
    : `sdd/context/${entry.category}/${entry.name}/`;
}

function contextSearchBar() {
  return `
    <div style="position:relative; margin: 8px 0 20px">
      <span aria-hidden="true" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); display:flex; color:var(--text-subtle); pointer-events:none">
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="5"></circle><line x1="11" y1="11" x2="14.5" y2="14.5"></line></svg>
      </span>
      <input type="text" data-context-search placeholder="Buscar por nombre, categoría o archivo…" style="width:100%; box-sizing:border-box; background: rgb(var(--rgb-zinc-900) / 0.6); border:1px solid var(--border); border-radius: var(--radius-lg); padding: 8px 32px; font-size: var(--text-14); font-family: var(--font-mono); color: var(--text-bright)">
      <button type="button" data-context-clear hidden aria-label="Limpiar búsqueda" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); width:12px; height:12px; background:none; border:none; cursor:pointer; color:var(--text-subtle); padding:0"><span style="display:flex; align-items:center; justify-content:center; width:100%; height:100%">${icon('close')}</span></button>
    </div>
  `;
}

function contextMatchesQuery(entry, query) {
  if (!query) return true;
  const haystack = [
    entry.name,
    entry.category,
    ...entry.docs.map((doc) => doc.file),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function renderContextList(entries, query) {
  if (entries.length === 0) {
    return emptyState(
      'Sin contexto registrado',
      'No se encontraron archivos en sdd/context/.',
    );
  }
  const filtered = entries.filter((entry) => contextMatchesQuery(entry, query));
  if (filtered.length === 0) {
    return emptyState(
      'Sin resultados',
      `No se encontraron entradas que coincidan con "${query}".`,
    );
  }
  const groups = groupBy(filtered, (entry) => entry.category);
  return CONTEXT_CATEGORY_ORDER.filter((category) => groups.has(category))
    .map((category) =>
      renderContextCategorySection(category, groups.get(category), query),
    )
    .join('');
}

async function renderContext(container, params) {
  let entries;
  try {
    entries = await loadContextCatalog();
  } catch (error) {
    container.innerHTML = errorState(error);
    return;
  }
  const totalSubprojects = Math.max(entries.length - 1, 0);

  container.innerHTML = `
    ${pageHeader({
      title: 'Contexto SDD',
      meta: `${totalSubprojects} subproyectos`,
      subtitle:
        'Constitution y context prompt de cada subproyecto del monorepo: la fuente de verdad de convenciones, stack y estado por app, lib y tool.',
    })}
    ${entries.length > 0 ? contextSearchBar() : ''}
    <div data-context-list-root>${renderContextList(entries, '')}</div>
  `;

  attachContextDocHandlers(container, entries);
}

function renderContextCategorySection(category, entries, query) {
  const collapsed = query === '' && contextCollapsedCategories.has(category);
  const contentId = `context-category-${category}`;
  return `
    <section style="margin-bottom:16px">
      <button type="button" data-context-toggle-category="${escapeHtml(category)}" aria-expanded="${!collapsed}" aria-controls="${contentId}" style="all:unset; box-sizing:border-box; cursor:pointer; display:flex; align-items:center; gap:10px; width:100%; padding:8px 4px; border-bottom:1px solid var(--border)">
        ${contextChevron(!collapsed)}
        <span style="font-family:var(--font-mono); font-size:var(--text-11); font-weight:var(--weight-semibold); text-transform:uppercase; letter-spacing:0.05em; color:var(--text-dim)">${escapeHtml(CONTEXT_CATEGORY_LABELS[category] ?? category)}</span>
        <span class="card-hint" style="margin-left:auto">${entries.length} entrada${entries.length === 1 ? '' : 's'}</span>
      </button>
      <div id="${contentId}" ${collapsed ? 'hidden' : ''} style="padding-left:12px; border-left:1px solid rgb(var(--rgb-zinc-800) / 0.6); margin-top:8px">
        <div style="display:flex; flex-direction:column; gap:4px">
          ${entries.map((entry) => renderContextEntrySection(entry, query)).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderContextEntrySection(entry, query) {
  const key = `${entry.category}/${entry.name}`;
  const collapsed = query === '' && contextCollapsedEntries.has(key);
  const contentId = `context-entry-${key.replace(/[^a-zA-Z0-9]/g, '-')}`;
  return `
    <div>
      <button type="button" data-context-toggle-entry="${escapeHtml(key)}" aria-expanded="${!collapsed}" aria-controls="${contentId}" style="all:unset; box-sizing:border-box; cursor:pointer; display:flex; align-items:center; gap:10px; width:100%; padding:8px 4px">
        ${contextChevron(!collapsed)}
        <span class="card-title" style="margin:0; font-size:var(--text-12)">${escapeHtml(entry.name)}</span>
        ${entry.freshness ? `<span class="card-hint" style="margin:0">${escapeHtml(entry.freshness)}</span>` : ''}
        <span class="card-hint" style="margin-left:auto">${entry.docs.length} docs</span>
      </button>
      <div id="${contentId}" ${collapsed ? 'hidden' : ''} style="margin-left:24px">
        <div style="display:flex; flex-direction:column; gap:6px; padding:6px 0 4px">
          ${entry.docs.map((doc) => renderContextDocCard(entry, doc)).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderContextDocCard(entry, doc) {
  const label = CONTEXT_DOC_LABELS[doc.file] ?? doc.file;
  const attrs = doc.available
    ? ` tabindex="0" role="button" style="cursor:pointer; border-radius:var(--radius-lg); padding:10px 12px" data-context-key="${escapeHtml(doc.key)}" aria-label="Ver ${escapeHtml(label)} de ${escapeHtml(entry.name)}"`
    : ` style="border-radius:var(--radius-lg); padding:10px 12px; opacity:0.5"`;
  const trailing = doc.available
    ? `<span class="row-chevron">›</span>`
    : `<span class="empty-state-hint" style="margin:0">No disponible</span>`;
  return `
    <div class="tile"${attrs}>
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px">
        <div style="display:flex; align-items:center; gap:10px; min-width:0">
          <span aria-hidden="true" style="color:var(--text-ghost); flex-shrink:0">${icon('file')}</span>
          <span class="card-title" style="margin:0; font-size:var(--text-12)">${escapeHtml(label)}</span>
          <span class="card-hint" style="margin:0">${escapeHtml(doc.file)}</span>
        </div>
        ${trailing}
      </div>
    </div>
  `;
}

function attachContextDocHandlers(container, entries) {
  const docsByKey = new Map();
  for (const entry of entries) {
    for (const doc of entry.docs) {
      if (!doc.available) continue;
      docsByKey.set(doc.key, { entry, doc });
    }
  }

  const listRoot = container.querySelector('[data-context-list-root]');
  const searchInput = container.querySelector('[data-context-search]');
  const clearButton = container.querySelector('[data-context-clear]');
  let query = '';

  const paint = () => {
    if (listRoot) listRoot.innerHTML = renderContextList(entries, query);
  };

  container.addEventListener('input', (event) => {
    if (!event.target.matches('[data-context-search]')) return;
    query = event.target.value.trim().toLowerCase();
    if (clearButton) clearButton.hidden = query === '';
    paint();
  });

  container.addEventListener('click', (event) => {
    const clearTarget = event.target.closest('[data-context-clear]');
    if (clearTarget) {
      query = '';
      if (searchInput) searchInput.value = '';
      clearTarget.hidden = true;
      paint();
      searchInput?.focus();
      return;
    }

    const categoryToggle = event.target.closest(
      '[data-context-toggle-category]',
    );
    if (categoryToggle) {
      const category = categoryToggle.dataset.contextToggleCategory;
      if (contextCollapsedCategories.has(category))
        contextCollapsedCategories.delete(category);
      else contextCollapsedCategories.add(category);
      paint();
      return;
    }

    const entryToggle = event.target.closest('[data-context-toggle-entry]');
    if (entryToggle) {
      const key = entryToggle.dataset.contextToggleEntry;
      if (contextCollapsedEntries.has(key)) contextCollapsedEntries.delete(key);
      else contextCollapsedEntries.add(key);
      paint();
      return;
    }

    const docCard = event.target.closest('[data-context-key]');
    if (docCard) {
      const found = docsByKey.get(docCard.dataset.contextKey);
      if (found) openContextDocModal(found.entry, found.doc);
    }
  });

  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const docCard = event.target.closest('[data-context-key]');
    if (!docCard) return;
    event.preventDefault();
    const found = docsByKey.get(docCard.dataset.contextKey);
    if (found) openContextDocModal(found.entry, found.doc);
  });
}

function openContextDocModal(entry, doc) {
  const tabs = entry.docs.map((item) => ({
    id: item.file,
    label: CONTEXT_DOC_LABELS[item.file] ?? item.file,
    disabled: !item.available,
    load: () =>
      loadMarkdown(item.path).then(
        (html) => `<div class="markdown">${html}</div>`,
        () => emptyState('No disponible', `sdd/${item.path}`),
      ),
  }));
  openModal({
    title: entry.name,
    subtitle: contextEntryPath(entry),
    size: 'lg',
    tabs,
    activeTabId: doc?.available ? doc.file : undefined,
  });
}

async function renderAgents(container, params) {
  let manifest = null;
  let manifestFailed = false;
  try {
    manifest = await loadManifest();
  } catch {
    manifestFailed = true;
  }
  const agentList = manifest
    ? enrichAgentManifest(manifest.agents)
    : CATALOG.agents;

  const results = await Promise.allSettled(
    agentList.map((agent) => fetchText(`agents/${agent.file}`)),
  );
  const agents = agentList.map((agent, index) =>
    buildAgentEntry(agent, results[index]),
  );

  container.innerHTML = `
    ${pageHeader({
      title: 'Agentes SDD',
      meta: `${agents.length} agentes activos`,
      subtitle: `Pipeline de ${agents.length} agentes que coordina el ciclo SDD de principio a fin. Cada agente tiene un rol específico e invoca al siguiente.`,
    })}
    ${manifestFailed ? manifestFallbackHint() : ''}
    <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:16px">
      ${agents.map((agent, index) => renderAgentCard(agent, index)).join('')}
    </div>
    ${agentsInvokePanel()}
  `;

  attachAgentCardHandlers(container, agents);
}

function buildAgentEntry(agent, result) {
  if (result.status !== 'fulfilled')
    return { ...agent, available: false, description: '' };
  const { description } = parseAgentFrontmatter(result.value);
  return { ...agent, available: true, description };
}

function parseAgentFrontmatter(source) {
  const match = /^---\n([\s\S]*?)\n---/.exec(source);
  if (!match) return { description: '' };
  const description =
    /^description:\s*(.+)$/m.exec(match[1])?.[1]?.trim() ?? '';
  return { description };
}

const AGENT_ACCENT_TONE = {
  '01': 'emerald',
  '02': 'sky',
  '03': 'violet',
  '04': 'amber',
  '05': 'blue',
  '06': 'pink',
  '07': 'teal',
};

function agentAccentSquare(num) {
  const tone = AGENT_ACCENT_TONE[num] ?? 'emerald';
  return `<span aria-hidden="true" style="display:flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius: var(--radius-lg); flex-shrink:0; font-family: var(--font-mono); font-size: var(--text-12); font-weight: var(--weight-bold); color: rgb(var(--rgb-${tone}-400)); background: rgb(var(--rgb-${tone}-500) / 0.05); border: 1px solid rgb(var(--rgb-${tone}-500) / 0.2)">${escapeHtml(num)}</span>`;
}

function agentsInvokePanel() {
  return `
    <div style="border-radius: var(--radius-lg); border: 1px solid rgb(var(--rgb-zinc-800) / 0.6); background: rgb(var(--rgb-zinc-900) / 0.2); padding: 16px 20px">
      <p style="margin:0 0 8px; font-family: var(--font-mono); font-size: var(--text-10); text-transform:uppercase; letter-spacing:0.05em; color: var(--text-faint)">Cómo invocar un agente</p>
      <p class="card-hint" style="margin:0">Los agentes se invocan desde Claude Code usando el flag <code>--agent</code> o prefijando el mensaje con el rol del agente. El Orquestador es siempre el punto de entrada al ciclo SDD.</p>
    </div>
  `;
}

function renderAgentCard(agent, index) {
  const description = agent.available
    ? agent.description
      ? `<p class="card-hint">${escapeHtml(agent.description)}</p>`
      : ''
    : `<p class="empty-state-hint">No disponible</p>`;
  const attrs = agent.available
    ? ` tabindex="0" role="button" style="cursor:pointer" data-agent-index="${index}" aria-label="Ver detalle de ${escapeHtml(agent.label)}"`
    : '';
  const staggerClass = ` animate-fade-in-up stagger-${Math.min(index + 1, 8)}`;
  return `
    <div class="tile${staggerClass}"${attrs}>
      <div style="display:flex; align-items:flex-start; gap:12px">
        ${agentAccentSquare(agent.num)}
        <div style="flex:1; min-width:0">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
            <span class="card-title" style="margin:0">${escapeHtml(agent.label)}</span>
            <span class="card-hint" style="margin:0">${escapeHtml(agent.file)}</span>
          </div>
          ${description}
        </div>
      </div>
    </div>
  `;
}

function attachAgentCardHandlers(container, agents) {
  for (const [index, agent] of agents.entries()) {
    if (!agent.available) continue;
    const trigger = container.querySelector(`[data-agent-index="${index}"]`);
    if (!trigger) continue;
    const open = () => openAgentModal(agent);
    trigger.addEventListener('click', open);
    trigger.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      open();
    });
  }
}

function openAgentModal(agent) {
  const path = `agents/${agent.file}`;
  openAsyncModal({
    title: agent.label,
    subtitle: `sdd/${path}`,
    size: 'xl',
    load: () =>
      loadMarkdown(path).then(
        (html) => `<div class="markdown">${html}</div>`,
        () => emptyState('No disponible', `sdd/${path}`),
      ),
  });
}

async function renderSkills(container, params) {
  let manifest = null;
  let manifestFailed = false;
  try {
    manifest = await loadManifest();
  } catch {
    manifestFailed = true;
  }
  const skillList = manifest
    ? enrichSkillManifest(manifest.skills)
    : CATALOG.skills;

  const results = await Promise.allSettled(
    skillList.map((skill) => fetchText(`skills/${skill.dir}/${skill.file}`)),
  );
  const skills = skillList.map((skill, index) =>
    buildSkillEntry(skill, results[index]),
  );
  const groups = groupBy(skills, (skill) => skill.category);

  container.innerHTML = `
    ${pageHeader({
      title: 'Skills',
      meta: `${skills.length} skills activos`,
      subtitle:
        'Habilidades especializadas disponibles en el entorno Claude Code. Cada skill encapsula un conjunto de instrucciones y parámetros para tareas específicas.',
    })}
    ${manifestFailed ? manifestFallbackHint() : ''}
    ${[...groups.entries()].map(([category, items]) => renderSkillCategory(category, items)).join('')}
  `;

  attachSkillCardHandlers(container, skills);
}

function buildSkillEntry(skill, result) {
  if (result.status !== 'fulfilled')
    return { ...skill, available: false, description: '' };
  const { description } = parseSkillFrontmatter(result.value);
  return { ...skill, available: true, description };
}

function parseSkillFrontmatter(source) {
  const match = /^---\n([\s\S]*?)\n---/.exec(source);
  if (!match) return { description: '' };
  const description =
    /^description:\s*(.+)$/m.exec(match[1])?.[1]?.trim() ?? '';
  return { description };
}

function formatSkillLabel(dir) {
  return dir
    .replace(/^generate-/, 'gen: ')
    .replace(/^sdd-/, 'sdd: ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const SKILL_CATEGORY_TONE = {
  'SDD Agent': 'emerald',
  'SDD Utility': 'sky',
  Generator: 'violet',
};

function skillCategoryChip(category) {
  const tone = SKILL_CATEGORY_TONE[category];
  if (!tone)
    return `<span class="chip chip--sm" style="flex-shrink:0">${escapeHtml(category)}</span>`;
  return `<span style="display:inline-flex; align-items:center; flex-shrink:0; padding: 2px 8px; border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: var(--text-10); color: rgb(var(--rgb-${tone}-400)); background: rgb(var(--rgb-${tone}-500) / 0.05); border: 1px solid rgb(var(--rgb-${tone}-500) / 0.2)">${escapeHtml(category)}</span>`;
}

function renderSkillCategory(category, items) {
  return `
    <section style="margin-bottom:24px">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px">
        <p style="margin:0; font-family: var(--font-mono); font-size: var(--text-10); text-transform:uppercase; letter-spacing:0.05em; color: var(--text-dim)">${escapeHtml(category)}</p>
        <span class="card-hint" style="margin:0">${items.length}</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px">${items.map((skill) => renderSkillCard(skill, category)).join('')}</div>
    </section>
  `;
}

function renderSkillCard(skill, category) {
  const title = formatSkillLabel(skill.dir);
  const hint = skill.available
    ? skill.description
      ? `<p class="card-hint" style="margin:2px 0 0">${escapeHtml(skill.description)}</p>`
      : ''
    : `<p class="empty-state-hint" style="margin:2px 0 0">No disponible</p>`;
  const attrs = skill.available
    ? ` tabindex="0" role="button" style="cursor:pointer" data-skill-dir="${escapeHtml(skill.dir)}" aria-label="Ver detalle de ${escapeHtml(title)}"`
    : '';
  return `
    <div class="tile" style="padding:14px 16px"${attrs}>
      <div style="display:flex; align-items:flex-start; gap:12px">
        ${skillCategoryChip(category)}
        <div style="flex:1; min-width:0">
          <p class="card-title" style="margin:0; font-family: var(--font-mono); font-size: var(--text-14)">${escapeHtml(title)}</p>
          ${hint}
          <p class="card-hint" style="margin:4px 0 0; color: var(--text-ghost)">/${escapeHtml(skill.dir)}</p>
        </div>
      </div>
    </div>
  `;
}

function attachSkillCardHandlers(container, skills) {
  for (const skill of skills) {
    if (!skill.available) continue;
    const trigger = container.querySelector(`[data-skill-dir="${skill.dir}"]`);
    if (!trigger) continue;
    const open = () => openSkillModal(skill);
    trigger.addEventListener('click', open);
    trigger.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      open();
    });
  }
}

function openSkillModal(skill) {
  const path = `skills/${skill.dir}/${skill.file}`;
  openAsyncModal({
    title: formatSkillLabel(skill.dir),
    subtitle: `sdd/${path}`,
    size: 'xl',
    load: () =>
      loadMarkdown(path).then(
        (html) => `<div class="markdown">${html}</div>`,
        () => emptyState('No disponible', `sdd/${path}`),
      ),
  });
}

const PROMPT_FLOW = [
  'start-sdd-cycle',
  'check-spec-before-implement',
  'hotfix-bypass-gate',
  'review-cycle',
];

function promptsFlowPanel() {
  const chain = PROMPT_FLOW.map((step, index) => {
    const arrow =
      index < PROMPT_FLOW.length - 1
        ? `<span style="color: var(--text-ghost); font-size: var(--text-12)">›</span>`
        : '';
    return `<span style="font-family: var(--font-mono); font-size: var(--text-10); color: var(--text-dim)">${escapeHtml(step)}</span>${arrow}`;
  }).join('');
  return `
    <div style="border-radius: var(--radius-lg); border: 1px solid rgb(var(--rgb-zinc-800) / 0.6); background: rgb(var(--rgb-zinc-900) / 0.2); padding: 16px 20px">
      <p style="margin:0 0 8px; font-family: var(--font-mono); font-size: var(--text-10); text-transform:uppercase; letter-spacing:0.05em; color: var(--text-faint)">Flujo de prompts</p>
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">${chain}</div>
    </div>
  `;
}

async function renderPrompts(container, params) {
  let manifest = null;
  let manifestFailed = false;
  try {
    manifest = await loadManifest();
  } catch {
    manifestFailed = true;
  }
  const promptList = manifest
    ? enrichPromptManifest(manifest.prompts)
    : CATALOG.prompts;

  const results = await Promise.allSettled(
    promptList.map((entry) => loadMarkdown(`prompts/${entry.file}`)),
  );

  const prompts = promptList.map((entry, index) => {
    const result = results[index];
    return result.status === 'fulfilled'
      ? { ...entry, html: result.value, error: null }
      : { ...entry, html: null, error: result.reason };
  });

  const body = prompts.every((prompt) => prompt.error)
    ? errorState(prompts[0].error)
    : `<div style="display:flex; flex-direction:column; gap:12px; margin-bottom:16px">${prompts.map((prompt, index) => promptCardMarkup(prompt, index)).join('')}</div>`;

  container.innerHTML = `
    ${pageHeader({
      title: 'Prompts',
      meta: `${prompts.length} prompts activos`,
      subtitle:
        'Prompts estructurados que guían los momentos críticos del flujo SDD: apertura, verificación, bypass y cierre de ciclos.',
    })}
    ${manifestFailed ? manifestFallbackHint() : ''}
    ${body}
    ${promptsFlowPanel()}
  `;

  attachPromptCardListeners(container, prompts);
}

function promptCardMarkup(prompt, index) {
  const labelChip = prompt.error
    ? ''
    : `<span style="display:inline-flex; padding:2px 8px; border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: var(--text-10); color: rgb(var(--rgb-emerald-400)); background: rgb(var(--rgb-emerald-500) / 0.05); border: 1px solid rgb(var(--rgb-emerald-500) / 0.2)">${escapeHtml(prompt.label)}</span>`;
  const body = prompt.error
    ? `<p class="empty-state-hint" style="margin:6px 0 0">No disponible</p>`
    : `
      <p class="card-subtitle" style="margin-top:6px">${escapeHtml(prompt.description)}</p>
      <p class="card-hint">${escapeHtml(`Trigger: ${prompt.trigger}`)}</p>
    `;
  const staggerClass = ` animate-fade-in-up stagger-${Math.min(index + 1, 8)}`;
  return `
    <div class="tile${staggerClass}" role="button" tabindex="0" data-prompt-index="${index}" style="cursor:pointer">
      <div style="display:flex; align-items:flex-start; gap:12px">
        <div style="flex:1; min-width:0">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
            ${labelChip}
            <span class="card-hint" style="margin:0; font-family: var(--font-mono)">${escapeHtml(prompt.file)}</span>
          </div>
          ${body}
        </div>
        <span class="row-chevron">›</span>
      </div>
    </div>
  `;
}

function promptDetailBody(prompt) {
  if (prompt.error) return errorState(prompt.error);
  return `<div class="markdown">${prompt.html}</div>`;
}

function openPromptDetail(prompt) {
  openModal(prompt.label, promptDetailBody(prompt), { size: 'xl' });
}

function attachPromptCardListeners(container, prompts) {
  for (const cardEl of container.querySelectorAll('[data-prompt-index]')) {
    const prompt = prompts[Number(cardEl.dataset.promptIndex)];
    cardEl.addEventListener('click', () => openPromptDetail(prompt));
    cardEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openPromptDetail(prompt);
    });
  }
}

function isRegistryAppEntry(key, value) {
  if (key.startsWith('_') || key.startsWith('$')) return false;
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function statusTag(status) {
  const meta =
    STATUS_META[String(status ?? '').toLowerCase()] ?? STATUS_META.defined;
  const toneColor = {
    emerald: 'rgb(var(--rgb-emerald-400))',
    teal: 'rgb(var(--rgb-teal-400))',
    amber: 'rgb(var(--rgb-amber-400))',
    zinc: 'var(--text-dim)',
    'zinc-mute': 'var(--text-faint)',
    rose: 'rgb(var(--rgb-rose-400))',
    sky: 'rgb(var(--rgb-sky-400))',
  };
  const color = toneColor[meta.tone] ?? 'var(--text-dim)';
  return `<span class="status-tag" style="color:${color}">${escapeHtml(meta.label)}</span>`;
}

function methodBadge(method) {
  const value = (method ?? 'GET').toUpperCase();
  return `<span class="method--${value.toLowerCase()}" style="display:inline-flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:var(--text-10);font-weight:var(--weight-medium);padding:2px 6px;border-style:solid;border-width:1px;border-radius:var(--radius-sm);">${escapeHtml(value)}</span>`;
}

function inlineExpandToggle({ open }) {
  return `<span class="inline-toggle" style="color:var(--text-subtle);font-size:var(--text-12);line-height:1;">${open ? '▲' : '▼'}</span>`;
}

function inlineRowOpenAttrs(label) {
  return `role="button" tabindex="0" aria-expanded="false" aria-label="${escapeHtml(label)}" style="cursor:pointer"`;
}

function attachInlineExpandHandlers(container, rowSelector) {
  const rows = Array.from(container.querySelectorAll(rowSelector)).filter(
    (el) => el.getAttribute('role') === 'button',
  );
  const setOpen = (rowEl, open) => {
    const detailEl = rowEl.nextElementSibling;
    if (!detailEl) return;
    detailEl.hidden = !open;
    rowEl.setAttribute('aria-expanded', String(open));
    const toggleEl = rowEl.querySelector('.inline-toggle');
    if (toggleEl) toggleEl.textContent = open ? '▲' : '▼';
  };
  const activate = (rowEl) => {
    const wasOpen = rowEl.getAttribute('aria-expanded') === 'true';
    for (const other of rows) {
      if (other !== rowEl) setOpen(other, false);
    }
    setOpen(rowEl, !wasOpen);
  };
  for (const rowEl of rows) {
    rowEl.addEventListener('click', () => activate(rowEl));
    rowEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      activate(rowEl);
    });
  }
}

async function renderSchema(container, params) {
  let registry;
  try {
    registry = await loadSchemaRegistry();
  } catch (error) {
    container.innerHTML = errorState(error);
    return;
  }
  const tables = collectSchemaTables(registry);
  const header = pageHeader({
    title: 'Schema',
    meta: `${tables.length} tabla${tables.length === 1 ? '' : 's'}`,
    subtitle: 'Tablas y entidades de base de datos definidas en el proyecto.',
  });
  if (tables.length === 0) {
    container.innerHTML = `
      ${header}
      ${emptyState(
        'Schema vacío',
        'Las tablas de base de datos serán definidas por el agente Arquitecto y aparecerán aquí una vez que el primer ciclo SDD lo defina.',
      )}
    `;
    return;
  }
  container.innerHTML = `
    ${header}
    <div class="row-list">${tables.map((table) => renderSchemaTableRow(table)).join('')}</div>
  `;
  attachInlineExpandHandlers(container, '[data-schema-row]');
}

function collectSchemaTables(registry) {
  return Object.entries(registry ?? {})
    .filter(([key, value]) => isRegistryAppEntry(key, value))
    .flatMap(([appKey, value]) =>
      Object.entries(value?.tables ?? {}).map(([name, table]) => ({
        ...table,
        name,
        _app: appKey,
      })),
    );
}

function hasSchemaDetail(table) {
  return (
    Object.keys(table.columns ?? {}).length > 0 ||
    (table.indexes ?? []).length > 0
  );
}

function renderSchemaTableRow(table) {
  const key = `${table._app}::${table.name}`;
  const columnCount = Object.keys(table.columns ?? {}).length;
  const detail = hasSchemaDetail(table);
  return `
    <div class="row-item">
      <div class="row" data-schema-row="${escapeHtml(key)}" ${detail ? inlineRowOpenAttrs(`Ver detalle de ${table.name}`) : ''}>
        <div class="row-main">
          <span style="font-family:var(--font-mono);font-size:var(--text-14);color:var(--text-bright)">${escapeHtml(table.name)}</span>
          <span class="card-hint">${escapeHtml(table.module ?? '—')}</span>
        </div>
        <div class="row-trail">
          ${statusTag(table.status ?? 'defined')}
          <span class="card-hint" style="font-family:var(--font-mono)">${columnCount} col${columnCount === 1 ? '' : 's'}</span>
          ${table.migration_file ? `<span class="card-hint" style="font-family:var(--font-mono)">${escapeHtml(table.migration_file)}</span>` : ''}
          ${detail ? inlineExpandToggle({ open: false }) : ''}
        </div>
      </div>
      ${detail ? `<div class="row-detail" hidden style="background:rgb(var(--rgb-zinc-900) / 0.2);">${schemaTableDetailBody(table)}</div>` : ''}
    </div>
  `;
}

function schemaTableDetailBody(table) {
  const columns = Object.entries(table.columns ?? {}).map(([name, col]) => ({
    name,
    ...col,
  }));
  const columnsSection = columns.length
    ? dataTable(
        [
          {
            label: 'Columna',
            render: (row) => `<code>${escapeHtml(row.name)}</code>`,
          },
          { label: 'Tipo', render: (row) => escapeHtml(row.type ?? '—') },
          {
            label: 'Constraints',
            render: (row) =>
              escapeHtml((row.constraints ?? []).join(' · ') || '—'),
          },
          { label: 'Notas', render: (row) => escapeHtml(row.notes ?? '') },
        ],
        columns,
      )
    : emptyState('Sin columnas definidas');
  const indexes = table.indexes ?? [];
  const indexesSection = indexes.length
    ? dataTable(
        [
          { label: 'Nombre', render: (row) => escapeHtml(row.name ?? '—') },
          { label: 'Tipo', render: (row) => escapeHtml(row.type ?? '—') },
          {
            label: 'Columnas',
            render: (row) => escapeHtml((row.columns ?? []).join(', ')),
          },
        ],
        indexes,
      )
    : '';
  const changelog = table.changelog ?? [];
  const changelogSection = changelog.length
    ? `<p class="card-hint">Historial</p><ul>${changelog
        .map(
          (entry) =>
            `<li>${escapeHtml(`ciclo ${entry.cycle ?? '—'} · ${entry.date ?? '—'} — ${entry.change ?? ''}`)}</li>`,
        )
        .join('')}</ul>`
    : '';
  return `
    <div style="padding:var(--space-4) 4px;display:flex;flex-direction:column;gap:var(--space-3);">
      ${table.spec ? `<p class="card-hint">${escapeHtml(stripSddPrefix(table.spec))}</p>` : ''}
      ${columnsSection}
      ${indexesSection}
      ${changelogSection}
      <p class="card-hint" style="color:var(--text-ghost)">ciclo ${escapeHtml(String(table.created_in_cycle ?? '—'))}${table.updated_in_cycle ? ` → ${escapeHtml(String(table.updated_in_cycle))}` : ''} · ${escapeHtml(table._app)}</p>
    </div>
  `;
}

async function renderApi(container, params) {
  let registry;
  try {
    registry = await loadApiRegistry();
  } catch (error) {
    container.innerHTML = errorState(error);
    return;
  }
  const endpoints = collectApiEndpoints(registry);
  const header = pageHeader({
    title: 'API',
    meta: `${endpoints.length} endpoint${endpoints.length === 1 ? '' : 's'}`,
    subtitle: 'Endpoints definidos en el contrato del sistema.',
  });
  if (endpoints.length === 0) {
    container.innerHTML = `
      ${header}
      ${emptyState(
        'Sin endpoints registrados',
        'Los endpoints del API serán definidos por el agente Arquitecto en sdd/api.json a medida que avanzan los ciclos SDD.',
      )}
    `;
    return;
  }
  container.innerHTML = `
    ${header}
    <div class="row-list">${endpoints.map((endpoint) => renderApiEndpointRow(endpoint)).join('')}</div>
  `;
  attachInlineExpandHandlers(container, '[data-api-row]');
}

function collectApiEndpoints(registry) {
  return Object.entries(registry ?? {})
    .filter(([key, value]) => isRegistryAppEntry(key, value))
    .flatMap(([appKey, value]) =>
      (value?.endpoints ?? []).map((endpoint, index) => ({
        ...endpoint,
        _app: appKey,
        _key: `${appKey}::${index}`,
      })),
    );
}

function hasApiDetail(endpoint) {
  return Boolean(
    endpoint.description ||
    (endpoint.path_params ?? []).length ||
    (endpoint.required_headers ?? []).length ||
    Object.keys(endpoint.responses ?? {}).length ||
    Object.keys(endpoint.request_body ?? {}).length ||
    (endpoint.changelog ?? []).length,
  );
}

function renderApiEndpointRow(endpoint) {
  const detail = hasApiDetail(endpoint);
  return `
    <div class="row-item">
      <div class="row" data-api-row="${escapeHtml(endpoint._key)}" ${detail ? inlineRowOpenAttrs(`Ver detalle de ${endpoint.path ?? ''}`) : ''}>
        <span class="row-lead">${methodBadge(endpoint.method)}</span>
        <div class="row-main row-main--inline">
          <span class="api-path">${escapeHtml(endpoint.path ?? '')}</span>
          ${endpoint.module ? `<span class="api-module">${escapeHtml(endpoint.module)}</span>` : ''}
        </div>
        <div class="row-trail">
          ${statusTag(endpoint.status ?? 'defined')}
          ${detail ? inlineExpandToggle({ open: false }) : ''}
        </div>
      </div>
      ${detail ? `<div class="row-detail" hidden style="background:rgb(var(--rgb-zinc-900) / 0.2);">${apiEndpointDetailBody(endpoint)}</div>` : ''}
    </div>
  `;
}

function apiEndpointDetailBody(endpoint) {
  const pathParams = endpoint.path_params ?? [];
  const headers = endpoint.required_headers ?? [];
  const responses = Object.entries(endpoint.responses ?? {});
  const changelog = endpoint.changelog ?? [];
  const requestBodyKeys = Object.keys(endpoint.request_body ?? {});
  const responsesSection = responses.length
    ? dataTable(
        [
          { label: 'Código', render: (row) => escapeHtml(row.code) },
          {
            label: 'Descripción',
            render: (row) => escapeHtml(row.description),
          },
        ],
        responses.map(([code, description]) => ({
          code,
          description:
            typeof description === 'string'
              ? description
              : JSON.stringify(description),
        })),
      )
    : '';
  const changelogSection = changelog.length
    ? `<p class="card-hint">Historial</p><ul>${changelog
        .map(
          (entry) =>
            `<li>${escapeHtml(`ciclo ${entry.cycle ?? '—'} · ${entry.date ?? '—'} — ${entry.change ?? ''}`)}</li>`,
        )
        .join('')}</ul>`
    : '';
  return `
    <div style="padding:var(--space-4) 4px;display:flex;flex-direction:column;gap:var(--space-3);">
      ${endpoint.description ? `<p class="card-subtitle">${escapeHtml(endpoint.description)}</p>` : ''}
      ${pathParams.length ? `<p class="card-hint">Path params: ${pathParams.map((param) => `<code>${escapeHtml(param)}</code>`).join(' ')}</p>` : ''}
      ${headers.length ? `<p class="card-hint">Headers requeridos: ${headers.map((header) => `<code>${escapeHtml(header)}</code>`).join(' ')}</p>` : ''}
      ${requestBodyKeys.length ? `<p class="card-hint">Request body</p><pre><code>${escapeHtml(JSON.stringify(endpoint.request_body, null, 2))}</code></pre>` : ''}
      ${responsesSection ? `<p class="card-hint">Responses</p>${responsesSection}` : ''}
      ${changelogSection}
      <p class="card-hint" style="color:var(--text-ghost)">ciclo ${escapeHtml(String(endpoint.created_in_cycle ?? '—'))} · ${escapeHtml(endpoint._app)}</p>
    </div>
  `;
}

async function renderComponents(container, params) {
  let registry;
  try {
    registry = await loadComponentsRegistry();
  } catch (error) {
    container.innerHTML = errorState(error);
    return;
  }
  const components = collectComponentEntries(registry);
  const header = componentsHeader(components.length);

  if (components.length === 0) {
    container.innerHTML = `
      ${header}
      ${emptyState(
        'Sin componentes registrados',
        'Los componentes React son registrados en sdd/components.json por el agente sdd-implementor-front al finalizar cada implementación frontend.',
      )}
    `;
    return;
  }

  container.innerHTML = `
    ${header}
    <div class="row-list">${components.map((component) => renderComponentRow(component)).join('')}</div>
  `;
  attachInlineExpandHandlers(container, '[data-component-row]');
}

function collectComponentEntries(registry) {
  return Object.entries(registry ?? {})
    .filter(([key, value]) => isRegistryAppEntry(key, value))
    .flatMap(([appKey, value]) =>
      (value?.components ?? []).map((component) => ({
        ...component,
        _app: appKey,
      })),
    );
}

function componentsHeader(total) {
  return pageHeader({
    title: 'Componentes',
    meta: `${total} registrado${total === 1 ? '' : 's'}`,
    subtitle:
      'Registro de componentes React del monorepo. Actualizado por el Implementador Frontend al finalizar cada implementación.',
  });
}

function componentStatusBadge(status) {
  return badge(status ?? '—', status ? `status--${status}` : undefined);
}

function formatComponentConsumes(consumes) {
  if (!Array.isArray(consumes) || consumes.length === 0) return '—';
  return escapeHtml(consumes.join(', '));
}

function formatComponentCycle(component) {
  const created = component.created_in_cycle;
  const updated = component.updated_in_cycle;
  if (created === null || created === undefined) return '—';
  return escapeHtml(updated ? `${created} → ${updated}` : String(created));
}

function hasComponentDetail(component) {
  return Boolean(
    component.description ||
    component.module ||
    component.spec ||
    (component.consumes ?? []).length ||
    (component.changelog ?? []).length,
  );
}

function renderComponentRow(component) {
  const key = `${component._app}::${component.id ?? component.name ?? ''}`;
  const detail = hasComponentDetail(component);
  return `
    <div class="row-item">
      <div class="row" data-component-row="${escapeHtml(key)}" ${detail ? inlineRowOpenAttrs(`Ver detalle de ${component.name ?? component.id ?? ''}`) : ''}>
        <div class="row-main">
          <span style="font-family:var(--font-mono);font-size:var(--text-14);color:var(--text-bright)">${escapeHtml(component.name ?? '—')}</span>
          <span class="card-hint">${escapeHtml(component.path ?? '—')}</span>
        </div>
        <div class="row-trail">
          ${badge(component.type ?? '—')}
          ${componentStatusBadge(component.status)}
          <span class="card-hint" style="font-family:var(--font-mono)">${escapeHtml(formatComponentCycle(component))}</span>
          ${detail ? inlineExpandToggle({ open: false }) : ''}
        </div>
      </div>
      ${detail ? `<div class="row-detail" hidden style="background:rgb(var(--rgb-zinc-900) / 0.2);">${componentDetailBody(component)}</div>` : ''}
    </div>
  `;
}

function componentDetailBody(component) {
  const changelog = component.changelog ?? [];
  const changelogSection = changelog.length
    ? `<p class="card-hint">Historial</p><ul>${changelog
        .map(
          (entry) =>
            `<li>${escapeHtml(`ciclo ${entry.cycle ?? '—'} · ${entry.date ?? '—'} — ${entry.change ?? ''}`)}</li>`,
        )
        .join('')}</ul>`
    : '';
  return `
    <div style="padding:var(--space-4) 4px;display:flex;flex-direction:column;gap:var(--space-3);">
      ${component.description ? `<p class="card-subtitle">${escapeHtml(component.description)}</p>` : ''}
      <p class="card-hint">${escapeHtml(`ID: ${component.id ?? '—'} · Módulo: ${component.module ?? '—'} · Spec: ${stripSddPrefix(component.spec ?? '—')}`)}</p>
      <p class="card-hint">Consume: ${formatComponentConsumes(component.consumes)}</p>
      ${changelogSection}
      <p class="card-hint" style="color:var(--text-ghost)">${escapeHtml(component._app)}</p>
    </div>
  `;
}

function schemaRefName(ref) {
  if (typeof ref !== 'string') return '—';
  const segments = ref.split('/');
  return segments[segments.length - 1] || ref;
}

function schemaTypeLabel(prop) {
  if (!prop || typeof prop !== 'object') return '—';
  if (prop.$ref) return schemaRefName(prop.$ref);
  if (prop.enum) return 'enum';
  if (Array.isArray(prop.oneOf))
    return prop.oneOf.map(schemaTypeLabel).join(' | ');
  if (prop.type === 'array')
    return prop.items ? `${schemaTypeLabel(prop.items)}[]` : 'array';
  if (prop.type === 'object') {
    if (prop.patternProperties) {
      const firstValue = Object.values(prop.patternProperties)[0];
      return firstValue ? `map<${schemaTypeLabel(firstValue)}>` : 'map';
    }
    return 'object';
  }
  if (Array.isArray(prop.type)) return prop.type.join(' | ');
  return prop.type ?? '—';
}

function schemaFieldEnumValues(prop) {
  if (Array.isArray(prop.enum)) return prop.enum;
  if (Array.isArray(prop.oneOf))
    return prop.oneOf.flatMap((option) => option.enum ?? []);
  return [];
}

function schemaFieldPattern(prop) {
  if (prop.pattern) return prop.pattern;
  const withPattern = Array.isArray(prop.oneOf)
    ? prop.oneOf.find((option) => option.pattern)
    : undefined;
  return withPattern ? withPattern.pattern : null;
}

function schemaFieldDetailHtml(prop) {
  const parts = [];
  if (prop.description)
    parts.push(
      `<span class="fieldtable-description">${escapeHtml(prop.description)}</span>`,
    );
  const enumValues = schemaFieldEnumValues(prop);
  if (enumValues.length) {
    parts.push(
      `<span class="fieldtable-enum">${escapeHtml(enumValues.join(' · '))}</span>`,
    );
  }
  const pattern = schemaFieldPattern(prop);
  if (pattern)
    parts.push(
      `<span class="fieldtable-pattern">${escapeHtml(`pattern: ${pattern}`)}</span>`,
    );
  return parts.length ? parts.join('<br>') : '—';
}

function schemaFieldRows(entity) {
  const properties = entity.properties ?? {};
  const required = new Set(entity.required ?? []);
  return Object.entries(properties).map(([field, prop]) => ({
    field,
    prop,
    isRequired: required.has(field),
  }));
}

function fieldTableRowHtml({ field, prop, isRequired }) {
  const requiredMark = isRequired
    ? `<span class="fieldtable-required">*</span>`
    : '';
  return `
    <tr class="fieldtable-row">
      <td class="fieldtable-field" title="${escapeHtml(field)}">${escapeHtml(field)}${requiredMark}</td>
      <td class="fieldtable-type">${escapeHtml(schemaTypeLabel(prop))}</td>
      <td class="fieldtable-detail" style="white-space:normal">${schemaFieldDetailHtml(prop)}</td>
    </tr>
  `;
}

function fieldTable({ title, entity }) {
  const rows = schemaFieldRows(entity);
  const strictBadge =
    entity.additionalProperties === false
      ? badge('additionalProperties: false', 'badge--strict')
      : '';
  const body = rows.length
    ? rows.map(fieldTableRowHtml).join('')
    : `<tr><td class="fieldtable-detail" colspan="3">${escapeHtml('Sin propiedades')}</td></tr>`;
  return `
    <div class="fieldtable-block">
      <div class="fieldtable-title-row">
        <span class="card-title">${escapeHtml(title)}</span>
        ${strictBadge}
      </div>
      <div class="table-wrapper">
        <table class="data-table fieldtable">
          <thead>
            <tr class="fieldtable-head">
              <th>Campo</th>
              <th>Tipo</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  `;
}

function schemaDefinitionTables(schema) {
  const definitions = schema.definitions ?? {};
  return Object.entries(definitions)
    .map(([name, definition]) =>
      fieldTable({ title: name, entity: definition }),
    )
    .join('');
}

function schemaModalChips(entry) {
  return `
    <div class="chip-row">
      ${badge(`Valida: ${entry.target}`, 'badge--target')}
      ${badge(`Escriben: ${entry.writers}`, 'badge--writers')}
    </div>
  `;
}

function schemaModalFooter(entry) {
  return `<p class="card-hint">${escapeHtml(`* = campo requerido · "$schema" en ${entry.target} · pnpm sdd:validate lo exige en verde`)}</p>`;
}

async function renderSchemas(container, params) {
  let manifest = null;
  let manifestFailed = false;
  try {
    manifest = await loadManifest();
  } catch {
    manifestFailed = true;
  }
  const schemaList = manifest
    ? enrichSchemaManifest(manifest.schemas)
    : CATALOG.schemas;

  const results = await Promise.allSettled(
    schemaList.map((entry) => fetchJson(`schemas/${entry.file}`)),
  );
  const schemas = schemaList.map((entry, index) =>
    buildSchemaEntry(entry, results[index]),
  );
  const available = schemas.filter((entry) => entry.available).length;

  container.innerHTML = `
    ${pageHeader({
      title: 'Schemas JSON',
      meta: `${available} de ${schemas.length} disponibles`,
      subtitle:
        'Tipado estricto de los registros SDD. Cada *.json de sdd/ declara su $schema y valida contra estos archivos.',
    })}
    ${manifestFailed ? manifestFallbackHint() : ''}
    <div class="card-grid">${schemas.map((entry) => renderSchemaCard(entry)).join('')}</div>
    <div class="card">
      <p class="card-title">Source of truth</p>
      <p class="card-subtitle">sdd/schemas/</p>
      <p class="card-hint">Si la documentación en prosa y el schema difieren, gana el schema. <code>pnpm sdd:validate</code> lo exige en verde (local, Reviewer y CI).</p>
    </div>
  `;

  attachSchemaCardHandlers(container, schemas);
}

function buildSchemaEntry(entry, result) {
  if (result.status !== 'fulfilled')
    return { ...entry, available: false, schema: null, stats: null };
  return {
    ...entry,
    available: true,
    schema: result.value,
    stats: computeSchemaStats(result.value),
  };
}

function sumSchemaFieldStats(schema) {
  let propertyCount = Object.keys(schema.properties ?? {}).length;
  let requiredCount = (schema.required ?? []).length;
  for (const def of Object.values(schema.definitions ?? {})) {
    propertyCount += Object.keys(def.properties ?? {}).length;
    requiredCount += (def.required ?? []).length;
  }
  return { propertyCount, requiredCount };
}

function computeSchemaStats(schema) {
  const { propertyCount, requiredCount } = sumSchemaFieldStats(schema);
  return {
    title: schema.title ?? null,
    propertyCount,
    requiredCount,
    strict: schema.additionalProperties === false,
  };
}

function renderSchemaCard(entry) {
  const statusBadge = entry.available
    ? badge('Disponible', 'status--implemented')
    : badge('No disponible', 'status--pending');
  if (!entry.available) {
    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">${escapeHtml(entry.name)}</span>
          ${statusBadge}
        </div>
        <p class="card-subtitle">sdd/schemas/${escapeHtml(entry.file)}</p>
        <p class="empty-state-hint">No disponible</p>
      </div>
    `;
  }
  const { title, propertyCount, requiredCount, strict } = entry.stats;
  const strictSuffix = strict ? ' · estricto' : '';
  return `
    <div class="card" tabindex="0" role="button" style="cursor:pointer" data-schema-file="${escapeHtml(entry.file)}" aria-label="Ver detalle de ${escapeHtml(entry.name)}">
      <div class="card-header">
        <span class="card-title">${escapeHtml(entry.name)}</span>
        ${statusBadge}
      </div>
      <p class="card-subtitle">${escapeHtml(entry.target)}</p>
      ${title ? `<p class="card-hint">${escapeHtml(title)}</p>` : ''}
      <p class="card-hint">${escapeHtml(`${propertyCount} propiedades · ${requiredCount} requeridas${strictSuffix}`)}</p>
      <p class="card-hint">${escapeHtml(`Escriben: ${entry.writers}`)}</p>
    </div>
  `;
}

function attachSchemaCardHandlers(container, schemas) {
  for (const entry of schemas) {
    if (!entry.available) continue;
    const trigger = container.querySelector(
      `[data-schema-file="${entry.file}"]`,
    );
    if (!trigger) continue;
    const open = () => openSchemaModal(entry);
    trigger.addEventListener('click', open);
    trigger.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      open();
    });
  }
}

function openSchemaModal(entry) {
  const body = `
    <p class="card-subtitle">sdd/schemas/${escapeHtml(entry.file)}</p>
    ${schemaModalChips(entry)}
    ${fieldTable({ title: entry.schema.title ?? entry.name, entity: entry.schema })}
    ${schemaDefinitionTables(entry.schema)}
    ${schemaModalFooter(entry)}
  `;
  openModal(entry.name, body, { size: 'xl' });
}

async function renderHelp(container, params) {
  const results = await Promise.allSettled(
    CATALOG.helpDocs.map((doc) => loadMarkdown(doc.path)),
  );
  const docs = CATALOG.helpDocs.map((doc, index) =>
    buildHelpDocEntry(doc, results[index]),
  );
  container.innerHTML = renderHelpShell(docs);
  attachHelpTabHandlers(container, docs);
}

function buildHelpDocEntry(doc, result) {
  if (result.status !== 'fulfilled')
    return { ...doc, html: null, error: result.reason };
  return { ...doc, html: result.value, error: null };
}

const HELP_DOC_TONE = { 'how-to': 'emerald', readme: 'sky' };

function helpDocToneColor(id) {
  const toneMap = {
    emerald: 'rgb(var(--rgb-emerald-400))',
    sky: 'rgb(var(--rgb-sky-400))',
  };
  return toneMap[HELP_DOC_TONE[id]] ?? 'var(--text-dim)';
}

function renderHelpPill(doc, active) {
  const color = helpDocToneColor(doc.id);
  const borderColor = active ? color : 'var(--border)';
  const textColor = active ? color : 'var(--text-faint)';
  return `
    <button type="button" data-help-tab="${escapeHtml(doc.id)}" role="tab" aria-selected="${active}" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:var(--radius-lg);border-style:solid;border-width:1px;font-size:var(--text-14);font-weight:var(--weight-medium);background:transparent;cursor:pointer;transition:border-color var(--transition-fast), color var(--transition-fast);border-color:${borderColor};color:${textColor}">
      ${escapeHtml(doc.label)}
      <span style="font-family:var(--font-mono);font-size:var(--text-10);padding:2px 6px;border-radius:var(--radius-sm);background:var(--surface-2);color:inherit">${escapeHtml(doc.badge)}</span>
    </button>
  `;
}

function renderHelpDescription(doc) {
  const color = helpDocToneColor(doc.id);
  return `<div style="border:1px solid ${color};border-radius:var(--radius-xl);padding:12px 16px;font-size:var(--text-14);color:var(--text-dim)">${escapeHtml(doc.description)}</div>`;
}

function renderHelpContent(doc) {
  if (doc.error) return emptyState('No se pudo cargar el documento', doc.path);
  return `<div class="tile markdown">${doc.html}</div>`;
}

function renderHelpShell(docs) {
  const pills = docs
    .map((doc, index) => renderHelpPill(doc, index === 0))
    .join('');
  return `
    ${pageHeader({ title: 'Ayuda', subtitle: 'Documentación del sistema SDD: guía de uso y referencia completa.' })}
    <div role="tablist" aria-label="Documentación SDD" style="display:flex;gap:var(--space-2);flex-wrap:wrap">${pills}</div>
    <div data-help-description>${renderHelpDescription(docs[0])}</div>
    <div data-help-content role="tabpanel">${renderHelpContent(docs[0])}</div>
    <section class="card" style="margin-top:16px">
      <div class="card-header"><span class="card-title">Ejemplos completos</span></div>
      <p class="card-hint" style="margin:0">
        Repos SDD reales generados por la CLI, uno por modo (monorepo Nx, standalone y proyecto
        existente), regenerados desde npm en cada release:
        <a href="https://github.com/e-burgos/sdd-harness-examples" target="_blank" rel="noreferrer" style="color:var(--text-bright)">github.com/e-burgos/sdd-harness-examples</a>
      </p>
    </section>
  `;
}

function setActiveHelpTab(container, docs, activeId) {
  for (const tabEl of container.querySelectorAll('[data-help-tab]')) {
    const isActive = tabEl.dataset.helpTab === activeId;
    tabEl.setAttribute('aria-selected', String(isActive));
    const color = helpDocToneColor(tabEl.dataset.helpTab);
    tabEl.style.borderColor = isActive ? color : 'var(--border)';
    tabEl.style.color = isActive ? color : 'var(--text-faint)';
  }
  const doc = docs.find((entry) => entry.id === activeId);
  container.querySelector('[data-help-description]').innerHTML =
    renderHelpDescription(doc);
  container.querySelector('[data-help-content]').innerHTML =
    renderHelpContent(doc);
}

function attachHelpTabHandlers(container, docs) {
  for (const tabEl of container.querySelectorAll('[data-help-tab]')) {
    tabEl.addEventListener('click', () =>
      setActiveHelpTab(container, docs, tabEl.dataset.helpTab),
    );
  }
}

const COSTS_FALLBACK_PRICING = Object.freeze({
  currency: 'USD',
  traditional_hourly_rate: 50,
  model_prices_per_mtok: {
    haiku: { input: 1, output: 5 },
    sonnet: { input: 3, output: 15 },
    opus: { input: 5, output: 25 },
    fable: { input: 10, output: 50 },
  },
});

const COSTS_ASSUMED_TIER = 'sonnet';
const COSTS_UNTIERED = '_untiered';

const COSTS_SERIES = Object.freeze({
  traditional: '#8b5cf6',
  agentic: '#059669',
  tokensIn: '#0284c7',
  tokensOut: '#d97706',
});

async function loadPricing() {
  try {
    const pricing = await fetchJson('pricing.json');
    return { ...COSTS_FALLBACK_PRICING, ...pricing, missing: false };
  } catch {
    return { ...COSTS_FALLBACK_PRICING, missing: true };
  }
}

function emptyCostUsage() {
  return {
    tokensIn: 0,
    tokensOut: 0,
    durationMinutes: 0,
    byTier: {},
    hasData: false,
  };
}

function addTierTokens(usage, tier, tokensIn, tokensOut) {
  const key = tier ?? COSTS_UNTIERED;
  usage.byTier[key] ??= { tokensIn: 0, tokensOut: 0 };
  usage.byTier[key].tokensIn += tokensIn;
  usage.byTier[key].tokensOut += tokensOut;
  usage.tokensIn += tokensIn;
  usage.tokensOut += tokensOut;
  usage.hasData = true;
}

function usageFromCycleMetrics(metricsUsage) {
  const usage = emptyCostUsage();
  if (!metricsUsage) return usage;
  usage.durationMinutes = metricsUsage.duration_minutes ?? 0;
  const byTier = metricsUsage.by_tier ?? null;
  if (byTier && Object.keys(byTier).length > 0) {
    for (const [tier, tokens] of Object.entries(byTier)) {
      addTierTokens(usage, tier, tokens.tokens_in ?? 0, tokens.tokens_out ?? 0);
    }
  } else {
    addTierTokens(
      usage,
      null,
      metricsUsage.tokens_in ?? 0,
      metricsUsage.tokens_out ?? 0,
    );
  }
  return usage;
}

function usageFromTasks(tasks) {
  const usage = emptyCostUsage();
  for (const task of tasks) {
    if (!task.usage) continue;
    usage.durationMinutes += task.usage.duration_minutes ?? 0;
    addTierTokens(
      usage,
      task.usage.model_tier ?? null,
      task.usage.tokens_in ?? 0,
      task.usage.tokens_out ?? 0,
    );
  }
  return usage;
}

function agenticCostUsd(usage, pricing) {
  let cost = 0;
  let assumed = false;
  for (const [tier, tokens] of Object.entries(usage.byTier)) {
    let prices = pricing.model_prices_per_mtok[tier];
    if (!prices) {
      prices =
        pricing.model_prices_per_mtok[COSTS_ASSUMED_TIER] ??
        COSTS_FALLBACK_PRICING.model_prices_per_mtok[COSTS_ASSUMED_TIER];
      assumed = true;
    }
    cost +=
      (tokens.tokensIn / 1_000_000) * prices.input +
      (tokens.tokensOut / 1_000_000) * prices.output;
  }
  return { cost, assumed };
}

async function loadCostsData() {
  const [pricing, cycleIndex] = await Promise.all([
    loadPricing(),
    loadCycleIndex(),
  ]);

  const results = await Promise.allSettled(
    cycleIndex.map(async ({ specId, cycleId }) => {
      const cycle = await loadCycleJson(specId, cycleId);
      let tasks = [];
      try {
        const tasksJson = await fetchJson(
          `specs/${specId}/cycles/${cycleId}/tasks.json`,
        );
        tasks = tasksJson.tasks ?? [];
      } catch {}
      return { specId, cycleId, cycle, tasks };
    }),
  );

  const rows = [];
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { specId, cycleId, cycle, tasks } = result.value;
    const usage = cycle.metrics?.usage
      ? usageFromCycleMetrics(cycle.metrics.usage)
      : usageFromTasks(tasks);
    const estimationHours = tasks.reduce(
      (sum, task) => sum + (task.estimation_hours ?? 0),
      0,
    );
    const agentic = agenticCostUsd(usage, pricing);
    rows.push({
      specId,
      cycleId,
      module: cycle.module ?? specId,
      status: cycle.status ?? 'in-progress',
      tasksTotal: tasks.length,
      estimationHours,
      traditionalCost: estimationHours * pricing.traditional_hourly_rate,
      usage,
      agenticCost: agentic.cost,
      tierAssumed: agentic.assumed,
    });
  }

  rows.sort((a, b) =>
    a.specId === b.specId
      ? a.cycleId.localeCompare(b.cycleId)
      : a.specId.localeCompare(b.specId),
  );
  return { pricing, rows };
}

function costsMoneyFormatter(currency) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  });
}

const costsTokensFormat = new Intl.NumberFormat('es-AR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const costsExactFormat = new Intl.NumberFormat('es-AR');

function costsLegend(entries) {
  const chips = entries
    .map(
      ({ label, color }) => `
        <span style="display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:var(--text-11);color:var(--text-dim)">
          <span style="width:10px;height:10px;border-radius:3px;background:${color}" aria-hidden="true"></span>${escapeHtml(label)}
        </span>`,
    )
    .join('');
  return `<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px">${chips}</div>`;
}

function costBarTrack({ segments, max, tip }) {
  const parts = segments
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const pct = max > 0 ? (segment.value / max) * 100 : 0;
      return `<span style="display:block;width:${pct.toFixed(2)}%;min-width:2px;height:14px;background:${segment.color};border-radius:0 4px 4px 0"></span>`;
    })
    .join('');
  return `
    <span data-cost-tip="${escapeHtml(tip)}" style="display:flex;align-items:center;gap:2px;flex:1;min-width:0;padding:3px 0">
      ${parts || '<span style="display:block;width:2px;height:14px;background:var(--border)"></span>'}
    </span>`;
}

function costBarRow({ label, href, valueLabel, segments, max, tip }) {
  const labelHtml = href
    ? `<a href="${escapeHtml(href)}" style="color:var(--text-muted);text-decoration:none">${escapeHtml(label)}</a>`
    : escapeHtml(label);
  return `
    <div style="display:flex;align-items:center;gap:12px;min-height:22px">
      <span style="flex:0 0 clamp(148px, 20%, 240px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono);font-size:var(--text-11);color:var(--text-muted)" title="${escapeHtml(label)}">${labelHtml}</span>
      ${costBarTrack({ segments, max, tip })}
      <span style="flex:0 0 auto;font-family:var(--font-mono);font-size:var(--text-11);color:var(--text-bright)">${escapeHtml(valueLabel)}</span>
    </div>`;
}

function shortSpecLabel(specId) {
  return specId.replace(/^spec-/, '');
}

function costsComparisonCard(rows, pricing, money) {
  const bySpec = new Map();
  for (const row of rows) {
    const entry = bySpec.get(row.specId) ?? {
      traditional: 0,
      agentic: 0,
      hasUsage: false,
    };
    entry.traditional += row.traditionalCost;
    entry.agentic += row.agenticCost;
    entry.hasUsage ||= row.usage.hasData;
    bySpec.set(row.specId, entry);
  }
  const max = Math.max(
    1e-9,
    ...[...bySpec.values()].flatMap((entry) => [
      entry.traditional,
      entry.agentic,
    ]),
  );
  const blocks = [...bySpec.entries()]
    .map(([specId, entry]) => {
      const agenticLabel = entry.hasUsage ? money.format(entry.agentic) : '—';
      return `
        <div style="display:grid;gap:2px;margin-bottom:14px">
          <a href="#/cycles" style="font-family:var(--font-mono);font-size:var(--text-12);color:var(--text-strong);text-decoration:none;margin-bottom:2px">${escapeHtml(specId)}</a>
          ${costBarRow({
            label: 'Tradicional',
            valueLabel: money.format(entry.traditional),
            segments: [
              { value: entry.traditional, color: COSTS_SERIES.traditional },
            ],
            max,
            tip: `${specId} — estimación tradicional: ${money.format(entry.traditional)} (horas de tasks × tarifa ${money.format(pricing.traditional_hourly_rate)}/h)`,
          })}
          ${costBarRow({
            label: 'Agéntico',
            valueLabel: agenticLabel,
            segments: [{ value: entry.agentic, color: COSTS_SERIES.agentic }],
            max,
            tip: entry.hasUsage
              ? `${specId} — costo agéntico aproximado: ${money.format(entry.agentic)} (tokens × tarifa por tier)`
              : `${specId} — sin telemetría de tokens todavía`,
          })}
        </div>`;
    })
    .join('');
  return `
    <section class="card" style="margin-bottom:16px">
      <div class="card-header"><span class="card-title">Costo por spec — tradicional vs agéntico</span></div>
      <p class="card-subtitle">Estimación tradicional (horas × tarifa) contra el costo aproximado de tokens del modo agéntico.</p>
      ${costsLegend([
        { label: 'Tradicional', color: COSTS_SERIES.traditional },
        { label: 'Agéntico', color: COSTS_SERIES.agentic },
      ])}
      ${blocks}
    </section>`;
}

function costsTokensCard(rows) {
  const withTokens = rows.filter((row) => row.usage.hasData);
  if (withTokens.length === 0) {
    return `
      <section class="card" style="margin-bottom:16px">
        <div class="card-header"><span class="card-title">Tokens por ciclo</span></div>
        <p class="card-hint">Sin telemetría todavía. Se registra al cerrar cada ciclo: <code>cycle.json → metrics.usage</code> (lo hace el sdd-reviewer) o por task en <code>tasks.json → usage</code>.</p>
      </section>`;
  }
  const max = Math.max(
    1e-9,
    ...withTokens.map((row) => row.usage.tokensIn + row.usage.tokensOut),
  );
  const bars = withTokens
    .map((row) =>
      costBarRow({
        label: `${shortSpecLabel(row.specId)} · ${row.cycleId}`,
        href: '#/cycles',
        valueLabel: costsTokensFormat.format(
          row.usage.tokensIn + row.usage.tokensOut,
        ),
        segments: [
          { value: row.usage.tokensIn, color: COSTS_SERIES.tokensIn },
          { value: row.usage.tokensOut, color: COSTS_SERIES.tokensOut },
        ],
        max,
        tip: `${row.specId} ${row.cycleId} — entrada: ${costsExactFormat.format(row.usage.tokensIn)} tokens · salida: ${costsExactFormat.format(row.usage.tokensOut)} tokens`,
      }),
    )
    .join('');
  return `
    <section class="card" style="margin-bottom:16px">
      <div class="card-header"><span class="card-title">Tokens por ciclo</span></div>
      ${costsLegend([
        { label: 'Entrada', color: COSTS_SERIES.tokensIn },
        { label: 'Salida', color: COSTS_SERIES.tokensOut },
      ])}
      <div style="display:grid;gap:4px">${bars}</div>
    </section>`;
}

function costsTableCard(rows, money) {
  const body = rows
    .map((row) => {
      const tokens = row.usage.hasData
        ? `${costsExactFormat.format(row.usage.tokensIn)} / ${costsExactFormat.format(row.usage.tokensOut)}`
        : '—';
      const agentic = row.usage.hasData
        ? money.format(row.agenticCost) + (row.tierAssumed ? ' *' : '')
        : '—';
      const saving = row.usage.hasData
        ? money.format(row.traditionalCost - row.agenticCost)
        : '—';
      return `
        <tr>
          <td><a href="#/cycles" style="color:var(--text-bright)">${escapeHtml(row.specId)} · ${escapeHtml(row.cycleId)}</a></td>
          <td>${escapeHtml(row.module)}</td>
          <td style="text-align:right">${costsExactFormat.format(row.estimationHours)} h</td>
          <td style="text-align:right">${money.format(row.traditionalCost)}</td>
          <td style="text-align:right">${escapeHtml(tokens)}</td>
          <td style="text-align:right">${escapeHtml(agentic)}</td>
          <td style="text-align:right">${escapeHtml(saving)}</td>
        </tr>`;
    })
    .join('');
  return `
    <section class="card" style="margin-bottom:16px">
      <div class="card-header"><span class="card-title">Detalle por ciclo</span></div>
      <div class="table-wrapper"><table class="data-table">
        <thead><tr><th>Ciclo</th><th>Módulo</th><th style="text-align:right">Horas est.</th><th style="text-align:right">Costo trad.</th><th style="text-align:right">Tokens in/out</th><th style="text-align:right">Costo agéntico</th><th style="text-align:right">Ahorro</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>
    </section>`;
}

function costsMethodologyCard(pricing, anyAssumed, money) {
  const tierRows = Object.entries(pricing.model_prices_per_mtok)
    .map(
      ([tier, prices]) =>
        `<tr><td>${escapeHtml(tier)}</td><td style="text-align:right">${money.format(prices.input)}</td><td style="text-align:right">${money.format(prices.output)}</td></tr>`,
    )
    .join('');
  return `
    <section class="card">
      <div class="card-header"><span class="card-title">Metodología y tarifas</span></div>
      <p class="card-hint">
        <strong>Tradicional</strong> = Σ estimation_hours de las tasks × ${money.format(pricing.traditional_hourly_rate)}/h.
        <strong>Agéntico</strong> = tokens registrados × tarifa del tier (USD por millón de tokens).
        La telemetría la escribe el sdd-reviewer al cerrar cada ciclo (<code>metrics.usage</code>) o los implementadores por task; es aproximada por diseño.
        ${anyAssumed ? `* Tokens sin tier declarado se tarifan como <code>${COSTS_ASSUMED_TIER}</code>.` : ''}
        ${pricing.missing ? 'No hay <code>sdd/pricing.json</code> — usando tarifas por defecto del kit.' : 'Tarifas editables en <code>sdd/pricing.json</code>.'}
      </p>
      <div class="table-wrapper"><table class="data-table">
        <thead><tr><th>Tier</th><th style="text-align:right">Input /MTok</th><th style="text-align:right">Output /MTok</th></tr></thead>
        <tbody>${tierRows}</tbody>
      </table></div>
    </section>`;
}

function attachCostsTooltip(container) {
  const tooltip = document.createElement('div');
  tooltip.setAttribute('role', 'status');
  tooltip.style.cssText =
    'position:fixed;z-index:80;max-width:320px;padding:8px 10px;border-radius:var(--radius-md);border:1px solid var(--border-soft);background:var(--surface-2);color:var(--text-bright);font-family:var(--font-mono);font-size:var(--text-11);line-height:1.5;pointer-events:none;display:none';
  container.appendChild(tooltip);

  const move = (event) => {
    const x = Math.min(event.clientX + 14, window.innerWidth - 330);
    const y = Math.min(event.clientY + 14, window.innerHeight - 80);
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  };
  container.addEventListener('mouseover', (event) => {
    const target = event.target.closest('[data-cost-tip]');
    if (!target) return;
    tooltip.textContent = target.dataset.costTip;
    tooltip.style.display = 'block';
    move(event);
  });
  container.addEventListener('mousemove', (event) => {
    if (tooltip.style.display === 'block') move(event);
  });
  container.addEventListener('mouseout', (event) => {
    if (event.target.closest('[data-cost-tip]')) {
      tooltip.style.display = 'none';
    }
  });
}

async function renderCosts(container) {
  const { pricing, rows } = await loadCostsData();
  const money = costsMoneyFormatter(pricing.currency ?? 'USD');

  if (rows.length === 0) {
    container.innerHTML = `
      ${pageHeader({
        title: 'Costos',
        subtitle:
          'Tokens, tiempos y comparativa de costos del modo agéntico contra la estimación tradicional.',
      })}
      ${emptyState(
        'Sin ciclos todavía',
        'Cuando el loop SDD complete ciclos con tasks estimadas y telemetría de tokens, el tablero aparece acá.',
      )}`;
    return;
  }

  const totals = rows.reduce(
    (acc, row) => {
      acc.hours += row.estimationHours;
      acc.traditional += row.traditionalCost;
      acc.tokens += row.usage.tokensIn + row.usage.tokensOut;
      acc.agentic += row.agenticCost;
      acc.hasUsage ||= row.usage.hasData;
      acc.anyAssumed ||= row.tierAssumed;
      return acc;
    },
    {
      hours: 0,
      traditional: 0,
      tokens: 0,
      agentic: 0,
      hasUsage: false,
      anyAssumed: false,
    },
  );
  const saving = totals.traditional - totals.agentic;
  const savingPct =
    totals.traditional > 0 ? Math.round((saving / totals.traditional) * 100) : 0;

  const kpis = [
    dashboardStatCell({
      value: `${costsExactFormat.format(totals.hours)} h`,
      label: 'Horas estimadas',
      href: '#/tasks',
    }),
    dashboardStatCell({
      value: money.format(totals.traditional),
      label: 'Costo tradicional',
      href: '#/tasks',
    }),
    dashboardStatCell({
      value: totals.hasUsage ? costsTokensFormat.format(totals.tokens) : '—',
      label: 'Tokens consumidos',
      href: '#/cycles',
    }),
    dashboardStatCell({
      value: totals.hasUsage ? money.format(totals.agentic) : '—',
      label: 'Costo agéntico aprox.',
      href: '#/cycles',
    }),
    dashboardStatCell({
      value: totals.hasUsage ? money.format(saving) : '—',
      label: 'Ahorro proyectado',
      href: '#/cycles',
      accent: totals.hasUsage && saving > 0,
      sub: totals.hasUsage ? `${savingPct}% menos` : '',
    }),
  ].join('');

  container.innerHTML = `
    ${pageHeader({
      title: 'Costos',
      meta: `${rows.length} ciclos`,
      subtitle:
        'Tokens, tiempos y comparativa de costos del modo agéntico contra la estimación tradicional de las tasks.',
    })}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:20px">${kpis}</div>
    ${costsComparisonCard(rows, pricing, money)}
    ${costsTokensCard(rows)}
    ${costsTableCard(rows, money)}
    ${costsMethodologyCard(pricing, totals.anyAssumed, money)}
  `;
  attachCostsTooltip(container);
}

async function renderNotFound(container, params) {
  container.innerHTML = emptyState(
    'Vista no encontrada',
    'El hash no coincide con ninguna vista disponible.',
  );
}

const VIEWS = {
  dashboard: {
    label: 'Dashboard',
    section: 'Visión general',
    icon: 'dashboard',
    render: renderDashboard,
    loading: dashboardLoadingSkeleton,
    deps: ['global', 'specs', 'tasks', 'fixes', 'context', 'arch'],
  },
  planning: {
    label: 'Planificación',
    section: 'Visión general',
    icon: 'planning',
    render: renderPlanning,
    deps: ['global', 'specs', 'tasks'],
  },
  costs: {
    label: 'Costos',
    section: 'Visión general',
    icon: 'costs',
    render: renderCosts,
    loading: dashboardLoadingSkeleton,
    deps: ['specs', 'tasks', 'pricing'],
  },
  specs: {
    label: 'Specs', section: 'SDD', icon: 'file', render: renderSpecs,
    deps: ['specs', 'global', 'tasks'],
  },
  cycles: {
    label: 'Ciclos',
    section: 'SDD',
    icon: 'cycle',
    render: renderCycles,
    deps: ['specs', 'tasks', 'global'],
  },
  tasks: {
    label: 'Tareas', section: 'SDD', icon: 'task', render: renderTasks,
    deps: ['specs', 'tasks'],
  },
  fixes: {
    label: 'Fixes', section: 'SDD', icon: 'fix', render: renderFixes,
    deps: ['fixes', 'specs'],
  },
  context: {
    label: 'Contexto',
    section: 'SDD',
    icon: 'context',
    render: renderContext,
    deps: ['context', 'global'],
  },
  agents: {
    label: 'Agentes',
    section: 'Herramientas SDD',
    icon: 'agent',
    render: renderAgents,
    deps: ['agents', 'catalog'],
  },
  skills: {
    label: 'Skills',
    section: 'Herramientas SDD',
    icon: 'skill',
    render: renderSkills,
    deps: ['skills', 'catalog'],
  },
  prompts: {
    label: 'Prompts',
    section: 'Herramientas SDD',
    icon: 'prompt',
    render: renderPrompts,
    deps: ['prompts', 'catalog'],
  },
  schema: {
    label: 'Schema',
    section: 'Arquitectura',
    icon: 'database',
    render: renderSchema,
    deps: ['arch', 'global'],
  },
  api: {
    label: 'API',
    section: 'Arquitectura',
    icon: 'api',
    render: renderApi,
    deps: ['arch', 'global'],
  },
  components: {
    label: 'Componentes',
    section: 'Arquitectura',
    icon: 'components',
    render: renderComponents,
    deps: ['arch', 'global'],
  },
  schemas: {
    label: 'Schemas JSON',
    section: 'Arquitectura',
    icon: 'schemaFix',
    render: renderSchemas,
    deps: ['schemas', 'catalog'],
  },
  help: {
    label: 'Documentación SDD',
    section: 'Ayuda',
    icon: 'help',
    render: renderHelp,
    deps: ['meta'],
  },
};

const DEFAULT_VIEW = 'dashboard';

let mountToken = 0;
let activeViewKey = DEFAULT_VIEW;
const navPinned = new Set(['Visión general', 'SDD']);

function parseHash(hash) {
  const raw = hash.replace(/^#/, '');
  const segments = raw
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => decodeURIComponent(segment));
  const [view = DEFAULT_VIEW, ...params] = segments;
  if (!(view in VIEWS)) return { view: 'notFound', params: [] };
  return { view, params };
}

function navItemHtml(key, meta) {
  return `
    <li class="nav-item">
      <span class="nav-bar"></span>
      <a class="nav-link" href="#/${key}" data-view="${key}">
        <span class="nav-icon">${icon(meta.icon)}</span>
        ${escapeHtml(meta.label)}
      </a>
    </li>
  `;
}

function navSectionHtml(section, entries) {
  const expanded = navPinned.has(section);
  const items = entries.map(([key, meta]) => navItemHtml(key, meta)).join('');
  return `
    <div class="nav-section">
      <button
        type="button"
        class="nav-section-toggle"
        data-nav-section="${escapeHtml(section)}"
        aria-expanded="${expanded}"
      >
        <span class="nav-section-title">${escapeHtml(section)}</span>
        <svg class="nav-section-chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="4,2 8,6 4,10" />
        </svg>
      </button>
      <div class="nav-list-collapse${expanded ? ' is-expanded' : ''}" data-nav-collapse>
        <ul class="nav-list">${items}</ul>
      </div>
    </div>
  `;
}

function buildNav() {
  const container = document.getElementById('nav-sections');
  const groups = groupBy(Object.entries(VIEWS), ([, meta]) => meta.section);
  container.innerHTML = [...groups.entries()]
    .map(([section, entries]) => navSectionHtml(section, entries))
    .join('');
}

function sectionHasView(section, currentView) {
  const meta = VIEWS[currentView];
  return meta?.section === section;
}

function syncNavSections(currentView) {
  const container = document.getElementById('nav-sections');
  for (const toggle of container.querySelectorAll('[data-nav-section]')) {
    const section = toggle.dataset.navSection;
    const expanded =
      navPinned.has(section) || sectionHasView(section, currentView);
    toggle.setAttribute('aria-expanded', String(expanded));
    const collapse = toggle.nextElementSibling;
    if (!collapse) continue;
    collapse.classList.toggle('is-expanded', expanded);
    for (const link of collapse.querySelectorAll('.nav-link')) {
      link.tabIndex = expanded ? 0 : -1;
    }
  }
}

function toggleNavSection(section) {
  if (navPinned.has(section) && !sectionHasView(section, activeViewKey)) {
    navPinned.delete(section);
  } else if (navPinned.has(section)) {
    navPinned.delete(section);
  } else {
    navPinned.add(section);
  }
  syncNavSections(activeViewKey);
}

function updateActiveNavLink(view) {
  const links = document.querySelectorAll('#nav-sections .nav-link');
  for (const link of links) {
    const active = link.dataset.view === view;
    link.classList.toggle('nav-link--active', active);
    link.closest('.nav-item')?.classList.toggle('nav-item--active', active);
  }
  activeViewKey = view;
  syncNavSections(view);
}

function setViewTitle(label) {
  document.title = `${label} · SDD Docs`;
}

function openSidebar() {
  document.getElementById('nav').classList.add('sidebar--open');
  document.getElementById('sidebar-backdrop').hidden = false;
  document.getElementById('menu-button').setAttribute('aria-expanded', 'true');
}

function closeSidebar() {
  document.getElementById('nav').classList.remove('sidebar--open');
  document.getElementById('sidebar-backdrop').hidden = true;
  document.getElementById('menu-button').setAttribute('aria-expanded', 'false');
}

function isLiveHost() {
  return location.hostname === '127.0.0.1' || location.hostname === 'localhost';
}

async function paintShellChrome() {
  const brandEl = document.getElementById('brand-project');
  const liveEl = document.getElementById('live-indicator');
  if (!brandEl && !liveEl) return;
  let project = 'SDD Docs';
  let version = '—';
  try {
    const global = await loadGlobal();
    project = global.project ?? project;
    version = global.version ?? version;
  } catch {}
  if (brandEl) brandEl.textContent = project;
  if (liveEl) {
    const updatedAt = lastLoadedAt
      ? lastLoadedAt.toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : null;
    liveEl.innerHTML = liveIndicator({
      live: isLiveHost(),
      project,
      version,
      updatedAt,
    });
  }
}

async function mountView(view, params) {
  const token = ++mountToken;
  const meta = VIEWS[view];
  const label = view === 'notFound' ? 'No encontrada' : meta.label;
  setViewTitle(label);
  updateActiveNavLink(view);
  const viewport = document.getElementById('view');
  viewport.innerHTML = meta?.loading ? meta.loading() : skeletonRows(4);
  const container = document.createElement('div');
  container.className = 'view-page animate-fade-in-up';
  try {
    if (view === 'notFound') {
      await renderNotFound(container, params);
    } else {
      await meta.render(container, params);
    }
    if (token !== mountToken) return;
    viewport.replaceChildren(container);
  } catch (error) {
    if (token !== mountToken) return;
    viewport.innerHTML = errorState(error);
  }
  paintShellChrome();
}

function onRoute() {
  closeModal();
  const { view, params } = parseHash(window.location.hash);
  mountView(view, params);
  closeSidebar();
}

function scrollToMarkdownAnchor(event) {
  const link = event.target.closest('.markdown a[href^="#"]');
  if (!link) return;
  const anchor = decodeURIComponent(link.getAttribute('href').slice(1));
  if (anchor.startsWith('/')) return;
  event.preventDefault();
  const scope = link.closest('.modal-body') ?? document.getElementById('view');
  const target = scope?.querySelector(`[id="${CSS.escape(anchor)}"]`);
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const LIVE_SYNC_INTERVAL_MS = 4000;
const LIVE_SYNC_MAX_FAILURES = 3;

function captureViewUiState() {
  const view = document.getElementById('view');
  if (!view) return null;
  const expanded = [];
  for (const toggle of view.querySelectorAll('[data-toggle][aria-expanded]')) {
    expanded.push([
      toggle.dataset.toggle,
      toggle.getAttribute('aria-expanded') === 'true',
    ]);
  }
  const tabs = [];
  for (const tab of view.querySelectorAll(
    '[data-help-tab][aria-selected="true"]',
  )) {
    tabs.push(tab.dataset.helpTab);
  }
  const inputs = [];
  view.querySelectorAll('input').forEach((el, index) => {
    if (el.value) inputs.push([index, el.value]);
  });
  return {
    expanded,
    tabs,
    inputs,
    scrollTop: document.scrollingElement?.scrollTop ?? 0,
  };
}

function restoreViewUiState(state) {
  if (!state) return;
  const view = document.getElementById('view');
  if (!view) return;
  for (const [key, wasExpanded] of state.expanded) {
    const toggle = view.querySelector(`[data-toggle="${CSS.escape(key)}"]`);
    if (!toggle) continue;
    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    if (isExpanded !== wasExpanded) toggle.click();
  }
  for (const tabId of state.tabs) {
    const tab = view.querySelector(`[data-help-tab="${CSS.escape(tabId)}"]`);
    if (tab && tab.getAttribute('aria-selected') !== 'true') tab.click();
  }
  const inputEls = view.querySelectorAll('input');
  for (const [index, value] of state.inputs) {
    const el = inputEls[index];
    if (el && el.value !== value) {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  if (document.scrollingElement) {
    document.scrollingElement.scrollTop = state.scrollTop;
  }
}

function viewDependsOn(viewKey, changedAreas) {
  const deps = VIEWS[viewKey]?.deps;
  if (!deps) return true;
  return deps.some((area) => changedAreas.has(area));
}

async function liveRefreshActiveView() {
  const { view, params } = parseHash(window.location.hash);
  const uiState = captureViewUiState();
  await mountView(view, params);
  restoreViewUiState(uiState);
}

function diffStateAreas(previous, next) {
  const changed = new Set();
  for (const [area, hash] of Object.entries(next)) {
    if (previous[area] !== hash) changed.add(area);
  }
  for (const area of Object.keys(previous)) {
    if (!(area in next)) changed.add(area);
  }
  return changed;
}

function startLiveSync() {
  if (!isLiveHost()) return;
  const stateUrl = new URL('__state', window.location.href).href;
  let knownAreas = null;
  let failures = 0;
  let timer = null;

  const tick = async () => {
    if (document.visibilityState !== 'visible') return;
    if (activeModal) return;
    try {
      const response = await fetch(stateUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      const state = await response.json();
      failures = 0;
      const nextAreas = state.areas ?? { all: state.fingerprint };
      if (knownAreas === null) {
        knownAreas = nextAreas;
        return;
      }
      const changed = diffStateAreas(knownAreas, nextAreas);
      if (changed.size === 0) return;
      knownAreas = nextAreas;
      invalidateCache();
      const { view } = parseHash(window.location.hash);
      if (changed.has('all') || viewDependsOn(view, changed)) {
        await liveRefreshActiveView();
      } else if (changed.has('global') || changed.has('meta')) {
        paintShellChrome();
      }
    } catch {
      failures++;
      if (failures >= LIVE_SYNC_MAX_FAILURES && timer) {
        clearInterval(timer);
        timer = null;
      }
    }
  };

  timer = setInterval(tick, LIVE_SYNC_INTERVAL_MS);
  tick();
}

function bootstrap() {
  buildNav();
  startLiveSync();
  document.addEventListener('click', scrollToMarkdownAnchor);
  document.getElementById('menu-button').addEventListener('click', openSidebar);
  document
    .getElementById('sidebar-close')
    .addEventListener('click', closeSidebar);
  document
    .getElementById('sidebar-backdrop')
    .addEventListener('click', closeSidebar);
  document.getElementById('nav-sections').addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-nav-section]');
    if (!toggle) return;
    toggleNavSection(toggle.dataset.navSection);
  });
  window.addEventListener('hashchange', onRoute);
  paintShellChrome();
  onRoute();
}

bootstrap();
