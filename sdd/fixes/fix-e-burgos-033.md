# FIX-e-burgos-033 — HU-08 CA-3 sin test propio para la rama ABSENT y comentario narrativo en resolveTradingConfig

| Campo         | Valor                                                                 |
| ------------- | --------------------------------------------------------------------- |
| **ID**        | FIX-e-burgos-033                                                      |
| **Tipo**      | IMPROVEMENT                                                           |
| **Severidad** | low                                                                   |
| **Keyword**   | [IMPROVEMENT]                                                         |
| **Fecha**     | 2026-09-05                                                            |
| **Autor**     | e-burgos                                                              |
| **Estado**    | validated                                                             |
| **Spec**      | spec-e-burgos-010-user-data-stream-fills (follow-ups del reviewer, cycle-02) |

## Problema

En `apps/api/src/reactive/user-data-stream.service.ts`: (1) la fila ABSENT de T-08b (1 log tras 10 barridos, 2 tras `userStreamMissingCredentialLogIntervalMs`) no tiene test, así que HU-08 CA-3 queda protegida sólo por analogía con la rama INVALID; (2) `resolveTradingConfig` explica con un comentario de dos líneas la conversión del `TradingMode` de Prisma al enum compartido, que la regla ✍️ pide expresar como función nombrada.

## Justificación del bypass

Cierre de follow-ups declarados por el reviewer al aprobar el ciclo; sin cambio de comportamiento.

## Solución aplicada

`toUserStreamTradingConfig(row)` a nivel de módulo (tipada desde el retorno real de `prisma.tradingConfig.findUnique`)
reemplaza el comentario y el cast inline en `resolveTradingConfig`. Nuevo test T-08b para la rama ABSENT en el
`describe` de resolución de credenciales, espejo del de la rama INVALID. Fix puramente correctivo: sin cambios de contexto.

### Archivos modificados

- `apps/api/src/reactive/user-data-stream.service.ts`
- `apps/api/src/reactive/user-data-stream.service.spec.ts`

### Test de validación

- **Referencia:** `user-data-stream.service.spec.ts` → `logs an ABSENT credential once per cooldown window, not once per sweep (T-08b)`.
  `pnpm nx test api --testPathPatterns=user-data-stream.service` 64/64; `pnpm typecheck:api` exit 0; lint sin warnings nuevos.

### Decisión del Reviewer

> Validado el 2026-09-05 en el main loop: test reproducido en verde y diff revisado (cero comentarios en el servicio).
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX

---
