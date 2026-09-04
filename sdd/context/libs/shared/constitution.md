# Constitución — libs/shared

> Versión 1.5 | Última actualización: cycle-02 | Fecha: 2026-09-04
> Fragmentos consolidados: spec-e-burgos-001 cycle-03 (2026-08-18) + spec-e-burgos-004 cycle-01 (2026-08-19) + spec-e-burgos-005 cycle-01 (2026-08-30) + spec-e-burgos-005 cycle-02 (2026-09-01) + spec-e-burgos-009 cycle-01 (2026-09-03) + spec-e-burgos-009 cycle-02 (2026-09-04)

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
- **Vocabulario de órdenes de entrada** (spec-005 cycle-02), junto a `ExchangeOrderState`/`ExchangeOrderStatus` y por la misma razón (que `libs/trading-engine` tipe su port sin depender de `libs/data-fetcher`): `EntryOrderMode` (`MARKET | LIMIT_MAKER | OCO`), `RestingEntryMode`, `EntryOrderLeg` (`LIMIT | STOP`), `EntryOrderRequest`, `EntryOrderRef`, `EntryOrderResult`, `EntryOrderExchangeState` (`RESTING | FILLED | CANCELLED | MISSING` — sin `EXPIRED`: el vencimiento es regla del bot, no del exchange) y `EntryOrderExchangeStatus` (con `partial`, `remainingQuantity`, `filledLeg`). El nombre es deliberado: `EntryOrderStatus` es el enum de Prisma y ambos conviven en `reconciliation.service.ts` de `apps/api`.

- `src/types/trading-config-wire.ts` (spec-009 cycle-01): el wire completo de configuración del bot vive acá y sólo acá. `TradingConfigWire` (respuesta de `GET/POST/PUT /trading/config`), `CreateTradingConfigInput` (espejo exacto de los 40 campos de `CreateTradingConfigDto`), `UpdateTradingConfigInput` (38: sin `asset` ni `pair`; `isActive` ya no existe en el DTO tras FIX-e-burgos-027) y `UpdateTradingConfigPayload` (lo que emite la UI: omite `mode` y admite `null` para limpiar `maxPositionHoldMinutes` y `entryTrailingDeltaBips`). Uniones `TradingAssetWire`, `TradingQuoteWire`, `TradingModeWire`, `TradingIntervalModeWire`, `TradingRiskProfileWire`; `entryOrderMode` reusa `EntryOrderMode`.
- Particiones `TRADING_CONFIG_BASE_FIELDS` (15) y `TRADING_CONFIG_ADVANCED_FIELDS` (25) con sus tipos derivados, y los helpers de compilación `ExactKeys`/`AssertNoKeyDrift`: `apps/api` ata sus DTOs con `implements` + un alias de exactitud de claves, y `apps/web` deriva su catálogo y su draft de la partición. **Un campo agregado en un solo lado rompe el typecheck** (`TS2344`). `TradingConfigData` (14 campos, previa) sigue existiendo para los consumidores viejos; los nuevos usan el wire.
- `src/types/entry-order-wire.ts` (spec-009 cycle-02): el wire de EP-017 (`GET /trading/entry-orders`). `EntryOrderWire` (los 24 campos del `select` de `listEntryOrders`, fechas como ISO string), `EntryOrderStatusWire` (`RESTING | FILLED | CANCELLED | EXPIRED | MISSING`, distinto de `EntryOrderExchangeState` que no tiene `EXPIRED`), `EntryOrderCancelReasonWire` (8 motivos), `EntryOrdersPageWire { items, nextCursor }`, `ListEntryOrdersQuery`; reusa `EntryOrderMode`, `EntryOrderLeg` y `TradingModeWire`. Listas congeladas para exhaustividad en la UI: `ENTRY_ORDER_STATUSES`, `ENTRY_ORDER_CANCEL_REASONS`, `ENTRY_ORDER_WIRE_FIELDS` (24), `ENTRY_ORDER_WS_EVENTS` (los seis `entry-order:*`). `apps/api` ata su `select` con `ENTRY_ORDER_SELECT satisfies Record<EntryOrderWireField, true>` (FIX-e-burgos-029).

## 4. Convenciones propias

- No introducir dependencias de React ni NestJS acá. Tests: `pnpm nx test shared`.
- Todo wire nuevo que consuman `apps/api` y `apps/web` nace acá con su lista congelada de campos y se ata en ambos lados con `ExactKeys`/`AssertNoKeyDrift` o `satisfies`: la deriva tiene que fallar en typecheck, no en producción.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
