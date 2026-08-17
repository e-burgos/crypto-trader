# Constitución — libs/shared

> Versión 1.1 | Última actualización: cycle-02 | Fecha: 2026-08-17

## 1. Propósito

- **Tipo:** lib
- **Rol en el sistema:** Types, DTOs, constantes y utilidades compartidas entre backend y frontend.

## 2. Stack tecnológico

- TypeScript puro, sin dependencias de framework.

## 3. Estructura y patrones

- Sin dependencias internas — es la base del grafo; todas las demás libs/apps pueden importarla.
- **Vocabulario común de órdenes de exchange** en `src/types/interfaces.ts`: `ExchangeOrderState` (`'ACTIVE' | 'FILLED' | 'CANCELLED' | 'MISSING'`) y `ExchangeOrderStatus` (`state`, `filledLeg: 'STOP' | 'TAKE_PROFIT' | null`, `executedPrice`, `executedQuantity`, `orderId`). Viven acá y no en `libs/data-fetcher` —donde está el cliente de Binance— porque `libs/trading-engine` los necesita para su `OrderExecutorPort` y no existe (ni debe existir) una dependencia de `trading-engine` sobre `data-fetcher`. **Cualquier tipo que necesiten esas dos libs va acá por la misma razón.**
- `TradeRecord` incluye `decisionId?: string | null` — trazabilidad de la operación ejecutada hacia la `AgentDecision` que la justificó. Opcional y nullable: los caminos sin decisión asociada (cierre manual, cierre ejecutado por el exchange) persisten `null` sin fallar.

## 4. Convenciones propias

- No introducir dependencias de React ni NestJS acá. Tests: `pnpm nx test shared`.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
