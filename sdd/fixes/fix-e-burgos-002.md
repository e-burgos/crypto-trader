# FIX-e-burgos-002 — El gate de CI que el arnés declara (sdd-validate.yml) no existe

| Campo         | Valor                 |
| ------------- | --------------------- |
| **ID**        | FIX-e-burgos-002      |
| **Tipo**      | BUGFIX                |
| **Severidad** | medium                |
| **Keyword**   | [BUGFIX]              |
| **Fecha**     | 2026-08-28            |
| **Autor**     | e-burgos              |
| **Estado**    | validated             |
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

- todo **pull request contra `main`**;
- todo **push a `main`** (protege merges directos).

Sigue las convenciones de `ci.yml`: `actions/checkout@v4`, `pnpm/action-setup@v4`,
`actions/setup-node@v4` con Node 22 y `cache: pnpm`, y `concurrency` con
`cancel-in-progress`. Instala con `--frozen-lockfile --ignore-scripts`: el validador solo
necesita `ajv` y `ajv-formats`, así que saltear los postinstall (Prisma, Playwright,
Nx) evita minutos de CI por un check que no compila nada.

**Sin filtro por `paths` a propósito.** La variante con `paths: ['sdd/**']` deja el check en
*neutral* —nunca reportado— en los PRs que no tocan `sdd/**`, y un required check que no
reporta bloquea el merge para siempre esperando un status que no va a llegar. Como el job
corre en ~1 minuto y es determinista, sale más barato ejecutarlo en todos los PRs contra
`main` que mantener un job de skip espejo. Así el check reporta siempre y se puede exigir en
la protección de rama de `main`.

> Activar el required check es una acción de administración del repo, fuera del alcance de
> este fix: Settings → Branches → regla de `main` → *Require status checks to pass* →
> agregar **`Validate SDD registries`**. El workflow tiene que haber corrido al menos una vez
> para aparecer en esa lista.

### Archivos modificados

- `.github/workflows/sdd-validate.yml` — nuevo: gate de CI que corre `pnpm sdd:validate`
- `sdd/fixes.json` — registro de este fix

### Test de validación

- **Referencia:** sin test unitario — el workflow **es** la validación. Se verificó en local
  que `pnpm sdd:validate` termina con exit 0 sobre el árbol actual y con exit 1 ante un
  registro corrupto (prueba destructiva sobre copia, revertida), que es exactamente la
  condición que el job hace fallar.

### Decisión del Reviewer

> **`validated`** (2026-08-30) — fix correcto, no requiere seguimiento.
>
> Verificado: `.github/workflows/sdd-validate.yml` existe, corre `pnpm sdd:validate` (step
> "Validate SDD registries"), dispara en `push` a `main` y en todo `pull_request` contra
> `main` (superset de "todo PR que toque `sdd/**`" — sin filtro `paths` a propósito, según
> justifica el propio fix_document), y sigue las convenciones de `ci.yml`:
> `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4` con `node-version:
> 22` y `cache: pnpm`. Contenido del workflow comparado línea por línea contra lo declarado
> en la solución aplicada.

---
