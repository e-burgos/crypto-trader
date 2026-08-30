# spec-e-burgos-005 cycle-01 — 2026-08-30

## Estado

Dos funciones puras nuevas sostienen el loop reactivo de `apps/api`. Ninguna hace I/O: reciben
snapshots ya construidos y devuelven un plan o un veredicto, igual que `evaluateSellPolicy` y
`position-manager`. 134 tests en verde (`pnpm nx test trading-engine`).

`src/lib/risk/` deja de tener un solo archivo: junto a `trade-simulation.ts` ahora vive
`action-caps.ts`, el primer límite de frecuencia real del motor.

## Estructura

- **`src/lib/fast-path.ts` — `planFastPath(input): FastPathPlan`.** Compone las funciones ya
  existentes de `position-manager` (`updateTrailingStop`, `resolvePartialTakeProfit`,
  `resolveProtectionRearm`) y devuelve **una sola** acción de un set cerrado de cuatro:
  `HARD_STOP_EXIT | TRAILING_EXIT | PARTIAL_TAKE_PROFIT | PROTECTION_REARM`, o `NONE`. Dos
  invariantes que un cambio futuro no puede romper:
  - **No invoca `evaluateSellPolicy`.** El "stop duro" del fast path es el cruce del precio
    contra el stop efectivo, no el `LOSS_CUT` por señal de aquella función — son dos reglas
    distintas y mezclarlas metería la tesis del LLM en el camino de reflejos.
  - Devuelve siempre el `TrailingState` recalculado, incluso con `action: 'NONE'`, para que el
    llamador persista el `highWaterPrice` sin ejecutar nada.
- **`src/lib/risk/action-caps.ts` — `evaluateActionCaps` + `classifyActionExposure`.**
  - `classifyActionExposure(kind)` mapea `BotActionKind` a `INCREASING | REDUCING | NEUTRAL`.
    Es la **única** fuente de verdad de esa clasificación: `bot_actions` NO persiste una columna
    `exposure` a propósito, se deriva siempre de aquí.
  - **Regla que no se puede relajar:** toda acción `REDUCING` (`SELL_FULL`, `SELL_PARTIAL`) sale
    `allowed` antes de mirar cap alguno (`REDUCING_EXPOSURE_EXEMPT`). Un cap nunca puede dejar a
    un bot atrapado dentro de una posición perdedora; los caps frenan el sobre-operar, no el
    salir. Al agregar un `BotActionKind` nuevo hay que decidir su exposure explícitamente.
  - Un cap devuelve `disposition: 'DEFERRED'` (volvé más tarde: hora/cooldown) o `'DISCARDED'`
    (no vuelvas: pérdida diaria). El llamador persiste esa distinción en `bot_actions.outcome`.
- Barrel `src/lib/index.ts`: exporta las dos funciones y sus tipos (`FastPathPlan`,
  `ActionCapsDecision`, `BotActionKind`, `ActionExposure`, `ActionCapId`, ...).

## Dependencias

Ninguna nueva. `fast-path.ts` solo importa de `./position-manager`; `action-caps.ts` no importa
nada.

## Qué sigue

- `resolvePartialTakeProfit` sigue soportando **un solo escalón** (`partialExitCount > 0 =>
  null`) y este ciclo no lo tocó (decisión explícita del architect §12.7). Varios escalones
  exigen además decidir la progresión del stop entre escalones.
