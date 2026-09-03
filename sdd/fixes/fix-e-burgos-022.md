# FIX-e-burgos-022 — La API nunca abre el puerto HTTP si Redis no es alcanzable y app.listen() cuelga sin log

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-022                                   |
| **Tipo**      | BUGFIX                                  |
| **Severidad** | medium                                   |
| **Keyword**   | [BUGFIX]                                |
| **Fecha**     | 2026-09-02                              |
| **Autor**     | e-burgos                                |
| **Estado**    | validated                               |
| **Spec**      | N/A (repo-level)                        |

## Problema

Con 6379 sin publicar la API mapea rutas y corre schedulers pero nunca bindea el puerto ni loguea error: MarketStreamService.onModuleInit -> runOwnershipCycle -> RedisReactiveCoordination.tryAcquire espera para siempre sobre un cliente ioredis con offline queue. En CI se veria como wait-on agotando 60 s sin pista. Candidatos: enableOfflineQueue false en el cliente de coordinacion o timeout en el health check.

## Causa raíz verificada y solución

La hipótesis inicial (la coordinación reactiva esperando en la offline queue de ioredis) **no era el
bloqueo**: con `ECONNREFUSED` ese cliente ya fallaba rápido. El `await` que cuelga es el de **Bull**:
crea sus clientes con `maxRetriesPerRequest: null`, así que todo comando de cola espera un `isReady()`
que nunca rechaza, y `EvaluationService.onModuleInit` (`removeRepeatable`/`add`) y
`TradingService.onModuleInit` (`getWaiting`/`getDelayed`/`getActive`) se quedaban ahí para siempre,
antes de `app.listen`. Medido: 92 s sin bindear el puerto y sin una sola línea de log.

Solución en dos capas, ambas commiteadas:

- **Carril reactivo** (`4a125c74`): cliente de coordinación con `enableOfflineQueue: false`,
  `commandTimeout`/`connectTimeout` desde umbrales, `healthy` en `false` hasta `ready`, y el ciclo de
  ownership del arranque acotado por `coordinationBootstrapTimeoutMs`.
- **Bull** (`ca9a621c`): `apps/api/src/common/queue-bootstrap.ts` corre el trabajo de cada hook con
  un tope de 5 s; al vencer loguea un `ERROR` claro, no lanza, y encola una continuación sobre
  `queue.isReady()` con una ventana de asentamiento de 30 s para que el intento original y el
  reintento no corran dos veces. `withTimeout` pasó a `apps/api/src/common/with-timeout.ts`.

Resultado medido con Redis en un puerto cerrado: `/api/health` responde `503`
`{status: degraded, redis: down}` a los 14 s; al levantar Redis, los repetibles y la recuperación de
agentes corren una sola vez; con Redis real, `200 ok` en 7 s. Los 13 `onModuleInit` de `apps/api`
quedaron auditados: sólo esos dos esperaban Redis.

## Justificación del bypass

Bug real destapado al actualizar la suite E2E (FIX-e-burgos-020). Se registra para no perderlo; no
está implementado todavía.

### Archivos a modificar

- `apps/api/src/reactive/redis-reactive-coordination.service.ts`
- `apps/api/src/reactive/market-stream.service.ts`

### Test de validación

- **Referencia:** pendiente, test unitario del componente o servicio afectado al implementar.

### Decisión del Reviewer

> Revisado por sdd-reviewer el **2026-09-03** — evidencia ejecutada, no leída.
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> **Evidencia:** `pnpm nx test api --testPathPatterns="queue-bootstrap|startup-recovery|evaluation.service|reactive"` (2026-09-03): 17 suites / 180 tests passed. Reproducción real ejecutada el 2026-09-03 con `REDIS_URL=redis://127.0.0.1:6390` (puerto cerrado) y `PORT=3011`, Postgres arriba: el puerto HTTP queda bindeado y `GET /api/health` responde **503** `{"status":"degraded","database":"up","redis":"down"}` **a los 20 s** del arranque (contra 92 s sin bindear ni loguear antes del fix), con exactamente las dos líneas ERROR esperadas: `[EvaluationService] Bull queue unavailable at bootstrap: … deferred until Redis returns (timed out after 5000ms)` y `[TradingService] Bull queue unavailable at bootstrap: … startup recovery … deferred`.
>
> **Seguimiento:** la política de arranque degradado que introduce este fix (tope de 5 s por hook de cola, ventana de asentamiento de 30 s, `health` en 503 `degraded` mientras Redis no vuelve) es una decisión arquitectónica transversal a `apps/api` y merece una línea de ADR en la próxima spec que toque colas o el carril reactivo. No se abre spec desde el FIX GATE.
