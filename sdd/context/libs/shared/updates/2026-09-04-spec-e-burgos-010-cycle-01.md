# spec-e-burgos-010 cycle-01 — 2026-09-04

> ⚠️ Ciclo **in-progress, no aprobado**. El tipo que sigue existe y compila, pero su productor
> (`UserDataStreamService` en `apps/api`) es inerte contra la Binance de hoy: el endpoint del
> `listenKey` devuelve `410 Gone` y el interruptor se entrega apagado. **Ningún registro de este
> tipo se publica hoy en producción.**

## Estado

- `UserDataStreamHealthRecord` nuevo en `src/types/interfaces.ts`: `credentialKey`, `ownerId`,
  `connectedAt`, `lastHeartbeatAtMs`, `lastKeepaliveAtMs`, `lastEventAtMs`, `publishedAt`.
- La lista de campos está **congelada por typecheck**: `USER_DATA_STREAM_HEALTH_FIELDS` +
  `AssertNoKeyDrift<ExactKeys<…>>` rompen la compilación si alguien agrega un campo. Es la regla
  de seguridad de HU-06 expresada como tipo: **ningún campo derivado del `listenKey`** — ni hash,
  ni prefijo, ni longitud. La credencial se identifica siempre por `credentialKey = userId:env`.
- `trading-config-wire.ts` no cambió: el ciclo no agrega ninguna columna de configuración por bot.
  El interruptor vive en una variable de entorno de plataforma, no en el wire.

## Qué sigue

- Si el ciclo se revierte o migra a otro transporte, este tipo y su lista congelada se van con él:
  no tiene ningún otro consumidor.
