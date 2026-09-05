# spec-e-burgos-010 cycle-01 — 2026-09-04

> ⚠️ El ciclo quedó **in-progress, no aprobado**. Todo lo que sigue está implementado y
> verificado unitariamente contra dobles, pero **el transporte es inerte contra la Binance de
> hoy**: `POST /api/v3/userDataStream` responde `410 Gone` (nginx) en TESTNET y en producción,
> así que no hay `listenKey` y sin `listenKey` no hay socket. El interruptor se entrega
> **apagado**. No leer nada de esto como "la detección de fills por stream funciona".

## Estado

- Servicio nuevo `apps/api/src/reactive/user-data-stream.service.ts`: lease por credencial
  `(userId, env)` sobre `ReactiveCoordinationPort`, ciclo de vida del `listenKey`
  (crear / keepalive / renegociar / cerrar), consumo de `executionReport` y publicación de salud.
  **Nunca se ejercitó contra el exchange**: no existe una sola corrida real de punta a punta.
- El servicio **no** crea `Position`, `Trade` ni `bot_actions`, no llama `placeInitialProtection`
  y no emite ningún evento `entry-order:*`. Su único camino de reconciliación es
  `EntryOrderService.settleFill` (RN-01 / D1-2); tras un `SETTLED` sólo invalida el cache de
  posiciones abiertas de `FastPathService`. No inyecta `AppGateway` ni `NotificationsService`.
- `EntryFillWatchService` y `ReconciliationService` quedaron **sin tocar y sin gatear** por la
  salud del stream (D-07): la sonda por tick sigue siendo el detector real de fills.
- La SPA, `EP-017` y los seis eventos `entry-order:*` no cambiaron.

## Estructura

- `reactive/user-data-stream.service.ts` — servicio, más los tokens de DI
  `USER_STREAM_REST_FACTORY` / `USER_STREAM_WS_FACTORY` y los helpers de key
  `userStreamOwnerLeaseKey` / `userStreamHealthKey` (`rx:v1:uds:owner:` / `rx:v1:uds:health:`).
- `reactive/execution-report-fill.ts` — función pura `toEntryFillStatus(report)`, paridad campo
  por campo con `BinanceRestClient.toEntryOrderStatus`. Sólo liquida `BUY` + `FILLED`; nunca
  emite `partial: true`, así que jamás dispara el `cancelOnExchange` previo al claim.
- `reactive/user-data-stream-flag.ts` — `isUserDataStreamFillsEnabled()`, lee
  `USER_DATA_STREAM_FILLS_ENABLED` **una sola vez, en el composition root**. Ausente ⇒ el
  provider resuelve a `null` y el servicio ni se instancia.
- `reactive/reactive-runtime-thresholds.ts` — 15 umbrales nuevos con prefijo `userStream*`.
  Invariante que sostiene HU-04 CA-1:
  `userStreamKeepaliveIntervalMs (15 min) + userStreamKeepaliveGraceMs (10 min) <
  userStreamKeyExpiryMs (60 min)`.
- `reactive/reactive-coordination.test-double.ts` — `createSharedFakeCoordination()` extraído de
  `market-stream.service.spec.ts`; ahora lo comparten los dos specs. Archivo sólo de tests.
- `reactive.module.ts` — tres providers nuevos. **No cambia el grafo de módulos**: no se agregó
  ninguna importación de módulo.

## Dependencias

Ninguna nueva en el manifiesto. `ws` y `axios` ya venían de `libs/data-fetcher`. Sin tablas,
columnas, índices ni endpoints nuevos: `sdd/schema.json`, `sdd/api.json` y `sdd/components.json`
no se tocaron.

## Qué sigue

- **Decisión humana pendiente, escalada al dev:** migrar al user data stream de la WebSocket API
  de Binance (otro transporte, requiere una clave Ed25519 que el dev tiene que crear), parquear el
  ciclo, o revertirlo. Hasta que se resuelva, `UserDataStreamService` es código muerto en
  producción por diseño (flag apagado).
- Defecto abierto: si `createListenKey` falla **durante una renegociación**, el crédito queda en
  `ownedCredentials` con el ws desconectado y el keepalive parado, reteniendo el lease para
  siempre — ninguna otra réplica puede tomarlo y el stream no se recupera sin reiniciar el
  proceso. En el arranque (`negotiateAndConnect`) el mismo fallo sí libera el lease, pero
  reintenta cada `userStreamSweepIntervalMs` (10 s) sin backoff, con un `warn` por intento.
- Falta el test de comportamiento de HU-05 CA-2 que pide `architect.md` §9 (stream `DEGRADED` +
  tick que cruza el nivel ⇒ `settleFill`); hoy la propiedad sólo está verificada
  estructuralmente.
- Deuda preexistente que este ciclo hereda y no agranda: `settleFill` hace el claim CAS y después
  crea `Position`, `Trade` y `bot_actions` **fuera de una transacción**.
