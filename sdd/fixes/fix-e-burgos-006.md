# FIX-e-burgos-006 — El contenedor de produccion siembra usuarios demo con contrasenas publicas en cada arranque

> Tipo: HOTFIX | Severidad: critical | Estado: implemented | Creado: 2026-08-30 | Resuelto: 2026-08-30

## Problema

apps/api/Dockerfile:40 ejecuta prisma db seed incondicionalmente como parte del entrypoint. apps/api/prisma/seed.ts crea cuatro cuentas -- dos de ellas con rol ADMIN -- con contrasenas hardcodeadas y visibles en el repositorio publico. Combinado con railway.toml, todo despliegue queda con cuentas administradoras cuyas credenciales cualquiera puede leer del repo. La semilla debe quedar fuera del arranque de produccion, o condicionada a una variable explicita que no este activa por default.

## Archivos afectados

- `apps/api/Dockerfile`
- `apps/api/prisma/seed.ts`
- `.env.example`

## Criterio de aceptacion

El entrypoint de produccion no siembra; la semilla sigue disponible para desarrollo y para el target db-seed de Nx

## Solucion aplicada

La semilla no es solo de cuentas demo: tambien provisiona datos de referencia que la API lee en
runtime (`AgentDefinition`, `AdminAgentConfig`, `PlatformLLMProvider`, `DataSourceConfig`), y no
existe otro bootstrap para ellos. Sacar `prisma db seed` del entrypoint habria dejado un despliegue
nuevo sin agentes ni registro de fuentes de datos. Por eso el corte se hace **dentro** de `seed.ts`,
separando ambas responsabilidades:

- `seedReferenceData()` — corre siempre, no crea credenciales.
- `seedDemoAccounts()` — los cuatro usuarios demo y sus trading configs; corre solo si
  `demoAccountSeedingAllowed()` lo autoriza.

Dos cerrojos independientes, ambos seguros por defecto:

1. `NODE_ENV === 'production'` → nunca se crean cuentas demo. Es un cerrojo duro: setear
   `SEED_DEMO_ACCOUNTS=true` en produccion **no** las reactiva.
2. `SEED_DEMO_ACCOUNTS=false` → las desactiva tambien fuera de produccion. El `CMD` del Dockerfile
   la fija explicitamente, de modo que el contenedor queda protegido aunque `NODE_ENV` cambie.

`prisma migrate deploy` sigue en el entrypoint sin cambios.

Desarrollo y CI no requieren configuracion nueva: sin `NODE_ENV=production` el comportamiento del
target `db-seed` de Nx es identico al anterior, por lo que `pnpm nx serve api` y los setups E2E
(`e2e/global.setup*.ts`) siguen encontrando sus usuarios.

## Verificacion

- `pnpm exec jest --config apps/api/jest.config.js apps/api/src` → 78 suites, 673/673 en verde.
- Ejecucion real de `seed.ts` contra un cliente Prisma stub, por entorno:
  - `NODE_ENV` sin setear y `NODE_ENV=test` → 4 usuarios + 2 trading configs + datos de referencia.
  - `NODE_ENV=production` (con o sin el flag) y `SEED_DEMO_ACCOUNTS=false` → 0 usuarios,
    0 trading configs, datos de referencia intactos.

## Pendiente — bases ya desplegadas

Este fix impide **crear** cuentas demo de aca en adelante; no toca datos existentes. Todo despliegue
anterior a este cambio ya tiene las cuatro cuentas creadas, dos de ellas `ADMIN`, con contrasenas
publicadas en el repositorio. Requiere remediacion operativa sobre la base productiva (borrar o
desactivar esas cuentas y revocar sus sesiones/refresh tokens), fuera del alcance de este fix por
no haber acceso a esa base.

## Decisión del Reviewer

> Validado el 2026-09-04 en la limpieza de deuda de proceso post-cierre de ciclos (los ciclos que debían validarlo ya estaban cerrados).
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> **Evidencia.** Fix mergeado en `main` (36a89c135). Suite de `apps/api` en verde sobre ese commit: 101 suites, 930 tests.
> Referencia de test declarada al resolverlo: El entrypoint de produccion solo siembra datos de referencia (agentes, proveedores LLM, data sources); no crea ninguna cuenta demo. En desarrollo y CI (NODE_ENV != production) el target db-seed de Nx sigue creando los cu…
