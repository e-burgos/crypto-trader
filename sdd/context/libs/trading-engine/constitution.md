# Constitución — libs/trading-engine

> Versión 1.1 | Última actualización: cycle-01 | Fecha: 2026-08-17

## 1. Propósito

- **Tipo:** lib
- **Rol en el sistema:** Lógica de órdenes y posiciones: ejecución BUY/SELL en Binance según decisión y confidence del agente, gestión de posiciones y P&L, y simulación pura de riesgo de trade.

## 2. Stack tecnológico

- TypeScript (Jest). Build de declaraciones vía `vite:dts` con `noPropertyAccessFromIndexSignature`: los accesos sobre index signatures van **con notación de corchetes** (`X['default']`), o el build emite TS4111.

## 3. Estructura y patrones

- Depende de: `libs/shared`, `libs/analysis`, `libs/data-fetcher`. Consumida por `apps/api`.
- `src/lib/order-executor.ts` — ejecución de órdenes. El sizing vigente es `balance × maxTradePct` inline (`order-executor.ts:164-173`).
- `src/lib/risk/` — simulación pura, exportada por el barrel:

  ```ts
  export function simulateTrade(input: TradeSimulationInput): TradeSimulationResult;
  export const SLIPPAGE_PCT_BY_ASSET: Readonly<Record<string, number>>; // BTC 0.0005, ETH 0.001, default 0.0015
  ```

  Función pura: sin Prisma, sin Nest, sin LLM — vive acá para que `OrderExecutor` pueda invocarla y para servir a backtests. Entrada tipada (`asset` base ya separado del quote, `price`/`quantity` numéricos): el llamador provee datos tipados, la lib no hace `Number(x) || 0` ni parseo del par por regex. Devuelve `riskRewardRatio`, insumo de la política de SELL.

## 4. Convenciones propias

- Tests: `pnpm nx test trading-engine`. El modo Sandbox/Testnet/Live se respeta siempre — nunca ejecutar órdenes Live sin TradingConfig explícito.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
