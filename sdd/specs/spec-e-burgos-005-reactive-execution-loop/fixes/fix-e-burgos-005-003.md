# FIX-e-burgos-005-003 — Dependencias obligatorias en TradingProcessor y eliminacion de PassthroughActionGate

> Tipo: IMPROVEMENT | Severidad: medium | Estado: pending | Creado: 2026-08-30
> Spec: spec-e-burgos-005-reactive-execution-loop | Ciclo: cycle-01

## Problema

positionAction, coordination y actionGate son opcionales en el constructor solo para no tocar los mocks de prisma de 11 specs preexistentes. El fallback de actionGate es un PassthroughActionGate que ejecuta todo y devuelve EXECUTED, dentro de la clase cuyo punto es que los caps no se puedan eludir. Hoy es inalcanzable por DI (Nest falla la resolucion si falta el provider), pero sigue alcanzable desde cualquier construccion manual. Dar a los specs una factoria de mock de prisma compartida, volver obligatorios los tres parametros y borrar PassthroughActionGate.

## Justificacion del FIX GATE

Deuda declarada por el sdd-reviewer al cerrar el cycle-01 (cycle.json -> reviewer_report.follow_ups). No agrega comportamiento de usuario, endpoints ni schema: consolida atajos de cableado que el ciclo tomo para no expandir el alcance de sus tasks. Va por FIX GATE y no dentro del cycle-02, cuyo alcance declarado en la spec §3 es la reaccion empujada al exchange (LIMIT_MAKER de entrada, OCO de entrada, trailingDelta); mezclar refactors ahi le enturbiaria el alcance.

## Archivos afectados

- `apps/api/src/trading/trading.processor.ts`

## Criterio de aceptacion

Los 11 specs de trading en verde con la factoria compartida y sin ningun parametro opcional en el constructor
