# spec-e-burgos-010 cycle-01 — 2026-09-04

> ⚠️ Ciclo **in-progress, no aprobado**. El resolver que sigue es una función pura con tests
> verdes, pero hoy nadie lo alimenta con datos reales: su único llamador
> (`UserDataStreamService` en `apps/api`) es inerte contra la Binance de hoy — el endpoint del
> `listenKey` devuelve `410 Gone` — y se entrega detrás de un interruptor apagado.

## Estado

- `resolveUserDataStreamHealth()` nuevo en `src/lib/reactive/user-data-stream-health.ts`,
  exportado por `src/lib/reactive/index.ts`. Función pura, sin I/O, hermana de `stream-health`
  pero con su propio contrato: no comparte umbrales ni razones con la salud del market stream.
- Veredictos: `UNKNOWN`/`NO_RECORD` sin registro, `DEGRADED`/`HEARTBEAT_STALE`,
  `DEGRADED`/`KEEPALIVE_STALE` (en ese orden de prioridad cuando los dos vencieron), `HEALTHY` si
  ambos están dentro de ventana. Antigüedad **exactamente igual** al umbral todavía es sana.
- **`lastEventAtMs` no es entrada del cálculo** (RN-03: el silencio nunca es salud, pero tampoco
  es muerte). El registro lo transporta para diagnóstico; el veredicto no lo mira. Hay un test de
  tabla que lo prueba variando `lastEventAtMs` en todo su rango sin que el veredicto cambie.

## Qué sigue

- Sin llamador vivo mientras el transporte esté inerte. Si el ciclo migra al user data stream de
  la WebSocket API de Binance, el modelo de salud se puede reusar tal cual: `lastHeartbeatAtMs` y
  `lastKeepaliveAtMs` son los dos únicos insumos y ambos existen en cualquier transporte con
  ping/pong y renovación de sesión.
