# spec-e-burgos-001 cycle-02 — 2026-08-17

## Estado

- `resuelve: context_prompt.md §Qué sigue "BinanceRestClient solo implementa órdenes MARKET"` —
  el cliente pasa de 1 a 8 operaciones de trading (LIMIT, STOP_LOSS_LIMIT, OCO, consulta de estado
  de orden y de lista OCO, cancelación de ambas, y listado de órdenes abiertas), con validación
  local de filtros antes de firmar. 88 tests en verde (61 solo del cliente REST).
- Sin acceso a testnet ni credenciales: todo se verifica contra un mock de la capa HTTP —payload
  exacto, firma presente y consistente, y **assert de que el mock no fue invocado** cuando la
  orden se rechaza localmente.

## Estructura

- **Se rechaza antes de firmar.** `getSymbolFilters(symbol)` reemplaza a `getLotSizeFilter`
  (eliminado: su único caller era `placeMarketOrder`) y cachea a nivel de proceso `LOT_SIZE`,
  `PRICE_FILTER` y `NOTIONAL`/`MIN_NOTIONAL`. Ajustes: cantidad `floor` al `stepSize`; precio de
  TP `ceil` al `tickSize` (redondear hacia arriba mantiene el `LIMIT_MAKER` sobre el mercado);
  `stopPrice`/`stopLimitPrice` `floor` al `tickSize`; notional verificado en **ambas** piernas.
  Fallback permisivo cuando el símbolo no declara un filtro (`stepSize/tickSize = 1e-8`, mínimos
  en 0), mismo criterio que el caché anterior.
- `OrderValidationError` con `code: 'LOT_SIZE' | 'PRICE_FILTER' | 'MIN_NOTIONAL' |
  'PRICE_CROSSES_MARKET'`. La última regla —con `referencePrice`, exigir
  `takeProfitPrice > referencePrice > stopPrice`— evita el `-2010 Order would trigger immediately`,
  que es el rechazo más común al colocar una OCO justo después de una compra en un mercado que se
  movió.
- **OCO por `/api/v3/orderList/oco`** (API vigente, `aboveType`/`belowType`), **no** el legacy
  `/api/v3/order/oco`. La pierna de TP es `LIMIT_MAKER`: es lo que garantiza no pagar fee taker si
  el precio salta.
- `ENDPOINT_WEIGHTS` suma los pesos reales: `POST /api/v3/order` y las cancelaciones pesan 1,
  `GET /api/v3/order` y `GET /api/v3/orderList` pesan 4, `GET /api/v3/openOrders` pesa 6. Entradas
  separadas por método para `/api/v3/orderList` (GET 4, DELETE 1). **`getOpenOrders` siempre se
  llama con símbolo**: sin él el peso salta a 80.
- `signedRequest` no cambió — mismo HMAC-SHA256 sobre el query string con `recvWindow: 60000`.
- **Clasificación de errores exportada como utilidades puras** del cliente:
  `RETRYABLE_BINANCE_ERROR_CODES`, `isRetryableBinanceErrorCode`, `getBinanceErrorCode`.
  Reintentables: `-1021` (timestamp fuera de `recvWindow`), `-1001`/`-1000`, `429`/`-1003` (rate
  limit). No reintentables: `-1013` (filtro), `-2010` (rechazo por saldo o cruce), `-2011`
  (cancelación rechazada), `-2013` (la orden no existe ⇒ `MISSING` en la reconciliación).
  Reintentar un `-1013` o un `-2010` es quemar el rate limit sin ninguna chance de éxito.
- `ExchangeOrderState` / `ExchangeOrderStatus` viven en **`libs/shared`**, no acá: es lo que
  permite que `libs/trading-engine` tipe su `OrderExecutorPort` sin depender de `data-fetcher`.
  El resto del contrato (`SymbolFilters`, `OrderValidationError`, `OcoOrderResult`) sí es de esta
  lib.

## Dependencias

- Sin dependencias externas nuevas.

## Qué sigue

- `BinanceWsClient` sigue exportado y sin importadores — se evalúa junto con la abstracción de
  exchange en `spec-e-burgos-002`, igual que antes de este ciclo.
- El cliente sigue siendo específico de Binance spot: nada de este ciclo generalizó la interfaz.
  Futuros, leverage y `positionSide` siguen fuera de alcance (`spec-e-burgos-002`).
