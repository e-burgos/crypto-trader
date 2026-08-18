import {
  readdirSync,
  statSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SDD_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = join(SDD_ROOT, 'catalog.json');

export function buildCatalog() {
  const skillsDir = join(SDD_ROOT, 'skills');
  return {
    $schema: './schemas/catalog.schema.json',
    _description:
      'Manifest generado del contenido de sdd/ para consumo del visor (sdd/docs) en hosting estatico sin listado de directorios. Regenerar con: pnpm sdd:rebuild-catalog. NUNCA editar a mano — pnpm sdd:validate falla si esta desactualizado.',
    agents: readdirSync(join(SDD_ROOT, 'agents'))
      .filter((f) => f.endsWith('.agent.md'))
      .sort()
      .map((file) => ({ file })),
    skills: readdirSync(skillsDir)
      .filter((entry) => statSync(join(skillsDir, entry)).isDirectory())
      .sort()
      .flatMap((dir) => {
        const file = readdirSync(join(skillsDir, dir)).find(
          (entry) => entry === 'skill.md' || entry === 'SKILL.md',
        );
        return file ? [{ dir, file }] : [];
      }),
    prompts: readdirSync(join(SDD_ROOT, 'prompts'))
      .filter((f) => f.endsWith('.prompt.md'))
      .sort()
      .map((file) => ({ file })),
    schemas: readdirSync(join(SDD_ROOT, 'schemas'))
      .filter((f) => f.endsWith('.schema.json') && f !== 'catalog.schema.json')
      .sort()
      .map((file) => ({ file })),
  };
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const catalog = buildCatalog();
  const serialized = JSON.stringify(catalog, null, 2) + '\n';
  const previous = existsSync(CATALOG_PATH)
    ? readFileSync(CATALOG_PATH, 'utf8')
    : '';
  writeFileSync(CATALOG_PATH, serialized);
  console.log(
    `[rebuild-catalog] ${serialized === previous ? 'unchanged' : 'wrote'} sdd/catalog.json — ` +
      `${catalog.agents.length} agents, ${catalog.skills.length} skills, ` +
      `${catalog.prompts.length} prompts, ${catalog.schemas.length} schemas`,
  );
}
