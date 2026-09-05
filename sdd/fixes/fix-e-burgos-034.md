# FIX-e-burgos-034 — El guard de rango de la configuración avanzada sólo corta el submit en la edición, no en el alta

| Campo         | Valor                                                                 |
| ------------- | --------------------------------------------------------------------- |
| **ID**        | FIX-e-burgos-034                                                      |
| **Tipo**      | IMPROVEMENT                                                           |
| **Severidad** | low                                                                   |
| **Keyword**   | [IMPROVEMENT]                                                         |
| **Fecha**     | 2026-09-05                                                            |
| **Autor**     | e-burgos                                                              |
| **Estado**    | in-progress                                                           |
| **Spec**      | spec-e-burgos-009-agent-advanced-config-ui (follow-up del reviewer, cycle-02) |

## Problema

`use-advanced-draft.ts` expone `isWithinRanges` y `edit-agent-modal.tsx` hace early-return con él cuando algún campo avanzado quedó fuera de rango (D7 de spec-009 cycle-01). `new-agent-stepper-modal.tsx` no lo consume, así que el alta puede enviar un valor que la edición rechazaría.

## Justificación del bypass

Follow-up declarado por el reviewer de spec-009 cycle-02; asimetría de validación visible para el trader.

## Solución aplicada

Pendiente.

### Archivos modificados

- `apps/web/src/components/config/new-agent-stepper-modal.tsx`
- `apps/web/src/components/config/new-agent-stepper-modal.spec.tsx`

### Test de validación

- **Referencia:** pendiente.

### Decisión del Reviewer

> [A completar por sdd-reviewer al cerrar el ciclo]
>
> - [ ] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX

---
