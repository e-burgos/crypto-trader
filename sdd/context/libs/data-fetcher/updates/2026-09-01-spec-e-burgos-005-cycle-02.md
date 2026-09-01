# spec-e-burgos-005 cycle-02 — 2026-09-01

## Estado

- `BinanceRestClient` pasa de 8 a **12 operaciones de trading**: suma `placeLimitMakerBuyOrder`,
  `placeOcoBuyOrder` (OCO de **compra** por `/api/v3/orderList/oco`: `belowType LIMIT_MAKER` +
  `aboveType STOP_LOSS_LIMIT`, `aboveTimeInForce GTC`, trailing de la pierna contingente como
  **`aboveTrailingDelta`**), `getEntryOrderStatus` y `cancelEntryOrder`. `placeStopLossLimitOrder`
  acepta `stopPrice` nulo y `trailingDeltaBips` (con `stopPrice` la orden queda dormida hasta
  cruzarlo; sin `stopPrice` trackea desde el próximo trade). Todo verificado **ejecutando** contra
  TESTNET (artifact `cycles/cycle-02/artifacts/testnet-write-probe.md`).
- Nuevo getter `getBaseUrl()`, usado por el harness como guarda de aborto.

## Estructura

- `getSymbolFilters` lee además el filtro **`TRAILING_DELTA`** en el campo opcional
  `SymbolFilters.trailingDelta` (`TrailingDeltaFilter`, min/max Above y Below en BIPS). Opcional a
  propósito: cuatro specs de `apps/api` construyen literales `SymbolFilters`.
- `OrderValidationCode` suma `'TRAILING_DELTA'`. Regla fail-closed: si se pide un delta y el símbolo
  no declara el filtro, se rechaza local. Contra el exchange el error sería `-1013 Filter failure:
  TRAILING_DELTA`, el **mismo código** que `LOT_SIZE`, así que rechazar local es la única forma de
  que sea diagnosticable.
- `PRICE_CROSSES_MARKET` tiene ahora sentido de **compra**: `limitPrice < referencePrice <
  stopPrice`. Un `LIMIT_MAKER` BUY con precio ≥ mercado es `-2010 Order would immediately match and
  take` (no reintentable). `referencePrice` es obligatorio en las tres colocaciones nuevas.
- Redondeo por pierna para compra: límite de compra `down`, stop y su límite `up`.
  `placeStopLossLimitOrder` pasó de redondear siempre `down` a `side === 'BUY' ? 'up' : 'down'`;
  la rama SELL es idéntica.
- `toEntryOrderStatus` es un mapper propio (`PARTIALLY_FILLED` con `executedQty > 0` ⇒ `FILLED`
  con `partial: true`; `-2013` ⇒ `MISSING`); `mapOrderStatusToState` de la protección no cambió.
  `GET /api/v3/orderList` no trae precios ni cantidades: para un OCO se consultan la lista y las
  piernas, o una sola pierna con `opts.leg`.
- `ENDPOINT_WEIGHTS` no necesitó entradas nuevas: los pesos medidos en testnet coinciden con la
  tabla (POST order 1, POST oco 1, GET order 4, GET orderList 4, openOrders con símbolo 6, DELETE 1).
- **Harness contra TESTNET**: `src/lib/binance/binance-rest.client.testnet.spec.ts`, gateado por
  `BINANCE_TESTNET_E2E=1` (sin la variable se reporta como *skipped*: CI nunca toca el exchange). Lee
  **solo** `BINANCE_API_TESTNET_KEY/SECRET` del `.env` raíz vía `dotenv` sin tocar `process.env`,
  aborta si `getBaseUrl()` no es `https://testnet.binance.vision`, coloca cada tipo a múltiplos del
  precio leído (×0.6 / ×1.4) para que nada se llene, y termina barriendo `ent-e2e-*` y afirmando cero
  órdenes propias abiertas. Esta lib corre **Vitest**, no Jest; el comando real:

  ```bash
  set -a && source .env && set +a
  BINANCE_TESTNET_E2E=1 pnpm nx test data-fetcher -- --run testnet
  ```

## Qué sigue

- El camino `STOP_LOSS_LIMIT` BUY con `trailingDelta` **sin** `stopPrice` queda soportado por el
  cliente (lo usa el harness) pero `apps/api` no lo usa: el ciclo eligió siempre `stopPrice` +
  `trailingDelta` para que el precio de disparo sea conocido de antemano.
