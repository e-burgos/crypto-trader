# spec-e-burgos-001 cycle-02 — 2026-08-17

## Estado

- Primer ciclo SDD que toca esta lib. Cambio pequeño y puramente aditivo: dos tipos de estado de
  orden de exchange y un campo opcional en `TradeRecord`. Nada retrocompatible se rompió.

## Estructura

- `src/types/interfaces.ts` suma `ExchangeOrderState` (`'ACTIVE' | 'FILLED' | 'CANCELLED' |
  'MISSING'`) y `ExchangeOrderStatus` (`state`, `filledLeg: 'STOP' | 'TAKE_PROFIT' | null`,
  `executedPrice`, `executedQuantity`, `orderId`).
- **Por qué acá y no en `libs/data-fetcher`, donde vive el cliente de Binance:** `libs/trading-engine`
  necesita esos tipos para su `OrderExecutorPort`, y no existe (ni debe existir) una dependencia de
  `trading-engine` sobre `data-fetcher`. `libs/shared` es la única lib que ambas ya consumen, así
  que es el lugar natural del vocabulario común de órdenes. Cualquier tipo nuevo que necesiten las
  dos va acá por la misma razón.
- `TradeRecord` suma `decisionId?: string | null` — trazabilidad de la operación ejecutada hacia
  la `AgentDecision` que la justificó. Opcional y nullable: los caminos sin decisión asociada
  (cierre manual, cierre ejecutado por el exchange) persisten `null` sin fallar.

## Dependencias

- Sin dependencias externas nuevas. Sigue siendo TypeScript puro, sin runtime propio.
