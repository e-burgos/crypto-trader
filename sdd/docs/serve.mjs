import { createServer } from 'node:http';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const DEFAULT_PORT = 4310;
const HOST = '127.0.0.1';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

function parseCliArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port' && argv[i + 1] !== undefined) {
      parsed.port = argv[i + 1];
      i++;
    } else if (argv[i] === '--root' && argv[i + 1] !== undefined) {
      parsed.root = argv[i + 1];
      i++;
    }
  }
  return parsed;
}

function resolveRoot(cliArgs) {
  if (cliArgs.root) return path.resolve(process.cwd(), cliArgs.root);
  return path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
}

function resolvePort(cliArgs) {
  return Number(cliArgs.port ?? process.env.SDD_DOCS_PORT ?? DEFAULT_PORT);
}

function isWithinRoot(root, target) {
  return target === root || target.startsWith(root + path.sep);
}

function splitUrl(rawUrl) {
  const withoutHash = rawUrl.split('#')[0];
  const queryIndex = withoutHash.indexOf('?');
  if (queryIndex === -1) return { rawPath: withoutHash, rawQuery: '' };
  return {
    rawPath: withoutHash.slice(0, queryIndex),
    rawQuery: withoutHash.slice(queryIndex),
  };
}

function respond(req, res, status, headers, body) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  if (req.method === 'HEAD' || body === undefined) {
    res.end();
  } else {
    res.end(body);
  }
}

function sendPlainText(req, res, status, message, extraHeaders = {}) {
  const buffer = Buffer.from(message, 'utf-8');
  respond(
    req,
    res,
    status,
    {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': buffer.length,
      ...extraHeaders,
    },
    buffer,
  );
}

function send400(req, res) {
  sendPlainText(req, res, 400, 'Bad Request');
}

function send403(req, res) {
  sendPlainText(req, res, 403, 'Forbidden');
}

function send404(req, res) {
  sendPlainText(req, res, 404, 'Not Found');
}

function send405(req, res) {
  sendPlainText(req, res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
}

function send500(req, res) {
  sendPlainText(req, res, 500, 'Internal Server Error');
}

async function serveFile(req, res, filePath, ext) {
  let data;
  try {
    data = await readFile(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') return send404(req, res);
    return send500(req, res);
  }
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
  respond(
    req,
    res,
    200,
    { 'Content-Type': contentType, 'Content-Length': data.length },
    data,
  );
}

async function handleDirectory(
  req,
  res,
  root,
  decodedPath,
  rawPath,
  rawQuery,
  realTarget,
) {
  if (!decodedPath.endsWith('/')) {
    respond(req, res, 301, { Location: rawPath + '/' + rawQuery }, undefined);
    return;
  }
  const indexTarget = path.join(realTarget, 'index.html');
  let indexReal;
  try {
    indexReal = await realpath(indexTarget);
  } catch (err) {
    if (err.code === 'ENOENT') return send404(req, res);
    return send500(req, res);
  }
  if (!isWithinRoot(root, indexReal)) return send403(req, res);
  let indexStats;
  try {
    indexStats = await stat(indexReal);
  } catch {
    return send500(req, res);
  }
  if (!indexStats.isFile()) return send404(req, res);
  await serveFile(req, res, indexReal, '.html');
}

const STATE_SKIP_DIRS = new Set(['docs', 'templates', 'node_modules', '.git']);

const STATE_AREA_FILES = {
  'global.json': 'global',
  'tasks.json': 'tasks',
  'fixes.json': 'fixes',
  'api.json': 'arch',
  'schema.json': 'arch',
  'components.json': 'arch',
  'pricing.json': 'pricing',
  'catalog.json': 'catalog',
};

const STATE_AREA_DIRS = {
  specs: 'specs',
  fixes: 'fixes',
  context: 'context',
  memory: 'memory',
  agents: 'agents',
  skills: 'skills',
  prompts: 'prompts',
  schemas: 'schemas',
};

function stateAreaOf(rel) {
  if (rel in STATE_AREA_FILES) return STATE_AREA_FILES[rel];
  const topDir = rel.split('/', 1)[0];
  return STATE_AREA_DIRS[topDir] ?? 'meta';
}

async function collectRegistryStamps(dir, relBase, stamps) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (relBase === '' && STATE_SKIP_DIRS.has(entry.name)) continue;
      await collectRegistryStamps(path.join(dir, entry.name), rel, stamps);
    } else if (entry.isFile()) {
      try {
        const info = await stat(path.join(dir, entry.name));
        stamps.push(`${rel}:${info.mtimeMs}:${info.size}`);
      } catch {}
    }
  }
}

function sha1(text) {
  return createHash('sha1').update(text).digest('hex');
}

async function serveStateFingerprint(req, res, root) {
  const stamps = [];
  await collectRegistryStamps(path.join(root, 'sdd'), '', stamps);
  stamps.sort();

  const areaStamps = {};
  for (const stampLine of stamps) {
    const area = stateAreaOf(stampLine.slice(0, stampLine.indexOf(':')));
    (areaStamps[area] ??= []).push(stampLine);
  }
  const areas = Object.fromEntries(
    Object.entries(areaStamps).map(([area, lines]) => [
      area,
      sha1(lines.join('\n')),
    ]),
  );

  const body = JSON.stringify({
    fingerprint: sha1(stamps.join('\n')),
    areas,
    files: stamps.length,
  });
  return respond(
    req,
    res,
    200,
    {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(body),
    },
    body,
  );
}

async function handleRequest(req, res, root) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send405(req, res);
  }

  const { rawPath, rawQuery } = splitUrl(req.url ?? '/');

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return send400(req, res);
  }

  if (decodedPath.includes('\0') || decodedPath.split('/').includes('..')) {
    return send403(req, res);
  }

  const segments = decodedPath.split('/').filter(Boolean);
  if (segments.some((segment) => segment.startsWith('.'))) {
    return send403(req, res);
  }
  if (segments.length === 0) {
    return respond(
      req,
      res,
      301,
      { Location: '/sdd/docs/' + rawQuery },
      undefined,
    );
  }
  if (segments[0] !== 'sdd') {
    return send403(req, res);
  }

  if (decodedPath === '/sdd/docs/__state') {
    return serveStateFingerprint(req, res, root);
  }

  const target = path.resolve(root, '.' + decodedPath);
  if (!isWithinRoot(root, target)) return send403(req, res);

  let realTarget;
  try {
    realTarget = await realpath(target);
  } catch (err) {
    if (err.code === 'ENOENT') return send404(req, res);
    return send500(req, res);
  }
  if (!isWithinRoot(root, realTarget)) return send403(req, res);

  let stats;
  try {
    stats = await stat(realTarget);
  } catch {
    return send500(req, res);
  }

  if (stats.isDirectory()) {
    return handleDirectory(
      req,
      res,
      root,
      decodedPath,
      rawPath,
      rawQuery,
      realTarget,
    );
  }

  if (!stats.isFile()) return send404(req, res);

  const ext = path.extname(decodedPath).toLowerCase();
  return serveFile(req, res, realTarget, ext);
}

function main() {
  const cliArgs = parseCliArgs(process.argv.slice(2));
  const root = resolveRoot(cliArgs);
  const port = resolvePort(cliArgs);

  const server = createServer((req, res) => {
    handleRequest(req, res, root).catch(() => send500(req, res));
  });

  server.listen(port, HOST, () => {
    process.stdout.write(`http://127.0.0.1:${port}/sdd/docs/\n`);
  });
}

main();
