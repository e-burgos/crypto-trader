# FIX-e-burgos-012 — CI no protege casi nada: el lint no puede fallar, los tests son parciales, no hay typecheck y el esquema que valida no es el de produccion

> Tipo: BUGFIX | Severidad: high | Estado: implemented | Creado: 2026-08-31 | Resuelto: 2026-08-31

## Problema

Este es el fix del que dependen los demas: los hallazgos de la auditoria (FIX-e-burgos-006 a 011) no llegaron a `main` porque alguien se distrajo, sino porque **no habia ningun gate que los pudiera detener**. Seis huecos verificados, todos en `.github/workflows/`:

**(a) El lint no puede fallar.** `ci.yml:78` terminaba en `|| true`. Cualquier error de ESLint se tragaba y el paso quedaba verde.

**(b) La cobertura del lint.** La auditoria reporto que `apps/api` y `apps/web` no se lintean por falta de `eslint.config.*` propio. **Es un falso positivo, medido y descartado** — ver "Que resulto no ser cierto".

**(c) Solo corrian los tests de `api`.** `ci.yml:81` era `pnpm nx test api`. Los de `web` y los de las 5 libs con `vite.config.mts` no corrian nunca. El script `test:all` existia y ningun workflow lo usaba.

**(d) No habia `typecheck` en ningun workflow**, aunque el script existia. Y el script estaba roto de dos maneras (ver "Que aparecio al encender los gates").

**(e) CI validaba un esquema que produccion nunca usa.** `ci.yml:75` y `e2e.yml:77` aplicaban el schema con `prisma db push --accept-data-loss`; produccion corre `prisma migrate deploy`. Las 37 migraciones no se ejercitaban en ningun workflow: una migracion rota pasaba verde y explotaba al desplegar.

**(f) E2E apagado por dos razones ya resueltas.** `e2e.yml:5-9` lo restringia a `workflow_dispatch` porque faltaba `/api/health` y faltaba el seed de usuarios E2E. Los dos existen hoy y estan verificados corriendo abajo.

## Archivos afectados

- `.github/workflows/ci.yml`
- `.github/workflows/e2e.yml`
- `package.json` (solo `scripts`)

## Resolucion, hueco por hueco

**(a)** Se quita el `|| true`. El paso de lint ahora falla el job.

**(b)** No se toca nada: no hace falta. `@nx/eslint/plugin` infiere el target `lint` para todo proyecto **cubierto por una config de ESLint, incluida la de la raiz** — no exige una por proyecto. Medido: `eslint .` en `apps/api` procesa 268 archivos (226 `.ts` en `src` mas configs y el seed) y en `apps/web` 250 (247 `.ts`/`.tsx` en `src`). Backend y frontend ya se lintean enteros; lo unico que faltaba era que el resultado importara, que es (a). Crear `apps/api/eslint.config.mjs` y `apps/web/eslint.config.mjs` habria agregado dos archivos que no cambian una sola linea de cobertura.

**(c)** `pnpm nx test api` pasa a `pnpm test:all` (`run-many --target=test --all --exclude=crypto-trader`): 7 proyectos, 1126 tests. Se fija `CI: true` en el `env` del job: el target `test` de los proyectos vitest es `vitest` a secas y con `testMode: "watch"` en `nx.json` — sin `CI` en el entorno queda en modo watch y el job se cuelga hasta el timeout. GitHub Actions ya define `CI=true`, pero dejarlo explicito hace que el comando sea reproducible localmente tal cual y que la garantia no dependa del runner.

**(d)** Se agrega un paso `pnpm typecheck`, y se arregla el script, que tenia dos agujeros propios:

- **Recursion infinita.** `run-many --target=typecheck --all` incluia al proyecto raiz `crypto-trader`, cuyo target `typecheck` (inferido del script de `package.json`) vuelve a invocar `pnpm typecheck`. Medido: 34 procesos `tsc` concurrentes y el comando sin terminar a los 10 minutos. `test:all` y `lint:all` ya llevaban `--exclude=crypto-trader`; `typecheck` era el unico que no.
- **No miraba el backend.** `apps/api` no tiene target `typecheck` (no usa el plugin de vite), asi que `run-many --target=typecheck` lo saltea en silencio: el gate de tipos cubria 0% del backend. Se agrega `typecheck:api` (`tsc --noEmit -p apps/api/tsconfig.app.json`) y `typecheck` lo encadena.

**(e)** `prisma db push --accept-data-loss` pasa a `prisma migrate deploy` en los dos workflows, y la imagen de postgres pasa de `postgres:16-alpine` a `pgvector/pgvector:pg16`.

El cambio de imagen no es cosmetico: `20260413130000_add_agent_definitions_rag` hace `CREATE EXTENSION IF NOT EXISTS vector` y `postgres:16-alpine` no trae pgvector, asi que `migrate deploy` sobre la imagen vieja muere con `P3018 / 0A000: extension "vector" is not available`. Con `db push` eso nunca se notaba porque `schema.prisma` no declara ni la extension ni la columna `embedding_vec`: **el esquema que CI validaba no solo era distinto del de produccion, le faltaba una tabla vectorial entera.** Es exactamente el hueco (e) hecho carne.

**(f)** Se habilita en `push` a `main` y en `pull_request` a `main`, y se cierra lo que quedaba realmente roto:

- Faltaba `prisma generate`. `apps/api/generated/prisma` esta en `.gitignore` y no esta trackeado (`git ls-files apps/api/generated` → 0), asi que en un checkout limpio el build de la API no compilaba. El workflow nunca habia corrido en verde, con o sin health endpoint.
- Faltaba el paso de seed. Se agrega `prisma db seed`.
- **Las credenciales por defecto no existian en la base.** `e2e.yml` inyectaba `E2E_USER_EMAIL=e2e@test.com` / `Password123!` cuando no hay secrets; el seed no crea ese usuario. Medido contra la API real: `e2e@test.com` → **HTTP 401**, `trader@cryptotrader.dev` → 200. El default pasa a `trader@cryptotrader.dev` / `trader123`, que es el mismo fallback que ya tenia `e2e/global.setup.ts` en el codigo.

## Que resulto no ser cierto

El hueco (b) tal como estaba descripto en la auditoria. La premisa —"el plugin de Nx infiere el target `lint` por presencia de config **en el proyecto**"— es falsa: la config de la raiz alcanza. `nx show project api --json` devuelve un target `lint` = `eslint .` con `cwd: apps/api`, y la corrida procesa los 268 archivos. Se dejo constancia en vez de crear las dos configs vacias, porque un archivo que no cambia la cobertura solo agrega la ilusion de que se arreglo algo.

## Que aparecio al encender los gates

Ningun error se silencio. El inventario completo de lo que los gates nuevos encuentran:

| Gate | Proyecto | Errores | Que son |
| --- | --- | --- | --- |
| lint | los 11 | **0** | ~850 warnings, ninguno bloquea |
| typecheck | ui | 1 | `libs/ui/tsconfig.lib.json` TS5107 (`esModuleInterop=false` deprecado en TS 6) |
| typecheck | web | 3 | `apps/web/src/pages/docs/agent-config.tsx` — tipado del `t()` de i18next |
| typecheck | api | 1 | `apps/api/src/common/swagger/swagger.setup.ts:40` — `spec` no existe en `NestJSReferenceConfiguration` |

Los warnings de lint **no se convierten en errores en este fix**: subir `max-warnings` es una decision de deuda tecnica propia, no parte de encender el gate. Distribucion medida sobre los 781 archivos que ve ESLint: 704 `no-explicit-any`, 95 `no-unused-vars`, 62 `no-non-null-assertion`, 19 directivas `eslint-disable` inutiles.

El lint arranco con **un** error real, en `libs/ui/src/lib/docs/docs-toc.tsx:59` — un `// eslint-disable-next-line react-hooks/exhaustive-deps` para una regla que no esta registrada (`eslint-plugin-react-hooks` no esta instalado), que `|| true` venia tapando. Esa linea desaparecio del working tree mientras se trabajaba este fix, por el otro agente que esta en `apps/`; no se toco desde aca. Si reaparece, el gate de lint la bloquea, que es lo que corresponde.

Los 5 errores de typecheck son de archivos fuera del alcance de este fix (`libs/ui`, `apps/web/src`, `apps/api/src`) y **son la condicion para que el job quede verde**. Van como fix aparte, no aca: cada uno es un cambio de 1-3 lineas en codigo de producto, no en infraestructura de CI, y mezclarlos haria que este fix toque 6 archivos y cruce el limite del FIX GATE.

## Verificacion

No se puede correr GitHub Actions desde el entorno de trabajo, asi que **cada comando del workflow se corrio localmente tal cual quedo escrito**, contra un PostgreSQL 16 real con pgvector instalado y un Redis real.

- `prisma generate` → EXIT 0.
- `prisma migrate deploy` sobre una base vacia → **las 37 migraciones aplican**, EXIT 0. Sobre `postgres:16-alpine` (sin pgvector) la misma corrida muere en la migracion 11 con `P3018`, que es la prueba de que el cambio de imagen es obligatorio y no opcional.
- `prisma migrate status` → "Database schema is up to date!".
- `prisma db seed` sobre la base migrada → EXIT 0, crea los 4 usuarios que usan los setups de `e2e/`.
- API arrancada contra esa base: `GET /api/health` → **HTTP 200 `{"status":"ok"}`**.
- `POST /api/auth/login` → `trader@cryptotrader.dev` 200, `admin@crypto.com` 200, `trader@crypto.com` 200, `e2e@test.com` **401** (el default viejo de `e2e.yml`).
- `pnpm nx run-many --target=lint --all --parallel=3` → EXIT 0, 11 proyectos, 0 errores.
- `pnpm test:all` con `CI=true` → EXIT 0, 7 proyectos, 1126 tests, sin colgarse en watch.
- `pnpm typecheck` → termina (antes recursaba) y reporta los 5 errores de la tabla, que es el comportamiento correcto del gate.

## Pendiente para la migracion a Hetzner + Cloudflare

Anotado y **no arreglado a proposito**: arreglar el despliegue actual (Railway + GitHub Pages) es trabajo que se tira.

- `VITE_API_URL` es inconsistente entre entornos: `ci.yml` (job `build`) lo toma de `vars.VITE_API_URL` con fallback `http://localhost:3000`, y `e2e.yml` lo fija a `http://localhost:3000`. El artifact `web-dist` que sube el job `build` queda por lo tanto compilado contra `localhost` salvo que la variable de repo este puesta. Definir de una sola vez en la migracion de donde sale la URL de la API por entorno.
- `deploy-web.yml` no se toco.
- `e2e.yml` sigue usando `pnpm dlx serve` y `npx wait-on`, que resuelven paquetes de la red en cada corrida. Al mover la infra conviene fijarlos como devDependencies.

## Fuera de alcance, para registrar

- **Drift entre migraciones y `schema.prisma`.** Con la base ya migrada, `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma` reporta que `bot_actions` tiene dos indices con nombre distinto al que genera el schema (`idx_bot_actions_config_occurred` vs `bot_actions_configId_occurredAt_idx`). Es cosmetico hoy, pero mientras exista drift la afirmacion "CI valida el esquema de produccion" no es del todo cierta. Un paso de drift-check es el cierre natural de (e), en otro fix.
- **El lint por proyecto no cubre el repo entero.** `run-many --target=lint --all` corre `eslint .` dentro de cada proyecto, asi que los directorios que no pertenecen a ninguno quedan afuera. `eslint .` desde la raiz ve 781 archivos y encuentra 7 errores que el gate no mira: `@typescript-eslint/no-empty-function` en `e2e/page-objects/chat-page.ts:56` y seis `no-empty` en `sdd/docs/` (`app.js`, un bundle del visor que deberia estar en `ignores`). El caso que importa es `e2e/`: son 24 specs de Playwright, codigo de test real, sin ningun lint encima. Cerrarlo pide decidir antes que hacer con `sdd/docs/`, y eso es otro fix.
- `nx.json` tiene `"analytics": true`: cada corrida de Nx intenta llegar a `www.google-analytics.com`. En un runner con egress restringido son reintentos y latencia por tarea.

## Decisión del Reviewer

> Validado el 2026-09-04 en la limpieza de deuda de proceso post-cierre de ciclos (los ciclos que debían validarlo ya estaban cerrados).
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> **Evidencia.** Fix mergeado en `main` (36a89c135). Suite de `apps/api` en verde sobre ese commit: 101 suites, 930 tests.
> Referencia de test declarada al resolverlo: GitHub Actions no se puede ejecutar desde el entorno de trabajo, asi que cada comando del workflow se verifico localmente tal cual quedo escrito contra un PostgreSQL 16 con pgvector y un Redis reales: prisma migrate depl…
