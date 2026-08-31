# FIX-e-burgos-005-003 — Dependencias obligatorias en TradingProcessor y eliminacion de PassthroughActionGate

> Tipo: IMPROVEMENT | Severidad: medium | Estado: implemented | Creado: 2026-08-30 | Resuelto: 2026-08-30
> Spec: spec-e-burgos-005-reactive-execution-loop | Ciclo: cycle-01

## Problema

positionAction, coordination y actionGate son opcionales en el constructor solo para no tocar los mocks de prisma de 11 specs preexistentes. El fallback de actionGate es un PassthroughActionGate que ejecuta todo y devuelve EXECUTED, dentro de la clase cuyo punto es que los caps no se puedan eludir. Hoy es inalcanzable por DI (Nest falla la resolucion si falta el provider), pero sigue alcanzable desde cualquier construccion manual. Dar a los specs una factoria de mock de prisma compartida, volver obligatorios los tres parametros y borrar PassthroughActionGate.

## Justificacion del FIX GATE

Deuda declarada por el sdd-reviewer al cerrar el cycle-01 (cycle.json -> reviewer_report.follow_ups). No agrega comportamiento de usuario, endpoints ni schema: consolida atajos de cableado que el ciclo tomo para no expandir el alcance de sus tasks. Va por FIX GATE y no dentro del cycle-02, cuyo alcance declarado en la spec §3 es la reaccion empujada al exchange (LIMIT_MAKER de entrada, OCO de entrada, trailingDelta); mezclar refactors ahi le enturbiaria el alcance.

## Archivos afectados

- `apps/api/src/trading/trading.processor.ts`
- `apps/api/src/trading/__mocks__/trading-processor-deps.ts` (nuevo)
- Los 12 specs de `apps/api/src/trading/trading.processor.*.spec.ts`

## Criterio de aceptacion

Los 11 specs de trading en verde con la factoria compartida y sin ningun parametro opcional en el constructor

## Resolucion

Los tres parametros (`positionAction`, `coordination`, `actionGate`) son ahora obligatorios y
`PassthroughActionGate` fue eliminado junto con la interfaz `ActionGatePort` que solo existia para
tiparlo. `coordination` conserva `@Inject(REACTIVE_COORDINATION)` y pierde `@Optional()`;
`ReactiveCoordinationModule` ya provee el token en `TradingModule`, asi que la resolucion por DI no
cambia.

Los specs comparten `createTradingPrismaMock` y `createTradingProcessorCollaborators`
(`apps/api/src/trading/__mocks__/trading-processor-deps.ts`). La factoria de prisma solo agrega
`tradingConfig.findUniqueOrThrow` — metodo que unicamente lee `ActionGateService` — resolviendo a un
config con `reactiveLoopEnabled: false`, de modo que el gate real toma su rama de passthrough
declarada en architect.md §3.4 paso 1 y el comportamiento observado por los specs no cambia. La
factoria de colaboradores arma el `PositionActionService` y la `DisabledReactiveCoordination` que
antes construia el fallback del constructor, con el mismo prisma/gateway/notifications.

Ninguna asercion preexistente cambio. El unico texto tocado fuera del armado de mocks es el titulo
del test de `trading.processor.reactive-window.spec.ts` que describia el fallback eliminado: sus
`expect` quedaron identicos y ahora recibe la misma `DisabledReactiveCoordination` de forma explicita.

## Verificacion

- `pnpm exec jest --config apps/api/jest.config.js apps/api/src/trading` — 20 suites / 127 tests, igual que antes del cambio
- `pnpm exec jest --config apps/api/jest.config.js apps/api/src` — 78 suites / 670 tests en verde
- `pnpm nx build api --skip-nx-cache` — compila
- `grep -rn "PassthroughActionGate" apps/api/src` — sin resultados
