# spec-e-burgos-010 cycle-02 — 2026-09-05

## Estado

- `UserDataStreamService` cambió de transporte: ya no negocia un `listenKey` por REST (retirado por
  Binance con 410 Gone) sino una sesión de la WebSocket API — `connect` → `time` → `session.logon`
  firmado con Ed25519 → `userDataStream.subscribe`, con re-logon periódico y re-autenticación
  obligatoria después de **cualquier** reconexión del socket. resuelve: la mención a
  `listenKey`/`BinanceUserDataStreamClient` del contexto base.
- El servicio sigue sin crear `Position`, `Trade` ni `bot_actions`, sin llamar
  `placeInitialProtection`, sin emitir ningún `entry-order:*` y sin inyectar gateway ni
  notificaciones: su único camino de reconciliación sigue siendo `entryOrders.settleFill`.
- `EntryFillWatchService` y `ReconciliationService` siguen **sin gatearse** por la salud del stream
  — ahora es una propiedad de runtime verificada por test (`entry-fill-watch.service.spec.ts`:
  health record DEGRADED publicado + tick que cruza el nivel ⇒ `settleFill`, y cero lecturas de
  claves `rx:v1:uds:health:`), no una inspección manual.
- El interruptor `USER_DATA_STREAM_FILLS_ENABLED` se entrega apagado y ahora admite una sola forma
  de estar encendido: `=== 'true'` (`'1'` ya no enciende nada).
- Ausencia de credencial Ed25519 = estado de primera clase: la plataforma arranca normal, esa
  credencial queda sin sesión (cubierta por la sonda por tick) y el aviso se loguea con cooldown
  de una hora en vez de una vez por barrido.
- La corrida autenticada contra TESTNET **no se ejecutó**: falta que el dueño de la cuenta cree la
  clave Ed25519. El transporte sí se verificó contra el exchange real sin credenciales.

## Estructura

- Archivos nuevos en `apps/api/src/reactive/`:
  - `user-stream-auth-credential.port.ts` — puerto de resolución `RESOLVED | ABSENT | INVALID`.
  - `env-user-stream-auth-credential.resolver.ts` — implementación por variables de entorno
    (`BINANCE_API_TESTNET_ED25519_*` / `BINANCE_API_ED25519_*`; `_PATH` tiene precedencia sobre el
    PEM en línea) con razones tipadas `MALFORMED_PEM | NOT_ED25519 | UNREADABLE_KEY_FILE`.
  - `bounded-ttl-cache.ts` — caché genérica FIFO + TTL con tope de tamaño.
  - `user-stream-ws-api.test-double.ts` — `FakeUserStreamWsApiClient` y
    `FakeUserStreamAuthCredentialResolver`.
- `UserDataStreamService` reorganizado alrededor de un único camino de fallo, `failSession(key,
  reason, failureClass)`: para timers, desengancha listeners, desconecta, **siempre libera el
  lease** y registra el backoff. El sweep respeta ese backoff (exponencial con jitter y tope para
  fallos transitorios, cooldown fijo para `AUTH_REJECTED`/`INVALID`, una hora para `ABSENT`), así
  que hay un `warn` por intento real y no uno por tick.
- Dedupe: `inFlightEvents` (guarda intra-tick) + `seenEvents`, que se marca **solo después** de que
  `settleFill` resolvió. Un settle que falla, o una config/executor ausente, dejan la identidad sin
  marcar para permitir la reentrega.
- Correlación `executionReport → entry_orders` acotada por `userId` en las dos vías (match por
  `clientOrderId` y match por identificadores de respaldo): un reporte nunca puede resolver la fila
  de otro usuario.
- `configCache` / `credentialsCache` / `executorCache` pasaron a `BoundedTtlCache`; la config del
  stream tiene tipo propio `UserStreamTradingConfig` (se fue el `any`).
- Listener de `'error'` registrado sobre el cliente WS del user data stream y sobre
  `BinanceWsClient` en `MarketStreamService` (agujero preexistente): un `emit('error')` ya no
  voltea el proceso.
- Umbrales nuevos en `reactive-runtime-thresholds.ts`: `userStreamRelogonIntervalMs`,
  `userStreamSessionMaxAgeMs`, `userStreamSessionPingIntervalMs`, `userStreamSessionAuthMaxAgeMs`,
  `userStreamRequestTimeoutMs`, `userStreamNegotiateBaseDelayMs`, `userStreamNegotiateMaxDelayMs`,
  `userStreamAuthRejectedCooldownMs`, `userStreamMissingCredentialLogIntervalMs`,
  `userStreamResolverCacheSize`. Se retiraron los del keepalive del `listenKey`.

## Dependencias

- Sin dependencias npm nuevas: la firma Ed25519 usa `node:crypto` y la lectura del PEM `node:fs`.
- Variables de entorno nuevas (documentadas en `.env.example`):
  `BINANCE_API_TESTNET_ED25519_KEY`, `BINANCE_API_TESTNET_ED25519_PRIVATE_KEY`,
  `BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PATH`,
  `BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PASSPHRASE`, sus equivalentes LIVE
  (`BINANCE_API_ED25519_*`, no usadas en este ciclo) y `USER_DATA_STREAM_ED25519_USER_IDS`.
- `apps/api` consume de `libs/data-fetcher` el transporte nuevo (`BinanceWsApiClient`,
  `createEd25519Signer`, `extractUserDataEvent`) en lugar de los helpers REST del `listenKey`.

## Qué sigue

- La corrida autenticada contra TESTNET (`session.logon` + `userDataStream.subscribe` +
  `executionReport` real) sigue pendiente hasta que el dev cree la clave Ed25519 en su cuenta de
  TESTNET. Hasta entonces el interruptor no debe encenderse en ningún entorno.
- `apps/api/src/reactive/reactive-coordination.test-double.ts` rompe `pnpm typecheck:api`
  (`Cannot find name 'jest'`, 6 errores): vive dentro de `tsconfig.app.json` sin tipos de jest.
  Defecto preexistente de cycle-01, no se tocó en este ciclo.
- Deuda preexistente vigente: `settleFill` hace el claim CAS y después escribe `Position`, `Trade`
  y `bot_actions` fuera de una transacción.
