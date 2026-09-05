# Sprint Plan — Cycle 1: User data stream de fills de entrada

> **Input:** sdd/specs/spec-e-burgos-010-user-data-stream-fills/cycles/cycle-01/functional.md
> **Output:** sdd/specs/spec-e-burgos-010-user-data-stream-fills/cycles/cycle-01/planner.md
> **Generado por:** sdd-planner

---

## Resumen del ciclo

| Campo               | Valor                                            |
| -------------------- | ------------------------------------------------- |
| Ciclo                | 1                                                 |
| Módulo               | user-data-stream-fills                           |
| Duración estimada    | ~1 semana (35h, 4-5 devs en paralelo)             |
| Story points totales | 38                                                |
| Apps involucradas    | apps/api, libs/data-fetcher, libs/shared          |

> `libs/shared` figura en `apps` porque el ciclo lo habilita, pero ninguna task de este sprint lo
> toca: apps/api ya depende de libs/data-fetcher (ver `EntryFillWatchService`), así que los tipos
> del listenKey y del executionReport se exportan directo desde libs/data-fetcher sin necesidad de
> vocabulario compartido nuevo. No se inventa carril B.

> El Arquitecto trabaja en paralelo sobre el mismo ciclo. Las tasks de abajo están redactadas en
> términos de CAPACIDAD (qué tiene que existir y comportarse así), no de nombres de clase — el
> Implementador Backend resuelve el nombre exacto contra `architect.md` al tomar cada task.

---

## Carriles de archivos (para ejecución en oleadas paralelas)

| Carril | Área                                  | Tasks                          |
| ------ | -------------------------------------- | ------------------------------- |
| A      | libs/data-fetcher                      | TASK-001, TASK-002              |
| C      | apps/api/src/reactive                  | TASK-004, TASK-005, TASK-006, TASK-007, TASK-008 |
| D      | apps/api (correlación + settleFill)     | TASK-010, TASK-011              |
| E      | composition root (reactive.module.ts)  | TASK-012                        |
| F      | interruptor de plataforma               | TASK-003, TASK-009              |
| G      | verificación TESTNET (opt-in)          | TASK-013                        |

Carril B (libs/shared) queda vacío — ver nota arriba.

---

## Tasks Backend

### TASK-001: Helper REST del ciclo de vida del listenKey

**Historia:** HU-04, HU-06
**App:** libs/data-fetcher
**Descripción:** Agregar a la familia de clientes REST de Binance un helper para
`POST/PUT/DELETE /api/v3/userDataStream` — con header `X-MBX-APIKEY` pero **sin** firma HMAC ni
`timestamp`/`recvWindow` (a diferencia de `signedRequest`). Sumar las tres entradas nuevas a
`ENDPOINT_WEIGHTS`. El helper nunca loguea el `listenKey` recibido ni la API key, ni en éxito ni
en error.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Existe un método reusable "con key pero sin firma" para los tres verbos del endpoint del
      listenKey, con base URL testnet/live separada (mismo patrón que el resto del cliente REST).
- [ ] `ENDPOINT_WEIGHTS` tiene las tres entradas nuevas.
- [ ] Test con doble de transporte (sin red) que cubre create/renew/close y el caso de error del
      exchange (4xx/5xx) sin que el listenKey ni la API key aparezcan en ningún log o excepción
      capturados por el test.

### TASK-002: Cliente WS del endpoint single-stream del listenKey

**Historia:** HU-01, HU-04, HU-06
**App:** libs/data-fetcher
**Descripción:** Nueva clase de cliente WS para `.../ws/<listenKey>` (JSON crudo, sin el envelope
`{ stream, data }` del combined stream que usa `BinanceWsClient`). Reutiliza el patrón de
reconexión/backoff/heartbeat ya probado, pero se construye por credencial y por modo (testnet/live
con URLs distintas). Emite un evento tipado para `executionReport` y un evento distinguible cuando
el exchange invalida la sesión (mensaje de error / cierre de socket). El tipo del evento se exporta
desde esta lib para que apps/api lo consuma sin vocabulario nuevo en libs/shared.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Clase nueva, independiente de `BinanceWsClient`, que abre `.../ws/<listenKey>`, reconecta con
      el mismo backoff ya probado, y expone el evento `executionReport` parseado y tipado.
- [ ] Distingue el evento de invalidación de sesión de un cierre de socket genérico.
- [ ] Test con un doble de WS (patrón `FakeWsClient extends EventEmitter`), sin red: conexión,
      reconexión, evento de invalidación, parseo de un `executionReport` de ejemplo.

### TASK-003: Interruptor de plataforma (variable de entorno)

**Historia:** HU-03
**App:** apps/api
**Descripción:** Exponer un booleano de configuración leído de una variable de entorno (mismo
patrón que `SHARED_SIGNAL_CACHE_ENABLED` de spec-001 cycle-03), default `false`. NO es una columna
de `TradingConfig`, no toca `trading-config-wire.ts` ni `advanced-fields.ts` ni los locales de la
SPA.
**Estimación:** 1h · **Story points:** 1
**Dependencias:** ninguna
**Criterio de done:**

- [ ] El flag se lee de una variable de entorno propia de plataforma, con default `false` cuando
      la variable no está seteada.
- [ ] Test unitario del helper de config: default apagado, y encendido cuando la variable es `1`/`true`.
- [ ] Ningún archivo de `apps/web` ni `libs/shared/src/types/trading-config-wire.ts` aparece en el
      diff de esta task.

### TASK-004: Umbrales nuevos en `reactive-runtime-thresholds.ts`

**Historia:** HU-04, HU-05
**App:** apps/api
**Descripción:** Centralizar en `reactive-runtime-thresholds.ts` los números mágicos que necesita
este ciclo: intervalo de keepalive del listenKey, colchón de renovación antes del vencimiento de 60
minutos, y edad máxima sin evento/keepalive antes de declarar el canal degradado o caído. Ningún
otro archivo del ciclo declara estos valores dispersos.
**Estimación:** 1h · **Story points:** 1
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Los tres umbrales nuevos existen en este archivo y en ningún otro.
- [ ] Test que verifica los valores expuestos y su invariante básica (colchón de renovación menor
      al plazo de vencimiento de 60 minutos).

### TASK-005: Lease por credencial sobre `ReactiveCoordinationPort`

**Historia:** HU-04, HU-05
**App:** apps/api/src/reactive
**Descripción:** Adquisición/renovación/liberación de un lease por `(userId, isTestnet)` sobre
`ReactiveCoordinationPort`, con un key space propio (NO reutilizar el de `MarketStreamService`, que
es por símbolo) — garantiza una única suscripción viva por dueño y ambiente aunque el dueño tenga
varios bots corriendo o haya varias réplicas del servicio. Si la coordinación no está disponible
(Redis caído / `DisabledReactiveCoordination`), el servicio no crashea y no compite por el
listenKey: cede el terreno a que la sonda por tick y la reconciliación sigan cubriendo los fills.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-004
**Criterio de done:**

- [ ] Adquisición, renovación y liberación del lease usan un key space exclusivo de este ciclo,
      distinto del de `MarketStreamService`.
- [ ] Con más de un intento concurrente de adquirir el lease para la misma credencial, solo uno lo
      obtiene.
- [ ] Con la coordinación deshabilitada/no disponible, el servicio no lanza excepción ni intenta
      operar como dueño.
- [ ] Test con un doble de coordinación en memoria (patrón `createSharedFakeCoordination`), sin red.

### TASK-006: Ciclo de vida del listenKey orquestado por el lease

**Historia:** HU-04, HU-06
**App:** apps/api/src/reactive
**Descripción:** Al adquirir el lease (TASK-005), crear el listenKey usando el helper de TASK-001;
programar su renovación periódica antes de que venza (usando el colchón de TASK-004); si el
exchange invalida la sesión, renegociar una nueva sin intervención humana; al liberar el lease o
apagar el servicio, cerrar el listenKey explícitamente. El listenKey nunca se persiste en Postgres
en claro: vive en memoria o en Redis con TTL corto, igual que el estado efímero de
`StreamHealthService`.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-001, TASK-005
**Criterio de done:**

- [ ] Crear/renovar/cerrar el listenKey ocurre exactamente en los momentos descritos (adquisición
      de lease, antes del vencimiento con el colchón configurado, invalidación por el exchange,
      liberación del lease/shutdown).
- [ ] El listenKey no aparece en ninguna columna Postgres ni en ningún log del test.
- [ ] Test con el doble del helper REST (TASK-001) y reloj falso para el temporizador de
      keepalive, sin red.

### TASK-007: Conexión y consumo del WS del listenKey

**Historia:** HU-01, HU-04
**App:** apps/api/src/reactive
**Descripción:** Con un listenKey vigente (TASK-006), abrir el cliente de TASK-002 apuntando a la
URL correcta según testnet/live; ante una reconexión del cliente, verificar que el listenKey sigue
vigente y renegociar si hace falta; exponer los `executionReport` parseados hacia el resto del
servicio reactivo.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-002, TASK-006
**Criterio de done:**

- [ ] La conexión WS se abre con la URL de testnet o de live según el modo de la credencial.
- [ ] Una reconexión del cliente no deja el servicio escuchando con un listenKey vencido.
- [ ] Test con el doble de WS (TASK-002) y el doble del helper REST, sin red.

### TASK-008: Modelo de salud/staleness de la suscripción

**Historia:** HU-05
**App:** apps/api/src/reactive
**Descripción:** Estado observable (sano / degradado / caído) derivado de la antigüedad del último
`executionReport` recibido y del último keepalive confirmado del listenKey — nunca interpretar la
ausencia de fills como salud (RN-03): silencio y caída se distinguen por antigüedad de señal, no
por ausencia de eventos de fill. Mientras está degradado o caído, la sonda por tick sigue cubriendo
los fills sin que este servicio la reemplace ni la desactive (RN-05). Al volver a sano, retoma la
detección rápida sin intervención del operador.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-006, TASK-007
**Criterio de done:**

- [ ] Existe un estado observable distinto entre sano, degradado y caído, calculado sobre la
      antigüedad de la última señal (evento o keepalive), no sobre la presencia de fills.
- [ ] Con reloj falso: cero eventos pero keepalive reciente = sano; keepalive vencido o socket
      caído = degradado/caído.
- [ ] El estado vuelve a sano automáticamente al recibir una señal nueva tras la degradación, sin
      llamada manual.
- [ ] Test con reloj falso, sin red.

### TASK-009: Guard de apagado sobre la adquisición del lease

**Historia:** HU-03
**App:** apps/api/src/reactive
**Descripción:** El flujo de adquisición de lease (TASK-005) consulta el interruptor de plataforma
(TASK-003) antes de intentar cualquier otra cosa. Con el flag en su valor de fábrica (apagado), no
se adquiere lease, no se crea listenKey, no se abre WS — la sonda por tick queda como único
detector, exactamente como antes de este ciclo.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-003, TASK-005
**Criterio de done:**

- [ ] Con el flag apagado, ningún doble de coordinación, de REST ni de WS registra invocación
      alguna al inicializar el servicio.
- [ ] Con el flag encendido, el flujo de adquisición de lease procede normalmente (sin cambiar el
      comportamiento verificado en TASK-005).
- [ ] Test que arranca el servicio con el flag apagado y afirma cero llamadas a los dobles.

## Tasks Backend — correlación e idempotencia (Carril D)

### TASK-010: Correlación executionReport → entry_orders RESTING

**Historia:** HU-01, HU-02
**App:** apps/api
**Descripción:** Resolver, a partir de un `executionReport` (tipo exportado en TASK-002), la fila
`entry_orders` en estado `RESTING` correspondiente — primero por `clientOrderId`, y si no resuelve,
por los identificadores de respaldo de esa misma orden (`orderId`/`orderListId`) — y delegar al
`settleFill` **existente** de `EntryOrderService`. Prohibido cualquier camino de reconciliación
paralelo (D1-2): esta task solo resuelve la fila y llama al método existente, nunca crea
`Position`/`Trade`/`BotAction` por su cuenta. Si el aviso no corresponde a ninguna orden `RESTING`
(cancelada, ya resuelta, o inexistente por ningún identificador), no produce ningún efecto.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-002
**Criterio de done:**

- [ ] Resuelve por `clientOrderId` y cae a los identificadores de respaldo solo si el principal no
      encuentra una orden `RESTING`.
- [ ] Delega exclusivamente a `settleFill` — ningún otro efecto de escritura en este código.
- [ ] Un `executionReport` que no matchea ninguna orden `RESTING` por ningún identificador no
      produce ningún efecto observable.
- [ ] Test con stubs de `EntryOrderService`/Prisma (sin red): match por principal, match por
      respaldo, sin match, y orden ya no `RESTING`.

### TASK-011: Deduplicación de redeliveries del mismo executionReport

**Historia:** HU-02
**App:** apps/api
**Descripción:** Binance reentrega el mismo `executionReport` tras una reconexión del WS. El claim
CAS de `settleFill` cubre que no se duplique la escritura en base, pero no evita que la capa de
correlación (TASK-010) dispare una notificación nueva, un evento WS nuevo o una llamada REST
redundante para una redelivery del mismo evento ya resuelto. Agregar, sobre la capa de
correlación, una deduplicación por la clave lógica del evento (con ventana corta) que hace que el
efecto observable de una redelivery sea nulo.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-010
**Criterio de done:**

- [ ] Dos entregas idénticas y consecutivas del mismo `executionReport` producen un único intento
      de notificación/evento WS/llamada REST — la segunda es un no-op observable.
- [ ] La deduplicación no interfiere con dos `executionReport` distintos de la misma orden (por
      ejemplo, un fill parcial seguido del fill final).
- [ ] Test que envía la misma redelivery dos veces y verifica el no-op en la segunda, sin red.

## Composition root (Carril E)

### TASK-012: Wiring del módulo reactivo

**Historia:** HU-01, HU-04
**App:** apps/api
**Descripción:** Registrar en `reactive.module.ts` (y en el módulo de trading si la correlación
vive ahí) los providers nuevos: helper REST del listenKey (TASK-001), cliente WS del listenKey
(TASK-002), lease + ciclo de vida (TASK-005/006), consumo WS (TASK-007), salud (TASK-008), guard de
apagado (TASK-009) y correlación + dedup (TASK-010/011) — con factory providers por credencial y
por modo, siguiendo el patrón ya existente para `BinanceWsClient`/`BinanceRestClient`/
`REACTIVE_COORDINATION`. Lo que no quede registrado acá queda huérfano y ningún test lo detecta.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-001, TASK-002, TASK-006, TASK-007, TASK-008, TASK-009, TASK-010, TASK-011
**Criterio de done:**

- [ ] El módulo resuelve todas las dependencias nuevas sin providers faltantes.
- [ ] Test de wiring con el `TestingModule` de Nest: el módulo compila y resuelve cada provider
      nuevo.
- [ ] Con el flag de plataforma apagado (TASK-003/009), el módulo compila igual sin abrir ninguna
      conexión.

## Verificación TESTNET (Carril G, opt-in — no corre en CI)

### TASK-013: Verificación end-to-end contra Binance TESTNET

**Historia:** HU-07
**App:** apps/api
**Descripción:** Spec de verificación real contra Binance TESTNET, gateada por
`process.env.BINANCE_TESTNET_E2E === '1' ? describe : describe.skip` (mismo patrón que
`entry-order.integration.testnet.spec.ts`), usando `BINANCE_API_TESTNET_KEY`/`_SECRET`. Crea,
renueva y cierra un listenKey real, coloca (o reutiliza el flujo existente para colocar) una orden
resting en TESTNET, y confirma que se recibe al menos un `executionReport` real. Nunca corre contra
el ambiente real de Binance, ni por excepción.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-012
**Criterio de done:**

- [ ] El spec está gateado exactamente con el mismo patrón de opt-in que
      `entry-order.integration.testnet.spec.ts` — `skip` cuando la variable no está en `'1'`.
- [ ] Sin la variable de entorno, `pnpm nx test apps/api` no ejecuta ningún código de esta task
      contra la red.
- [ ] Con la variable en `1` y credenciales de TESTNET válidas, la corrida crea, renueva y cierra
      un listenKey real y observa al menos un `executionReport` real.
- [ ] La evidencia de al menos una corrida exitosa queda registrada como parte del cierre del ciclo
      (el Reviewer la referencia en `cycle.json`).

---

## Orden de ejecución

```
Oleada 1 (sin dependencias, en paralelo):
  TASK-001, TASK-002, TASK-003, TASK-004

Oleada 2:
  TASK-005 (← TASK-004)
  TASK-010 (← TASK-002)

Oleada 3:
  TASK-006 (← TASK-001, TASK-005)
  TASK-009 (← TASK-003, TASK-005)
  TASK-011 (← TASK-010)

Oleada 4:
  TASK-007 (← TASK-002, TASK-006)

Oleada 5:
  TASK-008 (← TASK-006, TASK-007)

Oleada 6:
  TASK-012 (← TASK-001, TASK-002, TASK-006, TASK-007, TASK-008, TASK-009, TASK-010, TASK-011)

Oleada 7:
  TASK-013 (← TASK-012)
```

> IDs `TASK-[NNN]` — el scope es el `tasks.json` de este ciclo; los mismos IDs van en ambos
> archivos.
