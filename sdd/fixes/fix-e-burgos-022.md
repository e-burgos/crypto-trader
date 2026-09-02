# FIX-e-burgos-022 — La API nunca abre el puerto HTTP si Redis no es alcanzable y app.listen() cuelga sin log

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-022                                   |
| **Tipo**      | BUGFIX                                  |
| **Severidad** | medium                                   |
| **Keyword**   | [BUGFIX]                                |
| **Fecha**     | 2026-09-02                              |
| **Autor**     | e-burgos                                |
| **Estado**    | pending                                 |
| **Spec**      | N/A (repo-level)                        |

## Problema

Con 6379 sin publicar la API mapea rutas y corre schedulers pero nunca bindea el puerto ni loguea error: MarketStreamService.onModuleInit -> runOwnershipCycle -> RedisReactiveCoordination.tryAcquire espera para siempre sobre un cliente ioredis con offline queue. En CI se veria como wait-on agotando 60 s sin pista. Candidatos: enableOfflineQueue false en el cliente de coordinacion o timeout en el health check.

## Justificación del bypass

Bug real destapado al actualizar la suite E2E (FIX-e-burgos-020). Se registra para no perderlo; no
está implementado todavía.

### Archivos a modificar

- `apps/api/src/reactive/redis-reactive-coordination.service.ts`
- `apps/api/src/reactive/market-stream.service.ts`

### Test de validación

- **Referencia:** pendiente, test unitario del componente o servicio afectado al implementar.

### Decisión del Reviewer

> [A completar por sdd-reviewer al cerrar el ciclo]
>
> - [ ] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
