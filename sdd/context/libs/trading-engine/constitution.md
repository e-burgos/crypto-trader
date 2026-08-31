# Constitución — libs/trading-engine

> Versión 1.4 | Última actualización: cycle-01 | Fecha: 2026-08-30
> Fragmentos consolidados: spec-e-burgos-001 cycle-03 (2026-08-18) + spec-e-burgos-005 cycle-01 (2026-08-30)

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
- `src/lib/position-manager.ts` — funciones puras junto a la clase existente (`PositionManager` no se modificó): `updateTrailingStop` (cierra con `stopPrice = max(baseStop, candidate)`, lo que garantiza que el stop **nunca retrocede**), `shouldExitByTime`, `resolvePartialTakeProfit` (devuelve `null` si la porción vendida **o el remanente** quedan bajo `minNotional`; su `newStopPrice` es el breakeven **neto de las dos comisiones**, `entry × (1 + 2×TRADE_FEE_PCT)`), `applyPartialExit` (no cierra la posición: baja `quantity`, acumula `realizedPnlDelta` y suma el fee) y `resolveProtectionRearm(input): ProtectionRearmDecision` — decide `REARM` vs `NONE` con razón tipada (`DISABLED`, `SANDBOX`, `NOT_PROTECTED`, `NO_STOP`, `BELOW_THRESHOLD`); umbral `PROTECTION_REARM_MIN_STOP_DELTA_PCT` = 0.1 % sobre el stop vigente, rechaza valores no finitos o ≤ 0. **La lib solo decide** — cancelar y recolocar contra el exchange es orquestación de `apps/api` (`TradingProcessor.ensureNativeProtection`), que debe tratar la cancelación fallida como posición **desprotegida** y no recolocar con la OCO vieja todavía viva.
- **`src/lib/fast-path.ts` — `planFastPath(input): FastPathPlan`.** Compone las funciones ya existentes de `position-manager` (`updateTrailingStop`, `resolvePartialTakeProfit`, `resolveProtectionRearm`) y devuelve **una sola** acción de un set cerrado de cuatro: `HARD_STOP_EXIT | TRAILING_EXIT | PARTIAL_TAKE_PROFIT | PROTECTION_REARM`, o `NONE`. Dos invariantes que un cambio futuro no puede romper:
  - **No invoca `evaluateSellPolicy`.** El "stop duro" del fast path es el cruce del precio contra el stop efectivo, no el `LOSS_CUT` por señal de aquella función — son dos reglas distintas y mezclarlas metería la tesis del LLM en el camino de reflejos.
  - Devuelve siempre el `TrailingState` recalculado, **incluso con `action: 'NONE'`**, para que el llamador persista el `highWaterPrice` sin ejecutar nada.
- **`src/lib/risk/action-caps.ts` — `evaluateActionCaps` + `classifyActionExposure`.** `src/lib/risk/` deja de tener un solo archivo: junto a `trade-simulation.ts` vive el primer límite de frecuencia real del motor.
  - `classifyActionExposure(kind)` mapea `BotActionKind` a `INCREASING | REDUCING | NEUTRAL`. Es la **única** fuente de verdad de esa clasificación: `bot_actions` NO persiste una columna `exposure` a propósito, se deriva siempre de acá. Al agregar un `BotActionKind` hay que decidir su exposure explícitamente.
  - **Regla que no se puede relajar:** toda acción `REDUCING` (`SELL_FULL`, `SELL_PARTIAL`) sale `allowed` **antes de mirar cap alguno** (`REDUCING_EXPOSURE_EXEMPT`). Un cap nunca puede dejar a un bot atrapado dentro de una posición perdedora; los caps frenan el sobre-operar, no el salir.
  - Un cap devuelve `disposition: 'DEFERRED'` (volvé más tarde: hora/cooldown) o `'DISCARDED'` (no vuelvas: pérdida diaria). El llamador persiste esa distinción en `bot_actions.outcome`.
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
