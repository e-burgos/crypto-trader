# spec-e-burgos-005 cycle-02 — 2026-09-01

## Estructura

- `src/types/interfaces.ts` suma el vocabulario de órdenes de **entrada**, al lado de
  `ExchangeOrderState`/`ExchangeOrderStatus` y por la misma razón (que `libs/trading-engine`
  tipe su port sin depender de `libs/data-fetcher`): `EntryOrderMode`
  (`MARKET | LIMIT_MAKER | OCO`), `RestingEntryMode`, `EntryOrderLeg` (`LIMIT | STOP`),
  `EntryOrderRequest`, `EntryOrderRef`, `EntryOrderResult`, `EntryOrderExchangeState`
  (`RESTING | FILLED | CANCELLED | MISSING` — sin `EXPIRED`: el vencimiento es regla nuestra,
  no del exchange) y `EntryOrderExchangeStatus` (con `partial`, `remainingQuantity` y
  `filledLeg`). El tipo de consulta se llama `EntryOrderExchangeStatus` a propósito: `EntryOrderStatus`
  es el enum de Prisma y conviven en `reconciliation.service.ts`.
