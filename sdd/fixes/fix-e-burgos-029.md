# FIX-e-burgos-029 — El select de listEntryOrders no esta atado al wire compartido: una deriva no falla en typecheck

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-029                                   |
| **Tipo**      | IMPROVEMENT                                   |
| **Severidad** | low                                   |
| **Keyword**   | [IMPROVEMENT]                                 |
| **Fecha**     | 2026-09-03                              |
| **Autor**     | e-burgos                                |
| **Estado**    | validated                               |
| **Spec**      | spec-e-burgos-009-agent-advanced-config-ui (recomendacion del architect, cycle-02) |

## Problema

TradingService.listEntryOrders (apps/api/src/trading/trading.service.ts) proyecta 24 campos con un select literal sin relacion de tipos con el wire de EP-017 que libs/shared publica en spec-009 cycle-02. Un satisfies (o el patron implements + ExactKeys de cycle-01) hace que agregar o quitar un campo en un solo lado falle en pnpm typecheck:api.

## Justificación del bypass

Mismo mecanismo de no-deriva que cycle-01 aplico al DTO de configuracion; un tipo y una anotacion.

### Archivos a modificar

- `apps/api/src/trading/trading.service.ts`

### Test de validación

- **Referencia:** pnpm typecheck:api falla al agregar una clave al select que no exista en el wire (probe revertido) y pasa en el estado final.

### Decisión del Reviewer

> Cerrado por el sdd-reviewer al cerrar spec-e-burgos-009 cycle-02 (2026-09-04).
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> **Evidencia — probe ejecutado y revertido por el reviewer.** El fix extrajo el `select` de
> `listEntryOrders` a `ENTRY_ORDER_SELECT satisfies Record<EntryOrderWireField, true>` con
> `AssertNoKeyDrift` (`trading.service.ts:104-137`), mismo objeto en runtime. Para comprobar que la
> protección es real y no decorativa, agregué `bogusDriftProbe` **sólo en `libs/shared`**
> (`ENTRY_ORDER_WIRE_FIELDS` + `EntryOrderWire`):
>
> - `pnpm typecheck:api` falla con `trading.service.ts(132,3): error TS1360` (el `satisfies` del
>   select) y `trading.service.ts(135,3): error TS2344: Type '"bogusDriftProbe"' does not satisfy
>   the constraint 'never'` (el `AssertNoKeyDrift`).
> - `pnpm nx typecheck web` falla además en `fixtures.ts:11` (`TS2322`) y `fixtures.ts:37`
>   (`TS1360`), así que la deriva tampoco pasa desapercibida del lado de la SPA.
>
> Revertido: `git status` limpio y `pnpm typecheck:api` exit 0. Commit `c01504f3`.
> Sin seguimiento pendiente.
