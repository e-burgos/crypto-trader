# FIX-e-burgos-002 — El gate de CI que el arnés declara (sdd-validate.yml) no existe

| Campo         | Valor                 |
| ------------- | --------------------- |
| **ID**        | FIX-e-burgos-002      |
| **Tipo**      | BUGFIX                |
| **Severidad** | medium                |
| **Keyword**   | [BUGFIX]              |
| **Fecha**     | 2026-08-28            |
| **Autor**     | e-burgos              |
| **Estado**    | implemented           |
| **Spec**      | N/A (repo-level)      |

## Problema

El dual-harness (`CLAUDE.md` / `AGENTS.md` / `GEMINI.md`, sección ⛔ TIPADO ESTRICTO DE
REGISTROS SDD) afirma:

> Un commit que deje `pnpm sdd:validate` en rojo es un commit inválido — el mismo check
> corre en CI (`.github/workflows/sdd-validate.yml`, gate de todo PR que toque `sdd/**`).

Ese workflow nunca existió en el repositorio. Los únicos workflows son `ci.yml`,
`deploy-web.yml` y `e2e.yml`, y ninguno invoca `pnpm sdd:validate`. El kit tampoco lo
shippea: `sdd/documentation/{es,en}/INSTALL.md` lo lista como paso opcional a copiar del
repo origen.

Consecuencia: un commit que deje los registros SDD en rojo —schema inválido, `catalog.json`
stale, índice de tasks desincronizado— se mergea sin que nada lo frene, mientras agentes y
devs asumen lo contrario porque el arnés lo declara como invariante. La regla existía solo
como texto.

## Justificación del bypass

Defecto de tooling del arnés, ajeno al alcance de cualquier spec de producto: no toca
contrato de API, ni módulos de dominio, ni `schema.json`, y se resuelve con un solo archivo
nuevo. Mismo precedente que FIX-e-burgos-001.

No puede esperar un ciclo SDD porque es el gate que protege la integridad de los registros
de todos los ciclos siguientes: cada día sin él es otra ventana para mergear `sdd/` en rojo,
y el arnés ya promete que esa ventana está cerrada.

## Solución aplicada

Nuevo workflow `.github/workflows/sdd-validate.yml` que corre `pnpm sdd:validate` en:

- todo **pull request** que toque `sdd/**`, el `package.json` raíz o el propio workflow;
- todo **push a `main`** con esos mismos paths (protege merges directos).

Sigue las convenciones de `ci.yml`: `actions/checkout@v4`, `pnpm/action-setup@v4`,
`actions/setup-node@v4` con Node 22 y `cache: pnpm`, y `concurrency` con
`cancel-in-progress`. Instala con `--frozen-lockfile --ignore-scripts`: el validador solo
necesita `ajv` y `ajv-formats`, así que saltear los postinstall (Prisma, Playwright,
Nx) evita minutos de CI por un check que no compila nada.

El filtro por `paths` deja el workflow en *neutral* para PRs que no tocan `sdd/**`; si se lo
quiere como required check en la protección de rama, hay que usar la variante sin `paths`
o un job de skip explícito.

### Archivos modificados

- `.github/workflows/sdd-validate.yml` — nuevo: gate de CI que corre `pnpm sdd:validate`
- `sdd/fixes.json` — registro de este fix

### Test de validación

- **Referencia:** sin test unitario — el workflow **es** la validación. Se verificó en local
  que `pnpm sdd:validate` termina con exit 0 sobre el árbol actual y con exit 1 ante un
  registro corrupto (prueba destructiva sobre copia, revertida), que es exactamente la
  condición que el job hace fallar.

### Decisión del Reviewer

> [A completar por sdd-reviewer al cerrar el próximo ciclo]
>
> - [ ] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX

---
