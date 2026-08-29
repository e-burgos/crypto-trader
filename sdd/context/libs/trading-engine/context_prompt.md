# Context Prompt — libs/trading-engine

> Entry point para agentes que trabajen sobre `libs/trading-engine`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-03 | Fecha: 2026-08-18

- **Tipo:** lib
- **Estado:** proyecto pre-existente adoptado por el arnés SDD. **spec-e-burgos-001 cerrada (3 ciclos que tocaron esta lib)**. El cycle-01 sumó `src/lib/risk/simulateTrade()` sin cambiar comportamiento; el **cycle-02 sí cambia comportamiento de trading**: sizing modulado, política de SELL y herramientas de ganancia (trailing, parcial, salida por tiempo) como funciones puras, cableadas desde `apps/api`, y `OrderExecutorPort` extendido a 9 métodos (96 tests en verde). El **cycle-03** (último de la spec) cierra el follow-up de riesgo que cycle-02 dejó como degradación aceptada: `resolveProtectionRearm` decide el re-arme de la OCO nativa cuando el trailing o el breakeven mueven el stop — ver `constitution.md` §3.
- Rol: Lógica de órdenes y posiciones: ejecución BUY/SELL en Binance según decisión y confidence del agente, gestión de posiciones y P&L, y simulación pura de riesgo.
- Testear: `pnpm nx test trading-engine`. Lint: `pnpm nx lint trading-engine`.

## Qué sigue

- `resolvePartialTakeProfit` soporta **un solo escalón** (`partialExitCount > 0 ⇒ null`). Varios escalones de TP exigen cambiar esa guarda y decidir la progresión del stop entre escalones.
