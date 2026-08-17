# spec-e-burgos-001 cycle-01 — 2026-08-17

## Estado

La lib suma su primera pieza de **simulación de trade**: `simulateTrade()`, rescatada de la
`TradeSimulationTool` de `apps/api` (subsistema podado en este ciclo) y reescrita como función pura.
El comportamiento de ejecución de la lib no cambió — el ciclo fue de fundación, no de trading.

## Estructura

Directorio nuevo `src/lib/risk/`, exportado por el barrel:

```ts
export function simulateTrade(input: TradeSimulationInput): TradeSimulationResult;
export const SLIPPAGE_PCT_BY_ASSET: Readonly<Record<string, number>>; // BTC 0.0005, ETH 0.001, default 0.0015
```

- **Función pura**: sin Prisma, sin Nest, sin LLM. Vive acá y no en `apps/api` justamente para que el
  `OrderExecutor` (`src/lib/order-executor.ts`) pueda invocarla y para que sirva a backtests.
- Entrada tipada (`asset` base ya separado del quote, `price`/`quantity` numéricos): desaparecieron
  el `Number(x) || 0` defensivo y el parseo del par por regex que tenía la tool original — el
  llamador ya tiene los datos tipados.
- Devuelve además `riskRewardRatio`, que la tool no calculaba: es lo que el cycle-02 necesita para la
  política de SELL.
- `SLIPPAGE_PCT_BY_ASSET` se lee con notación de corchetes (`['default']`): la lib compila con
  `noPropertyAccessFromIndexSignature` y el acceso por punto emite TS4111 en la generación de
  declaraciones de `vite:dts`.

## Dependencias

Ninguna nueva. `apps/api` pasa a consumir la lib para simulación de riesgo.

## Qué sigue

`simulateTrade` está testeada pero **todavía sin llamadores en producción**: el cycle-02 la cablea
dentro de `OrderExecutor` (hoy `order-executor.ts:164-173` hace la aritmética inline).
