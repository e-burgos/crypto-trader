# Context Prompt — libs/trading-engine

> Entry point para agentes que trabajen sobre `libs/trading-engine`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-01 | Fecha: 2026-08-17

- **Tipo:** lib
- **Estado:** proyecto pre-existente adoptado por el arnés SDD. **1 ciclo SDD completado** (spec-e-burgos-001 cycle-01): sumó `src/lib/risk/simulateTrade()`, rescatada de la `TradeSimulationTool` podada en `apps/api` y reescrita como función pura. El comportamiento de ejecución no cambió — el cycle-01 fue de fundación, no de trading.
- Rol: Lógica de órdenes y posiciones: ejecución BUY/SELL en Binance según decisión y confidence del agente, gestión de posiciones y P&L, y simulación pura de riesgo.
- Testear: `pnpm nx test trading-engine`. Lint: `pnpm nx lint trading-engine`.

## Qué sigue

- `simulateTrade` está testeada pero **todavía sin llamadores en producción**: el cycle-02 la cablea dentro de `OrderExecutor` (hoy `order-executor.ts:164-173` hace la aritmética de sizing inline).
- Cycle-02: sizing modulado (`maxTradePct` como techo × `positionSizeMultiplier` de AEGIS × sizing de FORGE), trailing stop, take-profit escalonado y salida por tiempo.
