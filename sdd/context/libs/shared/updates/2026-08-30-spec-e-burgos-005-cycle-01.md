# spec-e-burgos-005 cycle-01 — 2026-08-30

## Estructura

- `src/types/interfaces.ts` suma el vocabulario del riel de mercado en vivo, bajo el bloque
  `── Reactive Market Stream ──`: `MarketTick`, `MarketCandleTick`, `StreamHealthState`
  (`'HEALTHY' | 'DEGRADED' | 'UNKNOWN'`) y `StreamHealthRecord`.
- Es vocabulario **compartido a propósito**: lo emite `apps/api` (`MarketStreamService`,
  `StreamHealthService`), lo consume `libs/analysis` (`resolveStreamHealth`,
  `detectMaterialEvent`) y lo devuelve `EP-015 GET /trading/stream-health` al front. Ningún
  tipo de estos vive duplicado en otro proyecto.
- `StreamHealthRecord` es la forma **serializada a Redis** (`rx:v1:health:{symbol}`, con TTL):
  todos sus campos son primitivos y los instantes van en epoch ms (`connectedAt`,
  `lastTickAtMs`, `lastHeartbeatAtMs`, `publishedAt`), nunca `Date`. Agregarle un campo no
  serializable rompería el `setJson`/`getJson` del puerto de coordinación.
- `UNKNOWN` no es un estado residual: significa "no hay registro" y el sistema lo trata igual
  que `DEGRADED` (fail-closed). Cualquier lector nuevo debe cubrir los tres valores.

## Qué sigue

- La UI todavía no consume `StreamHealthState` — el estado del stream es observable por
  `EP-015` y por el evento WS `market:stream-health`, sin pantalla que lo muestre.
