# FIX-e-burgos-034 — El guard de rango de la configuración avanzada sólo corta el submit en la edición, no en el alta

| Campo         | Valor                                                                 |
| ------------- | --------------------------------------------------------------------- |
| **ID**        | FIX-e-burgos-034                                                      |
| **Tipo**      | IMPROVEMENT                                                           |
| **Severidad** | low                                                                   |
| **Keyword**   | [IMPROVEMENT]                                                         |
| **Fecha**     | 2026-09-05                                                            |
| **Autor**     | e-burgos                                                              |
| **Estado**    | validated                                                             |
| **Spec**      | spec-e-burgos-009-agent-advanced-config-ui (follow-up del reviewer, cycle-02) |

## Problema

`use-advanced-draft.ts` expone `isWithinRanges` y `edit-agent-modal.tsx` hace early-return con él cuando algún campo avanzado quedó fuera de rango (D7 de spec-009 cycle-01). `new-agent-stepper-modal.tsx` no lo consume, así que el alta puede enviar un valor que la edición rechazaría.

## Justificación del bypass

Follow-up declarado por el reviewer de spec-009 cycle-02; asimetría de validación visible para el trader.

## Solución aplicada

`handleSubmit` del stepper hace el mismo early-return silencioso que `handleSave` de la edición cuando
`isWithinRanges` es falso, tomándolo del `useAdvancedDraft` que el stepper ya usaba. Sin texto nuevo ni
locales: la edición tampoco muestra mensaje. Nota: los controles clampean todo valor numérico a su rango
antes de llegar al draft, así que hoy el guard es defensivo; protege el submit si un control futuro deja
pasar un valor fuera de rango. Fix puramente correctivo: sin cambios de contexto.

### Archivos modificados

- `apps/web/src/components/config/new-agent-stepper-modal.tsx`
- `apps/web/src/components/config/new-agent-stepper-modal.spec.tsx`

### Test de validación

- **Referencia:** `new-agent-stepper-modal.spec.tsx` → `blocks the create submit when an advanced field is out of range` y
  `submits normally when an advanced numeric field is changed to an in-range value`. `pnpm nx test web -- new-agent-stepper-modal` 4/4;
  `pnpm nx typecheck web` OK; lint sin warnings nuevos.

### Decisión del Reviewer

> Validado el 2026-09-05 en el main loop: tests reproducidos en verde y diff de dos líneas revisado.
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX

---
