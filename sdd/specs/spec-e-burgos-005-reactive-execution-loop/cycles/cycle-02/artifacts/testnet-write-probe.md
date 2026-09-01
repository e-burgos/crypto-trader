# Probe de escritura contra Binance TESTNET — 2026-09-01

Ejecutado antes de escribir código, con la API cruda (`fetch` + HMAC), solo credenciales de testnet,
`BTCUSDT`, último precio 77.292,81, cantidad 0,0002 (notional ≈ 9–22 USDT ≥ 5). Todas las órdenes
quedaron lejos del mercado y se cancelaron al final: **0 órdenes abiertas** al terminar.

## Resultados por request

| # | Request | HTTP | Resultado |
| --- | --- | --- | --- |
| 1 | `POST /api/v3/order` `type=LIMIT_MAKER side=BUY price=46375` | 200 | `status: NEW`, `workingTime` seteado, `fills: []` |
| 2 | `POST /api/v3/order` `type=STOP_LOSS_LIMIT side=BUY timeInForce=GTC stopPrice=108210 price=108310 trailingDelta=100` | 200 | `status: NEW`, `trailingDelta: 100`, **`trailingTime: -1`**, `workingTime: -1`, `isWorking: false` (empieza a trackear recién al cumplirse `stopPrice`) |
| 3 | Igual a 2 **sin `stopPrice`** | 200 | `trailingTime` = ahora (trackea desde ya), `stopPrice: "0.00000000"` en la consulta |
| 4 | Igual a 2 con `trailingDelta=5` (filtro min 10) | 400 | `{"code":-1013,"msg":"Filter failure: TRAILING_DELTA"}` |
| 5 | `POST /api/v3/orderList/oco` `side=BUY belowType=LIMIT_MAKER belowPrice=46375 aboveType=STOP_LOSS_LIMIT aboveStopPrice=108210 abovePrice=108310 aboveTimeInForce=GTC newOrderRespType=FULL` | 200 | `listStatusType: EXEC_STARTED`, `listOrderStatus: EXECUTING`, `orders[]` con dos `orderId` y `orderReports[]` con ambas piernas en `NEW` (STOP_LOSS_LIMIT primero, LIMIT_MAKER segundo) |
| 6 | Igual a 5 más **`aboveTrailingDelta=100`** | 200 | Aceptado: la pierna STOP_LOSS_LIMIT sale con `trailingDelta: 100, trailingTime: -1` |
| 7 | `POST /api/v3/order` `type=LIMIT_MAKER side=BUY price=108210` (por encima del mercado) | 400 | `{"code":-2010,"msg":"Order would immediately match and take."}` |
| 8 | `GET /api/v3/order?orderId=` × 3 | 200 | Peso +4 cada una (`x-mbx-used-weight-1m`: 8 → 12 → 16) |
| 9 | `GET /api/v3/orderList?orderListId=` × 2 | 200 | Peso +4 cada una (20 → 24). Devuelve solo `orders[]` (id + clientOrderId), **sin** `orderReports` |
| 10 | `GET /api/v3/openOrders?symbol=BTCUSDT` | 200 | Peso +6 (30). Lista 7 órdenes propias (3 sueltas + 2×2 del OCO) |
| 11 | `DELETE /api/v3/order?orderId=` × 3 | 200 | `status: CANCELED` |
| 12 | `DELETE /api/v3/orderList?orderListId=` × 2 | 200 | `listOrderStatus: ALL_DONE` |
| 13 | `GET /api/v3/openOrders` final | 200 | `[]` |

## Hechos que el contrato debe reflejar

- Los pesos medidos coinciden con `ENDPOINT_WEIGHTS` vigentes: POST order 1, POST orderList/oco 1,
  GET order 4, GET orderList 4, openOrders (con símbolo) 6, DELETE 1. No hace falta agregar pesos.
- Un `LIMIT_MAKER` BUY con precio ≥ mercado es `-2010` (no reintentable): la regla
  `PRICE_CROSSES_MARKET` para compra es `limitPrice < referencePrice < stopPrice`.
- El `trailingDelta` **con** `stopPrice` queda dormido (`trailingTime: -1`) hasta cruzar el stop;
  **sin** `stopPrice` trackea de inmediato. La pierna contingente del OCO usa `aboveTrailingDelta`.
- Filtro `TRAILING_DELTA` de BTCUSDT en testnet: min/max Above y Below = 10/2000 BIPS; violarlo es
  `-1013 Filter failure: TRAILING_DELTA`, mismo código que LOT_SIZE/PRICE_FILTER.
- `GET /api/v3/orderList` no trae precios ni cantidades ejecutadas: para saber qué pierna llenó y a
  qué precio hay que consultar `GET /api/v3/order` de la pierna (mismo patrón que `getOcoStatus`).
- Latencia observada por request firmado: 300–500 ms.
