# spec-e-burgos-005 cycle-01 — 2026-08-30

## Estado

Módulo nuevo `src/reactive/` — la capa que hace que el bot reaccione al precio en lugar de al
reloj. 669 tests en verde en `apps/api` (era ~430 al abrir el ciclo). **`ReactiveModule` está
importado en `src/app/app.module.ts`**: los 4 servicios reactivos resuelven por DI desde
`AppModule` y `reactive-module-wiring.spec.ts` lo sostiene (borrar el import hace fallar ese
spec — es el candado que evita que el módulo vuelva a quedar huérfano). El loop nace apagado por
`TradingConfig.reactiveLoopEnabled` (default `false`) y, además, la coordinación entre réplicas
nace en su driver apagado.

Se rompió por fin la concentración de `trading.processor.ts`: pasó de ~1961 líneas a ~1400 al
extraerse `PositionActionService`, y el procesador dejó de ser el único dueño del camino de
salida.

## Estructura

### `src/reactive/` (nuevo)

| Archivo                                    | Responsabilidad                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `reactive-coordination.port.ts`            | `ReactiveCoordinationPort` + símbolo de DI `REACTIVE_COORDINATION`                          |
| `redis-reactive-coordination.service.ts`   | Implementación ioredis; lease y token con CAS en Lua                                        |
| `disabled-reactive-coordination.service.ts`| Implementación apagada: todo `false`/`null`, `isHealthy() === false`                        |
| `reactive-coordination.module.ts`          | Fábrica por env (`REACTIVE_COORDINATION_DRIVER`), exporta el puerto                          |
| `reactive-runtime-thresholds.ts`           | Umbrales de infraestructura (leases, edades de stream, ping/pong, TTLs)                      |
| `market-stream.service.ts`                 | Dueño por símbolo, ciclo de vida del WS, fan-out de `tick`/`candle`                          |
| `stream-health.service.ts`                 | Publica y resuelve la salud por símbolo; emite la transición y notifica la degradación sostenida |
| `material-event.service.ts`                | Compone `detectMaterialEvent` y ejecuta la secuencia de adelanto del ciclo                    |
| `fast-path.service.ts`                     | Compone `planFastPath` por tick y ejecuta vía `ActionGateService` → `PositionActionService`   |

**Grafo de módulos (unidireccional, sin ciclos — no romperlo):**

```
AppModule                       (el cableado del ciclo vive en app.module.ts)
    |
    v
ReactiveModule  ------------->  TradingModule
    |                                |
    +--------> ReactiveCoordinationModule <---+
               (hoja: provee REACTIVE_COORDINATION)
```

`ReactiveModule` importa `TradingModule` (por `ActionGateService` y `PositionActionService`),
`NotificationsModule` (por la notificación de degradación sostenida) y registra `TRADING_QUEUE`
por su cuenta para poder promover jobs. **`TradingModule` NO importa `ReactiveModule`** — y por
eso `TradingController` construye a mano su propia instancia de `StreamHealthService`
(ver `## Qué sigue`).

**Al tocar este grafo, empezar por acá:** `TradingModule` no re-exporta `BullModule`
(`exports: [TradingService, PositionActionService, ActionGateService]`). Esa única omisión causa
las dos deudas abiertas del módulo: obliga a `ReactiveModule` a registrar `TRADING_QUEUE` de nuevo
—hay **dos `Bull.Queue`** para `trading-agent`, con dos pares de clientes ioredis— y deja al
controller sin forma limpia de llegar a la capa reactiva. Las dos instancias comparten las claves
de Redis (`bull:trading-agent:*`), así que `getDelayed()`/`promote()` cruzan sin problema y el
adelanto por evento funciona; el costo es una conexión de más, no un bug.

**Claves de coordinación, todas versionadas `rx:v1:`** — al agregar una, seguir el prefijo:

| Clave                                | Qué es                                                          |
| ------------------------------------ | --------------------------------------------------------------- |
| `rx:v1:owner:{symbol}`               | Lease del dueño del símbolo (una suscripción WS por símbolo)      |
| `rx:v1:health:{symbol}`              | `StreamHealthRecord` publicado, con TTL — lo lee cualquier réplica |
| `rx:v1:window:{configId}`            | Fin de la ventana del temporizador vigente                        |
| `rx:v1:advance:{configId}:{windowEnd}`| Token de un solo uso: **un** adelanto por ventana                 |
| `rx:v1:bot:{configId}`               | Lease de acción del bot: serializa las acciones de un mismo bot   |

### `src/trading/` (cambios)

- **`action-gate.service.ts` — `ActionGateService.authorizeAndRun(request, execute)` es la ÚNICA
  puerta de toda acción automática**, del camino reactivo y del camino del LLM por igual. Es el
  invariante central del ciclo: un cap no se puede eludir porque no hay segunda puerta. Toma el
  lease del bot, revalida la posición esperada (`SUPERSEDED` si cambió bajo el lease), evalúa los
  caps, ejecuta y escribe la fila en `bot_actions`, liberando el lease pase lo que pase.
  **Cualquier punto de ejecución nuevo debe pasar por acá, no llamar al executor directo.**
- **`position-action.service.ts`** — extraído de `TradingProcessor`: `closeAtMarket`,
  `executePartialTakeProfit`, `rearmProtection`, `releaseProtectionIfNeeded` (+ los privados
  `closePositionAfterProtectionFailure` y `creditSandboxWallet`). Es la implementación **única**
  del camino de salida; el fast path la reusa en vez de reimplementarla, que es lo que
  garantiza CA-006 (liberar la protección nativa antes de vender) en los cuatro caminos.
  `releaseProtectionIfNeeded` quedó **público** justamente porque `executeLLMSell` también lo
  necesita.
- `bot-action-counters.ts` — las dos lecturas sobre `bot_actions` que alimentan los caps: conteo
  de la hora móvil y `max(occurredAt)` de la última acción ejecutada.
- `aggregate-risk.service.ts` — suma `evaluateDailyLoss` como **lectura pura** (sin efectos), para
  que el cap de pérdida diaria se pueda evaluar desde la puerta sin arrastrar el efecto de
  `assertBuyAllowed`.
- `trading.processor.ts` — sus 5 puntos de ejecución pasan por `authorizeAndRun`; escribe
  `rx:v1:window:{configId}` al re-encolar. **La omisión deliberada del `jobId` en el re-encolado
  sigue vigente y sigue siendo obligatoria** (reusar un jobId estático con el job activo hace que
  Bull devuelva el job existente y el agente se detiene en silencio); el adelanto por evento se
  hace con `Job.promote()`, no removiendo y re-encolando.
- `trading.controller.ts` — EP-015 `GET /trading/stream-health` y EP-016 `GET /trading/actions`.
- DTOs: `CreateTradingConfigDto` **y** `UpdateTradingConfigDto` declaran los 3 campos nuevos. Con
  `forbidNonWhitelisted` global, declararlos en los dos o el request entero responde 400.

### Datos

- Tabla nueva `bot_actions` (+ 4 enums) — ledger de acciones sobre el que se cuentan los caps.
  `positionId`/`decisionId` **sin FK a propósito**: es auditoría y debe sobrevivir al borrado de
  lo que referencia. Getter `botAction` dado de alta en `PrismaService`.
- `trading_configs` suma `reactiveLoopEnabled`, `maxActionsPerHour`, `minActionIntervalSec`.
- 3 migraciones SQL escritas a mano (no hay BD disponible en el entorno de desarrollo del arnés):
  `20260830120000_add_bot_actions`, `_120100_add_reactive_loop_switch`, `_120200_add_action_caps_columns`.

### Otros

- `main.ts` llama `app.enableShutdownHooks()` — **prerrequisito** de los `OnApplicationShutdown`
  de `src/reactive/`. Sin esa línea Nest nunca los invoca y los timers/leases quedan colgados.
- `trading.processor.isolation.spec.ts` reescrito sobre comportamiento observable.
  _resuelve: `context_prompt.md` → "Qué sigue" → las aserciones por string-matching de ese spec._
  La otra mitad de ese ítem sigue abierta: `executeLLMSell` conserva su `$transaction` de wallet
  SANDBOX inline (`trading.processor.ts:1350`) en vez de usar `creditSandboxWallet`, que ahora
  vive en `PositionActionService`.

## Dependencias

- `ioredis` pasa a usarse directo en `redis-reactive-coordination.service.ts` (antes solo llegaba
  vía `@nestjs/bull`). La coordinación **no degrada a memoria de proceso** por diseño: sin Redis
  el driver es `Disabled` y todo queda fail-closed. Un contador en memoria violaría CA-007.
- `apps/api` empieza a consumir `BinanceWsClient` de `libs/data-fetcher` (antes cero consumo).

## Qué sigue

### Deuda declarada, no bloqueante

- **`TradingController` construye `new StreamHealthService(...)` a mano** (`trading.controller.ts:61`)
  porque `TradingModule` no puede importar `ReactiveModule` sin crear el ciclo que §7.1 prohíbe.
  Resultado: dos instancias de la misma clase; la del controller es solo de lectura (sin
  `AppGateway`, `MarketStreamService` ni `NotificationsService`).
  **Este atajo ya se propagó una vez y es la deuda #1 del subproyecto.** Como el controller pasa 3
  de los 6 argumentos, toda colaboración nueva de `StreamHealthService` tiene que nacer
  **opcional** para no romperlo: le pasó a `NotificationsService` al implementarse la notificación
  de degradación, que necesitó además un test `does nothing when no NotificationsService was
  wired`. Una dependencia opcional es una que puede faltar en silencio, y el mecanismo se repite
  con cada dependencia que se agregue.
  Salida correcta: mover EP-015 a un controller propio de `ReactiveModule` sobre la misma ruta y
  volver **obligatorio** el constructor; **no** `forwardRef`. Hacerlo junto con el
  `exports: [BullModule]` de `TradingModule`: es el mismo archivo y la misma causa.
- **La query del ledger de EP-016 vive en el controller**, no en `trading.service.ts`:
  `TradingController.listBotActionsForUser` usa `this.prisma` directo. Es el único acceso a datos
  del controller y un precedente que contradice la separación del resto del subproyecto; quedó así
  porque el `files[]` de TASK-014 solo permitía tocar el controller. Mover a `TradingService`.
- **Los tres parámetros opcionales del constructor de `TradingProcessor`**
  (`positionAction`, `coordination`, `actionGate`) existen para no tener que arreglar los mocks de
  prisma de 11 specs preexistentes que lo construyen con 11 argumentos posicionales. Solo
  `coordination` lleva `@Optional()` (y su fallback es fail-closed), así que **Nest falla la
  resolución si falta el provider de los otros dos: no hay fail-open en producción**. Aun así
  `PassthroughActionGate` es un fallback que ejecuta todo y devuelve `EXECUTED`
  (`detail: 'ACTION_GATE_NOT_INJECTED'`) dentro de la clase cuyo punto es que los caps no se
  puedan eludir: agregarle un `@Optional()` por descuido borraría los caps en silencio. Salida
  correcta: dar a esos 11 specs una factoría de mock de prisma compartida y volver los tres
  parámetros obligatorios.
- `StreamHealthService.checkSustainedDegradation` marca el símbolo como notificado **antes** de
  esperar a `notifyDegradedUsers`, así que un fallo de `prisma.tradingConfig.findMany` pierde esa
  notificación hasta que el símbolo se recupere y vuelva a degradarse. El estado degradado sigue
  siendo observable por EP-015 y por el evento WS, que son el canal primario.
- Los 3 campos nuevos de `TradingConfig` (como los 17 anteriores) **solo se configuran por API**:
  sigue sin UI.
