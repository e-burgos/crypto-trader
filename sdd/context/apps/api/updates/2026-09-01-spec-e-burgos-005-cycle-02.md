# spec-e-burgos-005 cycle-02 — 2026-09-01

## Estado

- Capa de **entradas descansando en el exchange** entregada y **apagada**: `TradingConfig.entryOrderMode`
  (`MARKET` default | `LIMIT_MAKER` | `OCO`), `entryOrderTtlMinutes` (120, rango 5..1440) y
  `entryTrailingDeltaBips` (nullable, 10..2000), declarados en `CreateTradingConfigDto` y
  `UpdateTradingConfigDto`. Con `MARKET` el camino de compra es idéntico al anterior
  (`trading.processor.entry-orders.spec.ts` lo afirma por conteo de invocaciones, CA-001).
- Verificado **ejecutando** contra Binance TESTNET en tres niveles: probe crudo previo al contrato
  (`cycles/cycle-02/artifacts/testnet-write-probe.md`), harness del cliente en `libs/data-fetcher`, y
  spec integrado con Prisma real (`artifacts/testnet-integration-run.md`). Nunca en LIVE.

## Estructura

- `src/trading/entry-order.service.ts` — dueño de la entrada descansando: `placeResting` (fila
  `RESTING` creada **después** de la confirmación del exchange, `expiresAt = placedAt + TTL`),
  `settleFill` (única liquidación: si `partial` cancela el remanente primero; `updateMany` condicional
  como claim idempotente; `Position` + `Trade` con `decisionId: null` + protección inicial por el
  camino existente; `bot_actions {BUY, EXCHANGE_TRIGGER, EXECUTED}` **sin** pasar por la puerta),
  `cancelResting`, `markSkipped`, `countResting`, `sumRestingPlannedNotionalUsd`, `reaffirms`.
  Exportado por `TradingModule` para que `ReactiveModule` lo consuma sin invertir el grafo.
- **Tabla `entry_orders`** (`EntryOrder`, 5 estados: `RESTING` único no terminal; `FILLED`,
  `CANCELLED`, `EXPIRED`, `MISSING`) con `cancelReason` tipado; `positionId`/`decisionId` sin FK
  (auditoría). Prefijo de `clientOrderId` **`ent-`** + 24 hex; piernas del OCO `-l`/`-s`. Tres
  migraciones (`20260901230000/230100/230200`). `BotActionKind` suma `ENTRY_CANCEL`,
  `BotActionSource` suma `EXCHANGE_TRIGGER`.
- `trading.processor.ts` — rama de `executeBuy` para LIVE/TESTNET con `entryOrderMode != MARKET`
  (§7.1 del architect): concurrencia contando `RESTING`, `resolveEntryLevels` sobre
  `supportResistance` del snapshot con el precio **crudo** como referencia, sizing al peor precio,
  reafirmación idempotente / reemplazo, `assertBuyAllowed` con el notional comprometido, y la
  colocación **dentro** de `authorizeAndRun` (`kind: BUY`, `detail: ENTRY_PLACED_<modo>`). Sin nivel
  utilizable no compra ni cae a mercado: evento `entry-order:skipped`. SANDBOX ignora el modo.
- **Cancelaciones decididas por el bot pasan por la puerta** con `kind: ENTRY_CANCEL` (`REDUCING`,
  exento de caps): decisión posterior ≠ BUY en `runCycle` (c1), reemplazo (c1'), cap diario
  `DISCARDED` en reconciliación y en `executeBuy` (c2), y stop del bot en `TradingService`
  (`stopAgentById`, los tres stops masivos y `deleteConfig` **antes** del CASCADE; sin credenciales
  el stop igual procede y la fila queda `RESTING` con `lastError`). Lo que la reconciliación observa
  o limpia (TTL, `VANISHED_ON_EXCHANGE`, `MISSING`, huérfanas) no pasa por la puerta.
- `reconciliation.service.ts` — paso de entradas antes del barrido: **consulta primero, TTL
  después** (un fill le gana al vencimiento); `EXPIRED` cancela en el exchange antes de marcar;
  `MISSING` sólo por `-2013` directo y la fila nunca se borra; barrido de huérfanas `ent-` propio
  sobre la **misma** llamada a `getOpenOrders` que el barrido `prot-`. Dos deps nuevas en el
  constructor (`AggregateRiskService`, `ActionGateService`).
- `bot-action-counters.ts` — el conteo horario y el cooldown excluyen `source: EXCHANGE_TRIGGER` y
  `kind: ENTRY_CANCEL` (sin eso una misma compra consumiría el cap dos veces).
- `agents/domain/risk-budget.service.ts` — `countOpenPositions` suma las `RESTING` del mismo scope
  (una entrada viva es exposición comprometida; también lo ve el LLM como posición).
- `src/reactive/entry-fill-watch.service.ts` — sonda de fill por tick (D6): sólo con
  `reactiveLoopEnabled`, sólo cuando el tick cruza `limitPrice` o `stopPrice`, consulta **sólo la
  pierna cruzada** (peso 4), debounce `entryFillProbeDebounceMs` = 15 s por `(entryOrderId, leg)`,
  llama al mismo `settleFill` e invalida el caché de posiciones del fast path
  (`invalidateOpenPositions` pasó a público). Nunca vence, cancela ni marca `MISSING`. La
  reconciliación de inicio de ciclo sigue siendo la autoridad; con el riel apagado la ventana sin
  protección tras un fill es hasta el próximo ciclo.
- **EP-017 `GET /trading/entry-orders`** (`ListEntryOrdersDto`, scope por `userId`, cursor por `id`,
  `placedAt desc`). EP-006/007 aceptan los tres campos nuevos.
- Eventos WS por etapa: `entry-order:placed|filled|expired|cancelled|missing|skipped`. Notificaciones
  `TRADE_EXECUTED` (`entryOrderPlaced`, `entryOrderFilled`) y `AGENT_ERROR` (`entryOrderMissing`).
  `apps/web` no tiene las claves de locale: i18next muestra la clave literal, no rompe (deuda de UI).
- Tests: `jest.config.js` ignora `*.testnet.spec.ts`; `jest.testnet.config.js` (sin el mock de
  `generated/prisma`) corre `entry-order.integration.testnet.spec.ts` con
  `BINANCE_TESTNET_E2E=1 npx jest --config apps/api/jest.testnet.config.js`.

## Qué sigue

- `trading.processor.reactive-gate.spec.ts` cuenta ocurrencias textuales de `authorizeAndRun` (pasó
  de 6 a 8): es el anti-patrón prohibido por `lessons.md`; retirarlo y reemplazarlo por una aserción
  de comportamiento.
- Un fill parcial deja `cancelReason: PARTIAL_FILL_REMAINDER` en la fila `FILLED` (única fila que
  puede llevarlo). Decidir si merece columna propia.
- La invalidación del caché del fast path desde la reconciliación (no desde la sonda) queda acotada
  por el TTL del caché: sólo el user data stream de Binance la eliminaría (fuera de alcance).
- UI de los tres campos nuevos y de la lista de entradas (EP-017): deuda de UI heredada de spec-001.
- Encender `entryOrderMode` en producción es decisión del dev, bot por bot, primero en TESTNET.
