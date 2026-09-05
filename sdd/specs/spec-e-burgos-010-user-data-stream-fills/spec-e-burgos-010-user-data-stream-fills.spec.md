# Spec e-burgos-010 — Fills de entrada por user data stream de Binance

> **Autor:** e-burgos · **Fecha:** 2026-09-04 · **Estado:** in-progress
> **Módulo:** user-data-stream-fills
> **Subproyectos:** `apps/api`, `libs/data-fetcher`, `libs/shared`

## 1. Contexto y diagnóstico

`spec-e-burgos-005 cycle-02` empujó la **entrada** al exchange: el bot puede dejar una orden
`LIMIT_MAKER` u `OCO` descansando en Binance (`TradingConfig.entryOrderMode`, tabla `entry_orders`)
en vez de comprar siempre a mercado. `spec-e-burgos-009 cycle-02` cerró la mitad de UI: la pestaña
**Entradas** de la SPA consume `EP-017` y se refresca en vivo con los seis eventos
`entry-order:*`.

Queda abierto el eslabón del medio: **cómo se entera el backend de que la entrada se llenó.**

### Hallazgos

**A. El fill se descubre por sondeo, no por evento.** El único detector de fills de entrada es una
sonda que corre **por tick de mercado** (`apps/api/src/trading/entry-fill-watch.service.ts`),
más el barrido de `ReconciliationService` al arrancar el servicio. Ninguno de los dos es un
evento del exchange: el primero pregunta, el segundo repara. Entre el fill real y el momento en
que la sonda pregunta hay una ventana en la que la posición existe en Binance y **no existe**
para el sistema: sin fila `Position`, sin `Trade`, y sobre todo **sin protección nativa** (SL/TP
u OCO), que es exactamente lo que el resto de la plataforma da por sentado.

**B. La ventana depende del mercado, no del sistema.** La sonda cuelga del stream de mercado: su
frecuencia la fija la llegada de ticks del símbolo, no una garantía del backend. En un símbolo
quieto —o con el stream de mercado degradado, condición que `StreamHealthService` ya sabe
detectar— la ventana sin protección se alarga sin que nada la acote. El detector se vuelve más
lento justo cuando el mercado está raro, que es cuando importa.

**C. Binance ya publica el evento y el repo no lo escucha.** El user data stream
(`POST/PUT/DELETE /api/v3/userDataStream` para el ciclo de vida del `listenKey`, y el evento
`executionReport` sobre `wss://.../ws/<listenKey>`) es el canal que Binance provee para esto. Un
grep de `listenKey` / `userDataStream` / `executionReport` sobre el árbol **no devuelve nada**:
es capacidad del proveedor que el sistema no consume. El riel de transporte, en cambio, ya existe
y está probado: `BinanceWsClient` (`libs/data-fetcher`) con `autoReconnect`, y el patrón de
supervisión + staleness + fallback que `spec-e-burgos-005 cycle-01` dejó montado en
`apps/api/src/reactive/` para el stream de mercado.

**D. El propio ciclo que dejó la sonda anotó este ciclo como su continuación.** El contexto de
`apps/api` lo registra: _"La invalidación del caché de posiciones del fast path desde la
reconciliación queda acotada por el TTL del caché: solo el user data stream de Binance la
eliminaría al instante (fuera de alcance, spec-005 cycle-02)"_. No es un descubrimiento nuevo: es
la deuda que ese ciclo dejó firmada.

## 2. Objetivo

Que un fill de una entrada descansando se detecte **por evento del exchange** y no por sondeo, de
modo que la reconciliación a `Position` + `Trade` + protección inicial ocurra en el orden de
segundos desde el fill y no en el orden del próximo tick.

El aporte de este ciclo es **latencia de detección y previsibilidad de la ventana sin
protección**, no funcionalidad nueva visible: la SPA no cambia, los eventos no cambian, los
endpoints no cambian.

**La sonda por tick no se elimina.** Pasa de ser el detector único a ser la red de contención: el
stream es el camino rápido, la sonda es el camino que sigue funcionando cuando el stream no está
sano. Un sistema con dos detectores del mismo hecho vale por su idempotencia, no por su
velocidad — y esa idempotencia es el verdadero entregable de esta spec.

## 3. Alcance por ciclo

### Cycle-01 — User data stream con fallback a la sonda existente

1. **Ciclo de vida del `listenKey`.** Crear (`POST`), renovar por keepalive antes del vencimiento
   de 60 minutos (`PUT`) y cerrar (`DELETE`) en el shutdown, por credencial de trading y por modo
   (`LIVE`/`TESTNET`, base URL distinta). El `listenKey` es material sensible de sesión: no se
   loguea, no se persiste en claro, no viaja a la SPA.
2. **Suscripción y supervisión.** Conexión WS por `listenKey` con reconexión y backoff, y
   renegociación del `listenKey` cuando el exchange lo invalida. Una sola suscripción viva por
   credencial aunque varios bots del mismo dueño estén activos.
3. **Reconciliación disparada por `executionReport`.** El evento que corresponde a una fila
   `entry_orders` en estado `RESTING` (correlacionada por `clientOrderId`, con `orderId` /
   `orderListId` como respaldo) entra por **el mismo camino de reconciliación que ya existe**, no
   por uno nuevo: `Position` + `Trade` + protección inicial + contabilidad `bot_actions` con
   `source: EXCHANGE_TRIGGER`.
4. **Idempotencia como requisito, no como consecuencia.** Un fill visto dos veces por el stream,
   o visto por el stream y por la sonda, o por la sonda y por el barrido de arranque, produce
   **una** `Position`, **un** `Trade` y **una** fila de `bot_actions`. La transición
   `RESTING → FILLED` es el punto de serialización y el segundo observador no hace nada.
5. **Staleness y degradación explícita.** Edad del último evento/keepalive por suscripción. Con el
   stream degradado o caído, el sistema declara el estado y la sonda por tick sigue siendo el
   detector, sin que nada quede sin cubrir. El silencio del user data stream nunca se interpreta
   como "no hubo fills" — un stream sin eventos y un stream muerto se ven igual desde afuera.
6. **Interruptor apagado por default.** Toda la capa nace detrás de un flag de `TradingConfig` que
   se entrega en `false`: con el default, el comportamiento observable es idéntico al actual y el
   detector sigue siendo la sonda.

### Cycle-02 — Migración del transporte a la WebSocket API (`session.logon` + Ed25519)

Cycle-01 quedó **inerte**: Binance retiró `POST /api/v3/userDataStream` (410 Gone en TESTNET y en
producción, ver DEC-001). El objetivo de la spec no cambia; cambia el riel por el que viaja.

1. **Reemplazo del transporte, no del diseño.** Se sustituye únicamente el par
   `listenKey REST` + `wss://.../ws/<listenKey>` por la **WebSocket API** de Binance
   (`wss://ws-api.binance.com/ws-api/v3`, TESTNET `wss://ws-api.testnet.binance.vision/ws-api/v3`):
   `session.logon` autenticado con una clave **Ed25519**, seguido de `userDataStream.subscribe`.
   El payload de `executionReport` es el mismo, así que el mapper `toEntryFillStatus` no cambia.
2. **Se reutiliza todo lo que es independiente del transporte**, ya construido y verde en cycle-01:
   lease de credencial sobre `ReactiveCoordinationPort`, máquina de estados del ciclo de vida,
   correlación con `entry_orders` (incluido el respaldo por sufijo `-l` / `-s` de la OCO),
   deduplicación de reentregas, publicación de salud y staleness, interruptor apagado por default y
   wiring del composition root.
3. **Ciclo de vida propio del nuevo transporte.** La sesión de `session.logon` reemplaza al
   keepalive de 60 minutos del `listenKey`: renovación/relogon antes del vencimiento de sesión,
   `session.logout` o cierre limpio en el shutdown, y re-`logon` + re-`subscribe` tras cualquier
   reconexión del socket.
4. **Credencial Ed25519 nueva, provista por el dev.** El diseño no puede asumir que la clave ya
   existe: las variables de entorno se declaran explícitamente en `architect.md`, el arranque con la
   clave ausente deja la capa apagada sin romper nada, y la corrida contra TESTNET es opt-in local.
5. **Follow-ups de cycle-01 que sobreviven al cambio de transporte** entran como tasks de este
   ciclo: liberación del lease en el camino de renegociación fallida, listener de `'error'` sobre el
   cliente WS, backoff en los reintentos, marcado de identidad vista sólo tras el settle, alineación
   de `isUserDataStreamFillsEnabled()` con D-08, purga de cachés y el test de comportamiento de
   HU-05 CA-2.

### Ciclos posteriores (no comprometidos en esta spec)

- Consumir del mismo stream los eventos de las órdenes de **protección** (`prot-`) y de las ventas,
  hoy también reconciliadas por sondeo.
- Invalidación inmediata del caché de posiciones del fast path (deuda anotada por spec-005 cycle-02).

## 4. No-objetivos (fuera de esta spec)

| Excluido                                                                    | Dónde va                                        |
| --------------------------------------------------------------------------- | ----------------------------------------------- |
| Cambios en la SPA, en `EP-017` o en los seis eventos `entry-order:*`        | Ninguno — el requisito es que **no** cambien    |
| Reconciliación por stream de órdenes de protección y de salida              | Ciclo posterior                                 |
| Futuros USDⓈ-M, `fapi`, SHORT, apalancamiento                               | `spec-e-burgos-007`                             |
| Verificación contra Binance LIVE                                            | Prohibido — ver §5                              |
| Fills simulados en SANDBOX                                                  | Fuera: la capa es LIVE/TESTNET, igual que spec-005 cycle-02 |
| Nuevos endpoints REST                                                       | No se agrega ninguno en cycle-01                |

## 5. Restricciones de diseño (heredadas, no negociables)

- **Todo interruptor de comportamiento de trading nace apagado.** Una instalación que despliegue
  sin tocar su config debe producir exactamente las mismas órdenes, los mismos eventos y la misma
  secuencia observable que antes.
- **Un campo nuevo de `TradingConfig` debe declararse en `CreateTradingConfigDto` **y**
  `UpdateTradingConfigDto`**: con `forbidNonWhitelisted: true`, si falta en uno el request entero
  responde 400.
- **`libs/trading-engine` nunca depende de `libs/data-fetcher`.** El vocabulario común vive en
  `libs/shared`.
- **La lib decide, `apps/api` orquesta.** El cliente de `libs/data-fetcher` es transporte: no
  toca Prisma, no decide reconciliación.
- **Nunca LIVE.** La verificación contra el exchange es **solo TESTNET**, con las credenciales de
  testnet del `.env`. No se arranca un bot LIVE, no se colocan órdenes LIVE, no se abre un user
  data stream contra la base URL de producción de Binance durante el ciclo. El harness aborta si
  la base URL no es la de testnet.
- **CI no llega a Binance (HTTP 451).** Los tests unitarios y de integración que corren en CI no
  pueden tocar la red: el stream se verifica contra un doble de transporte. La corrida contra
  TESTNET es local y su evidencia se registra en el ciclo.
- **Sin comentarios narrativos en el código** (regla ✍️ del dual-harness).
- **Prohibido testear sobre el texto fuente** de un rango entre dos símbolos: las invariantes se
  afirman sobre comportamiento observable o sobre un símbolo concreto.
- **Secretos:** el `listenKey` y las claves de API no se escriben en logs, ni en la BD en claro, ni
  en payloads de WS hacia la SPA.

## 6. Criterios de aceptación de la spec

| ID     | Criterio                                                                                                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CA-001 | Con el interruptor apagado (default de entrega), el comportamiento observable es idéntico al actual: la sonda por tick sigue siendo el detector, no se abre ninguna conexión de user data stream y no se llama ningún endpoint de `listenKey`. |
| CA-002 | Con el interruptor encendido, un `executionReport` de fill de una entrada `RESTING` produce la reconciliación completa (`Position` + `Trade` + protección inicial + `bot_actions` con `source: EXCHANGE_TRIGGER`) sin esperar al próximo tick de mercado. |
| CA-003 | **Idempotencia:** el mismo fill entregado dos veces por el stream, o por el stream y por la sonda, o por la sonda y por el barrido de arranque, produce exactamente una `Position`, un `Trade` y una fila de `bot_actions`. Se verifica con assert de conteo, en ambos órdenes de llegada. |
| CA-004 | Los seis eventos `entry-order:*` y el contrato de `EP-017` no cambian: el mismo fill emite el mismo evento con el mismo payload, venga del stream o de la sonda. La SPA no requiere ningún cambio. |
| CA-005 | El `listenKey` se renueva antes de su vencimiento y se cierra en el shutdown; cuando el exchange lo invalida, el sistema renegocia uno nuevo y vuelve a suscribirse sin intervención. |
| CA-006 | Con el stream de user data caído o stale, el estado degradado es observable y la sonda por tick sigue detectando fills: ningún fill queda sin reconciliar por la caída del stream. El silencio nunca se reporta como salud. |
| CA-007 | Ningún log, respuesta de API o payload de WebSocket contiene el `listenKey` ni una clave de API. |
| CA-008 | La suite de `apps/api`, `libs/data-fetcher` y `libs/shared` pasa sin acceso a red; la verificación contra Binance TESTNET queda registrada como evidencia del ciclo, ejecutada localmente y nunca contra LIVE. |

> **Reinterpretación vigente desde cycle-02 (DEC-001).** Donde CA-001, CA-005 y CA-007 dicen
> `listenKey`, léase **la sesión autenticada de la WebSocket API** (`session.logon` + `userDataStream.subscribe`)
> y **la clave privada Ed25519**: el criterio es el mismo — no abrir sesión ni pedir credencial con el
> interruptor apagado, renovar la sesión antes de que venza y cerrarla en el shutdown, y no filtrar
> jamás el material sensible. El resto de los criterios no cambia porque no dependen del transporte.

## 7. Decisiones (DEC)

### DEC-001 — El transporte del user data stream migra a la WebSocket API (2026-09-04)

**Contexto.** `cycle-01` implementó la detección de fills sobre el ciclo de vida REST del
`listenKey` (`POST/PUT/DELETE /api/v3/userDataStream`) más el socket single-stream
`wss://.../ws/<listenKey>`. Al ejercitarlo contra el exchange, ese endpoint respondió **`410 Gone`
desde nginx** — no desde la capa de aplicación de Binance — tanto en `testnet.binance.vision` como
en `api.binance.com`, mientras `GET /api/v3/ping` seguía en `200`. Se comprobó dos veces y sin
credenciales, así que no es firma, ni key, ni IP: el endpoint está **retirado**.

**Evidencia.** `cycles/cycle-01/artifacts/testnet-verification-2026-09-04.md` y el issue bloqueante
#1 de `cycles/cycle-01/cycle.json`.

**Consecuencia.** `cycle-01` entrega 13/13 tasks en `done` con la suite verde (982 tests de `apps/api`)
pero su `reviewer_report.approved` queda en `false` y HU-07 CA-2/CA-3 en `FAIL`: el mecanismo está
construido y verificado contra dobles, e **inerte** contra la Binance de hoy. No hay regresión ni
cambio observable en producción porque el interruptor se entrega apagado.

**Decisión (del dev, 2026-09-04).** No revertir ni parquear: **migrar el transporte** en `cycle-02` a
la WebSocket API de Binance — `wss://ws-api.binance.com/ws-api/v3` (TESTNET
`wss://ws-api.testnet.binance.vision/ws-api/v3`), `session.logon` autenticado con una clave
**Ed25519** que el dev crea en su cuenta de TESTNET, y luego `userDataStream.subscribe`. Se conserva
todo lo que no depende del transporte (lease, máquina de estados, correlación, deduplicación, salud,
interruptor, wiring); se reemplaza únicamente el helper REST del `listenKey` y
`BinanceUserDataStreamClient`.

**Verificación previa del transporte (2026-09-04, sin credenciales).** Socket abierto contra
`wss://ws-api.testnet.binance.vision/ws-api/v3`: `ping` → `status 200`; `time` → `status 200`
(`serverTime`); `userDataStream.subscribe` sin sesión → `status 400`, `code -1193`
(_"WebSocket session not authenticated. Recommendation: use `session.logon`"_); `session.logon` sin
parámetros → `status 400`, `code -1102` (_"Mandatory parameter 'apiKey' was not sent"_). El
transporte responde y expone exactamente los dos métodos que el diseño necesita. Registrado también
en `cycles/cycle-02/brief.yaml`.
