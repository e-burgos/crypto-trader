# FIX-e-burgos-005-002 — La notificacion de degradacion no se pierde si falla la escritura

> Tipo: BUGFIX | Severidad: medium | Estado: pending | Creado: 2026-08-30
> Spec: spec-e-burgos-005-reactive-execution-loop | Ciclo: cycle-01

## Problema

StreamHealthService.checkSustainedDegradation marca notifiedDegradations ANTES de que notifyDegradedUsers resuelva. Un fallo de prisma.tradingConfig.findMany pierde el aviso de esa degradacion hasta que el simbolo se recupere y vuelva a degradarse. Marcar despues de que resuelva, o revertir la marca si rechaza.

## Justificacion del FIX GATE

Deuda declarada por el sdd-reviewer al cerrar el cycle-01 (cycle.json -> reviewer_report.follow_ups). No agrega comportamiento de usuario, endpoints ni schema: consolida atajos de cableado que el ciclo tomo para no expandir el alcance de sus tasks. Va por FIX GATE y no dentro del cycle-02, cuyo alcance declarado en la spec §3 es la reaccion empujada al exchange (LIMIT_MAKER de entrada, OCO de entrada, trailingDelta); mezclar refactors ahi le enturbiaria el alcance.

## Archivos afectados

- `apps/api/src/reactive/stream-health.service.ts`
- `apps/api/src/reactive/stream-health.service.spec.ts`

## Criterio de aceptacion

Test que fuerza el rechazo de la escritura y verifica que la siguiente pasada vuelve a intentar la notificacion
