# Sprint Plan — Ciclo 2: Migración del transporte del user data stream a la WebSocket API

> **Input:** sdd/specs/spec-e-burgos-010-user-data-stream-fills/cycles/cycle-02/architect.md (principal),
> functional.md, brief.yaml, cycle-01/planner.md (forma y disciplina de carriles)
> **Output:** sdd/specs/spec-e-burgos-010-user-data-stream-fills/cycles/cycle-02/planner.md
> **Generado por:** sdd-planner (claude/sonnet, effort medium)

---

## Resumen del ciclo

| Campo               | Valor                                                     |
| -------------------- | ---------------------------------------------------------- |
| Ciclo                | 2                                                         |
| Módulo               | user-data-stream-fills                                   |
| Duración estimada    | ~1.5 semanas (60.5h, camino crítico ~30h con 3-4 devs en paralelo) |
| Story points totales | 66                                                         |
| Apps involucradas    | apps/api, libs/data-fetcher, libs/shared, libs/analysis   |

> Las tasks están redactadas en términos de CONTRATO (qué archivo, qué decisión del arquitecto
> implementa, qué criterio de aceptación cierra) — el Implementador Backend resuelve detalles de
> nombre interno contra `architect.md` al tomar cada task, pero **los nombres de archivo, símbolos
> públicos y umbrales ya están fijados por el arquitecto** (§1, §4bis, §5, §9): no hay margen de
> interpretación ahí.

---

## Carriles de archivos (para ejecución en oleadas paralelas)

| Carril | Área                                       | Tasks                                                              |
| ------ | -------------------------------------------- | -------------------------------------------------------------------- |
| L      | libs/data-fetcher (transporte)               | TASK-001, TASK-002, TASK-010, TASK-012, TASK-020, TASK-021, TASK-022 |
| S      | libs/shared + libs/analysis (vocabulario)     | TASK-005, TASK-006                                                  |
| A      | apps/api/src/reactive (consumidor + composición) | TASK-003, TASK-004, TASK-007, TASK-008, TASK-009, TASK-011, TASK-013..019, TASK-023, TASK-024, TASK-025 |
| V      | verificación TESTNET (opt-in, bloqueable)     | TASK-026                                                            |

**Regla de exclusión dentro de Carril A:** `apps/api/src/reactive/user-data-stream.service.ts` (y su
spec) es el archivo con más tasks encadenadas del ciclo (TASK-013 → 014 → 015 → 016 → 017 → 018).
**Nunca dos de esas seis corren en paralelo** — cada una depende estrictamente de la anterior, en
ese orden exacto, tal como lo exige `architect.md` §4bis/§9.3 (D-13 → D-16 → D-05/§4.5 → D-17 → D-18 →
D-19, en ese orden de capas sobre el mismo archivo). Es el mismo patrón que cycle-01 usó sobre este
archivo (TASK-005 → 006 → 007 → 008 → 010 → 011 de cycle-01/tasks.json): un solo implementador a la
vez sobre este archivo, oleada tras oleada.

---

## Nota de secuenciación (deletions después de composition root)

El brief pide ordenar las oleadas: leaf artifacts → cliente WS → adaptación del servicio →
composition root/umbrales → **borrados del transporte muerto de cycle-01** → tests cross-lane →
TESTNET. TASK-020/021/022 (los borrados en `libs/data-fetcher`) no tienen una dependencia técnica
dura sobre TASK-019 (el composition root) — podrían borrarse desde la oleada 1 sin romper nada,
porque `architect.md` §9.1 confirma que nada más los usa (`"Sin otro usuario"`). Se las encadena
igual después de TASK-019 **a propósito**, no por necesidad de compilación: así, si algo del
servicio nuevo todavía dependiera sin querer de un símbolo viejo, el borrado lo revienta *después*
de que el transporte nuevo ya esté probado end-to-end por dobles, nunca antes. Es la decisión más
segura para correr implementadores en paralelo sin perseguir una regresión a mitad de ciclo.

---

## Tasks — Carril L: `libs/data-fetcher` (transporte)

### TASK-001: Ed25519Signer — firma pura de `session.logon`

**Historia:** HU-04, HU-06
**App:** libs/data-fetcher
**Descripción:** Crear `ed25519-signer.ts` (D-11): `buildSignaturePayload` (parámetros sin
`signature`, orden ascendente por nombre, `clave=valor` unidos con `&`, **sin percent-encoding**),
`createEd25519Signer(pem, passphrase?)` (usa `crypto.createPrivateKey` + `crypto.sign(null, ...)`,
lanza si `asymmetricKeyType !== 'ed25519'`) y `redactWsApiRequest(frame)` (enmascara `apiKey` y
`signature` con `'***'`). Módulo puro: sin `ws`, sin axios, sin estado global, cero dependencias npm
nuevas.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** ninguna
**Criterio de done:**

- [ ] `buildSignaturePayload({timestamp:'2', apiKey:'A+B/C='})` devuelve
      `'apiKey=A+B/C=&timestamp=2'` — sin `%2B` ni `%2F` (T-11).
- [ ] La firma producida por `createEd25519Signer` verifica contra `crypto.verify(null, payload,
      publicKey, sigBuffer)` con un par de claves generado en el propio test.
- [ ] `createEd25519Signer` lanza al recibir un PEM RSA (no Ed25519).
- [ ] `redactWsApiRequest` enmascara `params.apiKey` y `params.signature`, deja el resto intacto.
- [ ] `JSON.stringify(signer)` del objeto devuelto por `createEd25519Signer` es `'{}'`.

### TASK-002: `execution-report.ts` — extractor de envoltura + parser movido de cycle-01

**Historia:** HU-01
**App:** libs/data-fetcher
**Descripción:** Archivo nuevo con `RawUserDataStreamMessage`, `ExecutionReportEvent` y
`parseExecutionReport` **movidos sin cambios** desde el cliente de cycle-01 que se borra (TASK-021).
Sumar `extractUserDataEvent(frame)` (D-14): `frame.event` objeto ⇒ envoltura A; si no, `frame` mismo
⇒ envoltura B; candidato sin `e: string` ⇒ `null`. Se aceptan las dos envolturas, decidido por
estructura, nunca por configuración.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** ninguna
**Criterio de done:**

- [ ] `parseExecutionReport` y su mapeo campo por campo son **idénticos** a los de cycle-01 (mismos
      casos de test, sin regresión de paridad con D-06).
- [ ] Tabla de `extractUserDataEvent`: `{event:{e:'executionReport',…}}` ⇒ evento;
      `{e:'executionReport',…}` ⇒ evento; `{event:{e:'outboundAccountPosition'}}` ⇒ `null`;
      `{id,status,result}` ⇒ `null`; `{}`, `null`, `[]`, `'texto'` ⇒ `null` (T-14).

### TASK-010: `BinanceWsApiClient` — transporte nuevo sobre la WebSocket API

**Historia:** HU-01, HU-04, HU-09, HU-06
**App:** libs/data-fetcher
**Descripción:** Implementar D-10 completo: `connect/disconnect/isConnected/getBaseUrl`, `time()` y
`ping()` sin credenciales, `logon(auth)/logout()/subscribeUserDataStream()/unsubscribeUserDataStream()`
correlacionados por `id` sobre un `Map<string, PendingRequest>`; enrutamiento de frames en el orden
estricto de D-10 (respuesta por `id` conocido → evento de usuario vía `extractUserDataEvent` → ruido
ignorado); reconexión con backoff exponencial ±20% jitter; heartbeat `ws.ping()`/`ws.terminate()`;
emisión de `connected` en **toda** apertura (incluida la primera); `BinanceWsApiError` construido
**solo** con `status/code/msg/method`, nunca con el request. Registrar listener de `'error'` sobre el
socket subyacente (no debe lanzar — HU-09 CA-1 lo verifica en TASK-013, pero el cliente debe
exponerlo). Cero dependencias npm nuevas (`ws` + `node:crypto`).
**Estimación:** 6h · **Story points:** 8
**Dependencias:** TASK-001, TASK-002
**Criterio de done:**

- [ ] Respuestas fuera de orden se resuelven contra su request por `id`; `status !== 200` rechaza con
      `BinanceWsApiError`; `requestTimeoutMs` sin respuesta rechaza y limpia la pendiente; el cierre
      del socket rechaza **todas** las pendientes (T-10).
- [ ] Un frame con `id` desconocido no rompe el enrutamiento de eventos posterior.
- [ ] `connected` se emite en la primera conexión y en cada reconexión, sin rama especial.
- [ ] Emitir `'error'` sobre el doble de `ws` no lanza y queda capturado por el cliente.
- [ ] Test con doble de `ws` (mismo patrón que `binance-ws.client.spec.ts`) — ningún test abre un
      socket real.

### TASK-012: `libs/data-fetcher/index.ts` — agregar exports del transporte nuevo

**Historia:** HU-01, HU-04
**App:** libs/data-fetcher
**Descripción:** Sumar al barrel: `BinanceWsApiClient`, `BINANCE_WS_API_URL`,
`BINANCE_WS_API_TESTNET_URL`, `BinanceWsApiConfig`, `BinanceWsApiError`, `Ed25519Signer`,
`createEd25519Signer`, `buildSignaturePayload`, `redactWsApiRequest`, y desde `execution-report.ts`:
`ExecutionReportEvent`, `parseExecutionReport`, `extractUserDataEvent`, `RawUserDataStreamMessage`.
**No borrar todavía** los exports del cliente viejo (eso es TASK-022, después de TASK-021).
**Estimación:** 0.5h · **Story points:** 1
**Dependencias:** TASK-001, TASK-002, TASK-010
**Criterio de done:**

- [ ] `@crypto-trader/data-fetcher` expone los símbolos nuevos listados arriba.
- [ ] `ExecutionReportEvent` se sigue exportando con el mismo nombre (para que
      `execution-report-fill.ts` no cambie ni una línea).

### TASK-020: Borrar ciclo de vida REST del `listenKey` en `BinanceRestClient` (D-09)

**Historia:** HU-04
**App:** libs/data-fetcher
**Descripción:** Borrar `createListenKey`, `keepAliveListenKey`, `closeListenKey`, el privado
`keyedRequest` y las 3 entradas de `ENDPOINT_WEIGHTS` de `/api/v3/userDataStream`. `signedRequest`
**no se toca**. Borrar del spec los casos que cubrían esos tres métodos.
**Estimación:** 1h · **Story points:** 1
**Dependencias:** TASK-019
**Criterio de done:**

- [ ] Ningún símbolo de los borrados existe en `binance-rest.client.ts`.
- [ ] `signedRequest` y el resto de `BinanceRestClient` (usado por `LiveOrderExecutor`) siguen
      pasando sus tests sin cambios.
- [ ] `binance-rest.client.testnet.spec.ts` (harness de órdenes) no se toca y sigue en verde.

### TASK-021: Borrar cliente WS single-stream de cycle-01 y su harness TESTNET muerto

**Historia:** HU-01
**App:** libs/data-fetcher
**Descripción:** Borrar `binance-user-data-stream.client.ts`, su spec y
`binance-user-data-stream.testnet.spec.ts` (aborta en 410 contra `createListenKey`, ya inútil).
Confirmar que todo lo reusable (`RawUserDataStreamMessage`, `ExecutionReportEvent`,
`parseExecutionReport`) ya vive en `execution-report.ts` (TASK-002) antes de borrar.
**Estimación:** 1h · **Story points:** 1
**Dependencias:** TASK-002, TASK-019
**Criterio de done:**

- [ ] Los tres archivos no existen más en el árbol.
- [ ] `pnpm nx test data-fetcher` sigue verde sin ellos (la cobertura del parser vive en
      `execution-report.spec.ts`, la de conexión/heartbeat/backoff en
      `binance-ws-api.client.spec.ts`).

### TASK-022: Finalizar `libs/data-fetcher/index.ts` — quitar exports del transporte retirado

**Historia:** HU-01
**App:** libs/data-fetcher
**Descripción:** Quitar del barrel `BINANCE_USER_STREAM_WS_URL`, `BINANCE_TESTNET_USER_STREAM_WS_URL`,
la clase del cliente viejo, `StreamExpiredEvent`, `StreamExpiredReason`. Los exports agregados en
TASK-012 quedan como export final.
**Estimación:** 1h · **Story points:** 1
**Dependencias:** TASK-012, TASK-020, TASK-021
**Criterio de done:**

- [ ] Ningún consumidor del monorepo importa un símbolo borrado (`pnpm nx run-many -t lint build
      --projects=api,data-fetcher` verde).

---

## Tasks — Carril S: `libs/shared` + `libs/analysis` (vocabulario y resolver puro)

### TASK-005: Renombre `lastKeepaliveAtMs` → `lastSessionAuthAtMs` en `UserDataStreamHealthRecord`

**Historia:** HU-05, HU-06
**App:** libs/shared
**Descripción:** Renombrar el campo en `UserDataStreamHealthRecord`, en `USER_DATA_STREAM_HEALTH_FIELDS`
y en el guard `AssertNoKeyDrift` (D-15). Ningún campo nuevo, ningún campo derivado de clave/firma/apiKey.
**Estimación:** 1h · **Story points:** 1
**Dependencias:** ninguna
**Criterio de done:**

- [ ] `lastKeepaliveAtMs` no existe más en `interfaces.ts`; `lastSessionAuthAtMs` sí, con el mismo tipo.
- [ ] `AssertNoKeyDrift` sigue fallando en typecheck si se agrega un campo fuera de la lista congelada.

### TASK-006: `user-data-stream-health.ts` — razón `SESSION_AUTH_STALE`

**Historia:** HU-05
**App:** libs/analysis
**Descripción:** Renombrar `KEEPALIVE_STALE` → `SESSION_AUTH_STALE` en `UserDataStreamHealthReason` y
actualizar la cascada (`NO_RECORD` → `HEARTBEAT_STALE` → `SESSION_AUTH_STALE` → `HEALTHY`) para leer
`lastSessionAuthAtMs` (TASK-005) contra `userStreamSessionAuthMaxAgeMs`. `lastEventAtMs` sigue
informativo, fuera del cálculo (RN-03).
**Estimación:** 1h · **Story points:** 1
**Dependencias:** TASK-005
**Criterio de done:**

- [ ] Tabla `resolveUserDataStreamHealth`: `HEALTHY` / `DEGRADED(HEARTBEAT_STALE|SESSION_AUTH_STALE)`
      / `UNKNOWN(NO_RECORD)` (T-05a).
- [ ] Variando **solo** `lastEventAtMs` (`null`, `now`, `now - 24h`) el veredicto no cambia (T-05c).
- [ ] Con `heartbeat` fresco y `logon` exitoso vuelve a `HEALTHY` sin llamada manual (T-05d).

---

## Tasks — Carril A: `apps/api/src/reactive` (consumidor y composición)

### TASK-003: Umbrales del transporte nuevo en `reactive-runtime-thresholds.ts` (D-20)

**Historia:** HU-04, HU-05
**App:** apps/api
**Descripción:** Borrar `userStreamKeyExpiryMs`, `userStreamKeepaliveIntervalMs`,
`userStreamKeepaliveGraceMs`, `userStreamKeepaliveMaxAgeMs`. Agregar los nueve umbrales de §5
(`userStreamSessionMaxAgeMs`, `userStreamRelogonIntervalMs`, `userStreamRelogonGraceMs`,
`userStreamSessionAuthMaxAgeMs`, `userStreamSessionPingIntervalMs`, `userStreamRequestTimeoutMs`,
`userStreamConnectTimeoutMs`, `userStreamNegotiateBaseDelayMs`, `userStreamNegotiateMaxDelayMs`,
`userStreamAuthRejectedCooldownMs`, `userStreamMissingCredentialLogIntervalMs`,
`userStreamResolverCacheSize`) con los valores literales del arquitecto.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Los cuatro umbrales del `listenKey` no existen más en el archivo.
- [ ] Test unitario sobre las 8 relaciones de §5 (invariantes 1-8, leídas del objeto exportado, nunca
      como literal repetido) — T-05t.

### TASK-004: `BoundedTtlCache` — caché acotada FIFO+TTL genérica (D-19)

**Historia:** HU-09
**App:** apps/api
**Descripción:** Clase genérica `BoundedTtlCache<V>(maxSize, ttlMs)` con `get/set/delete/size`;
desalojo FIFO por orden de inserción del `Map` cuando `size > maxSize`; `get` de una entrada vencida
la borra y devuelve `undefined`. Sin dependencias.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Resolviendo `maxSize + 50` claves distintas, `size` deja de crecer en `maxSize` (T-09c, parte
      directa de la clase).
- [ ] Una entrada leída después de `ttlMs` devuelve `undefined` y el tamaño baja en 1.

### TASK-007: `UserStreamAuthCredentialPort` — puerto + símbolo + tipos de resolución (D-12)

**Historia:** HU-08
**App:** apps/api
**Descripción:** Declarar `USER_STREAM_AUTH_CREDENTIAL` (symbol), `UserStreamAuthInvalidReason`
(`'UNREADABLE_KEY_FILE' | 'MALFORMED_PEM' | 'NOT_ED25519'`), `UserStreamAuthResolution`
(`RESOLVED | ABSENT | INVALID`) y la interfaz `UserStreamAuthCredentialPort.resolve(userId, env)`.
Solo tipos y el símbolo — sin implementación.
**Estimación:** 1h · **Story points:** 1
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Los tres tipos compilan y `UserStreamAuthInvalidReason` es una unión cerrada de literales (no
      `string`).

### TASK-008: `EnvUserStreamAuthCredentialResolver` — resolución por entorno (D-12)

**Historia:** HU-08, HU-06
**App:** apps/api
**Descripción:** Implementación que lee `process.env` **perezosamente, solo dentro de `resolve()`**
(nunca en constructor ni import). Normaliza el PEM (`_PATH` con precedencia sobre `_PRIVATE_KEY`;
`\n` literal → salto real; `trim()` final — §1.3). Regla de matcheo: `USER_DATA_STREAM_ED25519_USER_IDS`
ausente ⇒ credencial aplica a todos los usuarios del ambiente; presente y `userId` fuera de la lista
⇒ `ABSENT` (§1.6). Memoiza el `Ed25519Signer` por `env`. Devuelve `INVALID` con
`UNREADABLE_KEY_FILE`/`MALFORMED_PEM`/`NOT_ED25519` según corresponda.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-001, TASK-007
**Criterio de done:**

- [ ] Con el interruptor apagado, `resolve()` nunca se llama y ninguna variable Ed25519 se lee (se
      verifica en TASK-013, esta task solo garantiza la pereza de la lectura interna).
- [ ] Tabla: PEM corrupto ⇒ `INVALID/MALFORMED_PEM`; clave RSA ⇒ `INVALID/NOT_ED25519`; `_PATH`
      inexistente ⇒ `INVALID/UNREADABLE_KEY_FILE`; sin `*_ED25519_KEY` ⇒ `ABSENT`; `userId` fuera de
      `USER_DATA_STREAM_ED25519_USER_IDS` ⇒ `ABSENT` (T-08d, parte resolver).
- [ ] Las tres formas de PEM de §1.3 (ruta, inline con `\n` escapado, inline multilínea) normalizan al
      mismo `KeyObject` válido.

### TASK-009: `isUserDataStreamFillsEnabled()` — contrato estricto `=== 'true'` (D-08, issue-7)

**Historia:** HU-03
**App:** apps/api
**Descripción:** Quitar la aceptación de `'1'`. Única forma válida: el string exacto `'true'`.
**Estimación:** 1h · **Story points:** 1
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Tabla: `'true'` ⇒ `true`; `'1'`, `'TRUE'`, `'yes'`, `''`, `undefined` ⇒ `false` (T-03c).

### TASK-011: Puerto tipado por evento + `FakeUserStreamWsApiClient` (test double, §4.2/§11.1)

**Historia:** HU-04
**App:** apps/api
**Descripción:** Declarar en `user-stream-ws-api.test-double.ts` los tipos de §4.2
(`UserStreamWsApiEvents`, `UserStreamWsApiClient`, `UserStreamWsApiFactory`,
`USER_STREAM_WS_API_FACTORY`) y `FakeUserStreamWsApiClient extends EventEmitter implements
UserStreamWsApiClient`: cuenta llamadas de `connect/logon/subscribeUserDataStream/
unsubscribeUserDataStream/logout/ping/time/disconnect`; guarda la `apiKey` recibida en cada `logon`;
`failNextLogonWith(status, code)` / `failNextSubscribeWith(...)`; helpers `emitConnected()`,
`emitExecutionReport(partial)`, `emitClose()`, `emitHeartbeat()`, `emitSessionLost()`, `emitError(err)`.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-001, TASK-002
**Criterio de done:**

- [ ] El doble implementa estructuralmente `UserStreamWsApiClient` sin `any` ni `eslint-disable`.
- [ ] Cada helper `emit*` dispara el evento correspondiente y los contadores de llamada quedan
      accesibles para los specs que lo consuman.

### TASK-013: `UserDataStreamService` — máquina de estados de sesión (D-13)

**Historia:** HU-04, HU-08, HU-06
**App:** apps/api/src/reactive
**Descripción:** Reescribir el ciclo de vida sobre la máquina de D-13: `IDLE → CONNECTING →
AUTHENTICATING → LIVE → RECONNECTING → RELEASING`. La secuencia de autenticación
(`time → logon → subscribe`) cuelga **una sola vez** del evento `connected` (idéntica en la primera
conexión y en cada reconexión — RN-10). Relogon periódico cada `userStreamRelogonIntervalMs` sobre
la conexión viva (no re-suscribe). Heartbeat aplicativo con `ping()`. Lease por `(userId, env)` sobre
`ReactiveCoordinationPort` sin cambios de forma respecto de cycle-01, pero el flujo de adquisición
ahora consulta primero al resolver (TASK-008): `ABSENT`/`INVALID` ⇒ no se toma lease, 1 warn con
cooldown; `RESOLVED` ⇒ `tryAcquire`. Cierre ordenado en `onApplicationShutdown` (parar timers →
unsubscribe → logout → disconnect → detach listeners → release si sigue siendo dueño → borrar estado).
**Estimación:** 6h · **Story points:** 8
**Dependencias:** TASK-001, TASK-003, TASK-006, TASK-007, TASK-008, TASK-010, TASK-011
**Criterio de done:**

- [ ] Con timers falsos, avanzar `userStreamSessionMaxAgeMs` produce ≥1 `logon` posterior al inicial,
      leyendo el umbral del objeto de thresholds (T-04a).
- [ ] Tabla de causas de reconexión (`emitClose`+`emitConnected`, `emitError`+close, cierre limpio):
      en las tres, `logon` y `subscribeUserDataStream` +1 cada uno, sin intervención (T-04b).
- [ ] `onApplicationShutdown`: para timers, `unsubscribeUserDataStream`, `logout`, `disconnect`,
      `release`, en ese orden; con lease ya perdido, sin `release` redundante (T-04c).
- [ ] Dos instancias contra `createSharedFakeCoordination()`: solo una hace `logon`; la otra 0
      `connect`/`logon` (T-04d).
- [ ] Rechazo de sesión (`-1022`/`-2015`/`-1102`) ⇒ `getHealth(userId, env)` nunca `HEALTHY` (T-04g).
- [ ] Con resolver `ABSENT` para todas las credenciales: `onModuleInit` no lanza, `tryAcquire` 0
      llamadas, `connect` 0, y un tick que cruza el nivel produce `settleFill` por la sonda (T-08a).
- [ ] Resolver `RESOLVED` para `user-A`/testnet y `ABSENT` para `user-B`/testnet: A hace `logon`, B
      no, sin efecto cruzado (T-08c).
- [ ] `INVALID` (PEM corrupto/clave RSA/`_PATH` inexistente): 0 `tryAcquire`, 0 `connect`, sin
      excepción, salud `DEGRADED`, 1 log con cooldown (T-08d, parte servicio).

### TASK-014: `failSession` único + backoff del sweep (D-16, issues 2 y 3)

**Historia:** HU-04
**App:** apps/api/src/reactive
**Descripción:** Todo fallo de sesión (`connect`, `time`, `logon`, `subscribe`, relogon,
`session-lost`) llama a la **misma** `failSession(key, reason, failureClass)`: para timers → detach
listeners → `ws.disconnect()` → release del lease → borra estado en memoria →
`registerNegotiationFailure`. `renegotiate()` deja de existir como camino propio. Backoff del sweep
con `Map<string, NegotiationBackoff>`: `TRANSIENT` crece exponencial con jitter ±20%;
`AUTH_REJECTED`/`INVALID` cooldown fijo 1h; `ABSENT` cooldown fijo 1h. Un `warn` por intento real, no
por tick del sweep.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-013
**Criterio de done:**

- [ ] Tabla de fallos (`connect`/`time`/`logon` transitorio y `-1022`/`subscribe`/relogon/
      `session-lost`): en cada fila, `coordination.release` 1 vez, `getOwnedCredentialKeys()` vacío,
      y la otra instancia puede adquirir la credencial en el sweep siguiente (T-04e).
- [ ] Con `connect` fallando siempre: los instantes de intento respetan `base * 2^(n-1)` (tolerancia
      de jitter ±20%), acotados por `userStreamNegotiateMaxDelayMs`; los `warn` capturados igualan la
      cantidad de intentos reales, no la de ticks del sweep (T-04f).
- [ ] Éxito de negociación borra la entrada de `negotiationBackoff`.

### TASK-015: Correlación `executionReport` → `entry_orders` con guarda de `userId` (D-05 endurecida, §4.5)

**Historia:** HU-01, HU-02
**App:** apps/api/src/reactive
**Descripción:** Conservar la lógica de cycle-01 (`clientOrderId` primario vía `normalizeEntryClientOrderId`;
respaldo por `orderId`/`limitLegOrderId`/`stopLegOrderId`/`orderListId`; guardas `side==='BUY'`,
símbolo, `status==='RESTING'`). **Sumar** `row.userId === state.userId` a
`isAcceptableEntryOrderMatch` — el defecto de §4.5: la credencial Ed25519 sale del entorno y puede
pertenecer a una cuenta distinta de la del usuario.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-014
**Criterio de done:**

- [ ] Tabla de correlación por `clientOrderId` exacto, por sufijo `-l`/`-s`, por `orderId`,
      `limitLegOrderId`, `stopLegOrderId`, `orderListId` — cada fila resuelve la orden correcta
      (T-01b).
- [ ] Fila `entry_orders` RESTING de `user-A` con el `clientOrderId` del reporte; sesión cuyo dueño es
      `user-B`: `settleFill` **0 llamadas** (T-01c).
- [ ] Orden ya `FILLED`/inexistente ⇒ `settleFill` 0 llamadas, gateway 0, notificaciones 0 (T-01e).
- [ ] Sin ningún tick de mercado tras el fill, `settleFill` se llama 1 vez a partir del solo aviso del
      exchange (T-01a).

### TASK-016: Dedupe `seenEvents`/`inFlightEvents` — marcar vista solo tras settle exitoso (D-17, issue-6)

**Historia:** HU-02
**App:** apps/api/src/reactive
**Descripción:** Dos colecciones: `seenEvents: Map<string, number>` (identidad → settledAt, cota FIFO
`userStreamSeenEventCacheSize`, TTL `userStreamSeenEventTtlMs`) e `inFlightEvents: Set<string>` (sin
cota, se borra en `finally`). Pipeline exacto de D-17: `seenEvents` hit ⇒ return sin Prisma;
`inFlightEvents` hit ⇒ return; terminal (`fillStatus===null`, sin correlación, `SETTLED`,
`ALREADY_SETTLED`) ⇒ `markSeen`; transitorio (config null, executor null, catch) ⇒ **no** `markSeen`.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-015
**Criterio de done:**

- [ ] Conteo único en los tres órdenes posibles (stream×2, stream+sonda, sonda+barrido): 1 posición, 1
      trade, 1 bot_action (T-02a).
- [ ] Segundo aviso sobre fila ya `FILLED` o identidad ya vista: 0 llamadas a notificaciones/gateway/
      executor, 0 consultas a Prisma para la reentrega ya vista (T-02b).
- [ ] `settleFill` lanza en la 1.ª entrega ⇒ la 2.ª vuelve a intentar (2 llamadas a `settleFill`);
      `resolveTradingConfig` null la 1.ª vez ⇒ la 2.ª entrega settlea; `SETTLED`/`ALREADY_SETTLED` ⇒
      la 2.ª entrega no llega a Prisma; sin fillStatus/sin correlación ⇒ la 2.ª entrega tampoco
      consulta Prisma (T-02c, seis sub-casos).
- [ ] Dos `emit('execution-report')` en el mismo tick del event loop: `settleFill` 1 vez (T-02d).

### TASK-017: Listener de `'error'` sobre el cliente WS de `UserDataStreamService` (D-18 parte 1, issue-4)

**Historia:** HU-09
**App:** apps/api/src/reactive
**Descripción:** Registrar `error` en `attachWsListeners` (y quitarlo en `detachWsListeners`).
Tratamiento: `logger.warn(err.message)` **y nada más** — no dispara renegociación por sí solo (el
`close` que casi siempre lo acompaña ya tiene su camino).
**Estimación:** 1h · **Story points:** 1
**Dependencias:** TASK-016
**Criterio de done:**

- [ ] `emitError(new Error('boom'))` sobre el doble **no lanza**; queda 1 `warn`; la salud no pasa a
      `HEALTHY` (T-09a).

### TASK-018: Cachés acotadas (`BoundedTtlCache`) + `UserStreamTradingConfig` tipado (D-19, issue-8)

**Historia:** HU-09
**App:** apps/api/src/reactive
**Descripción:** Migrar `configCache`, `credentialsCache` y `executorCache` a `BoundedTtlCache`
(TASK-004) con `maxSize = userStreamResolverCacheSize` (200) y
`ttlMs = userStreamSubscriptionRefreshIntervalMs`. Purgar `negotiationBackoff` en el mismo barrido.
Tipar `resolveTradingConfig(): Promise<UserStreamTradingConfig | null>` con la interfaz exacta de D-19
(9 campos) — sin cast, sin acoplar a `apps/generated/prisma/client`. Quitar los `any` del archivo
(`SettleFillParams.config` en `entry-order.service.ts` queda como deuda ajena, no se toca).
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-017, TASK-004
**Criterio de done:**

- [ ] Resolviendo `userStreamResolverCacheSize + 50` configs/credenciales/executors distintos, el
      `size` de las tres estructuras deja de crecer en el máximo (T-09c, parte servicio).
- [ ] `resolveTradingConfig` no usa `any` ni cast; el tipo de retorno satisface estructuralmente la
      fila de Prisma.
- [ ] Cero `eslint-disable @typescript-eslint/no-explicit-any` en el archivo.

### TASK-019: Composition root — `reactive.module.ts` + `.env.example` (§8)

**Historia:** HU-01, HU-03, HU-04
**App:** apps/api/src/reactive
**Descripción:** Wiring de §8: `USER_STREAM_AUTH_CREDENTIAL` (factory → `EnvUserStreamAuthCredentialResolver`),
`USER_STREAM_WS_API_FACTORY` (factory → `BinanceWsApiClient` con los timeouts/backoff de
`DEFAULT_REACTIVE_RUNTIME_THRESHOLDS`), y `UserDataStreamService` gateado por
`isUserDataStreamFillsEnabled()` (apagado ⇒ `null`, sin `onModuleInit`, sin leer Ed25519). Desaparece
`USER_STREAM_REST_FACTORY` del provider array. Actualizar `.env.example` con las nueve variables de
§1.1, vacías, con el comentario de referencia (TESTNET / LIVE / alcance por usuario / interruptor /
harness).
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-003, TASK-007, TASK-008, TASK-009, TASK-010, TASK-018
**Criterio de done:**

- [ ] Sin `USER_DATA_STREAM_FILLS_ENABLED`: `moduleRef.get(UserDataStreamService)` es `null`; el doble
      de WS registra 0 `connect`/`logon`/`subscribe` y el resolver 0 `resolve`, tras avanzar timers
      falsos más allá de la suma de todos los intervalos `userStream*` (T-03a).
- [ ] El servicio no inyecta `AppGateway` ni `NotificationsService`; `ENTRY_ORDER_WS_EVENTS` no cambia
      (T-03b).
- [ ] `reactive-module-wiring.spec.ts`: el módulo compila y resuelve cada provider nuevo; con el flag
      apagado compila igual sin abrir ninguna conexión.
- [ ] `.env.example` tiene las nueve variables de §1.1 vacías (`USER_DATA_STREAM_FILLS_ENABLED=`
      incluida, apagada por default).

### TASK-023: Centinela de seguridad — clave, firma y `apiKey` nunca en logs (HU-06, tres centinelas)

**Historia:** HU-06
**App:** apps/api/src/reactive
**Descripción:** Extender el centinela en runtime de cycle-01 a tres centinelas:
`apiKey='API-KEY-SENTINEL'`, PEM `'PRIVATE-KEY-SENTINEL'`, `sign()` devolviendo
`'SIGNATURE-SENTINEL'`. Recorrer el ciclo completo (connect → time → logon → subscribe → evento →
relogon → fallo de logon con `-1022` → shutdown) con spies sobre `Logger#log/warn/error/debug` y sobre
`gateway.emitToUser`; assert: ninguna llamada capturada, serializada con `JSON.stringify`, contiene
ninguno de los tres centinelas. Complementos: `JSON.stringify(signer) === '{}'`;
`BinanceWsApiError.message` no contiene ninguno de los tres aunque el request que falló los llevara;
tabla sobre `redactWsApiRequest`. **Prohibido string-matching sobre el texto fuente.**
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-018
**Criterio de done:**

- [ ] El recorrido completo del ciclo (incluido el camino de error) no filtra ninguno de los tres
      centinelas en ningún log ni evento capturado (T-06).
- [ ] `BinanceWsApiError.message` se construye solo con `status/code/msg/method`.

### TASK-024: Test de comportamiento HU-05 CA-2 — la sonda cubre en DEGRADED (issue-5)

**Historia:** HU-05
**App:** apps/api/src/reactive
**Descripción:** En `entry-fill-watch.service.spec.ts` (spec-only, el fuente **no** se toca): publicar
un `UserDataStreamHealthRecord` vencido en `rx:v1:uds:health:{u}:{env}` de la coordinación falsa
(stream en `DEGRADED`), emitir un tick que cruza el nivel de una entrada RESTING, assertear
`settleFill` 1 llamada. Complemento en la misma prueba: la coordinación falsa registra sus `getJson` y
se assertea que `EntryFillWatchService` **no** consultó ninguna clave `rx:v1:uds:health:`.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-018, TASK-006
**Criterio de done:**

- [ ] El test T-05b existe, pasa, y verifica las dos afirmaciones (settle + cero acoplamiento) como
      propiedad de runtime, no por inspección manual del código.

### TASK-025: Listener de `'error'` sobre `BinanceWsClient` en `MarketStreamService` (D-18 parte 2, issue-4 preexistente)

**Historia:** HU-09
**App:** apps/api/src/reactive
**Descripción:** Registrar `error` en el constructor de `MarketStreamService`, junto a
`ticker`/`kline`/`heartbeat` (`market-stream.service.ts:84-86`). El puerto `MarketStreamWsClient` debe
admitir el evento. Tratamiento: `logger.warn(err.message)`. Es un agujero preexistente de cycle-01 (no
una regresión de este ciclo), absorbido explícitamente por el brief.
**Estimación:** 1h · **Story points:** 1
**Dependencias:** ninguna
**Criterio de done:**

- [ ] `emitError` sobre el doble de `BinanceWsClient` en `market-stream.service.spec.ts` no lanza
      (T-09b).

---

## Verificación TESTNET (Carril V, opt-in — no corre en CI, bloqueable)

### TASK-026: Verificación end-to-end contra Binance TESTNET

**Historia:** HU-07
**App:** libs/data-fetcher
**Descripción:** Crear `binance-ws-api.testnet.spec.ts` (Vitest, `dotenv` sin tocar `process.env`,
mismo patrón que el harness de REST). **Triple compuerta** (§11.4): (1) `BINANCE_TESTNET_E2E === '1'`,
si no ⇒ `describe.skip`; (2) `BINANCE_API_TESTNET_ED25519_KEY` **y** una de las dos formas de la
privada (`BINANCE_API_TESTNET_ED25519_PRIVATE_KEY` o `BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PATH`)
presentes — si faltan ⇒ `describe.skip` con un mensaje que dice **literalmente** que la corrida está
bloqueada por ausencia de la credencial Ed25519, no por un defecto del transporte (HU-07 CA-2); (3)
aborto antes del primer frame si `client.getBaseUrl() !== BINANCE_WS_API_TESTNET_URL` o si el
`BinanceRestClient` del harness no apunta a `https://testnet.binance.vision` (HU-07 CA-4, RN-08).
Secuencia que cuenta como evidencia: `connect → time → logon → subscribe → colocar entrada
descansando (prefijo ent-e2e-) → recibir executionReport real → renovación (logon de nuevo) →
reconexión forzada → re-logon + re-subscribe → segundo executionReport real → unsubscribe → logout →
disconnect → barrer ent-e2e-* y confirmar cero órdenes propias abiertas`. Comando exacto:

```bash
set -a && source .env && set +a
BINANCE_TESTNET_E2E=1 pnpm nx test data-fetcher -- --run ws-api
```

**Bloqueo explícito — sin inventar evidencia:** el schema de `tasks.json` de este ciclo solo admite
`pending | in-progress | done | skipped` como `status` (no existe un valor `blocked`). Si al tomar
esta task **`BINANCE_API_TESTNET_ED25519_KEY`** o **ninguna de las dos formas de la privada** están
cargadas en `.env`, el implementador **NO marca esta task `done`**: la deja `pending` (o `in-progress`
si alcanzó a escribir el harness pero no a correrlo), y documenta el bloqueo textualmente en
`cycle.json → issues_found` al cierre del ciclo — "bloqueada por ausencia de la credencial Ed25519 de
TESTNET, no por un defecto del transporte" — para que el Reviewer la deje pendiente en vez de darla
por pasada. Nunca se registra evidencia de una corrida que no ocurrió.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-019, TASK-020, TASK-021, TASK-022
**Criterio de done:**

- [ ] El spec está gateado exactamente con las tres compuertas de §11.4, en ese orden.
- [ ] Sin `BINANCE_TESTNET_E2E=1`, `pnpm nx test data-fetcher` no ejecuta ningún código de esta task
      contra la red.
- [ ] **Si** la clave Ed25519 existe y la corrida se ejecuta: crea una sesión real, la mantiene viva a
      través de al menos una renovación y una reconexión, y recibe al menos un `executionReport` real
      que llega al mismo camino de reconciliación (HU-07 CA-3).
- [ ] La evidencia (envoltura real usada por Binance, forma redactada del `result` de `session.logon`,
      `rateLimits` observados, tiempo fill→evento) se registra en `cycles/cycle-02/artifacts/`.
- [ ] La corrida nunca toca `wss://ws-api.binance.com` (HU-07 CA-4, RN-08).

---

## Orden de ejecución

```
Oleada 1 (sin dependencias, en paralelo — 8 tasks):
  TASK-001, TASK-002, TASK-003, TASK-004, TASK-005, TASK-007, TASK-009, TASK-025

Oleada 2:
  TASK-006  (← TASK-005)
  TASK-008  (← TASK-001, TASK-007)
  TASK-010  (← TASK-001, TASK-002)
  TASK-011  (← TASK-001, TASK-002)

Oleada 3:
  TASK-012  (← TASK-001, TASK-002, TASK-010)
  TASK-013  (← TASK-001, TASK-003, TASK-006, TASK-007, TASK-008, TASK-010, TASK-011)

Oleada 4:
  TASK-014  (← TASK-013)

Oleada 5:
  TASK-015  (← TASK-014)

Oleada 6:
  TASK-016  (← TASK-015)

Oleada 7:
  TASK-017  (← TASK-016)

Oleada 8:
  TASK-018  (← TASK-017, TASK-004)

Oleada 9:
  TASK-019  (← TASK-003, TASK-007, TASK-008, TASK-009, TASK-010, TASK-018)
  TASK-023  (← TASK-018)
  TASK-024  (← TASK-018, TASK-006)

Oleada 10:
  TASK-020  (← TASK-019)
  TASK-021  (← TASK-002, TASK-019)

Oleada 11:
  TASK-022  (← TASK-012, TASK-020, TASK-021)

Oleada 12 (bloqueable — ver TASK-026):
  TASK-026  (← TASK-019, TASK-020, TASK-021, TASK-022)
```

> IDs `TASK-[NNN]` — el scope es el `tasks.json` de este ciclo; los mismos IDs van en ambos archivos.
> El camino crítico real (oleadas 3→8, las seis tasks encadenadas sobre
> `user-data-stream.service.ts`) suma ~24h; con oleada 1-2 en paralelo (varios implementadores) y
> oleadas 9-12 cortas, el ciclo completo cabe en menos de dos semanas incluso con un solo
> implementador de backend corriendo el camino crítico en serie.
