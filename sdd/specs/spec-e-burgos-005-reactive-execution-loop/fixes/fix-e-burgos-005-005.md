# FIX-e-burgos-005-005 — Ampliar los escenarios congelados que ejercitan el harness de costo

> Tipo: IMPROVEMENT | Severidad: medium | Estado: implemented | Creado: 2026-08-30 | Resuelto: 2026-08-30
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

## Resolucion

Dos escenarios reactivos nuevos, en una lista separada de los 12 congelados:

- `level-break-under-price-threshold` — previous.close 59.800 -> close 60.090 (+0,485%, por debajo del 0,5% de `priceChangePct`, asi que `PRICE_MOVED` no se dispara) con soporte en 59.950. El camino interpolado confirma el lado -1 en el primer tick (0,250% de distancia, sobre el 0,2% de `levelConfirmDistancePct`) y el lado +1 en el tick 46, a NOW-55s: `LEVEL_BREAK`.
- `volume-spike-with-flat-price` — precio plano en 60.000 (ni `PRICE_MOVED` ni `LEVEL_BREAK`), `volume.current` 3.200 sobre `volume.average` 1.150. La vela horaria en curso cierra en `snapshotTakenAt`; el ratio normalizado por fraccion transcurrida (§12.1) cruza 2,5x en el tick 40, a NOW-165s: `VOLUME_SPIKE`.

Ambos adelantos caen dentro de `snapshotMaxAgeMs`, asi que el gate sigue sosteniendo en la corrida REACTIVE igual que en la BASELINE y ningun assert de CA-003 cambia de direccion.

`buildScenarioCandleAt` deriva la vela en curso de los dos unicos puntos que el escenario conoce, igual que `buildScenarioTicks` con el precio: acumulacion al ritmo de `volume.average` hasta el inicio de la ventana, e interpolacion lineal hasta `volume.current` en el snapshot. Con los volumenes de los 12 escenarios congelados el ratio va de 1,00x a 1,04x, muy por debajo de 2,5x, de modo que su comportamiento no cambia.

### Fixture compartida

Los escenarios nuevos NO entran en `SCENARIOS`: `llm-cost-harness.spec.ts` verifica CA-059 con conteos absolutos (12 escenarios, 5 sin senal, 7 con senal, 12 ids unicos) y CA-059 congela ese set por definicion. Se exportan en `REACTIVE_EVENT_SCENARIOS` y el harness reactivo consume `REACTIVE_HARNESS_SCENARIOS` (los 12 congelados + los 2 nuevos). El harness hermano queda intacto, sin aflojar ningun assert.

## Verificacion

- `pnpm exec jest --config apps/api/jest.config.js apps/api/src/orchestrator` -> 10 suites, 104 tests en verde (102 previos + 2 asserts nuevos), con el harness hermano incluido.
- No-vacuidad: 3 adelantos sobre 14 escenarios — `broken-price-spike` (PRICE_MOVED), `level-break-under-price-threshold` (LEVEL_BREAK), `volume-spike-with-flat-price` (VOLUME_SPIKE).
- Assert nuevo por tipo: cada escenario que adelanta matchea el tipo declarado en `EXPECTED_ADVANCE_EVENT`, y el conjunto de tipos ejercitados es exactamente los tres.

## Decisión del Reviewer

> Validado el 2026-09-04 en la limpieza de deuda de proceso post-cierre de ciclos (los ciclos que debían validarlo ya estaban cerrados).
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> **Evidencia.** Fix mergeado en `main` (36a89c135). Suite de `apps/api` en verde sobre ese commit: 101 suites, 930 tests.
> Referencia de test declarada al resolverlo: El harness reactivo con al menos 3 escenarios que adelantan, cubriendo los tres tipos de evento, y el harness hermano en verde
