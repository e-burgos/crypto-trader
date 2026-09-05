# Architect — Cycle 1: User data stream de fills de entrada

> **Input:** sdd/specs/spec-e-burgos-010-user-data-stream-fills/cycles/cycle-01/functional.md
> **Output:** sdd/specs/spec-e-burgos-010-user-data-stream-fills/cycles/cycle-01/architect.md
> **Generado por:** sdd-architect (claude/opus, effort high)

---

## 0. Resumen ejecutivo — el ciclo en una frase

Un servicio nuevo en `apps/api/src/reactive/` toma un **lease por credencial**, negocia un
`listenKey` contra Binance, abre un socket **single-stream** con un cliente nuevo de
`libs/data-fetcher`, traduce cada `executionReport` terminal a un `EntryOrderExchangeStatus`
idéntico al que ya produce el poll REST, lo correlaciona con la fila `entry_orders` RESTING y llama
al **mismo `EntryOrderService.settleFill`**. Nada más cambia: ni la sonda, ni la reconciliación, ni
la SPA, ni el schema, ni la API.

**Corrección de un supuesto del brief, con evidencia** (el reviewer valida contra esto):
`must_resolve` afirma que *«el claim CAS de settleFill cubre la BD, pero NO la notificación ni el
evento WS»*. **Es inexacto.** En `apps/api/src/trading/entry-order.service.ts` el guard
`if (claimed.count === 0) return 'ALREADY_SETTLED';` está en la línea 281, y
`notificationsService.create(...)` y `gateway.emitToUser(..., 'entry-order:filled', ...)` están en
las líneas ~352 y ~366 — **después** del claim. Un segundo observador que llegue a `settleFill`
sobre una fila ya `FILLED` sale antes de notificar y antes de emitir. Lo que el claim
**efectivamente NO cubre** está en §7.2; es un conjunto distinto y más chico del que el brief
suponía, y el diseño lo cierra igual.

---

## 1. Decisiones técnicas

### D-01 — Lease por credencial: key space propio sobre `ReactiveCoordinationPort`

**Unidad de exclusión:** `(userId, env)` con `env ∈ {'live','testnet'}`, derivado de
`config.mode === TradingMode.TESTNET`. Es 1:1 con la fila `binance_credentials`
(`@@unique([userId, isTestnet])`).

**Claves (prefijo versionado `rx:v1:`, regla de `constitution.md` §3.4):**

| Clave | Contenido | TTL |
| --- | --- | --- |
| `rx:v1:uds:owner:{userId}:{env}` | `instanceId` del dueño (lease CAS) | `userStreamOwnerLeaseTtlMs` |
| `rx:v1:uds:health:{userId}:{env}` | `UserDataStreamHealthRecord` (sin secretos) | `userStreamHealthTtlMs` |

**Por qué no se reutiliza `rx:v1:owner:{symbol}`:** ese lease es por símbolo porque el dato es
público y una conexión sirve a todos los usuarios. Éste es por credencial: escala con usuarios
activos, no con símbolos, y dos claves distintas con la misma semántica de dueño en el mismo
namespace producirían un dueño de símbolo bloqueando un stream de usuario. Key space separado, no
negociable.

**Primitivas exactas:** `tryAcquire` / `renew` / `release` de `ReactiveCoordinationPort` (CAS en Lua
sobre `SET NX PX` en `redis-reactive-coordination.service.ts`). El sweep de adquisición corre cada
`userStreamSweepIntervalMs`; la renovación cada `userStreamOwnerRenewIntervalMs`, mismo patrón que
`MarketStreamService.renewOwnership`.

**Por qué el lease es obligatorio, independientemente de cómo se comporte Binance.** Hay dos
hipótesis en circulación sobre `POST /api/v3/userDataStream` con un `listenKey` ya activo: (a)
devuelve uno nuevo e invalida el socket anterior, o (b) devuelve el mismo y extiende su validez. El
diseño **no puede depender de cuál es cierta**, porque las dos son igual de dañinas sin lease: (a)
produce un loop de churn entre réplicas; (b) produce N réplicas recibiendo el **mismo**
`executionReport` (trabajo duplicado, N llamadas REST) y —peor— un `DELETE` emitido por cualquiera
de ellas **corta el stream de todas**. El lease vuelve las dos hipótesis irrelevantes: hay un solo
emisor de `POST`, de `PUT` y de `DELETE` por credencial.

**Regla de oro derivada:** `POST`/`PUT`/`DELETE` de `/api/v3/userDataStream` se emiten **únicamente
mientras se sostiene el lease**. Antes de cada `PUT` de keepalive y antes del `DELETE` de cierre, se
revalida la tenencia (`renew` exitoso). Un `DELETE` sin lease es la falla más cara del ciclo.

**Redis caído / `DisabledReactiveCoordination`** (landmine 8): `tryAcquire` devuelve `false` ⇒ la
réplica nunca es dueña ⇒ **no crea listenKey, no abre socket, no arranca timers**. No hay churn, no
hay crash, no hay estado indefinido. La cobertura de fills queda enteramente en la sonda por tick y
en la reconciliación, que por D-07 **no se gatean nunca**. Además:

- Al bootstrap, si `isHealthy() === false` y `isEnabled?.() !== false`, se loguea una vez a nivel
  `error` siguiendo el precedente `COORDINATION_UNAVAILABLE_AT_BOOTSTRAP`; si el driver está
  deliberadamente apagado (`isEnabled?.() === false`) **no se loguea nada** — es configuración, no
  falla.
- Sin lease no se puede publicar el health record ⇒ `getJson` devuelve `null` ⇒ el resolver da
  `UNKNOWN` ⇒ se trata como `DEGRADED` (fail-closed, precedente de `StreamHealthState.UNKNOWN` en
  `libs/shared`). El sistema **nunca reporta sano** un stream que no existe.

**Pérdida del lease en caliente** (`renew` devuelve `false`): secuencia estricta y en este orden —
(1) parar el timer de keepalive, (2) `wsClient.disconnect()`, (3) **NO** emitir `DELETE` (ya no somos
dueños; el `DELETE` mataría el stream del nuevo dueño), (4) descartar el `listenKey` de memoria, (5)
dejar de publicar health para esa credencial. El `listenKey` huérfano vence solo en ≤60 min o lo
supersede el `POST` del nuevo dueño.

### D-02 — El `listenKey` vive **solo en la memoria de la réplica dueña**

**Prohibido Postgres en claro** (dado). **Y también se descarta Redis con TTL.** Justificación, no
preferencia:

1. **Redis en este despliegue persiste a disco.** `constitution.md` de `apps/api` §3.5: Redis 7
   corre con **AOF** y `noeviction` porque sostiene colas Bull y leases. Un `SET` con TTL escribe el
   valor en el append-only file; el TTL lo saca del keyspace, **no del historial del AOF** hasta la
   próxima reescritura. Guardar ahí material bearer es peor que la intuición de "TTL corto" sugiere,
   y contradice RN-07 ("no se persiste en texto plano en un almacenamiento compartido").
2. **No hay un segundo lector.** El único componente que necesita el `listenKey` es el socket de la
   réplica dueña. Publicarlo en Redis no habilita ningún consumidor: habilita un atacante.
3. **El failover no lo necesita.** El dueño entrante emite `POST` y obtiene un `listenKey` válido
   (nuevo o el mismo extendido). Recuperar la cadena anterior no ahorra ni una llamada.
4. **Costo aceptado y acotado:** ante un `SIGKILL` no se alcanza a emitir el `DELETE`. El key vence
   solo en ≤60 min y el `POST` del nuevo dueño lo supersede o lo extiende. En apagado ordenado,
   `onApplicationShutdown` emite el `DELETE` (HU-04 CA-3).

**Qué SÍ va a Redis:** el `instanceId` del lease (no es secreto) y el `UserDataStreamHealthRecord`,
cuyo tipo tiene lista de campos congelada (§9) y **no contiene ni el `listenKey` ni ninguna
derivación suya** — ni un hash, ni un prefijo, ni una longitud.

### D-03 — Helper REST "con key y sin firma" en `BinanceRestClient`

`signedRequest` no sirve: firma HMAC sobre el query string, agrega `timestamp`+`recvWindow` y su tipo
de método es `'GET' | 'POST' | 'DELETE'` (no admite `PUT`). Los tres endpoints del `listenKey` piden
**solo el header `X-MBX-APIKEY`** — que el constructor ya setea cuando hay `apiKey` — y **rechazan**
firma y timestamp.

**Método privado nuevo:**

```ts
private async keyedRequest<T>(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  params: Record<string, string> = {},
): Promise<{ data: T }>
```

Lanza `Error('API key is required for user data stream requests')` si `!this.apiKey`. **No** exige
`apiSecret`. No agrega `timestamp`, ni `recvWindow`, ni `signature`.

**Métodos públicos nuevos:**

| Método | Endpoint | Devuelve |
| --- | --- | --- |
| `createListenKey(): Promise<string>` | `POST /api/v3/userDataStream` | `data.listenKey` |
| `keepAliveListenKey(listenKey: string): Promise<void>` | `PUT /api/v3/userDataStream?listenKey=…` | — |
| `closeListenKey(listenKey: string): Promise<void>` | `DELETE /api/v3/userDataStream?listenKey=…` | — |

**Entradas nuevas en `ENDPOINT_WEIGHTS`** (una por método, como el precedente de `/api/v3/orderList`):

```ts
{ prefix: '/api/v3/userDataStream', method: 'POST',   weight: 2 },
{ prefix: '/api/v3/userDataStream', method: 'PUT',    weight: 2 },
{ prefix: '/api/v3/userDataStream', method: 'DELETE', weight: 2 },
```

Dos notas que el implementador no puede saltear:

- **Peso 2 es deliberadamente conservador.** Binance documentó 1 en versiones anteriores y 2 en las
  vigentes. Declarar de más solo vuelve al limitador local **más** prudente, nunca menos: es la
  dirección segura del error.
- **`getEndpointWeight` matchea por `startsWith` en orden de array.** Verificado: ningún prefijo
  existente es prefijo de `/api/v3/userDataStream` (`'/api/v3/order'` no lo es: `u ≠ o`), y ninguna
  URL existente empieza con el prefijo nuevo. No hay colisión y la posición en el array es libre —
  pero la regla sigue siendo la que obligó a separar `/api/v3/orderList` de `/api/v3/order`.

**Errores relevantes:** `-1125` (`This listenKey does not exist`) en el `PUT` es la señal canónica de
key vencido o invalidado; **no es reintentable** y dispara la renegociación (D-06). No se agrega a
`RETRYABLE_BINANCE_ERROR_CODES`.

### D-04 — Cliente WS nuevo: `BinanceUserDataStreamClient`

`BinanceWsClient` no sirve y no se extiende: construye la URL como `/stream?streams=…`, parsea el
envelope `{ stream, data }` y asume una conexión multiplexada compartida entre símbolos. El endpoint
del `listenKey` es single-stream (`/ws/<listenKey>`), entrega JSON crudo y es **por credencial**.
Ensancharlo con condicionales convertiría a la clase que sostiene todo el riel de mercado en un
punto de falla común entre datos públicos y una suscripción autenticada.

**Archivo:** `libs/data-fetcher/src/lib/binance/binance-user-data-stream.client.ts`, exportado desde
el barrel de la lib.

```ts
export const BINANCE_USER_STREAM_WS_URL = 'wss://stream.binance.com:9443';
export const BINANCE_TESTNET_USER_STREAM_WS_URL = 'wss://stream.testnet.binance.vision';

export interface BinanceUserDataStreamConfig {
  testnet?: boolean;                 // elige la base URL; NUNCA se hardcodea en el call site
  baseUrl?: string;                  // override explícito (solo tests)
  autoReconnect?: boolean;           // default true
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  wsPingIntervalMs?: number;
  wsPongTimeoutMs?: number;
}

export class BinanceUserDataStreamClient extends EventEmitter {
  constructor(config?: BinanceUserDataStreamConfig);
  connect(listenKey: string): void;   // el key es ARGUMENTO, no config
  disconnect(): void;
  isConnected(): boolean;
  getBaseUrl(): string;               // guarda de aborto del harness TESTNET
}
```

**`connect(listenKey)` toma el key como argumento y no como campo de configuración.** Es una decisión
de seguridad, no de estilo: un objeto de config se loguea entero con naturalidad ("config del
cliente"), un argumento de método no. El key se guarda en un campo privado, no se expone por getter y
la clase no define `toJSON`.

**Eventos emitidos** (nombres en kebab-case, precedente `symbol-owned`/`symbol-released`):

| Evento | Payload | Cuándo |
| --- | --- | --- |
| `connected` | `{ at: number }` | `open` del socket |
| `disconnected` | `{ at: number; code: number \| null }` | `close` |
| `reconnecting` | `{ at: number; attempt: number; delayMs: number }` | antes de cada reintento |
| `heartbeat` | `{ at: number }` | `ping` o `pong` del socket |
| `execution-report` | `ExecutionReportEvent` | mensaje con `e === 'executionReport'` |
| `stream-expired` | `{ at: number; reason: 'LISTEN_KEY_EXPIRED' \| 'RECONNECT_EXHAUSTED' }` | ver abajo |
| `error` | `Error` | error del socket |

Los tipos de evento que no interesan (`outboundAccountPosition`, `balanceUpdate`,
`listStatus`) se **ignoran en silencio**, igual que hoy `handleMessage` ignora streams desconocidos.
Un mensaje malformado se descarta sin lanzar (precedente exacto del `catch {}` de
`BinanceWsClient.handleMessage`).

**Reconexión.** Backoff exponencial con jitter, en vez del delay fijo de 5 s de `BinanceWsClient`:
`delay = min(reconnectBaseDelayMs * 2^attempt, reconnectMaxDelayMs)` con ±20 % de jitter (misma
convención que `protection-retry.ts`). El contador se resetea en cada `open` exitoso. Motivo: un
socket autenticado puede estar cerrándose porque la credencial fue revocada; martillar cada 5 s para
siempre es el peor comportamiento posible contra el rate limit del exchange.

**Heartbeat:** idéntico a `BinanceWsClient` — `ws.ping()` cada `wsPingIntervalMs`, `ws.terminate()`
si no llega `pong` en `wsPongTimeoutMs`. Es el mecanismo que ya resolvió el modo de falla del socket
medio abierto (silencio permanente sin `close`), y en este stream ese modo es **más** peligroso
porque el silencio es indistinguible del funcionamiento normal (RN-03).

**El cliente es transporte y nada más.** No conoce Prisma, no conoce credenciales, **no emite
ninguna llamada REST** y no sabe qué es un `listenKey` más allá de una cadena que va en la URL.
Cuando el key muere, emite `stream-expired` y se detiene; renegociar es responsabilidad de
`apps/api` (D-06). Esto respeta la restricción "la lib es transporte".

**Construcción por credencial y por modo:** el call site nunca instancia la clase con una URL
literal. `reactive.module.ts` provee una **factory** (§10), y la factory elige la base URL a partir
de `testnet`. El bug latente que esto previene está a la vista hoy: el provider de
`MARKET_STREAM_WS_CLIENT` hardcodea mainnet — correcto para ticks públicos, **inaceptable** para una
suscripción autenticada, donde apuntar un `listenKey` de testnet a mainnet es un fallo silencioso.

**Tipo del evento parseado** (vive en `libs/data-fetcher`, junto a su parser, igual que
`TickerUpdate`/`KlineUpdate`; **no** va a `libs/shared` porque `libs/trading-engine` no lo necesita y
la regla del vocabulario compartido existe para ese caso concreto):

```ts
export interface ExecutionReportEvent {
  eventTimeMs: number;                  // E
  transactionTimeMs: number;            // T
  symbol: string;                       // s
  clientOrderId: string;                // c
  originalClientOrderId: string | null; // C  ('' -> null)
  side: 'BUY' | 'SELL';                 // S
  orderType: string;                    // o
  executionType: string;                // x
  orderStatus: string;                  // X
  orderId: string;                      // i  (number -> String, para casar con EntryOrder.orderId)
  orderListId: string | null;           // g  (-1 -> null, precedente de listOpenOrders)
  orderQuantity: number;                // q
  lastExecutedQuantity: number;         // l
  cumulativeFilledQuantity: number;     // z
  lastExecutedPrice: number;            // L
  cumulativeQuoteQuantity: number;      // Z
  tradeId: string | null;               // t  (-1 -> null)
}
```

### D-05 — Correlación `executionReport` → fila `entry_orders` RESTING

**Clave primaria de correlación: `normalizeEntryClientOrderId(report.clientOrderId)` contra
`entry_orders.clientOrderId`** (`findUnique`; es la única constraint única de la tabla).

**Éste es el landmine que rompe la implementación ingenua.** Un `where: { clientOrderId: report.c }`
directo **nunca matchea una entrada OCO**. `LiveOrderExecutor.placeEntryOrder`
(`libs/trading-engine/src/lib/order-executor.ts:664`) coloca las piernas con
`belowClientOrderId: \`${clientOrderId}-l\`` y `aboveClientOrderId: \`${clientOrderId}-s\``, mientras
que la fila guarda el `listClientOrderId` **sin sufijo**. El `executionReport` de la pierna trae el
id **con** sufijo. `normalizeEntryClientOrderId` (`entry-order.service.ts:65`, `replace(/-(l|s)$/,'')`)
ya existe para exactamente esto y la reconciliación ya lo usa — reusarla, no reinventarla.

**Respaldo** (solo si el primario no resuelve), con el índice existente `[userId, status]`:

```ts
prisma.entryOrder.findFirst({
  where: {
    userId, status: 'RESTING', symbol: report.symbol,
    OR: [
      { orderId: report.orderId },
      { limitLegOrderId: report.orderId },
      { stopLegOrderId: report.orderId },
      ...(report.orderListId ? [{ orderListId: report.orderListId }] : []),
    ],
  },
})
```

Cubre los cuatro identificadores que la fila guarda: `orderId` para `LIMIT_MAKER`, las dos piernas y
el `orderListId` para OCO. **No hace falta índice nuevo**: el conjunto RESTING por usuario es chico y
`[userId, status]` ya lo acota (justificación de por qué `sdd/schema.json` no se toca, §11).

**Guardas antes de aceptar el match:** `report.side === 'BUY'`, `row.symbol === report.symbol` y
`row.status === 'RESTING'`. Un `clientOrderId` que matchea con símbolo distinto se descarta.

**Nota sobre `C` (`originalClientOrderId`):** en eventos de cancelación Binance manda un `c` nuevo y
pone el original en `C`. Como este ciclo **solo actúa sobre `orderStatus === 'FILLED'`** (D-06), `c`
siempre es el id vivo y `C` no se usa para correlacionar. Se parsea igual, para diagnóstico.

**`executionReport` que no matchea ninguna fila: es lo normal, no un error.** Se descarta **sin
ningún efecto**: sin notificación, sin evento WS, sin llamada REST, sin fila nueva. Se loguea a nivel
`debug` (nunca `warn`/`error`) y se cuenta en un contador en memoria. Motivos legítimos, todos
esperables en un stream sano: una OCO de protección (`prot-`), una venta, una orden manual del
usuario en la web de Binance, una entrada ya resuelta por la sonda, u otra instalación de la
plataforma sobre la misma API key. **Loguear esto como error convertiría el funcionamiento normal en
ruido de alerta.** Lo que sí hace un reporte no correlacionado es **refrescar el reloj de
frescura**: prueba que el stream está vivo.

### D-06 — Qué dispara un settle, y con qué payload (paridad exacta con el poll REST)

**Función pura nueva**, sin Nest, sin Prisma, sin I/O — unitariamente testeable sin red:

```ts
// apps/api/src/reactive/execution-report-fill.ts
export function toEntryFillStatus(
  report: ExecutionReportEvent,
): EntryOrderExchangeStatus | null;
```

Devuelve `null` salvo que `side === 'BUY' && orderStatus === 'FILLED' && cumulativeFilledQuantity > 0`.
En ese caso:

| Campo de `EntryOrderExchangeStatus` | Valor |
| --- | --- |
| `state` | `'FILLED'` |
| `filledLeg` | `'STOP'` si `orderType === 'STOP_LOSS_LIMIT'`; `'LIMIT'` si `'LIMIT_MAKER'`; si no `null` |
| `executedPrice` | `cumulativeQuoteQuantity > 0 ? cumulativeQuoteQuantity / cumulativeFilledQuantity : null` |
| `executedQuantity` | `cumulativeFilledQuantity` |
| `remainingQuantity` | `orderQuantity - cumulativeFilledQuantity` |
| `partial` | `false` (siempre, por construcción) |
| `orderId` | `report.orderId` |

Es **paridad campo por campo** con `BinanceRestClient.toEntryOrderStatus` (líneas 961-1006): el
precio ejecutado es el promedio ponderado `quoteQty / executedQty` en los dos caminos, no el precio
del último trade. Eso es lo que hace verdadera a HU-01 CA-3 ("el mismo contenido de información sea
cual sea el detector") y lo vuelve verificable (§12, T-3).

**Decisión de fondo — el stream NO liquida fills parciales.** Binance emite un `executionReport` por
trade: una orden que se llena en cinco trades produce cuatro `PARTIALLY_FILLED` y un `FILLED`. La
sonda REST mapea `PARTIALLY_FILLED` con `executedQty > 0` a `FILLED` con `partial: true` — pero la
sonda observa como mucho cada 15 s, típicamente **después** de que la orden terminó de llenarse. El
stream ve el **primer** trade en milisegundos. Aplicar la misma regla haría que el stream liquide
sistemáticamente órdenes a una fracción de la cantidad, cancelando un remanente que estaba por
llenarse solo — un cambio de comportamiento económico, no una optimización de latencia.

Consecuencias, todas deseables:

- Un parcial que se completa se liquida al llegar el `FILLED`: latencia igual de buena, cantidad
  correcta.
- Un parcial que **se estanca** lo sigue cubriendo la sonda, con exactamente la semántica de hoy: no
  hay regresión, solo ausencia de mejora en ese caso de borde. Es el precio correcto por no romper
  la aritmética de la posición.
- Como este camino jamás pasa `partial: true`, **nunca ejecuta el `cancelOnExchange` previo al
  claim** de `settleFill` — que es la única llamada REST que el claim CAS no protege (§7.2).
- La pierna que Binance vence al llenarse la otra en un OCO llega como `orderStatus: 'EXPIRED'` y
  cae en el `null`: no genera un segundo settle sobre la misma fila.

### D-07 — La sonda por tick y la reconciliación **no se gatean**

**Decisión: siguen corriendo sin condición, incluso con el stream sano.** Es la decisión más
importante del ciclo después de la idempotencia.

**Costo cuantificado de dejarlas (peso de rate limit):**

- `EntryFillWatchService.probeEntry` solo dispara cuando el tick cruza el nivel y con debounce de
  `entryFillProbeDebounceMs` (15 s) por `(entryOrderId, leg)`. Tras un settle por stream, la fila
  deja de ser RESTING, pero `restingEntriesCache` tiene TTL `symbolRefreshIntervalMs` (30 s) ⇒ **como
  mucho 2 sondas extra por pierna**. `getEntryOrderStatus` pesa 4 (`GET /api/v3/order`) ⇒ **≤8 de
  peso por fill `LIMIT_MAKER`, ≤16 por fill OCO**, contra un presupuesto de 1100/min por IP en
  `BinanceRateLimiter`. Es **≤1,5 %** de un minuto de presupuesto, una sola vez por fill.
- `ReconciliationService.reconcileEntryOrder` poléa una vez por orden RESTING por ciclo de decisión
  del LLM. Tras un settle por stream la orden ya **no** es RESTING ⇒ deja de polearse. El costo de
  reconciliación **baja**, no sube.
- Costo propio del stream, para comparar: 1 socket + 1 `POST` al conectar + 4 `PUT`/hora (peso 2 c/u
  ⇒ 8 de peso/hora) + 1 `DELETE` al cerrar, por credencial.

**Costo cuantificado en notificaciones "que parecen duplicadas": cero.** Verificado en el código, no
supuesto: el guard `claimed.count === 0 → 'ALREADY_SETTLED'` (línea 281) precede a
`notificationsService.create` (~352) y a `gateway.emitToUser('entry-order:filled')` (~366). El
segundo detector se retira antes de ambos. El único gasto residual es una consulta Prisma y un
`getEntryOrderStatus`.

**Por qué NO gatear, aunque el costo fuera mayor:** gatear la sonda con "el stream está sano"
convierte la red de contención en **dependiente de la señal de salud**. Un falso `HEALTHY` —el modo
de falla exacto contra el que RN-03 nos advierte— apagaría los **dos** detectores a la vez y dejaría
la posición sin protección justo en el escenario que este ciclo existe para eliminar. Fail-open es
estrictamente más seguro que fail-closed acá, y el costo medido lo hace barato. RN-05 lo pide y este
diseño lo cumple **por construcción, no por configuración**: no existe ninguna variable que apague la
sonda.

### D-08 — Interruptor a nivel plataforma (D1-1: de acuerdo, sin disenso)

`process.env.USER_DATA_STREAM_FILLS_ENABLED === 'true'`, precedente literal de
`SignalCacheService` (`apps/api/src/cache/signal-cache.service.ts:42`) y de
`REACTIVE_COORDINATION_DRIVER`. **Se entrega apagado** (variable ausente ⇒ `false`).

**Se lee exactamente una vez, en el composition root** (`reactive.module.ts`, dentro de la factory
del provider), nunca dentro de la lógica del servicio. Apagado ⇒ el servicio **no se instancia**:
sin `onModuleInit`, sin timers, sin `tryAcquire`, sin `POST`, sin socket. HU-03 CA-1 se cumple por
ausencia de código en ejecución, que es más fuerte que un `if` interno.

Sin columna de `TradingConfig`, sin migración, sin cambio en `libs/shared/src/types/trading-config-wire.ts`,
sin cambio en `apps/web/src/components/config/advanced/advanced-fields.ts` ni en los locales.
**El architect coincide con D1-1 y no propone ninguna columna por bot.** La unidad correcta es la
credencial `(userId, env)`: dos bots del mismo dueño comparten forzosamente la suscripción, así que
un flag por bot ni siquiera sería expresable sin ambigüedad.

---

## 2. Servicio nuevo en `apps/api` — `UserDataStreamService`

**Archivo:** `apps/api/src/reactive/user-data-stream.service.ts`.
**Cableado:** `ReactiveModule` (ya importa `TradingModule`, `PrismaModule`,
`ReactiveCoordinationModule`, `GatewayModule`, `NotificationsModule` — no hace falta ninguna
importación nueva de módulo, y por lo tanto no se toca el grafo de módulos de `constitution.md` §3.4).

**Puertos estructurales declarados en `apps/api`** (mismo patrón que `MarketStreamWsClient` /
`MarketStreamRestClient` — lo que hace testeable el servicio sin red):

```ts
export const USER_STREAM_REST_FACTORY = Symbol('USER_STREAM_REST_FACTORY');
export const USER_STREAM_WS_FACTORY = Symbol('USER_STREAM_WS_FACTORY');

export interface UserStreamRestClient {
  createListenKey(): Promise<string>;
  keepAliveListenKey(listenKey: string): Promise<void>;
  closeListenKey(listenKey: string): Promise<void>;
  getBaseUrl(): string;
}
export interface UserStreamWsClient {
  on(event: string, listener: (...args: any[]) => void): unknown;
  off(event: string, listener: (...args: any[]) => void): unknown;
  connect(listenKey: string): void;
  disconnect(): void;
  isConnected(): boolean;
  getBaseUrl(): string;
}

export type UserStreamRestFactory =
  (creds: { apiKey: string; apiSecret: string; testnet: boolean }) => UserStreamRestClient;
export type UserStreamWsFactory =
  (opts: { testnet: boolean }) => UserStreamWsClient;
```

**Estado por credencial suscripta** (en memoria, nunca serializado):

```ts
interface OwnedCredentialStream {
  userId: string;
  env: 'live' | 'testnet';
  listenKey: string;            // material bearer — no sale de este objeto
  ws: UserStreamWsClient;
  rest: UserStreamRestClient;
  connectedAt: number;
  lastHeartbeatAtMs: number;
  lastKeepaliveAtMs: number;
  lastEventAtMs: number | null; // informativo; NO decide salud
  keepaliveTimer: NodeJS.Timeout | null;
  reconnectAttempts: number;
}
```

### 2.1 Conjunto de credenciales a suscribir

Unión de dos consultas, refrescada cada `userStreamSubscriptionRefreshIntervalMs` (30 s, espejo de
`resolveActiveConfigs`):

1. `tradingConfig.findMany({ where: { isRunning: true, mode: { in: [LIVE, TESTNET] }, entryOrderMode: { not: 'MARKET' } }, select: { userId, mode } })` — mantiene el socket **caliente antes** de
   la primera orden, para que un fill inmediato no caiga en la ventana del sweep.
2. `entryOrder.findMany({ where: { status: 'RESTING' }, select: { userId, mode } })` — cubre órdenes
   cuyo bot se detuvo pero cuya orden sigue viva en el exchange.

`SANDBOX` nunca participa (fuera de alcance por brief). Una credencial que sale del conjunto se
libera con la secuencia de cierre ordenado (§2.3).

### 2.2 Máquina de estados por credencial

| Estado | Entrada | Salida |
| --- | --- | --- |
| `IDLE` | inicial, o tras release | `tryAcquire` OK → `NEGOTIATING` |
| `NEGOTIATING` | dueño sin key | `createListenKey()` OK → `CONNECTING`; error → `IDLE` + backoff |
| `CONNECTING` | key en mano | `ws.connect(key)` → evento `connected` → `LIVE`; `disconnected` → `RECONNECTING` |
| `LIVE` | socket abierto | `renew` OK cada 10 s; `PUT` cada 15 min |
| `RECONNECTING` | socket cerrado | backoff del cliente; `attempts ≥ userStreamReconnectAttemptsBeforeRenegotiate` → `stream-expired(RECONNECT_EXHAUSTED)` → `NEGOTIATING` |
| `RELEASING` | lease perdido, credencial fuera del set, o shutdown | ver §2.3 |

**Renegociación (HU-04 CA-2)** — se dispara por cualquiera de tres señales, y todas convergen al
mismo camino:

1. evento `stream-expired` con `LISTEN_KEY_EXPIRED` (el `e: 'listenKeyExpired'` de Binance),
2. `keepAliveListenKey` que falla con `-1125`,
3. `userStreamReconnectAttemptsBeforeRenegotiate` reconexiones consecutivas fallidas.

Camino: revalidar lease → `ws.disconnect()` → `closeListenKey(viejo)` **best-effort, envuelto en
try/catch, ignorando el error** (el key ya puede no existir) → `createListenKey()` →
`ws.connect(nuevo)`. Todo sin intervención humana.

**Keepalive (HU-04 CA-1):** `PUT` cada `userStreamKeepaliveIntervalMs`. Si un `PUT` falla con un
error reintentable, se reintenta en el siguiente tick del timer. Si
`now - lastKeepaliveAtMs > userStreamKeyExpiryMs - userStreamKeepaliveGraceMs`, se renegocia sin
esperar más `PUT`s. Con 15 min de cadencia y 10 min de colchón sobre un vencimiento de 60 min, hay
**tres** intentos antes de tocar el colchón y la renegociación ocurre como muy tarde 10 min antes del
vencimiento.

### 2.3 Cierre ordenado

`onApplicationShutdown` y salida del conjunto de suscripción, en este orden estricto:
parar timers → `ws.disconnect()` → **si y solo si seguimos siendo dueños** `closeListenKey(key)` →
`coordination.release(...)` → borrar el estado en memoria. Si el lease ya se perdió, se salta el
`DELETE` (D-01). Cumple HU-04 CA-3.

### 2.4 Camino del evento (el único camino de reconciliación — RN-01, D1-2)

```
execution-report
  → lastEventAtMs = now                       (frescura; nunca decide salud)
  → dedupe por identidad (§7.3)               ← primero, para que la reentrega no cueste nada
  → toEntryFillStatus(report)  →  null ⇒ descartar en silencio
  → correlación (D-05)         →  null ⇒ descartar en silencio (debug + contador)
  → resolver config (cache por configId) y executor (cache por `${userId}:${isTestnet}`)
  → entryOrderService.settleFill({ userId, config, symbol, mode, executor, order, status })
  → 'SETTLED'  ⇒ fastPath.invalidateOpenPositions(order.configId)
    'ALREADY_SETTLED' ⇒ no hacer nada
    'REMAINDER_CANCEL_FAILED' ⇒ inalcanzable desde este camino (partial siempre false)
```

**Prohibido**, y el reviewer lo verifica: este servicio **no** crea `Position`, **no** crea `Trade`,
**no** escribe `bot_actions`, **no** llama a `placeInitialProtection` y **no** emite ningún evento
`entry-order:*` por su cuenta. Todo eso ocurre exclusivamente dentro de `settleFill`.

**Credenciales y executor:** se reusa el patrón ya probado de
`EntryFillWatchService.resolveCredentials` (caché por `${userId}:${isTestnet}` con TTL, `decrypt` de
`users/utils/encryption.util.ts`) y `resolveExecutor`
(`new LiveOrderExecutor(new BinanceRestClient({ apiKey, apiSecret, testnet }))`). El executor hace
falta porque `settleFill` lo necesita para `placeInitialProtection`.

---

## 3. Umbrales nuevos — `reactive-runtime-thresholds.ts`

Todos en `ReactiveRuntimeThresholds` y en `DEFAULT_REACTIVE_RUNTIME_THRESHOLDS`. Ninguno se escribe
como literal en un servicio.

```ts
userStreamOwnerLeaseTtlMs: 30_000,
userStreamOwnerRenewIntervalMs: 10_000,
userStreamSweepIntervalMs: 10_000,
userStreamSubscriptionRefreshIntervalMs: 30_000,
userStreamKeyExpiryMs: 3_600_000,          // contrato de Binance: 60 min
userStreamKeepaliveIntervalMs: 900_000,    // 15 min → 3 intentos antes del colchón
userStreamKeepaliveGraceMs: 600_000,       // 10 min de colchón antes del vencimiento
userStreamHeartbeatMaxAgeMs: 240_000,      // 4 min
userStreamKeepaliveMaxAgeMs: 2_400_000,    // 40 min
userStreamHealthPublishIntervalMs: 5_000,
userStreamHealthTtlMs: 25_000,
userStreamReconnectBaseDelayMs: 1_000,
userStreamReconnectMaxDelayMs: 30_000,
userStreamReconnectAttemptsBeforeRenegotiate: 3,
userStreamSeenEventTtlMs: 600_000,
userStreamSeenEventCacheSize: 500,
```

**Invariantes, verificados por un test unitario sobre las constantes** (así el umbral no se puede
desajustar por un cambio suelto):

1. `userStreamKeepaliveIntervalMs + userStreamKeepaliveGraceMs < userStreamKeyExpiryMs`
2. `userStreamKeepaliveMaxAgeMs < userStreamKeyExpiryMs`
3. `userStreamKeepaliveIntervalMs < userStreamKeepaliveMaxAgeMs`
4. `userStreamOwnerRenewIntervalMs < userStreamOwnerLeaseTtlMs`
5. `userStreamHealthTtlMs > userStreamHealthPublishIntervalMs`

---

## 4. Modelo de salud / staleness (RN-03: el silencio nunca es salud)

**Tipo nuevo en `libs/shared/src/types/interfaces.ts`**, junto al bloque `── Reactive Market Stream ──`.
Va a `libs/shared` —y no a `data-fetcher`— porque lo produce `apps/api` y lo consume `libs/analysis`,
que no puede depender de `data-fetcher` (mismo motivo que `StreamHealthRecord`).

```ts
export interface UserDataStreamHealthRecord {
  credentialKey: string;          // `${userId}:${env}` — jamás listenKey ni apiKey
  ownerId: string;
  connectedAt: number;
  lastHeartbeatAtMs: number;
  lastKeepaliveAtMs: number;
  lastEventAtMs: number | null;   // INFORMATIVO — nunca entra al cálculo
  publishedAt: number;
}
```

Todos los campos son primitivos y los instantes van en epoch ms — es la forma **serializada a Redis**
(`setJson`/`getJson`), regla explícita de `libs/shared/constitution.md` §3. Se ata con
`satisfies`/`ExactKeys` a una lista congelada `USER_DATA_STREAM_HEALTH_FIELDS`, precedente de
`ENTRY_ORDER_WIRE_FIELDS`: **agregar un campo que transporte el `listenKey` falla en typecheck**, no
en producción.

**Resolver puro nuevo en `libs/analysis/src/lib/reactive/`**, junto a `stream-health.ts` y con su
misma forma:

```ts
export type UserDataStreamHealthReason =
  | 'NO_RECORD' | 'HEARTBEAT_STALE' | 'KEEPALIVE_STALE' | null;

export function resolveUserDataStreamHealth(input: {
  now: number;
  record: UserDataStreamHealthRecord | null;
  thresholds: { heartbeatMaxAgeMs: number; keepaliveMaxAgeMs: number };
}): { state: StreamHealthState; reason: UserDataStreamHealthReason };
```

Orden de evaluación:

1. `!record` → `UNKNOWN` / `NO_RECORD`
2. `now - lastHeartbeatAtMs > heartbeatMaxAgeMs` → `DEGRADED` / `HEARTBEAT_STALE`
3. `now - lastKeepaliveAtMs > keepaliveMaxAgeMs` → `DEGRADED` / `KEEPALIVE_STALE`
4. → `HEALTHY` / `null`

**`lastEventAtMs` NO es una entrada de la decisión.** Es el corazón de RN-03: un stream sin fills que
avisar y un stream muerto emiten lo mismo (nada), así que la salud se decide por señales que sí
laten cuando no pasa nada — el heartbeat del socket y el keepalive del `listenKey`. Reusa
`StreamHealthState` (`HEALTHY | DEGRADED | UNKNOWN`) y su regla fail-closed: `UNKNOWN` se trata como
`DEGRADED`.

**Publicación:** cada `userStreamHealthPublishIntervalMs`, solo para credenciales cuyo lease se
sostiene, en `rx:v1:uds:health:{userId}:{env}` con TTL `userStreamHealthTtlMs`. Si la réplica muere,
el registro caduca y el estado pasa a `UNKNOWN` ⇒ `DEGRADED`. **La ausencia de dueño nunca se ve como
salud.**

**Observabilidad sin endpoint nuevo** (los endpoints REST nuevos están fuera de alcance por brief):
el estado se expone como (a) el registro en Redis, legible por cualquier réplica, (b) un getter en
proceso `getHealth(userId, env)`, y (c) un log de **transición** de estado (`HEALTHY → DEGRADED` y
vuelta), siguiendo `StreamHealthService.checkTransition`. **No** se agrega evento WS ni notificación:
la SPA no cambia y el silencio del canal no es un problema del trader mientras la sonda cubre (RN-05).

---

## 5. Cambios en schema (sdd/schema.json)

**Ninguno.** No se crea ni se modifica ninguna tabla, columna, índice ni enum.

- La idempotencia ya existe como transición condicional `RESTING → FILLED` (D1-2): no hace falta
  columna de "fill event id" ni constraint nueva. Agregarla sería un segundo mecanismo compitiendo
  con el que ya funciona.
- La deduplicación de reentregas se resuelve en memoria de la réplica dueña (§7.3) porque el problema
  es **local por construcción**: el lease garantiza que la reentrega llega a la misma réplica que ya
  la vio. Persistirla en Postgres sería pagar una escritura por evento para resolver un problema que
  no cruza procesos.
- La correlación de respaldo se apoya en el índice existente `[userId, status]` sobre un conjunto
  RESTING chico por usuario.
- El `listenKey` **no se persiste** (D-02).

⇒ **`sdd/schema.json` no se toca.**

---

## 6. Contratos de API (sdd/api.json)

**Ninguno.** El ciclo no agrega, modifica ni deprecia ningún endpoint REST. `EP-017 GET
/trading/entry-orders` y los seis eventos `entry-order:*` de `ENTRY_ORDER_WS_EVENTS` quedan
**byte-idénticos**: el stream reusa `settleFill`, que ya los emite. No se agrega evento WS nuevo ni
tipo de notificación nueva.

⇒ **`sdd/api.json` no se toca.**

---

## 7. Idempotencia — qué ya está resuelto y qué agrega este ciclo

### 7.1 Lo que ya cubre el claim CAS (no se reimplementa — D1-2)

`settleFill` hace `prisma.entryOrder.updateMany({ where: { id, status: 'RESTING' }, data: { status: 'FILLED', … } })`
y devuelve `'ALREADY_SETTLED'` si `claimed.count === 0`. Es una transición atómica de estado en un
solo statement: dos observadores concurrentes, en la misma réplica o en réplicas distintas, no pueden
ganarla los dos. Cubre `Position`, `Trade`, `bot_actions`, `placeInitialProtection`, **la notificación
y el evento `entry-order:filled`** — los dos últimos porque están después del guard (líneas 281 vs.
~352 y ~366). **RN-02 y HU-02 CA-1/CA-2 quedan satisfechas por el mecanismo existente**, para
cualquier combinación de detectores y cualquier orden de llegada.

### 7.2 Lo que el claim NO cubre, y cómo se cierra

| Hueco | Cómo se cierra |
| --- | --- |
| `cancelOnExchange` corre **antes** del claim cuando `status.partial` ⇒ un `DELETE` REST redundante y muy probablemente un `-2011` | **D-06**: el camino del stream nunca produce `partial: true`, así que nunca entra ahí. El camino de la sonda queda exactamente como hoy. |
| Reentrega del mismo `executionReport` por el propio WS tras reconectar ⇒ consulta Prisma inútil por evento | **§7.3**: dedupe por identidad **antes** de correlacionar. |
| Las dos piernas de un OCO producen dos reportes que correlacionan a la **misma** fila | La pierna vencida llega como `EXPIRED` y `toEntryFillStatus` la descarta. Si igual llegara, el claim la absorbe. |
| Reportes de órdenes ajenas al dominio (`prot-`, ventas, órdenes manuales) | **D-05**: descarte silencioso, sin efectos, sin log de error. |

### 7.3 Deduplicación de reentregas (el aporte de idempotencia propio del ciclo)

**Identidad del evento:**
`${report.symbol}:${report.orderId}:${report.orderStatus}:${report.cumulativeFilledQuantity}`

Estable ante reentrega (Binance reenvía el payload idéntico), distinta entre las dos piernas de un
OCO y distinta entre estados sucesivos de la misma orden.

**Estructura:** `Map<string, number>` (identidad → `seenAt`), acotada por
`userStreamSeenEventCacheSize` con desalojo FIFO y expiración por `userStreamSeenEventTtlMs`. En
memoria y por réplica: es **correcto**, no una simplificación — el lease garantiza que el socket de
una credencial vive en una sola réplica, así que la reentrega que hay que suprimir llega a esa misma
réplica. Si el lease se mueve, el claim CAS sigue siendo la red.

**Posición en el pipeline:** primero de todo, antes de la correlación. Así una reentrega no cuesta ni
una consulta a la base. Ése es el sentido operativo de HU-02 CA-2: *el efecto observable del segundo
aviso es nulo* — y "nulo" acá incluye "ni siquiera una lectura".

---

## 8. Seguridad del material sensible (HU-06 / RN-07)

Reglas de construcción, no de disciplina:

1. El `listenKey` entra al cliente WS como **argumento de `connect()`**, nunca como campo de
   configuración. Un objeto de config se loguea entero con naturalidad; un argumento de método no.
2. `BinanceUserDataStreamClient` guarda el key en un campo privado, no lo expone por getter y no
   define `toJSON`.
3. `UserDataStreamHealthRecord` tiene lista de campos congelada y **ningún campo derivado del key**
   (ni hash, ni prefijo, ni longitud). Agregar uno rompe el typecheck.
4. Ningún payload hacia la SPA cambia (§6) ⇒ el key no puede viajar al navegador.
5. Los mensajes de log del ciclo referencian la credencial por `credentialKey = ${userId}:${env}`,
   nunca por el key ni por la API key.
6. **El `listenKey` viaja en el query string de las tres llamadas REST y en el path del WS.** Es
   exigencia del protocolo de Binance, no una elección. Consecuencia obligatoria: en el `catch` de
   esas llamadas **no se loguea `error.config.url` ni el objeto de error completo** — solo
   `getBinanceErrorCode(error)` y `error.message`. Un log de error genérico de axios imprime la URL
   con el key adentro: es la vía de fuga concreta que HU-06 anticipa, y la única del ciclo.

---

## 9. Criterios de aceptación reinterpretados como propiedades ejecutables

El reviewer valida contra **esta** tabla. Cada reinterpretación conserva la intención del criterio y
la vuelve verificable sin medir un valor puntual.

| Criterio original | Mide un valor | Reinterpretación ejecutable |
| --- | --- | --- |
| **HU-01 CA-1** — protección sin esperar ningún tick | no (ya es propiedad) | Con el doble de `MarketStreamService` sin emitir un solo `tick`, inyectar un `execution-report`; assert: `settleFill` llamado 1 vez y `placeInitialProtection` invocado. |
| **HU-01 CA-3** — mismo contenido para cualquier detector | sí ("el mismo contenido") | Tabla de fixtures pareados (payload REST ↔ `executionReport` del mismo fill): `toEntryFillStatus(report)` debe ser **deep-equal** al `EntryOrderExchangeStatus` que produce el camino REST. Propiedad de paridad, no comparación de textos. |
| **HU-02 CA-2** — el efecto del segundo aviso es nulo | sí ("nulo") | Con la fila ya `FILLED`: spies sobre `notifications.create`, `gateway.emitToUser` y el doble del executor ⇒ **0 llamadas** en los tres; y con reentrega de identidad ya vista, **0 llamadas a Prisma**. |
| **HU-03 CA-1** — no abre conexión ni pide clave | sí ("ninguna") | Sin `USER_DATA_STREAM_FILLS_ENABLED`: el doble REST registra `createListenKey` 0 veces y el doble WS registra `connect` 0 veces, tras arrancar el módulo y avanzar timers falsos más allá de todos los intervalos. |
| **HU-04 CA-1** — "nunca transcurre el plazo completo de vencimiento sin renovación" | **sí** (60 min) | (a) invariante sobre constantes: `keepaliveIntervalMs + keepaliveGraceMs < keyExpiryMs`; (b) con timers falsos, avanzar `userStreamKeyExpiryMs` y assert ≥1 `keepAliveListenKey` exitoso registrado, con `keyExpiryMs` leído del objeto de umbrales, nunca escrito como literal en el test. |
| **HU-04 CA-4** — una sola sesión por dueño y ambiente | no | Dos instancias del servicio contra `createSharedFakeCoordination()`: exactamente **una** llama `createListenKey`; la otra registra 0 llamadas y 0 `connect`. |
| **HU-05 CA-3** — "silencioso" ≠ "muerto" por antigüedad | **sí** (antigüedad) | Test de tabla sobre el resolver puro: variando **solo** `lastEventAtMs` en todo su rango (`null`, `now`, `now - 24 h`) el veredicto **no cambia**; variando `lastHeartbeatAtMs`/`lastKeepaliveAtMs` más allá de su umbral, pasa a `DEGRADED` con la razón correspondiente. Prueba que el silencio no es una entrada del cálculo. |
| **HU-05 CA-2** — ningún fill queda sin reconciliar en degradado | sí ("ninguno") | Propiedad estructural: no existe ninguna ruta de código que condicione `EntryFillWatchService` ni `ReconciliationService` al estado del stream (D-07). Se verifica por comportamiento: con el servicio del stream en `DEGRADED`, un tick que cruza el nivel sigue produciendo `settleFill`. |
| **HU-06 CA-1/CA-2** — el key no aparece en logs ni en respuestas | **sí** (y el test ingenuo sería string-matching del fuente, **prohibido**) | Test de **centinela en runtime**: se recorre el ciclo de vida completo con `listenKey = 'LISTEN-KEY-SENTINEL'` y `apiKey = 'API-KEY-SENTINEL'`, con spies sobre `Logger#log/warn/error/debug` y sobre `gateway.emitToUser`; assert: `JSON.stringify(args)` de **ninguna** llamada capturada contiene ninguno de los dos centinelas. Se ejercita explícitamente el camino de error de `keepAliveListenKey` (el más propenso a filtrar la URL). Es una propiedad sobre argumentos reales, no sobre el texto fuente. |
| **HU-07 CA-1** — la suite pasa sin red | no | `pnpm nx run-many -t test` sobre `api`, `data-fetcher`, `shared`, `analysis` sin variables de TESTNET: verde, y ningún test instancia `BinanceUserDataStreamClient` real. |
| **HU-07 CA-2/CA-3** — evidencia TESTNET, nunca LIVE | sí ("al menos una corrida") | Spec gateado por `BINANCE_TESTNET_E2E === '1'` que **aborta si `getBaseUrl()` no es la URL de testnet** (precedente `binance-rest.client.testnet.spec.ts`), crea/renueva/cierra el `listenKey` y recibe un `execution-report` real; evidencia en `cycle-01/artifacts/`. |

---

## 10. Cableado (`reactive.module.ts`) — dueño explícito del composition root

```ts
{
  provide: USER_STREAM_REST_FACTORY,
  useFactory: (): UserStreamRestFactory =>
    ({ apiKey, apiSecret, testnet }) => new BinanceRestClient({ apiKey, apiSecret, testnet }),
},
{
  provide: USER_STREAM_WS_FACTORY,
  useFactory: (): UserStreamWsFactory =>
    ({ testnet }) => new BinanceUserDataStreamClient({
      testnet,
      wsPingIntervalMs: DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.wsPingIntervalMs,
      wsPongTimeoutMs: DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.wsPongTimeoutMs,
      reconnectBaseDelayMs: DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamReconnectBaseDelayMs,
      reconnectMaxDelayMs: DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamReconnectMaxDelayMs,
    }),
},
{
  provide: UserDataStreamService,
  useFactory: (prisma, coordination, entryOrders, fastPath, restFactory, wsFactory) =>
    process.env.USER_DATA_STREAM_FILLS_ENABLED === 'true'
      ? new UserDataStreamService(prisma, coordination, entryOrders, fastPath,
          restFactory, wsFactory, DEFAULT_REACTIVE_RUNTIME_THRESHOLDS, randomUUID())
      : null,
  inject: [PrismaService, REACTIVE_COORDINATION, EntryOrderService, FastPathService,
           USER_STREAM_REST_FACTORY, USER_STREAM_WS_FACTORY],
}
```

`ReactiveModule` ya importa todo lo necesario (`PrismaModule`, `ReactiveCoordinationModule`,
`TradingModule` → `EntryOrderService`); **no cambia el grafo de módulos** de `constitution.md` §3.4 y
`reactive-module-wiring.spec.ts` sigue siendo el candado. `instanceId` con `randomUUID()`, igual que
`MarketStreamService`. El provider se agrega a `exports` solo si otro módulo lo necesita — hoy no lo
necesita ninguno.

---

## 11. Estrategia de pruebas sin red (CI recibe 451 de Binance)

**Dobles de transporte** (patrón exacto de `market-stream.service.spec.ts`):

- `FakeUserStreamWsClient extends EventEmitter implements UserStreamWsClient` — `connect(listenKey)`
  registra el key recibido, `disconnect`, `isConnected`, `getBaseUrl`, más helpers de test
  `emitExecutionReport(partial)`, `emitListenKeyExpired()`, `emitClose()`, `emitHeartbeat()`.
- `FakeUserStreamRestClient implements UserStreamRestClient` — `createListenKey` devuelve un
  centinela con contador y cuenta llamadas; `keepAliveListenKey`/`closeListenKey` registran
  invocaciones; switch `failNextWith(code)` para forzar el camino `-1125`.
- **Coordinación:** `createSharedFakeCoordination()` ya existe en `market-stream.service.spec.ts`.
  **Extraerlo a `apps/api/src/reactive/reactive-coordination.test-double.ts`** e importarlo desde los
  dos specs: dos implementaciones divergentes del mismo doble es exactamente el tipo de duplicación
  que este repo evita. Es un archivo solo de tests; el cambio en el spec existente es un import.
- Timers falsos de Jest para keepalive, sweep de lease, publicación de salud y backoff — precedente
  de los tests de heartbeat de `data-fetcher`.

**Verificación TESTNET (opt-in, local, nunca CI):** vive en **`libs/data-fetcher`**, extendiendo el
harness ya existente `binance-rest.client.testnet.spec.ts` (Vitest, gateado por
`BINANCE_TESTNET_E2E === '1'`, con aborto si `getBaseUrl()` no es `https://testnet.binance.vision`).
Motivo de la ubicación: crear/renovar/cerrar el `listenKey` y recibir un `executionReport` real
requiere **solo** el cliente REST y el cliente WS nuevos, los dos de esta lib — no hace falta
levantar Nest contra testnet, y el harness ya barre `ent-e2e-*` al terminar. La lógica de
correlación (incluida la normalización `-l`/`-s`) se prueba unitariamente en `apps/api`, sin red.

```bash
set -a && source .env && set +a
BINANCE_TESTNET_E2E=1 pnpm nx test data-fetcher -- --run testnet
```

**Prohibiciones vigentes:** ningún test hace string-matching sobre el texto fuente; ninguna prueba
toca Binance LIVE; el harness aborta antes de la primera llamada si la base URL no es la de testnet.

---

## 12. Dependencias externas

**Ninguna nueva.** `ws` y `axios` ya son dependencias de `libs/data-fetcher`. No se agrega paquete
npm, ni servicio externo, ni infraestructura: Redis, Postgres y Bull quedan como están.

---

## 13. Registros SDD tocados por el architect

| Registro | Estado |
| --- | --- |
| `sdd/api.json` | **No modificado** — el ciclo no agrega ni cambia endpoints (§6). |
| `sdd/schema.json` | **No modificado** — sin tablas, columnas, índices ni enums nuevos (§5). |
| `sdd/cycle.json`, `tasks.json`, `global.json`, `specs/index.json` | No tocados — los escribe el orquestador. |

---

## 14. Preguntas abiertas que requieren decisión humana

1. **Ninguna que bloquee la implementación, y ningún disenso con D1-1.** El architect **no** propone
   columna por bot en `TradingConfig`: la unidad correcta es la credencial y el interruptor de
   plataforma la expresa bien.
2. **Deuda pre-existente que este ciclo hereda y no empeora (informativa, no bloqueante):**
   `settleFill` hace el claim CAS y **después** crea `Position`, `Trade` y `bot_actions` **fuera de
   una transacción**. Si el proceso muere entre el claim y el `position.create`, la fila queda
   `FILLED` sin `Position` y ningún detector la vuelve a mirar (ya no es RESTING). El agujero existe
   hoy con la sonda y la reconciliación; el stream no lo agranda ni lo achica. Cerrarlo pide envolver
   los tres `create` en `prisma.$transaction` — **fuera de alcance de este ciclo**; se sugiere
   registrarlo como fix o como ciclo siguiente.
3. **Verificación del peso real de `/api/v3/userDataStream` contra testnet:** se declara 2 (§D-03,
   dirección conservadora). Durante la corrida TESTNET conviene leer el header
   `x-mbx-used-weight-1m` antes y después de un `PUT` y dejar el número medido como evidencia del
   ciclo. Si midiera 1, bajar la entrada de `ENDPOINT_WEIGHTS` es un cambio de una línea, no un
   rediseño.
