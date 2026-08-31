# Constitución — libs/shared

> Versión 1.3 | Última actualización: cycle-01 | Fecha: 2026-08-30
> Fragmentos consolidados: spec-e-burgos-001 cycle-03 (2026-08-18) + spec-e-burgos-004 cycle-01 (2026-08-19) + spec-e-burgos-005 cycle-01 (2026-08-30)

## 1. Propósito

- **Tipo:** lib
- **Rol en el sistema:** Types, DTOs, constantes y utilidades compartidas entre backend y frontend.

## 2. Stack tecnológico

- TypeScript puro, sin dependencias de framework.

## 3. Estructura y patrones

- Sin dependencias internas — es la base del grafo; todas las demás libs/apps pueden importarla.
- **Vocabulario común de órdenes de exchange** en `src/types/interfaces.ts`: `ExchangeOrderState` (`'ACTIVE' | 'FILLED' | 'CANCELLED' | 'MISSING'`) y `ExchangeOrderStatus` (`state`, `filledLeg: 'STOP' | 'TAKE_PROFIT' | null`, `executedPrice`, `executedQuantity`, `orderId`). Viven acá y no en `libs/data-fetcher` —donde está el cliente de Binance— porque `libs/trading-engine` los necesita para su `OrderExecutorPort` y no existe (ni debe existir) una dependencia de `trading-engine` sobre `data-fetcher`. **Cualquier tipo que necesiten esas dos libs va acá por la misma razón.**
- `TradeRecord` incluye `decisionId?: string | null` — trazabilidad de la operación ejecutada hacia la `AgentDecision` que la justificó. Opcional y nullable: los caminos sin decisión asociada (cierre manual, cierre ejecutado por el exchange) persisten `null` sin fallar.
- `src/types/agent-wire.ts` — **única** fuente del contrato del wire de agentes: `AGENT_SLOT_WIRE_IDS`/`AgentSlotWireId`, `ResolutionSource` (`override | user | admin | preset | credential`), `ResolvedAgentModelWire`, `AgentHealthItemWire`, `AgentHealthReportWire`. Existe porque un consumidor (`apps/web`) declaraba su propia interfaz del response y el typecheck no detectó un renombre del backend hasta romper producción. Cualquier cambio del wire de agentes se hace **acá primero**; declarar la forma del response en el consumidor es el anti-patrón que este archivo previene. El wire de **admin** (`/admin/agent-configs`) sigue con vocabulario `agentId` propio, sin cubrir todavía.
- `src/utils/fingerprint.ts` — función pura `fingerprint()` (content-addressed, estable ante reordenamiento), usada para las huellas de posiciones/noticias/macro que consume el gate determinista de `libs/analysis`.
- `src/types/market-data-sources.ts` — `TraderDataSourceInfo` (EP-011): contrato del listado de fuentes de datos que ve un trader, con `hasOwnCredential`/`hasSharedCredential` ya derivados en el servidor (el frontend no infiere el estado de acceso ni recibe la key ni la identidad del admin que comparte).
- **Vocabulario del riel de mercado en vivo** en `src/types/interfaces.ts`, bajo el bloque `── Reactive Market Stream ──`: `MarketTick`, `MarketCandleTick`, `StreamHealthState` (`'HEALTHY' | 'DEGRADED' | 'UNKNOWN'`) y `StreamHealthRecord`. Es vocabulario compartido a propósito: lo emite `apps/api` (`MarketStreamService`, `StreamHealthService`), lo consume `libs/analysis` (`resolveStreamHealth`, `detectMaterialEvent`) y lo devuelve `EP-015 GET /trading/stream-health` al front. Ninguno de estos tipos vive duplicado en otro proyecto.
- `StreamHealthRecord` es la forma **serializada a Redis** (`rx:v1:health:{symbol}`, con TTL): todos sus campos son primitivos y los instantes van en epoch ms (`connectedAt`, `lastTickAtMs`, `lastHeartbeatAtMs`, `publishedAt`), **nunca `Date`**. Agregarle un campo no serializable rompe el `setJson`/`getJson` del puerto de coordinación.
- `StreamHealthState.UNKNOWN` **no es un estado residual**: significa "no hay registro" y el sistema lo trata igual que `DEGRADED` (fail-closed). Cualquier lector nuevo debe cubrir los tres valores.
- `IndicatorSnapshot` (`src/types/interfaces.ts`) **no tiene `close`** — solo `Candle` lo tiene. Al consumirlo, pasar el precio de cierre explícito desde el último candle; no castear esperando un campo que en runtime nunca está poblado.

## 4. Convenciones propias

- No introducir dependencias de React ni NestJS acá. Tests: `pnpm nx test shared`.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
