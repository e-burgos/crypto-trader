# Constitución — libs/data-fetcher

> Versión 1.3 | Última actualización: cycle-01 | Fecha: 2026-08-30
> Fragmentos consolidados: spec-e-burgos-001 cycle-02 (2026-08-17) + spec-e-burgos-005 cycle-01 (2026-08-30)

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
- **`BinanceRestClient` cubre 8 operaciones de trading:** MARKET, LIMIT, STOP_LOSS_LIMIT, OCO, consulta de estado de orden y de lista OCO, cancelación de ambas y listado de órdenes abiertas.
  - **Se rechaza antes de firmar.** `getSymbolFilters(symbol)` (reemplaza a `getLotSizeFilter`, eliminado) cachea a nivel de proceso `LOT_SIZE`, `PRICE_FILTER` y `NOTIONAL`/`MIN_NOTIONAL`. Ajustes: cantidad `floor` al `stepSize`; precio de TP `ceil` al `tickSize` (redondear hacia arriba mantiene el `LIMIT_MAKER` sobre el mercado); `stopPrice`/`stopLimitPrice` `floor` al `tickSize`; notional verificado en **ambas** piernas. Fallback permisivo cuando el símbolo no declara un filtro (`stepSize/tickSize = 1e-8`, mínimos en 0).
  - `OrderValidationError` con `code: 'LOT_SIZE' | 'PRICE_FILTER' | 'MIN_NOTIONAL' | 'PRICE_CROSSES_MARKET'`. La última —con `referencePrice`, exigir `takeProfitPrice > referencePrice > stopPrice`— evita el `-2010 Order would trigger immediately`, el rechazo más común al colocar una OCO justo después de una compra en un mercado que se movió.
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

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
