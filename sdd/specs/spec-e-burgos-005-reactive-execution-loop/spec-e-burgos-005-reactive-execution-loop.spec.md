# Spec e-burgos-005 — Loop de ejecución reactivo

> **Autor:** e-burgos · **Fecha:** 2026-08-29 · **Estado:** in-progress
> **Módulo:** reactive-execution-loop
> **Subproyectos:** `apps/api`, `libs/data-fetcher`, `libs/trading-engine`, `libs/analysis`, `libs/shared`

## 1. Contexto y diagnóstico

`spec-e-burgos-001` dejó el núcleo de agentes podado, con gestión activa de riesgo, órdenes
nativas de protección y el costo LLM por decisión medido y reducido. `spec-e-burgos-004` cerró
la resolución de credenciales de las fuentes de datos. Con eso, **la calidad de la decisión y su
costo dejaron de ser el cuello de botella. El cuello de botella pasó a ser el tiempo.**

La plataforma hoy no tradea: **le saca una foto al mercado cada 15–30 minutos y reacciona a la
foto.** Entre decisión y decisión queda ciega e inerte.

### Hallazgos

**A. El intervalo lo elige el LLM, y entre ciclos el bot duerme.**

`TradingProcessor` calcula `effectiveWaitMinutes` (`apps/api/src/trading/trading.processor.ts:411-414`)
a partir de `LLMDecision.suggestedWaitMinutes` en modo `AGENT` o de
`TradingConfig.minIntervalMinutes` en modo `CUSTOM` (`intervalMode: IntervalMode @default(AGENT)`,
`minIntervalMinutes: Int @default(5)`, `apps/api/prisma/schema.prisma:264-311`). El
`suggestedWaitMinutes` sale del JSON de síntesis del LLM con default **15**
(`orchestrator.service.ts:582-583`), 30 cuando AEGIS bloquea (línea 473). Después de decidir, el
bot se re-encola y no vuelve a mirar el mercado hasta que vence el temporizador. Un movimiento del
4 % en el minuto 3 de una ventana de 30 minutos no existe para el sistema.

**El precedente ya está sentado y funciona:** cuando el gate determinístico resuelve la decisión
sin LLM, fija `waitMinutes = config.minIntervalMinutes` (`decision-gate.service.ts:163`), con un
test que lo consagra — _"the gate never lengthens the cadence"_. Acortar la cadencia por decisión
del código, no del LLM, ya es un patrón aceptado del repo.

**A.bis — El re-encolado no tiene puerta de entrada externa.** La cola es **Bull clásico**
(`bull` 4.16.5 + `@nestjs/bull` 11 — **no BullMQ**), queue `'trading-agent'`. El re-encolado es un
job con `delay` (`trading.processor.ts:566-586`) que **omite el `jobId` a propósito**: reutilizarlo
mientras el job activo corre haría que Bull devuelva el job existente en vez de crear el delayed,
deteniendo el agente en silencio. Consecuencia: hoy no existe ninguna forma de adelantar el
próximo ciclo desde afuera. Las únicas operaciones de Bull usadas en todo el repo son `add`,
`getJob`, `getWaiting`, `getDelayed`, `getActive` y `.remove()`. **`Job.promote()` existe en la API
de Bull y este repo no lo invoca en ningún lado** — es el gancho natural, y también el punto donde
se juega la corrección: adelantar un ciclo sin desactivar el delayed pendiente produce dos ciclos
concurrentes sobre la misma posición.

**B. Lo único que reacciona en tiempo real cubre solo la salida.**

La reacción instantánea real del sistema es la orden OCO descansando en Binance
(`placeOcoSellOrder`, `libs/data-fetcher/src/lib/binance/binance-rest.client.ts:608-680`), que
tiene `side: 'SELL'` **hardcodeado** (línea 664). Protege una posición **ya abierta**. En la
entrada el sistema está inerte: no hay ninguna orden condicional descansando en el exchange que
compre en un nivel, ni ninguna que reaccione mientras el servicio está caído o reiniciando.

**C. El riel reactivo está construido a medias y desconectado.**

`libs/data-fetcher/src/lib/binance/binance-ws.client.ts` existe, tiene tests, tiene
`autoReconnect` y está exportado en el barrel de la lib — **y ningún código de producción lo
importa.** El contexto de la lib lo registra explícitamente: _"`BinanceWsClient` sigue exportado
y sin importadores. No se podó a propósito"_. Es capacidad instalada, dormida y sin dueño.

**D. La capa determinística ya existe, es pura, y corre en el peor momento posible.**

Tres piezas puras, sin I/O, verificadas:

| Pieza                                       | Ubicación                                          | Qué decide                                          |
| ------------------------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| `evaluateDeterministicGate`                 | `libs/analysis/src/lib/gate/deterministic-gate.ts` | Si no hace falta llamar al LLM (HOLD determinista)  |
| `evaluateSellPolicy`                        | `libs/trading-engine/src/lib/sell-policy.ts`       | `TAKE_PROFIT` \| `LOSS_CUT` \| `NONE`               |
| `updateTrailingStop`, `shouldExitByTime`,   | `libs/trading-engine/src/lib/position-manager.ts`  | Trailing, salida por tiempo, TP parcial, re-arme    |
| `resolvePartialTakeProfit`, `applyPartialExit`, `resolveProtectionRearm` |                       | de la protección nativa                             |

Todas son funciones puras y síncronas: **podrían evaluarse en cada tick de un WebSocket sin una
sola llamada de red.** Hoy solo se evalúan una vez cada 15–30 minutos, dentro del ciclo del LLM,
con lo cual el sistema tiene reflejos pero solo los usa cuando ya despertó por otra razón.

**E. No existe ningún límite de frecuencia de trading.**

Verificado por grep sobre `libs/` y `apps/`: **no existe** máximo de acciones por hora, ni tiempo
mínimo entre ejecuciones, ni freno por pérdida diaria dentro del motor.
`libs/trading-engine/src/lib/risk/` contiene **un solo archivo**, `trade-simulation.ts`
(`simulateTrade`, pura). El único límite de pérdida diaria del sistema es `maxDailyLossUsd` de
`UserRiskPolicy` (`schema.prisma:377-394`), evaluado por `AggregateRiskService.assertBuyAllowed`
— **por usuario, solo en el camino de BUY y solo dentro del ciclo del LLM.**

Hoy eso alcanza porque el temporizador es el limitador de facto: un bot no puede operar más de
2–4 veces por hora. **Un loop reactivo elimina ese limitador implícito, y con él la única
protección de frecuencia que el sistema tiene.**

**F. Un sistema reactivo que pierde el stream en silencio es peor que un temporizador.**

Un temporizador que no dispara es un bot que no opera: falla ruidosamente. Un WebSocket caído es
un bot que **cree que el mercado está quieto**: falla en silencio, con posiciones abiertas y con
la convicción de que no hay nada que hacer. No existe hoy ninguna detección de staleness porque
no existe ningún stream.

**G. No existe estado en memoria por bot, y el sistema asume varias réplicas.**

El estado vive en Prisma; los jobs de Bull son efímeros (`trading.service.ts:117-119`: _"The DB is
the source of truth for isRunning"_). `TradingService` implementa `OnModuleInit` para recuperar
agentes tras un reinicio, pero **no hay `OnApplicationShutdown` en ningún punto del camino de
trading**: los jobs delayed sobreviven en Redis y los retoma el worker que arranque. El repo ya
convive con réplicas y lo tiene documentado en dos lugares — los jobs repetibles de evaluación se
registran con `jobId` fijo + `removeRepeatable` previo _"para que N réplicas no multipliquen el
sweep"_, y el caché de data sources es in-memory por proceso, con hit-rate fragmentado por
instancia.

Un consumidor de WebSocket con suscripciones y ventanas de conteo en memoria es **infraestructura
con estado, que es exactamente lo que este backend no tiene hoy**. Con N réplicas, sin un dueño
explícito: N suscripciones por símbolo, N evaluaciones del fast path sobre la misma posición y N
órdenes. Los caps de frecuencia (hallazgo E) no pueden vivir en memoria de proceso por la misma
razón. Es el riesgo de diseño central del ciclo.

## 2. Objetivo

Que el agente sea **dirigido por precio, no por temporizador**: que despierte cuando el mercado
hace algo material, que ejecute sus reflejos sin pagar una llamada de LLM para ello, y que la
reacción sobreviva a la caída del servicio — todo bajo caps de frecuencia que ningún LLM puede
relajar, y con detección explícita de la degradación del stream.

**El costo de LLM por bot/día no debe superar la línea base.** El aporte de este ciclo es
**latencia a costo constante**, no ahorro.

> **Corrección respecto de la formulación inicial de esta spec.** El objetivo arrancó redactado
> como "el costo debe BAJAR". Es incumplible tal como está construido el ciclo, y por una razón
> estructural, no por falta de esfuerzo: el temporizador **no se elimina** (es el piso del
> alcance) y el umbral del evento material es el **mismo** `gatePriceChangePct` que ya usa el
> gate determinista. Con esas dos restricciones, el número de evaluaciones del gate por ventana
> es exactamente uno, con el loop encendido o apagado — el loop cambia **cuándo** ocurre esa
> evaluación, no **cuántas** ocurren. La reducción de llamadas de LLM ya la entregó el gate de
> `spec-e-burgos-001`. Una baja real exigiría dejar de disparar el ciclo por temporizador cuando
> la ventana entera no tuvo ningún evento material, y eso obliga a que el detector cubra también
> las condiciones no-precio del gate (EMA, RSI, huellas de noticias, macro y posiciones), que hoy
> solo se recalculan una vez por ciclo. Es un ciclo propio, no un ajuste de umbral.

## 3. Alcance por ciclo

### Cycle-01 — Despertar por evento, fast path determinístico y caps duros

1. **Riel de mercado en vivo.** Cablear `BinanceWsClient` a los símbolos de las `TradingConfig`
   activas: un consumidor con ciclo de vida propio en `apps/api`, suscripción por símbolo
   compartida entre bots del mismo par, y `autoReconnect` gobernado.
2. **Disparo por evento material.** El ciclo de decisión se dispara por movimiento de precio
   contra la referencia de la última decisión, quiebre de nivel o spike de volumen — **o** por el
   temporizador vigente, lo que llegue primero. El temporizador nunca se elimina: pasa a ser el
   piso, no el único reloj.
3. **Fast path determinístico.** `evaluateSellPolicy` + las funciones de `position-manager` +
   el gate corren en cada tick y ejecutan por sí solas un set **acotado y enumerado** de acciones:
   stop duro, salida por trailing, re-armado de protección y take-profit parcial. El LLM conserva
   la decisión estratégica (abrir posición, dimensionar, cerrar por tesis); esta capa conserva los
   reflejos.
4. **Caps duros de frecuencia, fuera del alcance del LLM.** Máximo de acciones por hora, tiempo
   mínimo entre ejecuciones y límite de pérdida diaria que frena el bot. Se evalúan en el mismo
   punto para todo camino de ejecución — el reactivo y el del LLM.
5. **Detección de staleness del stream.** Heartbeat + edad del último tick por símbolo. Cuando el
   stream se degrada, el bot cae a temporizador + REST y lo declara; nunca interpreta el silencio
   como quietud del mercado.

### Cycle-02 — Reacción empujada al exchange

6. Órdenes condicionales descansando también en la **entrada**: `LIMIT_MAKER` en nivel, OCO de
   entrada y `trailingDelta`, para que la reacción dispare en Binance aunque el servicio esté
   caído o reiniciando.

> **Por qué la capa 3 va a un ciclo propio.** El supuesto de partida era que el surface de
> ejecución spot ya estaba completo y no había que agregar tipos de orden. La verificación lo
> desmiente en este punto concreto: `LIMIT_MAKER` existe **solo** como pierna interna del OCO de
> venta (`binance-rest.client.ts:666`), no como orden colocable; `trailingDelta` **no aparece en
> ninguna línea del repo**; y el OCO tiene `side: 'SELL'` hardcodeado. La capa 3 es una extensión
> real de `BinanceRestClient` y de `OrderExecutorPort`, no un cableado. Además, colocar órdenes de
> entrada que disparan solas mientras el servicio está caído **exige que los caps de frecuencia y
> la detección de staleness ya existan y estén probados** — es el orden seguro, no una preferencia.

#### Decisiones de alcance de cycle-02 (registradas 2026-09-01 al abrir el ciclo)

La línea del ítem 6 deja cuatro huecos que el código verificado no resuelve. Se cierran acá para
que el ciclo no los resuelva en silencio.

| # | Hueco | Decisión | Razonamiento |
| --- | --- | --- | --- |
| D2-1 | **De dónde sale el precio de entrada.** `LLMDecision` es `BUY \| SELL \| HOLD` sin precio. | La única fuente de niveles del sistema es `supportResistance` del `IndicatorSnapshot` (`calculateSupportResistance`, últimos 5 niveles por lado). `LIMIT_MAKER` de entrada = soporte más cercano **por debajo** del precio, con fallback a `precio × (1 − orderPriceOffsetPct)` si no hay soporte utilizable. OCO de entrada = esa misma pierna más `STOP_LOSS_LIMIT` de ruptura en la resistencia más cercana **por encima**. `trailingDelta` es opcional y aplica sólo a la pierna de ruptura (Binance lo admite en `STOP_LOSS`/`STOP_LOSS_LIMIT`/`TAKE_PROFIT`/`TAKE_PROFIT_LIMIT`, en BIPS, combinable con `stopPrice`). | Reusar un nivel ya calculado por ciclo mantiene la lib pura y evita pedirle un precio al LLM, que hoy no lo produce y cuyo formato de salida no se toca en esta spec. |
| D2-2 | **Una entrada que se llena con el servicio caído no crea `Position`.** La reconciliación sólo conoce posiciones protegidas y barre órdenes con prefijo `prot-`. | Se persiste la entrada descansando en una tabla propia (`entry_orders`), con prefijo de `clientOrderId` distinto de `prot-`. `ReconciliationService` se extiende: fill ⇒ `Position` + `Trade` + protección inicial por el camino existente; vencida, cancelada o huérfana ⇒ se cierra el registro y se cancela en el exchange. | Sin registro persistido, un fill durante un deploy queda como balance base sin posición: invisible para el fast path, la protección y los caps. |
| D2-3 | **Contabilidad en `bot_actions`.** Una orden que dispara en Binance no pasa por `authorizeAndRun`. | La **colocación** pasa por `authorizeAndRun` como `kind: BUY` y consume caps igual que la compra a mercado. El **fill** lo registra la reconciliación a posteriori con `source: EXCHANGE_TRIGGER` (valor nuevo de `BotActionSource`), sin autorización porque ya ocurrió y no se puede bloquear. Una misma compra nunca cuenta dos veces. Coherencia con los caps: cuando el cap de pérdida diaria devuelve `DISCARDED`, las entradas descansando del bot se cancelan. | `authorizeAndRun` sigue siendo la única puerta de las acciones que el bot decide; lo que el exchange ejecuta se audita, no se autoriza. |
| D2-4 | **SANDBOX.** `SandboxOrderExecutor` se construye nuevo en cada ciclo del processor: una entrada simulada en memoria se evapora. | `SandboxOrderExecutor` implementa el contrato nuevo del port en memoria para poder testear el port sin red; en modo SANDBOX el bot sigue comprando a mercado como hoy. La capa es efectivamente LIVE y TESTNET. | Simular fills persistentes en papel es un ciclo propio; no se paga acá. |

**Interruptor:** `TradingConfig.entryOrderMode` con default `MARKET` (comportamiento idéntico al
actual), más TTL de la entrada y `trailingDelta` opcional. Los campos van a `CreateTradingConfigDto`
y `UpdateTradingConfigDto` por el `forbidNonWhitelisted`. Nace apagado y se cierra el ciclo apagado.

**Deuda registrada que NO entra:** la cola `trading-agent` duplicada entre `TradingModule` y
`ReactiveModule` (reviewer de cycle-01) sigue siendo deuda, no bloqueante.

## 4. No-objetivos (fuera de esta spec)

| Excluido                                                                                 | Dónde va                            |
| ---------------------------------------------------------------------------------------- | ----------------------------------- |
| Futuros USDⓈ-M, `fapi`, SHORT, apalancamiento                                            | `spec-e-burgos-007`                 |
| Subcuenta por bot, IP allowlist, `DataSourceCredentialResolver` sobre el eje `configId`  | `spec-e-burgos-006` (prereq. de 007) |
| Migración de `TradingMode` (`libs/shared/src/types/enums.ts:13`)                          | No corresponde — esta spec es SPOT puro |
| UI de configuración de los campos nuevos                                                 | Spec de UI ya diferida por spec-001 |

**Binance Agent OS: descartado, no re-investigar.** Su authorization server declara
`grant_types_supported: ["authorization_code"]` (sin `refresh_token`),
`token_endpoint_auth_methods_supported: ["none"]` (sin cliente confidencial) y no expone
`registration_endpoint`. Es un riel para clientes interactivos: un backend headless multi-tenant
no puede sostenerlo, y un token que expira sin renovación programática es peligroso con posiciones
abiertas.

## 5. Restricciones de diseño (heredadas, no negociables)

- **SPOT puro.** Sin `fapi`, sin apalancamiento, sin `positionSide`. `TradingMode`
  (`LIVE | SANDBOX | TESTNET`) es enum de Prisma persistido en `Position` y `Trade`: **no se
  migra.**
- **Todo interruptor de comportamiento de trading nace apagado.** Una instalación existente que
  despliegue sin tocar su config debe producir exactamente las mismas órdenes que antes. El loop
  reactivo entero es opt-in.
- **Cancelar la protección antes de vender.** Toda salida nueva llama `releaseProtectionIfNeeded`
  antes del `placeMarketOrder(SELL)`, o falla con `-2010`. El fast path es un camino de salida
  nuevo: aplica en pleno.
- **`libs/trading-engine` nunca depende de `libs/data-fetcher`.** El vocabulario común de órdenes
  vive en `libs/shared`. Cualquier tipo que necesiten ambas libs va ahí.
- **La lib decide, `apps/api` orquesta.** Las funciones de `trading-engine` y `analysis` son puras
  (sin Prisma, sin Nest, sin LLM, sin `Date.now()` interno). Esa pureza es lo que permite testear
  el fast path sin BD, sin red y sin credenciales: mantenerla es requisito, no estilo.
- **`ValidationPipe` global con `forbidNonWhitelisted: true`.** Un campo nuevo de `TradingConfig`
  que no esté declarado en `CreateTradingConfigDto` **y** `UpdateTradingConfigDto` hace que el
  request entero responda 400.
- **Los getters de `PrismaService` son 1:1 con los modelos.** Agregar un modelo sin declarar su
  getter rompe el build.
- **Sin acceso a testnet ni credenciales reales.** Todo se verifica contra un mock de la capa de
  transporte: payload exacto, y assert de que el mock **no** fue invocado cuando la acción se
  rechaza localmente.
  > **Superada parcialmente en cycle-02 (decisión del dev, 2026-09-01):** el mock de transporte
  > sigue siendo el primer criterio, pero las órdenes nuevas se verifican **además contra Binance
  > TESTNET** (colocar, consultar y cancelar cada tipo) con las credenciales de testnet ya cargadas.
  > Razón: hay una cuenta LIVE con fondos reales conectada, el servicio se reinicia en cada deploy y
  > una orden condicional mal colocada no se deshace desde el código. **Nunca en LIVE durante el
  > ciclo.** El harness lee únicamente credenciales de testnet y aborta si la URL base no es la de
  > testnet.
- **Prohibido testear sobre el texto fuente.** Ninguna aserción nueva puede hacer string-matching
  sobre un rango de archivo entre dos símbolos. Las invariantes se afirman sobre comportamiento
  observable o sobre un símbolo concreto.

## 6. Criterios de aceptación de la spec

| ID     | Criterio                                                                                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CA-001 | Con el loop reactivo apagado, el comportamiento observable del sistema es idéntico al actual: mismas órdenes, mismos intervalos, mismo número de llamadas de LLM.           |
| CA-002 | Con el loop encendido, un evento material adelanta la decisión respecto del temporizador, y una ventana sin evento material **no** produce llamada de LLM.                  |
| CA-003 | Sobre los mismos escenarios congelados, con el loop encendido el número de ciclos de decisión por ventana es exactamente el mismo que con el loop apagado (uno), y el número de llamadas de LLM no lo supera: assert **por escenario** además del agregado, más una condición de **no-vacuidad** (al menos un escenario adelanta el ciclo, o el test no prueba nada). Se mide en conteo de llamadas, no en USD: el precio es una tarifa externa y variable, el conteo es una propiedad del diseño. |
| CA-004 | Ninguna acción del fast path se ejecuta si viola un cap de frecuencia, y ningún parámetro del LLM puede relajar un cap.                                                     |
| CA-005 | Con el stream degradado, el bot opera por temporizador + REST y el estado degradado es observable; el silencio del stream nunca se interpreta como ausencia de movimiento.  |
| CA-006 | Toda salida del fast path libera la protección nativa antes de vender.                                                                                                     |
| CA-007 | Con más de una réplica del backend, un mismo evento material produce **una** ejecución y **un** ciclo de decisión, no N. Los caps se cuentan sobre estado compartido, no sobre memoria de proceso. |
