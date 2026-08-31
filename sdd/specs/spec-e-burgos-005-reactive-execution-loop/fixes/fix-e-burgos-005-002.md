# FIX-e-burgos-005-002 — La notificacion de degradacion no se pierde si falla la escritura

> Tipo: BUGFIX | Severidad: medium | Estado: implemented | Creado: 2026-08-30 | Resuelto: 2026-08-30
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

## Solucion aplicada

Marca optimista con reversion en el `catch` (no marcar-despues-de-resolver), en
`StreamHealthService.checkSustainedDegradation`:

```ts
this.notifiedDegradations.add(symbol);
try {
  await this.notifyDegradedUsers(symbol);
} catch (err) {
  this.notifiedDegradations.delete(symbol);
  throw err;
}
```

Por que esta y no marcar despues del `await`: entre el chequeo del umbral y la resolucion de la
escritura hay un intervalo de `await`. Marcar recien al resolver deja ahi una ventana en la que una
segunda pasada de `publishOwnedSymbols` (el intervalo de publicacion, u otra invocacion concurrente)
ve el simbolo todavia sin marcar y dispara una segunda notificacion — rompe el anti-spam que ya
estaba probado. Marcar antes del `await` cierra la ventana porque el `add` es sincronico dentro de la
misma pasada; el `catch` restituye el estado solo cuando la escritura efectivamente fallo, que es el
unico caso en el que el reintento hace falta. `degradedSinceMs` no se toca, asi que la pasada
siguiente ya supera el umbral y reintenta de inmediato. El `throw` se conserva para no cambiar la
propagacion actual del error (lo loguea el `.catch` del publicador).

## Archivos modificados

- `apps/api/src/reactive/stream-health.service.ts` — marca optimista + reversion en `catch`
- `apps/api/src/reactive/stream-health.service.spec.ts` — dos tests nuevos

## Verificacion

Tests agregados (ninguna asercion del test de anti-spam existente fue modificada):

1. `retries the notification on the next pass when the write rejects` — `findMany` rechaza una vez;
   la pasada que supera el umbral rechaza sin notificar, la siguiente notifica una sola vez y las
   posteriores no repiten.
2. `notifies once when two passes overlap while the write is still in flight` — dos pasadas
   concurrentes con la escritura pendiente producen una unica notificacion.

Comprobado por mutacion: revirtiendo el `try/catch` al codigo anterior, (1) falla
(`1 failed, 14 passed`); con el fix aplicado, 15/15.

```
$ pnpm exec jest --config apps/api/jest.config.js apps/api/src/reactive
Test Suites: 9 passed, 9 total
Tests:       89 passed, 89 total

$ pnpm exec jest --config apps/api/jest.config.js apps/api/src
Test Suites: 78 passed, 78 total
Tests:       671 passed, 671 total
```

## Decision del Reviewer

> [A completar por sdd-reviewer al cerrar el proximo ciclo]
>
> - [ ] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en proxima spec: SPEC-XXX
