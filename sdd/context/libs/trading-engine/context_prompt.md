# Context Prompt — libs/trading-engine

> Entry point para agentes que trabajen sobre `libs/trading-engine`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-02 | Fecha: 2026-08-17

- **Tipo:** lib
- **Estado:** proyecto pre-existente adoptado por el arnés SDD. **2 ciclos SDD completados** (spec-e-burgos-001). El cycle-01 sumó `src/lib/risk/simulateTrade()` sin cambiar comportamiento; el **cycle-02 sí cambia comportamiento de trading**: sizing modulado, política de SELL y herramientas de ganancia (trailing, parcial, salida por tiempo) como funciones puras, cableadas desde `apps/api`, y `OrderExecutorPort` extendido a 9 métodos. 96 tests en verde.
- Rol: Lógica de órdenes y posiciones: ejecución BUY/SELL en Binance según decisión y confidence del agente, gestión de posiciones y P&L, y simulación pura de riesgo.
- Testear: `pnpm nx test trading-engine`. Lint: `pnpm nx lint trading-engine`.

## Qué sigue

- **No hay función que decida el re-arme de la OCO cuando el trailing mueve el stop** — hoy el caller (`apps/api`) degrada a polling. Si se implementa, el umbral de 0.1 % sobre el stop vigente para no recolocar la orden en cada tick es candidato natural a vivir acá como función pura.
- `resolvePartialTakeProfit` soporta **un solo escalón** (`partialExitCount > 0 ⇒ null`). Varios escalones de TP exigen cambiar esa guarda y decidir la progresión del stop entre escalones.
