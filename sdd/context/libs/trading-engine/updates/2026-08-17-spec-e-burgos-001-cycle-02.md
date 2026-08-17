# spec-e-burgos-001 cycle-02 — 2026-08-17

## Estado

- Segundo ciclo SDD. A diferencia del cycle-01 (fundación), **este sí cambia comportamiento de
  trading** — pero todo lo nuevo de la lib es aritmética determinista y pura: sin Prisma, sin
  Nest, sin LLM. Esa pureza es lo que hace que los CA de sizing, política de SELL y herramientas
  de ganancia sean tests unitarios sin BD ni credenciales. 96 tests en verde.
- `resuelve: context_prompt.md §Qué sigue "simulateTrade está testeada pero todavía sin llamadores
  en producción"` — la llama `evaluateSellPolicy` para calcular la fricción de salida.
- `resuelve: context_prompt.md §Qué sigue "Cycle-02: sizing modulado, trailing stop, take-profit
  escalonado y salida por tiempo"` — implementados como funciones puras, cableadas desde
  `apps/api`.

## Estructura

- **`src/lib/sizing.ts` — `resolveTradeQuantity`.** `ceilingQuantity` sale de
  `calculateTradeQuantity` (sin tocar); `factor = min(aegis × verdict, forge)` con `clamp(·,0,1)`
  en **cada** factor ⇒ `effectiveFactor ∈ [0,1]` ⇒ el techo `balance × maxTradePct` es inviolable
  **por construcción**, no por casos de test. Ante contradicción AEGIS vs FORGE gana el más
  conservador (`min`, nunca promedio ni producto). `REDUCE` es un factor, no un corte; FORGE
  `skip` ⇒ factor 0 con `blockedBy: 'FORGE_SKIP'`, distinto de `AEGIS_BLOCK`. `floor8` idéntico
  al redondeo de `calculateTradeQuantity`.
- **`src/lib/sell-policy.ts` — `evaluateSellPolicy`.** Dos caminos independientes: toma de
  ganancia (`profitPct >= minProfitPct`, idéntico al comportamiento previo) y corte de pérdida por
  señal. Este último es **fail-closed en cadena**: `lossCutEnabled` apagado, confianza nula / no
  finita / fuera de `[0,1]`, posición no en pérdida, pérdida bajo `lossCutMinLossPct`, confianza
  bajo el umbral o `edgeRatio` bajo el mínimo ⇒ `NONE`. Nunca se abre una venta en pérdida por un
  dato faltante.
- **Por qué el edge ratio y no el `riskRewardRatio`:** con `stopLossPct: 0`, `simulateTrade`
  devuelve en `downsideUsd` exactamente el costo de salirse ahora (fee + slippage). El
  `riskRewardRatio` del tramo restante hasta TP/SL tiende a infinito a medida que el precio se
  acerca al stop, o sea recomendaría sostener justo cuando el corte importa. La regla adoptada:
  cortar antes del stop solo si lo que ahorro supera N veces lo que me cuesta salir.
- **`src/lib/position-manager.ts` — funciones puras nuevas** junto a la clase existente
  (`PositionManager` no se modificó): `updateTrailingStop`, `shouldExitByTime`,
  `resolvePartialTakeProfit`, `applyPartialExit`.
  - `updateTrailingStop` cierra con `stopPrice = max(baseStop, candidate)`: el `max` es lo que
    garantiza que el stop **nunca retrocede**, ni siquiera cuando el precio cae. `highWaterPrice`
    se refresca aunque el trailing esté apagado.
  - `resolvePartialTakeProfit` devuelve `null` (parcial omitido) si la porción vendida o **el
    remanente** quedan bajo `minNotional`: dejar un resto invendible es peor que no vender. Su
    `newStopPrice` es el breakeven **neto de las dos comisiones** (`entry × (1 + 2×TRADE_FEE_PCT)`),
    no el entry pelado — y el caller es quien aplica el `max` contra el stop vigente para que el
    parcial nunca baje un stop ya trailed.
  - `applyPartialExit` **no cierra** la posición: baja `quantity`, acumula `realizedPnlDelta` y
    suma el fee.
- **`src/lib/order-executor.ts` — `OrderExecutorPort` pasa de 3 a 9 métodos:** suma
  `placeLimitOrder`, `placeStopLossLimitOrder`, `placeProtectionOrder`,
  `getProtectionOrderStatus`, `cancelProtectionOrder` y `getOpenOrders`. El noveno
  (`getOpenOrders`) no estaba en el diseño y se agregó para que el barrido de OCO zombie de la
  reconciliación conozca **solo el port** en vez de importar `BinanceRestClient`: la inversión de
  dependencia se mantiene.
  - `SandboxOrderExecutor` simula la protección en un `Map` en memoria (mueve `free → locked`,
    resuelve FILLED/ACTIVE/MISSING contra el precio seteado). **El executor se construye nuevo en
    cada ciclo del processor**, así que ese `Map` no sobrevive: la simulación existe para testear
    el contrato del port sin red, no para dar protección persistente en papel. Por eso
    `nativeProtectionEnabled` se ignora en modo SANDBOX.
  - `createTradeRecord` suma `decisionId?: string | null`.
- Los tipos `ExchangeOrderState` / `ExchangeOrderStatus` se consumen desde `libs/shared`, no desde
  `libs/data-fetcher`: es lo que evita que `trading-engine` pase a depender de `data-fetcher`. No
  crear esa dependencia entre libs — `LiveOrderExecutor` tipa su constructor estructuralmente en
  vez de importar `BinanceRestClient`, y ese patrón se mantiene.

## Dependencias

- Sin dependencias externas nuevas. `libs/shared` (tipos de orden) sigue siendo la única.

## Qué sigue

- No hay función que decida el re-arme de la OCO cuando el trailing mueve el stop: hoy el caller
  (`apps/api`) degrada a polling. Si cycle-03 lo implementa, el umbral de 0.1 % sobre el stop
  vigente para no recolocar la orden en cada tick es candidato natural a vivir acá como función
  pura.
- `resolvePartialTakeProfit` soporta **un solo escalón** (`partialExitCount > 0 ⇒ null`). Varios
  escalones de TP exigen cambiar esa guarda y decidir la progresión del stop entre escalones.
