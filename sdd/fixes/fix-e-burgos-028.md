# FIX-e-burgos-028 — Las notificaciones de entradas no traen configId ni entryOrderId: el deep-link no puede abrir la entrada exacta

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-028                                   |
| **Tipo**      | IMPROVEMENT                                   |
| **Severidad** | low                                   |
| **Keyword**   | [IMPROVEMENT]                                 |
| **Fecha**     | 2026-09-03                              |
| **Autor**     | e-burgos                                |
| **Estado**    | in-progress                             |
| **Spec**      | spec-e-burgos-009-agent-advanced-config-ui (recomendacion del architect, cycle-02) |

## Problema

Los JSON de notificacion entryOrderPlaced y entryOrderFilled (apps/api/src/trading/entry-order.service.ts) no incluyen configId ni entryOrderId; solo entryOrderMissing trae entryOrderId. La vista de entradas de spec-009 cycle-02 solo puede enlazar por estado. Agregar ambos ids a los tres mensajes (aditivo; apps/web ignora claves extra).

## Justificación del bypass

Cambio aditivo en tres JSON de notificacion; hace ejecutable el criterio original de US-2-010 de spec-009 cycle-02.

### Archivos a modificar

- `apps/api/src/trading/entry-order.service.ts`
- `apps/api/src/trading/entry-order.service.spec.ts`

### Test de validación

- **Referencia:** entry-order.service.spec.ts: los tres mensajes de notificacion incluyen configId y entryOrderId; las claves previas se conservan.

### Decisión del Reviewer

> [A completar por sdd-reviewer al cerrar el ciclo]
>
> - [ ] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
