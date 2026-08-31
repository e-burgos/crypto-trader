# FIX-e-burgos-005-004 — Acceso a datos fuera del controller y unificacion del credito de wallet sandbox

> Tipo: IMPROVEMENT | Severidad: medium | Estado: implemented | Creado: 2026-08-30 | Resuelto: 2026-08-30
> Spec: spec-e-burgos-005-reactive-execution-loop | Ciclo: cycle-01

## Problema

La query del ledger quedo en TradingController.listBotActionsForUser en vez de trading.service.ts, y obligo a inyectar PrismaService en el controller, que antes no lo tenia. Ademas el  de wallet SANDBOX inline de executeLLMSell duplica creditSandboxWallet, que ya vive en PositionActionService.

## Justificacion del FIX GATE

Deuda declarada por el sdd-reviewer al cerrar el cycle-01 (cycle.json -> reviewer_report.follow_ups). No agrega comportamiento de usuario, endpoints ni schema: consolida atajos de cableado que el ciclo tomo para no expandir el alcance de sus tasks. Va por FIX GATE y no dentro del cycle-02, cuyo alcance declarado en la spec §3 es la reaccion empujada al exchange (LIMIT_MAKER de entrada, OCO de entrada, trailingDelta); mezclar refactors ahi le enturbiaria el alcance.

## Archivos afectados

- `apps/api/src/trading/trading.controller.ts`
- `apps/api/src/trading/trading.service.ts`
- `apps/api/src/trading/trading.processor.ts`
- `apps/api/src/trading/position-action.service.ts`

## Criterio de aceptacion

La suite de apps/api en verde, sin PrismaService en el controller y con un solo credito de wallet sandbox

## Resolucion

`TradingController.listBotActionsForUser` se movio a `TradingService.getBotActions(userId, query)`,
junto a `getPositions`, `getTradeHistory` y `getDecisions`, que ya resolvian sus lecturas ahi. El
cuerpo de la query viajo sin cambios: mismo `where`, mismo `orderBy`, mismo `take: limit + 1`, mismo
`select` y el mismo calculo de `nextCursor`. El controller quedo con un solo parametro de
constructor (`tradingService`) y sin el import de `PrismaService` que la task habia agregado.

El aislamiento por usuario no se toco: `getBotActions` del controller sigue leyendo el `userId` de
`@CurrentUser()` y pasandoselo al servicio, y el servicio lo fija en el `where` antes de aplicar los
filtros del query. `trading.controller.bot-actions.spec.ts` sigue siendo la prueba de esa garantia y
sus siete casos y todas sus aserciones quedaron identicos: lo unico que cambio es el armado del mock, que ahora inyecta
el prisma mockeado en un `TradingService` real en vez de en el controller, de modo que el spec
recorre el camino completo controller → service → prisma.

El credito de wallet SANDBOX de `executeLLMSell` pasa a delegar en
`PositionActionService.creditSandboxWallet`, que dejo de ser privado. El bloque inline era
identico al metodo ya existente salvo por leer `pos.pair` donde el metodo recibe `currency`: mismo
`$transaction`, mismo `upsert` con `10_000 + proceeds - fee` en `create` e `increment` en `update`,
mismo `findUnique` dentro de la transaccion y el mismo `wallet:updated` por gateway. No quedaron
`$transaction` en `trading.processor.ts`. Los specs del procesador ya armaban su
`PositionActionService` con `createTradingProcessorCollaborators`, que le pasa el mismo prisma y el
mismo gateway que recibe el procesador, asi que las llamadas observadas por los mocks no cambiaron y
ningun spec necesito tocarse. El escaneo de fuente de
`trading.processor.reactive-gate.spec.ts` sigue contando 5 llamadas a `this.positionAction`: su
regex enumera los metodos del camino de salida y `creditSandboxWallet` no es uno de ellos.

## Verificacion

- `pnpm exec jest --config apps/api/jest.config.js apps/api/src` — 78 suites / 670 tests en verde, la misma cuenta que antes del cambio
- `pnpm nx build api` — compila
- `pnpm exec eslint` sobre los cinco archivos tocados — 0 errores (solo warnings `no-explicit-any` preexistentes)
- `grep -n "PrismaService" apps/api/src/trading/trading.controller.ts` — sin resultados
- `grep -n "\$transaction" apps/api/src/trading/trading.processor.ts` — sin resultados
