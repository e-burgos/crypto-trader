# FIX-e-burgos-007 — Sin JWT_SECRET la app arranca igual con un secreto conocido escrito en el codigo

> Tipo: HOTFIX | Severidad: critical | Estado: pending | Creado: 2026-08-30

## Problema

auth.module.ts:12 y jwt.strategy.ts:17 caen a dev-secret; auth.service.ts:56,76 caen a dev-refresh-secret. No hay validacion de entorno al arrancar, asi que si la variable falta en produccion nada lo detecta y cualquiera que lea el repositorio puede forjar un token de administrador. Agravado por chat.module.ts:19, que usa process.env.JWT_SECRET sin fallback: si falta, ese modulo valida contra undefined mientras el resto firma con el valor por defecto. Hay que eliminar los fallbacks y validar el entorno al arrancar, fallando ruidoso.

## Archivos afectados

- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/strategies/jwt.strategy.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/chat/chat.module.ts`
- `apps/api/src/main.ts`

## Criterio de aceptacion

La app no arranca sin JWT_SECRET ni JWT_REFRESH_SECRET, con mensaje explicito; ningun fallback hardcodeado queda en el codigo
