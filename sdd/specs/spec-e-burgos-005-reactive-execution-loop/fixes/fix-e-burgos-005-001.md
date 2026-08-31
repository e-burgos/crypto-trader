# FIX-e-burgos-005-001 — Una sola instancia de StreamHealthService por inyeccion, y un solo registro de TRADING_QUEUE

> Tipo: IMPROVEMENT | Severidad: medium | Estado: implemented | Creado: 2026-08-30 | Resuelto: 2026-08-30
> Spec: spec-e-burgos-005-reactive-execution-loop | Ciclo: cycle-01

## Problema

trading.controller.ts:61 construye StreamHealthService a mano con 3 de 6 argumentos, porque TradingModule no puede importar ReactiveModule sin el ciclo que architect §7.1 prohibe. Mover EP-015 a un controller propio de ReactiveModule sobre la misma ruta y volver obligatorio el constructor. Sin forwardRef. En el mismo cambio, hacer que TradingModule re-exporte BullModule y borrar el registerQueue de reactive.module.ts, para que Nest provea una unica Bull.Queue en vez de dos con sus dos pares de clientes ioredis. La falta de ese export es la causa de fondo de ambos.

## Justificacion del FIX GATE

Deuda declarada por el sdd-reviewer al cerrar el cycle-01 (cycle.json -> reviewer_report.follow_ups). No agrega comportamiento de usuario, endpoints ni schema: consolida atajos de cableado que el ciclo tomo para no expandir el alcance de sus tasks. Va por FIX GATE y no dentro del cycle-02, cuyo alcance declarado en la spec §3 es la reaccion empujada al exchange (LIMIT_MAKER de entrada, OCO de entrada, trailingDelta); mezclar refactors ahi le enturbiaria el alcance.

## Archivos afectados

- `apps/api/src/reactive/stream-health.controller.ts` (nuevo)
- `apps/api/src/trading/trading.controller.ts`
- `apps/api/src/trading/trading.module.ts`
- `apps/api/src/reactive/reactive.module.ts`
- `apps/api/src/reactive/stream-health.service.ts`
- `apps/api/src/reactive/stream-health.service.spec.ts`
- `apps/api/src/reactive/reactive-module-wiring.spec.ts`
- `apps/api/src/trading/trading.controller.bot-actions.spec.ts`

## Criterio de aceptacion

La suite de apps/api en verde y una sola instancia resuelta por DI para StreamHealthService y para la cola

## Resolucion — 2026-08-30

EP-015 se sirve desde `StreamHealthController`, declarado en `ReactiveModule` con
`@Controller('trading')` + `@Get('stream-health')`: la ruta publica no cambia y el grafo de modulos
de architect §7.1 queda intacto (`ReactiveModule -> TradingModule`, sin `forwardRef`).
`TradingController` ya no construye nada a mano y perdio la inyeccion de `REACTIVE_COORDINATION`
que solo existia para alimentar esa instancia paralela.

`StreamHealthService` recibe `gateway`, `marketStream` y `notifications` como parametros
obligatorios; desaparecieron las tres guardas de opcionalidad (`onModuleInit`,
`publishOwnedSymbols`, `notifyDegradedUsers`) y los tres accesos con `?.`.

`TradingModule` exporta `BullModule` y `ReactiveModule` ya no registra `TRADING_QUEUE`: queda un
unico `Bull.Queue` para la cola, con un solo par de clientes ioredis.

`reactive-module-wiring.spec.ts` verifica ahora que el controller resuelve por DI y que su
`StreamHealthService` es la MISMA instancia que expone el modulo — el candado del criterio de
aceptacion.

### Tests borrados (sintoma, no propiedad)

Tres casos de `stream-health.service.spec.ts` describian el comportamiento del servicio a medio
cablear, que era el atajo, no una propiedad del sistema:

- `does nothing when no MarketStreamService was wired (read-only instance)`
- `does nothing on init when no MarketStreamService was wired`
- `does nothing when no NotificationsService was wired`

### Verificacion

- `pnpm exec jest --config apps/api/jest.config.js apps/api/src` → 78 suites, 670 tests en verde
- `pnpm nx build api` → webpack compiled successfully
- `grep -rn "registerQueue" apps/api/src` → un solo registro de `TRADING_QUEUE`
  (`trading.module.ts`); los otros dos son `EVALUATION_QUEUE` y `DOCUMENT_PROCESSING_QUEUE`
- `grep -rn "new StreamHealthService" apps/api/src` → sin ocurrencias en `trading/`; quedan la
  `useFactory` de `reactive.module.ts` (composition root) y las construcciones de su unit test
