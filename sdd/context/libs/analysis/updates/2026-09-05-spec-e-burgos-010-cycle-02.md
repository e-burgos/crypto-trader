# spec-e-burgos-010 cycle-02 — 2026-09-05

## Estado

- El resolutor puro de salud del user data stream sigue siendo el mismo modelo, con la señal
  renombrada: la razón `KEEPALIVE_STALE` pasó a `SESSION_AUTH_STALE` y el umbral que la gobierna es
  `sessionAuthMaxAgeMs`. resuelve: la mención al keepalive del `listenKey` en el contexto base.
- RN-03 ("el silencio nunca es salud") quedó protegida por tests que barren `lastEventAtMs` en todo
  su rango sin que el veredicto cambie, y que sí lo cambian moviendo `lastHeartbeatAtMs` o
  `lastSessionAuthAtMs` más allá de su umbral.

## Estructura

- `src/lib/reactive/user-data-stream-health.ts` — `resolveUserDataStreamHealth({ now, record,
  thresholds })` devuelve `HEALTHY` / `DEGRADED(HEARTBEAT_STALE | SESSION_AUTH_STALE)` /
  `UNKNOWN(NO_RECORD)`, con `HEARTBEAT_STALE` prioritario cuando ambas señales están vencidas y la
  edad exactamente igual al umbral tratada como sana. Sigue siendo puro: sin Prisma, sin red.

## Dependencias

- Ninguna nueva.

## Qué sigue

- Nada pendiente propio de la lib en este ciclo.
