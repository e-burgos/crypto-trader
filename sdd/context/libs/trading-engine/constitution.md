# Constitución — libs/trading-engine

> Versión 1.2 | Última actualización: cycle-02 | Fecha: 2026-08-17

## 1. Propósito

- **Tipo:** lib
- **Rol en el sistema:** Lógica de órdenes y posiciones: ejecución BUY/SELL en Binance según decisión y confidence del agente, gestión de posiciones y P&L, y simulación pura de riesgo de trade.

## 2. Stack tecnológico

- TypeScript (Jest). Build de declaraciones vía `vite:dts` con `noPropertyAccessFromIndexSignature`: los accesos sobre index signatures van **con notación de corchetes** (`X['default']`), o el build emite TS4111.

## 3. Estructura y patrones

- Depende de: `libs/shared`, `libs/analysis`, `libs/data-fetcher`. Consumida por `apps/api`.
- **Todo lo agregado en el cycle-02 es aritmética determinista y pura: sin Prisma, sin Nest, sin LLM.** Esa pureza es lo que permite testear sizing, política de SELL y herramientas de ganancia sin BD ni credenciales — mantenerla.
- `src/lib/order-executor.ts` — ejecución de órdenes. `OrderExecutorPort` tiene **9 métodos**: los 3 originales + `placeLimitOrder`, `placeStopLossLimitOrder`, `placeProtectionOrder`, `getProtectionOrderStatus`, `cancelProtectionOrder` y `getOpenOrders` (este último existe para que el barrido de OCO zombie de la reconciliación conozca solo el port, sin importar `BinanceRestClient`). `LiveOrderExecutor` tipa su constructor **estructuralmente** en vez de importar el cliente: ese patrón se mantiene y `trading-engine` **nunca** pasa a depender de `data-fetcher` — el vocabulario común de órdenes (`ExchangeOrderState`/`ExchangeOrderStatus`) vive en `libs/shared`.
- `SandboxOrderExecutor` simula la protección en un `Map` en memoria y **el executor se construye nuevo en cada ciclo del processor**: la simulación existe para testear el contrato del port sin red, no para dar protección persistente en papel.
- `src/lib/sizing.ts` — `resolveTradeQuantity`: `ceilingQuantity` sale de `calculateTradeQuantity` (sin tocar) y `factor = min(aegis × verdict, forge)` con `clamp(·,0,1)` en **cada** factor ⇒ el techo `balance × maxTradePct` es inviolable **por construcción**, no por casos de test. Ante contradicción AEGIS vs FORGE gana el más conservador (`min`, nunca promedio ni producto).
- `src/lib/sell-policy.ts` — `evaluateSellPolicy`: toma de ganancia (idéntica al comportamiento previo) y corte de pérdida por señal, **fail-closed en cadena** (cualquier dato faltante o fuera de rango ⇒ `NONE`). Usa el **edge ratio** sobre `simulateTrade` con `stopLossPct: 0` —el costo de salirse ahora— y no el `riskRewardRatio`, que tiende a infinito al acercarse el precio al stop y recomendaría sostener justo cuando el corte importa.
- `src/lib/position-manager.ts` — funciones puras junto a la clase existente (`PositionManager` no se modificó): `updateTrailingStop` (cierra con `stopPrice = max(baseStop, candidate)`, lo que garantiza que el stop **nunca retrocede**), `shouldExitByTime`, `resolvePartialTakeProfit` (devuelve `null` si la porción vendida **o el remanente** quedan bajo `minNotional`; su `newStopPrice` es el breakeven **neto de las dos comisiones**, `entry × (1 + 2×TRADE_FEE_PCT)`) y `applyPartialExit` (no cierra la posición: baja `quantity`, acumula `realizedPnlDelta` y suma el fee).
- `src/lib/risk/` — simulación pura, exportada por el barrel:

  ```ts
  export function simulateTrade(input: TradeSimulationInput): TradeSimulationResult;
  export const SLIPPAGE_PCT_BY_ASSET: Readonly<Record<string, number>>; // BTC 0.0005, ETH 0.001, default 0.0015
  ```

  Función pura: sin Prisma, sin Nest, sin LLM — vive acá para que `OrderExecutor` pueda invocarla y para servir a backtests. Entrada tipada (`asset` base ya separado del quote, `price`/`quantity` numéricos): el llamador provee datos tipados, la lib no hace `Number(x) || 0` ni parseo del par por regex. La consume `evaluateSellPolicy` para calcular la fricción de salida.

## 4. Convenciones propias

- Tests: `pnpm nx test trading-engine`. El modo Sandbox/Testnet/Live se respeta siempre — nunca ejecutar órdenes Live sin TradingConfig explícito.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
