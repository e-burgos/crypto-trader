# spec-e-burgos-009 cycle-02 — 2026-09-03

## Estructura

- `src/types/entry-order-wire.ts` (nuevo): el wire de EP-017 (`GET /trading/entry-orders`).
  `EntryOrderWire` (los 24 campos del `select` de `listEntryOrders`, fechas como ISO string),
  `EntryOrderStatusWire` (`RESTING | FILLED | CANCELLED | EXPIRED | MISSING`, distinto de
  `EntryOrderExchangeState` que no tiene `EXPIRED`), `EntryOrderCancelReasonWire` (8 motivos),
  `EntryOrdersPageWire { items, nextCursor }`, `ListEntryOrdersQuery`; reusa `EntryOrderMode`,
  `EntryOrderLeg` y `TradingModeWire`.
- Listas congeladas para exhaustividad en la UI: `ENTRY_ORDER_STATUSES`, `ENTRY_ORDER_CANCEL_REASONS`,
  `ENTRY_ORDER_WIRE_FIELDS` (24), `ENTRY_ORDER_WS_EVENTS` (los seis `entry-order:*`), con sus tipos
  derivados y los chequeos `AssertNoKeyDrift`/`ExactKeys` reutilizados de `trading-config-wire.ts`.
- `apps/api` ata su `select` con `ENTRY_ORDER_SELECT satisfies Record<EntryOrderWireField, true>`
  (FIX-e-burgos-029): una clave de más o de menos en cualquiera de los dos lados falla el typecheck.
