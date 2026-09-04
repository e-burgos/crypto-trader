# FIX-e-burgos-028 — Las notificaciones de entradas no traen configId ni entryOrderId: el deep-link no puede abrir la entrada exacta

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-028                                   |
| **Tipo**      | IMPROVEMENT                                   |
| **Severidad** | low                                   |
| **Keyword**   | [IMPROVEMENT]                                 |
| **Fecha**     | 2026-09-03                              |
| **Autor**     | e-burgos                                |
| **Estado**    | validated                               |
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

> Cerrado por el sdd-reviewer al cerrar spec-e-burgos-009 cycle-02 (2026-09-04).
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> **Evidencia.** `entry-order.service.spec.ts`, 25 tests verdes corridos en el cierre. Los payloads
> de `entryOrderPlaced`, `entryOrderFilled` y `entryOrderMissing` se afirman con `toMatchObject`
> incluyendo `configId` y `entryOrderId`, y el test nuevo
> *"marks the row MISSING and notifies configId and entryOrderId alongside the previous keys"*
> comprueba que las claves previas se conservan — el cambio es estrictamente aditivo y ninguna
> traducción cambia. Commit `4a4bd546`.
> Consumido punta a punta en el mismo ciclo: `getNotificationRoute` agrega `configId` y
> `entryOrderId` a la URL de la pestaña Entradas **sólo cuando el payload los trae**, así que las
> notificaciones viejas siguen resolviendo a la misma ruta — afirmado en `notification-utils.spec.ts`
> (*"entryOrderPlaced sin ids apunta a la pestaña Entradas filtrada por RESTING"*,
> *"entryOrderFilled con ids agrega configId y entryOrderId"*, *"las claves previas conservan su
> ruta"*). Con esto el criterio original de US-2-010 quedó ejecutable. Sin seguimiento pendiente.
