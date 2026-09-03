# FIX-e-burgos-029 — El select de listEntryOrders no esta atado al wire compartido: una deriva no falla en typecheck

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-029                                   |
| **Tipo**      | IMPROVEMENT                                   |
| **Severidad** | low                                   |
| **Keyword**   | [IMPROVEMENT]                                 |
| **Fecha**     | 2026-09-03                              |
| **Autor**     | e-burgos                                |
| **Estado**    | in-progress                             |
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

> [A completar por sdd-reviewer al cerrar el ciclo]
>
> - [ ] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
