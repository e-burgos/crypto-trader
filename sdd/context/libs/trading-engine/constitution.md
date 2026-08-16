# Constitución — libs/trading-engine

> Versión 1.0 | Última actualización: cycle-0 (inicial)

## 1. Propósito

- **Tipo:** lib
- **Rol en el sistema:** Lógica de órdenes y posiciones: ejecución BUY/SELL en Binance según decisión y confidence del agente, gestión de posiciones y P&L.

## 2. Stack tecnológico

- TypeScript (Jest).

## 3. Estructura y patrones

- Depende de: `libs/shared`, `libs/analysis`, `libs/data-fetcher`. Consumida por `apps/api`.

## 4. Convenciones propias

- Tests: `pnpm nx test trading-engine`. El modo Sandbox/Testnet/Live se respeta siempre — nunca ejecutar órdenes Live sin TradingConfig explícito.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
