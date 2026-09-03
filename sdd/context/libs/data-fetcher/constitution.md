# Constitución — libs/data-fetcher

> Versión 1.4 | Última actualización: cycle-02 | Fecha: 2026-09-03
> Fragmentos consolidados: spec-e-burgos-001 cycle-02 (2026-08-17) + spec-e-burgos-005 cycle-01 (2026-08-30) + spec-e-burgos-005 cycle-02 (2026-09-01)

## 1. Propósito

- **Tipo:** lib
- **Rol en el sistema:** Obtención de datos externos: velas OHLCV y tickers de Binance (REST + WebSocket), noticias (CryptoPanic, NewsData.io) y RSS (CoinDesk, Cointelegraph, Decrypt).

## 2. Stack tecnológico

- TypeScript, `rss-parser`, clientes HTTP/WS de Binance.

## 3. Estructura y patrones

- Depende solo de `libs/shared`. Consumida por `apps/api`, `libs/analysis` y `libs/trading-engine`.
- `BinanceRestClient.getKlines()` acepta un rango temporal opcional (aditivo y retrocompatible; las llamadas de `getOhlcv`, `getSnapshot` y el trading engine no cambiaron):

  ```ts
  async getKlines(
    symbol: string,
    interval: CandleInterval,
    limit = 200,
    range?: { startTime?: number; endTime?: number },
  ): Promise<Candle[]>
  ```

  `startTime`/`endTime` se pasan tal cual a `/api/v3/klines` y solo se agregan a los params cuando vienen definidos. Patrón de uso para precio histórico en un instante: pedir 3 velas de `1m` acotadas a `[at − 60s, at + 60s]` y quedarse con la que cumple `openTime <= at <= closeTime`; si ninguna la contiene, el dato no existe (gap del proveedor) y el llamador debe tratarlo como "no evaluable", **nunca como precio 0**.
- **`BinanceRestClient` cubre 12 operaciones de trading:** las 8 originales (MARKET, LIMIT, STOP_LOSS_LIMIT, OCO de venta, consulta de estado de orden y de lista OCO, cancelación de ambas y listado de órdenes abiertas) más 4 de **entrada descansando** (spec-005 cycle-02): `placeLimitMakerBuyOrder`, `placeOcoBuyOrder` (OCO de **compra** por `/api/v3/orderList/oco`: `belowType LIMIT_MAKER` + `aboveType STOP_LOSS_LIMIT` con `aboveTimeInForce GTC`, trailing de la pierna contingente como **`aboveTrailingDelta`**), `getEntryOrderStatus` y `cancelEntryOrder`. `placeStopLossLimitOrder` acepta `stopPrice` nulo y `trailingDeltaBips`: con `stopPrice` la orden queda dormida hasta cruzarlo, sin `stopPrice` trackea desde el próximo trade. Todo verificado **ejecutando** contra TESTNET. Nuevo getter `getBaseUrl()`, usado como guarda de aborto por el harness.
  - **Se rechaza antes de firmar.** `getSymbolFilters(symbol)` (reemplaza a `getLotSizeFilter`, eliminado) cachea a nivel de proceso `LOT_SIZE`, `PRICE_FILTER`, `NOTIONAL`/`MIN_NOTIONAL` y, desde cycle-02, el filtro opcional **`TRAILING_DELTA`** (`SymbolFilters.trailingDelta`, min/max Above y Below en BIPS — opcional a propósito: cuatro specs de `apps/api` construyen literales `SymbolFilters`). Ajustes: cantidad `floor` al `stepSize`; precio de TP `ceil` al `tickSize` (redondear hacia arriba mantiene el `LIMIT_MAKER` sobre el mercado); `stopPrice`/`stopLimitPrice` `floor` al `tickSize` en SELL y **`up` en BUY** (`placeStopLossLimitOrder` pasó de redondear siempre `down` a `side === 'BUY' ? 'up' : 'down'`); notional verificado en **ambas** piernas. Fallback permisivo cuando el símbolo no declara un filtro (`stepSize/tickSize = 1e-8`, mínimos en 0).
  - `OrderValidationError` con `code: 'LOT_SIZE' | 'PRICE_FILTER' | 'MIN_NOTIONAL' | 'PRICE_CROSSES_MARKET' | 'TRAILING_DELTA'`. Regla fail-closed: si se pide un delta y el símbolo no declara el filtro, se rechaza local — contra el exchange el error sería `-1013 Filter failure: TRAILING_DELTA`, el **mismo código** que `LOT_SIZE`, así que rechazar local es la única forma de que sea diagnosticable. `PRICE_CROSSES_MARKET` —con `referencePrice`, exigir `takeProfitPrice > referencePrice > stopPrice` en venta, o `limitPrice < referencePrice < stopPrice` en compra— evita el `-2010 Order would (trigger|immediately match)`, el rechazo más común al colocar protección u OCO de entrada justo cuando el mercado se movió; `referencePrice` es obligatorio en las tres colocaciones de entrada.
  - `toEntryOrderStatus` mapea el estado de una entrada (`PARTIALLY_FILLED` con `executedQty > 0` ⇒ `FILLED` con `partial: true`; `-2013` ⇒ `MISSING`); `mapOrderStatusToState` de la protección no cambió. `GET /api/v3/orderList` no trae precios ni cantidades: para un OCO se consulta la lista y las piernas, o una sola pierna con `opts.leg`. `ENDPOINT_WEIGHTS` no necesitó entradas nuevas (los pesos medidos en testnet coinciden con la tabla).
  - **OCO por `/api/v3/orderList/oco`** (API vigente, `aboveType`/`belowType`), **no** el legacy `/api/v3/order/oco`. La pierna de TP es `LIMIT_MAKER`: garantiza no pagar fee taker si el precio salta.
  - `ENDPOINT_WEIGHTS` lleva los pesos reales, con entradas separadas por método para `/api/v3/orderList` (GET 4, DELETE 1). **`getOpenOrders` siempre se llama con símbolo**: sin él el peso salta a 80.
  - Clasificación de errores exportada como utilidades puras: `RETRYABLE_BINANCE_ERROR_CODES`, `isRetryableBinanceErrorCode`, `getBinanceErrorCode`. Reintentables: `-1021`, `-1001`/`-1000`, `429`/`-1003`. No reintentables: `-1013` (filtro), `-2010` (saldo o cruce), `-2011`, `-2013` (⇒ `MISSING` en la reconciliación). **Reintentar un `-1013` o un `-2010` es quemar el rate limit sin ninguna chance de éxito.**
  - `signedRequest` no cambió: HMAC-SHA256 sobre el query string con `recvWindow: 60000`.
- **`BinanceWsClient` — riel de mercado en vivo, con consumidor en producción** (`apps/api/src/reactive/market-stream.service.ts`). Cuatro capacidades, todas opt-in por configuración o por llamada explícita:
  - **Heartbeat propio.** `ws.ping()` cada `wsPingIntervalMs` (default 30 s); si no llega `pong` en `wsPongTimeoutMs` (default 10 s) se hace `ws.terminate()` para que actúe el `autoReconnect` que ya existía. Resuelve el modo de falla real del cliente: **un socket TCP medio abierto produce silencio permanente y `close` nunca llega, así que `autoReconnect` no se disparaba nunca**. `on('ping')`/`on('pong')` emiten `heartbeat` `{ at }`.
  - **`addStreams(streams)` / `removeStreams(streams)`.** Con el socket conectado envían `{ method: 'SUBSCRIBE' | 'UNSUBSCRIBE', params, id }`; sin conectar solo actualizan la lista pendiente. Antes el conjunto de suscripciones **solo se podía fijar antes de `connect()`**, y el conjunto de símbolos activos cambia cada vez que un bot arranca o para.
  - **`isConnected(): boolean`.**
  - `BinanceWsConfig` suma `wsPingIntervalMs` y `wsPongTimeoutMs` (ambos opcionales).
  Streams que consume `apps/api` por símbolo: `{symbol}@miniTicker` (precio, ~1/s) y `{symbol}@kline_1h` (vela en curso). **El intervalo de la kline debe coincidir con el timeframe del `IndicatorSnapshot`** (`getKlines('1h', 200)`): cambiarlo de un lado sin el otro deja al detector de eventos comparando contra una referencia de otro timeframe.
- `ExchangeOrderState` / `ExchangeOrderStatus` viven en **`libs/shared`**, no acá: es lo que permite que `libs/trading-engine` tipe su `OrderExecutorPort` sin depender de esta lib. El resto del contrato (`SymbolFilters`, `OrderValidationError`, `OcoOrderResult`) sí es propio.

## 4. Convenciones propias

- Tests: `pnpm nx test data-fetcher`.
- **Harness contra TESTNET** (spec-005 cycle-02): `src/lib/binance/binance-rest.client.testnet.spec.ts`, gateado por `BINANCE_TESTNET_E2E=1` (sin la variable se reporta *skipped*: CI nunca toca el exchange). Lee **solo** `BINANCE_API_TESTNET_KEY/SECRET` del `.env` raíz vía `dotenv` sin tocar `process.env`, aborta si `getBaseUrl()` no es `https://testnet.binance.vision`, coloca cada tipo a múltiplos del precio leído (×0.6/×1.4) para que nada se llene, y termina barriendo `ent-e2e-*` y afirmando cero órdenes propias abiertas. Esta lib corre **Vitest**, no Jest:

  ```bash
  set -a && source .env && set +a
  BINANCE_TESTNET_E2E=1 pnpm nx test data-fetcher -- --run testnet
  ```

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
