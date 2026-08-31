# FIX-e-burgos-006 — El contenedor de produccion siembra usuarios demo con contrasenas publicas en cada arranque

> Tipo: HOTFIX | Severidad: critical | Estado: pending | Creado: 2026-08-30

## Problema

apps/api/Dockerfile:40 ejecuta prisma db seed incondicionalmente como parte del entrypoint. apps/api/prisma/seed.ts crea cuatro cuentas -- dos de ellas con rol ADMIN -- con contrasenas hardcodeadas y visibles en el repositorio publico. Combinado con railway.toml, todo despliegue queda con cuentas administradoras cuyas credenciales cualquiera puede leer del repo. La semilla debe quedar fuera del arranque de produccion, o condicionada a una variable explicita que no este activa por default.

## Archivos afectados

- `apps/api/Dockerfile`
- `apps/api/prisma/seed.ts`

## Criterio de aceptacion

El entrypoint de produccion no siembra; la semilla sigue disponible para desarrollo y para el target db-seed de Nx
