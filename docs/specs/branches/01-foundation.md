# Spec 01 — Foundation (Monorepo, Shared, DB)

## Objetivo

Dejar la base del monorepo lista para desarrollo colaborativo y modular.

## Alcance

- Monorepo Nx inicializado (React, NestJS, libs)
- Shared lib: enums, tipos, DTOs, constantes, utils
- Prisma 7: schema completo, config, seed, driver adapter
- Build verde para todos los proyectos

## Criterios de aceptación

- `pnpm nx run-many --target=build --all` pasa sin errores
- Prisma Client generado y usable
- Seed crea admin y trader de prueba
- Todo versionado en branch `feature/foundation` (o `feature/initial-implementation` si ya existe)

---

**Dependencias:** Ninguna
**Siguiente:** 02-auth-users, 03-data-layer, 04-analysis-engine, 06-frontend-foundation (pueden avanzar en paralelo)
