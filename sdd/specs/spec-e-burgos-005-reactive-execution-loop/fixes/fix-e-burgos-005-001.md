# FIX-e-burgos-005-001 — Una sola instancia de StreamHealthService por inyeccion, y un solo registro de TRADING_QUEUE

> Tipo: IMPROVEMENT | Severidad: medium | Estado: pending | Creado: 2026-08-30
> Spec: spec-e-burgos-005-reactive-execution-loop | Ciclo: cycle-01

## Problema

trading.controller.ts:61 construye StreamHealthService a mano con 3 de 6 argumentos, porque TradingModule no puede importar ReactiveModule sin el ciclo que architect §7.1 prohibe. Mover EP-015 a un controller propio de ReactiveModule sobre la misma ruta y volver obligatorio el constructor. Sin forwardRef. En el mismo cambio, hacer que TradingModule re-exporte BullModule y borrar el registerQueue de reactive.module.ts, para que Nest provea una unica Bull.Queue en vez de dos con sus dos pares de clientes ioredis. La falta de ese export es la causa de fondo de ambos.

## Justificacion del FIX GATE

Deuda declarada por el sdd-reviewer al cerrar el cycle-01 (cycle.json -> reviewer_report.follow_ups). No agrega comportamiento de usuario, endpoints ni schema: consolida atajos de cableado que el ciclo tomo para no expandir el alcance de sus tasks. Va por FIX GATE y no dentro del cycle-02, cuyo alcance declarado en la spec §3 es la reaccion empujada al exchange (LIMIT_MAKER de entrada, OCO de entrada, trailingDelta); mezclar refactors ahi le enturbiaria el alcance.

## Archivos afectados

- `apps/api/src/trading/trading.controller.ts`
- `apps/api/src/trading/trading.module.ts`
- `apps/api/src/reactive/reactive.module.ts`
- `apps/api/src/reactive/stream-health.service.ts`

## Criterio de aceptacion

La suite de apps/api en verde y una sola instancia resuelta por DI para StreamHealthService y para la cola
