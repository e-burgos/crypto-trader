# Mapa del camino de fill vigente — insumo de cycle-01

> Generado por una exploración read-only del orquestador el 2026-09-04, antes de abrir el ciclo.
> **Leer esto antes de explorar el código por cuenta propia.** Está verificado contra el árbol
> en `bbac5b8cf`; si algo no coincide, gana el código.

## 1. `apps/api/src/trading/entry-order.service.ts` — `EntryOrderService`

- `placeResting(params)` — coloca LIMIT_MAKER/OCO, crea la fila `RESTING`, emite `entry-order:placed`.
- **`settleFill(params): Promise<SettleFillOutcome>` — el núcleo del fill.** Lo llaman HOY dos
  caminos: la sonda por tick y la reconciliación. Pasos:
  1. Si el fill es parcial, cancela el remanente en el exchange.
  2. **Claim de idempotencia (CAS por transición de estado):**
     `prisma.entryOrder.updateMany({ where: { id, status: 'RESTING' }, data: { status: 'FILLED', ... } })`.
     Si `claimed.count === 0` devuelve `'ALREADY_SETTLED'` y no hace nada más.
     **No hay lock de Redis ni constraint de "fill event id": la idempotencia es esta transición.**
  3. Crea `Position` (con campos de protección nativa si `nativeProtectionEnabled`), `Trade` (BUY),
     setea `EntryOrder.positionId`.
  4. Crea `BotAction` con `kind: 'BUY'` y **`source: 'EXCHANGE_TRIGGER'`**.
  5. Si hay protección nativa, `positionAction.placeInitialProtection(...)`.
  6. Notificación + `gateway.emitToUser(..., 'entry-order:filled', {...})`.
- Otros: `confirmExternalCancellation`, `markMissing`, `cancelResting`, `applyTerminalStatus`,
  `findResting`, `listRestingClientOrderIds`, `countResting`, `sumRestingPlannedNotionalUsd`.

> **Consecuencia de diseño para este ciclo:** un tercer detector (el user data stream) que llame a
> `settleFill` hereda la idempotencia gratis. El trabajo real no es inventar idempotencia: es
> correlacionar el `executionReport` con la fila correcta y no duplicar efectos de borde
> (notificación, evento WS, llamadas REST redundantes).

## 2. `apps/api/src/trading/reconciliation.service.ts` — `ReconciliationService`

- `reconcile(input)` — se invoca **una vez por ciclo de decisión del LLM** desde
  `trading.processor.ts` (solo LIVE/TESTNET; construye un `LiveOrderExecutor`/`BinanceRestClient`
  nuevo por llamada a partir de credenciales desencriptadas).
- `reconcileEntryOrders` → `reconcileEntryOrder`: `executor.getEntryOrderStatus(...)` (poll REST) por
  cada entrada `RESTING`; si `FILLED` → `entryOrders.settleFill(...)`; si `CANCELLED`/`MISSING`/TTL
  vencido → camino terminal correspondiente.
- Reconcilia también fills de la OCO de protección (`reconcileProtected` → `closeFilledByExchange`)
  con el **mismo patrón**: `prisma.position.updateMany({ where: { id, status: 'OPEN' }, ... })`.

## 3. Eventos WS y vocabulario compartido

- `apps/api/src/gateway/app.gateway.ts` — `AppGateway.emitToUser(userId, event, data)` emite al room
  `user:<userId>`, namespace `/ws`, autenticado por JWT en `handleConnection`.
- Los payloads son objetos literales inline en `entry-order.service.ts` (no tipados centralmente en
  el call site). Los **nombres** sí son canónicos en
  `libs/shared/src/types/entry-order-wire.ts`: `ENTRY_ORDER_WS_EVENTS` con los seis eventos, más
  `EntryOrderWire`, `EntryOrderStatusWire`, `EntryOrderCancelReasonWire` y aserciones de
  exhaustividad (`AssertNoKeyDrift`/`ExactKeys`) que **fuerzan tocar ese archivo si se agrega un
  status terminal o un cancel reason nuevo**.

## 4. `apps/api/src/reactive/*` — el riel reactivo

| Archivo | Qué aporta a este ciclo |
| --- | --- |
| `market-stream.service.ts` | WS público de Binance **por símbolo**, con elección de líder en Redis: lease `rx:v1:owner:<symbol>`, TTL 30 s, renovado cada 10 s. Emite `tick`, `candle`, `symbol-owned`, `symbol-released`. **Patrón a imitar, key space a NO reutilizar** (ver landmine 1). |
| `stream-health.service.ts` | Staleness: publica `StreamHealthRecord` en `rx:v1:health:<symbol>` cada 5 s; `resolveStreamHealth` (de `@crypto-trader/analysis`) calcula HEALTHY/DEGRADED con `streamTickMaxAgeMs` (20 s) / `streamHeartbeatMaxAgeMs` (90 s); emite `market:stream-health` y notifica si la degradación se sostiene 60 s. |
| `reactive-coordination.port.ts` + `redis-reactive-coordination.service.ts` | `ReactiveCoordinationPort`: `tryAcquire`/`renew`/`release` (Lua CAS sobre `SET NX PX`), `tryConsumeToken`, `setJson`/`getJson`, `isHealthy`, `isEnabled`. **Primitiva exacta para el lease del listenKey.** `DisabledReactiveCoordination` es el no-op cuando no hay Redis. |
| `entry-fill-watch.service.ts` | **La sonda por tick.** `onModuleInit` → `marketStream.on('tick')` → `handleTick` → configs con `isRunning && reactiveLoopEnabled` → `resolveEligibleProbes` (el precio cruza `limitPrice`/`stopPrice`, debounce de 15 s por `(entryOrderId, leg)`) → `resolveExecutor` (credenciales desencriptadas, cacheadas por `userId:isTestnet`) → `probeEntry`: **`getEntryOrderStatus` es una llamada REST**, y solo si da `FILLED` llama `settleFill`. |
| `material-event.service.ts` | Patrón de cómo un evento reactivo alimenta la cola Bull `TRADING_QUEUE`. |
| `reactive.module.ts` | Wiring DI: factory providers de `BinanceWsClient`/`BinanceRestClient`, `REACTIVE_COORDINATION`. Un `UserDataStreamService` entra acá. |
| `reactive-runtime-thresholds.ts` | Fuente única de los números mágicos (`ownerLeaseTtlMs`, `entryFillProbeDebounceMs`, `wsPingIntervalMs`/`wsPongTimeoutMs`). **Los umbrales nuevos del listenKey van acá.** |

> **Matiz que define el ciclo:** el "tick" es un evento WS público, pero la confirmación del fill
> sigue siendo un **poll REST** disparado por ese tick. El `executionReport` reemplaza exactamente
> ese poll.

> **Fallback vigente:** `StreamHealthService` reporta la degradación, no la remedia. El fallback de
> hoy es que la sonda REST y la reconciliación nunca se apagaron.

## 5. `libs/data-fetcher/src/lib/binance/*`

- **`binance-rest.client.ts`** — base URL por `config.testnet` (`https://testnet.binance.vision`).
  `signedRequest<T>(path, method, params)` firma HMAC-SHA256 sobre el query string y agrega
  `timestamp`+`recvWindow`. Tabla `ENDPOINT_WEIGHTS` + `BinanceRateLimiter`.
  **No existe ningún método para `POST/PUT/DELETE /api/v3/userDataStream`.** Esos endpoints
  necesitan solo el header `X-MBX-APIKEY` (ya se setea cuando hay `apiKey`) y **no llevan firma ni
  timestamp**: hace falta un helper "con key pero sin firmar", más entradas nuevas en
  `ENDPOINT_WEIGHTS`.
- **`binance-ws.client.ts`** — implementa **solo el combined stream**
  (`wss://stream.binance.com:9443/stream?streams=...`, mensajes con envelope `{ stream, data }`) y
  asume una conexión multiplexada compartida entre símbolos. El endpoint del listenKey es
  **single-stream** (`.../ws/<listenKey>`) y entrega JSON crudo sin envelope. Ver landmine 2.

## 6. Interruptores — cómo se declara un flag hoy

- `apps/api/prisma/schema.prisma`, modelo `TradingConfig`: `reactiveLoopEnabled Boolean @default(false)`,
  `entryOrderMode EntryOrderMode @default(MARKET)` (enum `MARKET|LIMIT_MAKER|OCO`),
  `entryOrderTtlMinutes Int @default(120)`, `entryTrailingDeltaBips Int?`.
- Se leen directo de la fila Prisma donde hacen falta (no hay servicio de feature flags).
- Wire compartido: `libs/shared/src/types/trading-config-wire.ts`.
- UI: `apps/web/src/components/config/advanced/advanced-fields.ts` es un registro declarativo
  (`{ kind: 'switch', section: 'reactive', dependsOn: [...] }`) + strings en
  `apps/web/src/locales/{en,es}.ts`.

> **Un flag por bot en `TradingConfig` arrastra apps/web.** Este ciclo tiene como requisito
> explícito no tocar la SPA — ver la decisión D1-1 del brief.

## 7. Prisma

- `EntryOrder` (`@@map("entry_orders")`): `clientOrderId String @unique` es **la única constraint
  única**; `orderId`/`orderListId`/`limitLegOrderId`/`stopLegOrderId` no son únicos. Índices:
  `[configId, status]`, `[userId, status]`, `[status, expiresAt]`. `positionId` y `decisionId` son
  referencias de auditoría **sin FK a propósito**.
- `BotAction`: `source BotActionSource` (`FAST_PATH | LLM_CYCLE | EXCHANGE_TRIGGER`),
  `kind BotActionKind` (incluye `ENTRY_CANCEL`).
- Migraciones: `apps/api/prisma/migrations/<YYYYMMDDHHMMSS_snake_case>/migration.sql` (43 existentes).
  Precedentes: `20260901230000_add_entry_order_bot_action_values`, `20260901230100_add_entry_orders`,
  `20260901230200_add_trading_config_entry_order_columns`.

## 8. Tests — cómo se evita la red

- `entry-order.service.spec.ts`, `reconciliation.service.spec.ts`, `trading.processor.entry-orders.spec.ts`,
  `trading.controller.entry-orders.spec.ts`: stubs `jest.fn()` de `OrderExecutorPort` + factory de
  prisma mockeado. Sin red.
- **`entry-order.integration.testnet.spec.ts`** — TESTNET real, **gateado por
  `process.env.BINANCE_TESTNET_E2E === '1' ? describe : describe.skip`**, lee
  `BINANCE_API_TESTNET_KEY`/`_SECRET`. Es el único lugar que toca la red y solo con opt-in
  explícito. **Este es el patrón a seguir para la verificación TESTNET de este ciclo** — así CI
  (que recibe 451 de Binance) nunca lo ejecuta.
- **`market-stream.service.spec.ts` es el harness de WS más cercano:** `FakeWsClient extends
  EventEmitter implements MarketStreamWsClient` + `createSharedFakeCoordination()` que implementa
  `ReactiveCoordinationPort` sobre un `Map` en memoria. **Plantilla para el doble del user data
  stream.**
- `entry-fill-watch.service.spec.ts` mockea `@crypto-trader/data-fetcher` y
  `@crypto-trader/trading-engine` a nivel módulo y maneja `handleTick` con `MarketTick` sintéticos.

## 9. Landmines (leer antes de diseñar)

1. **La clave de sharding no coincide.** La elección de líder de `MarketStreamService` es por
   **símbolo** (el dato es público y una conexión sirve a todos los usuarios). El user data stream
   es por **credencial** (`userId` + `isTestnet`, 1:1 con la fila `BinanceCredential` y su
   listenKey). No puede reutilizar el mismo key space: necesita uno propio
   (ej. `rx:v1:uds:owner:<credentialId>`) y **escala con la cantidad de usuarios activos, no con la
   cantidad de símbolos**.
2. **No hay cliente WS para el endpoint single-stream del listenKey.** `BinanceWsClient` solo
   entiende el envelope del combined stream. Hace falta una clase nueva que reuse su forma de
   reconexión/backoff/heartbeat pero con su propia URL, su propio parseo y construcción **por
   credencial y por modo** (hoy el factory de `reactive.module.ts` hardcodea mainnet, correcto para
   ticks públicos, inaceptable para una suscripción autenticada).
3. **No hay helper REST para el ciclo de vida del listenKey**, y esos endpoints son "con key pero
   sin firma", distinto de todo el resto de `BinanceRestClient`.
4. **El polling no se apaga solo.** `EntryFillWatchService.probeEntry` y
   `ReconciliationService.reconcileEntryOrder` van a seguir corriendo salvo que se los gatee
   explícitamente. La carrera es **segura** (el claim CAS de `settleFill` la resuelve), pero el
   costo en peso de rate limit y en notificaciones/logs que parecen duplicados es real.
5. **La desencriptación y el caché de credenciales ya tienen precedente** en
   `EntryFillWatchService.resolveCredentials` (caché por `userId:isTestnet` con TTL) y en
   `apps/api/src/users/utils/encryption.util.ts`. Reusar, no reinventar.
6. **El listenKey es material tipo bearer:** quien lo tiene lee el stream privado de ese usuario. No
   loguearlo, no persistirlo en Postgres en claro (hoy no existe columna para él — y agregar una es
   una decisión a justificar frente a guardarlo solo en memoria o en Redis con TTL corto, que es lo
   que ya hace `stream-health.service.ts` con su estado efímero).
7. **Duplicación multi-instancia:** Binance admite **un solo listenKey activo por API key** —
   crear uno nuevo invalida el socket anterior. Sin un lease por credencial, N réplicas se pisan en
   un loop de churn. La primitiva correcta y ya probada es el CAS de
   `redis-reactive-coordination.service.ts`.
8. **Redis caído:** todo el riel reactivo degrada a "no soy dueño de nada"
   (`isHealthy()`/`isEnabled()`). El servicio nuevo debe seguir el mismo patrón defensivo: caer a
   "que la sonda REST y la reconciliación sigan cubriendo los fills", nunca crashear ni dejar fills
   sin detectar.
