# FIX-e-burgos-001 — rebuild-catalog no reconoce las skills nombradas SKILL.md

| Campo         | Valor                               |
| ------------- | ----------------------------------- |
| **ID**        | FIX-e-burgos-001                    |
| **Tipo**      | BUGFIX                              |
| **Severidad** | high                                |
| **Keyword**   | [BUGFIX]                            |
| **Fecha**     | 2026-08-17                          |
| **Autor**     | e-burgos                            |
| **Estado**    | implemented                         |
| **Spec**      | N/A (repo-level)                    |

## Problema

`pnpm sdd:validate` falla con `catalog.json: skills is stale vs sdd/ filesystem`, en un árbol
de trabajo limpio y sin relación con ningún ciclo (verificado con `git stash -u`).

En este repo las skills están versionadas como `sdd/skills/<dir>/SKILL.md` (mayúsculas), porque
`.claude/skills` es un symlink a `sdd/skills` y el descubrimiento de skills de Claude Code exige
ese nombre en un filesystem case-sensitive. `sdd/scripts/rebuild-catalog.mjs:28` solo detecta
`skill.md` en minúsculas, así que `buildCatalog()` devuelve `skills: []` mientras
`sdd/catalog.json` conserva las 18 entradas antiguas → el chequeo de frescura del validador
falla siempre.

Doble consecuencia:

1. `pnpm sdd:validate` queda en rojo de forma permanente, y con él el gate de CI
   (`.github/workflows/sdd-validate.yml`) de todo PR que toque `sdd/**`.
2. Correr `pnpm sdd:rebuild-catalog` "arregla" el validador vaciando la sección `skills`, con lo
   que el visor SDD deja de listar todas las skills. Además, las entradas actuales apuntan a
   `skill.md`, archivo que no existe: el visor sirve 404 para cada skill.

## Justificación del bypass

Bloquea el arranque del cycle-01 de `spec-e-burgos-001-agents-simplification`: el orquestador no
puede dejar `pnpm sdd:validate` en verde, que es requisito de registro del ciclo, y ningún commit
del ciclo sería válido. Es un defecto de tooling del arnés, ajeno al alcance de la spec, y no
justifica un ciclo SDD propio: dos archivos, sin contratos de API ni entidades nuevas.

## Solución aplicada

Hacer que el kit tolere ambos nombres en vez de forzar el rename inverso (renombrar a `skill.md`
rompería el descubrimiento de skills de Claude Code vía el symlink `.claude/skills`):

- `sdd/scripts/rebuild-catalog.mjs` — detectar `SKILL.md` o `skill.md` en cada directorio de
  skill y registrar en el catálogo el nombre real del archivo, para que el visor lo pueda
  resolver.
- `sdd/schemas/catalog.schema.json` — relajar `skills[].file` de `const: "skill.md"` a
  `enum: ["skill.md", "SKILL.md"]`.
- `sdd/catalog.json` — regenerado con `pnpm sdd:rebuild-catalog` (archivo generado, nunca
  editado a mano).

### Archivos modificados

- `sdd/scripts/rebuild-catalog.mjs` — detección case-insensitive del archivo de skill
- `sdd/schemas/catalog.schema.json` — `skills[].file` acepta `skill.md` y `SKILL.md`
- `sdd/catalog.json` — regenerado (18 skills con `file: "SKILL.md"`)

### Test de validación

- **Referencia:** `pnpm sdd:validate` en verde con `sdd/catalog.json` regenerado — el propio
  validador compara `catalog.json` contra el filesystem (`sdd/scripts/validate-sdd.mjs:359-374`),
  así que es la verificación directa del defecto. El repo no tiene suite unitaria para los
  scripts de `sdd/`.

### Decisión del Reviewer

> [A completar por sdd-reviewer al cerrar el ciclo]
>
> - [ ] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX

---
