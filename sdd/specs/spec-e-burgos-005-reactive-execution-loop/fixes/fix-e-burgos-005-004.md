# FIX-e-burgos-005-004 — Acceso a datos fuera del controller y unificacion del credito de wallet sandbox

> Tipo: IMPROVEMENT | Severidad: medium | Estado: pending | Creado: 2026-08-30
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
