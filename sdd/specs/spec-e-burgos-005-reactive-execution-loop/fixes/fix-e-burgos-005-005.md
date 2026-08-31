# FIX-e-burgos-005-005 — Ampliar los escenarios congelados que ejercitan el harness de costo

> Tipo: IMPROVEMENT | Severidad: medium | Estado: pending | Creado: 2026-08-30
> Spec: spec-e-burgos-005-reactive-execution-loop | Ciclo: cycle-01

## Problema

De los 12 escenarios congelados, solo broken-price-spike produce un adelanto: los otros 11 tienen extremos estables en precio. La garantia de CA-003 se apoya en un unico punto de datos y el chequeo de no-vacuidad se cumple con lo justo. Agregar al menos un escenario que dispare LEVEL_BREAK y uno que dispare VOLUME_SPIKE, coordinado con el harness hermano de costo de LLM que comparte la fixture.

## Justificacion del FIX GATE

Deuda declarada por el sdd-reviewer al cerrar el cycle-01 (cycle.json -> reviewer_report.follow_ups). No agrega comportamiento de usuario, endpoints ni schema: consolida atajos de cableado que el ciclo tomo para no expandir el alcance de sus tasks. Va por FIX GATE y no dentro del cycle-02, cuyo alcance declarado en la spec §3 es la reaccion empujada al exchange (LIMIT_MAKER de entrada, OCO de entrada, trailingDelta); mezclar refactors ahi le enturbiaria el alcance.

## Archivos afectados

- `apps/api/src/orchestrator/cost-harness/scenarios.fixture.ts`
- `apps/api/src/orchestrator/cost-harness/reactive-cost-harness.spec.ts`

## Criterio de aceptacion

El harness reactivo con al menos 3 escenarios que adelantan, cubriendo los tres tipos de evento, y el harness hermano en verde
