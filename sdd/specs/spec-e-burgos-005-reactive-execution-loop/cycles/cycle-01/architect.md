# Architect — Cycle 1: Loop de ejecución reactivo

> **Input:** `brief.yaml` (`verified_facts` + `decisiones_criticas` D1–D5), `functional.md` (20 historias,
> 33 reglas de negocio), `spec-e-burgos-005-reactive-execution-loop.spec.md` §5 y §6.
> **Output:** este archivo.
> **Generado por:** sdd-architect

---

## 0. Cómo leer este documento

Cada decisión D1–D5 se cierra como **contrato**: decisión tomada, alternativa descartada con su
motivo, y las firmas / secuencias exactas que el implementor sigue sin volver a decidir nada.
Lo que no aparece acá y hace falta para implementar es un hueco del arquitecto: se pregunta, no se
inventa.

Las secciones §6 a §11 son el contrato ejecutable (tipos, firmas, orden de llamadas, SQL, endpoints).
La §12 lista los puntos donde el brief o el funcional pidieron algo que el código no soporta y la
corrección propuesta: **el reviewer valida contra la redacción corregida de esta sección, no contra
la letra original.**

### Reparto arquitectónico (invariante del ciclo)

| Capa | Qué le toca | Prohibido |
| --- | --- | --- |
| `libs/shared` | Vocabulario común entre libs (`MarketTick`, `MarketCandleTick`, `StreamHealthRecord`) | Depender de nada |
| `libs/analysis` | Detección de evento material y resolución de salud del stream, **funciones puras** | Prisma, Nest, LLM, `Date.now()` interno, importar `data-fetcher` en las piezas nuevas |
| `libs/trading-engine` | Plan del fast path y evaluación de caps, **funciones puras** | Depender de `data-fetcher` (regla vigente), Prisma, Nest |
| `libs/data-fetcher` | Extensión aditiva de `BinanceWsClient` (suscripción en caliente + heartbeat) | Conocer bots, configs o posiciones |
| `apps/api` | Orquestación: dueño del stream, promoción de jobs, ejecución contra el exchange, persistencia, WS al front | Reimplementar una decisión que ya vive en una lib |

`Date.now()` no aparece dentro de ninguna función nueva de `libs/`: el tiempo entra por parámetro
`now: number`, igual que en `evaluateDeterministicGate`.

---

## 1. D1 — Dueño único del stream y del fast path bajo N réplicas

### Decisión

**Un dueño por símbolo, elegido por lease en Redis, que corre la suscripción WS y el fast path de
todos los bots de ese símbolo.** El dueño vive en un módulo Nest nuevo (`ReactiveModule`) del mismo
proceso que hoy corre el worker de Bull, con `OnModuleInit` y `OnApplicationShutdown` propios.

- **Clave:** `rx:v1:owner:{symbol}`, valor `instanceId`, `SET ... NX PX 30000`.
- **Renovación:** cada 10 s, con CAS Lua (`if GET == instanceId then PEXPIRE`). **Si la renovación
  devuelve `false`, la instancia pierde la propiedad en el acto**: desuscribe el símbolo, tira su
  estado en proceso y deja de evaluar el fast path. No hay período de gracia.
- **Barrido de adquisición:** cada 10 s cada réplica intenta tomar el lease de todo símbolo activo
  que no tenga dueño.
- **Símbolos activos:** los `(asset, pair)` distintos de `TradingConfig` con
  `isRunning = true AND reactiveLoopEnabled = true`, releídos de Postgres cada 30 s. Si un símbolo
  deja de estar activo, el dueño libera el lease y desuscribe.
- **Muerte del dueño:** el lease expira a los ≤30 s y otra réplica lo toma en el barrido siguiente
  (≤10 s). **Ventana ciega máxima: 40 s por símbolo.**
- **Cierre ordenado:** `OnApplicationShutdown` libera **todos** los leases con CAS Lua, desconecta
  el `BinanceWsClient`, limpia los timers de renovación / barrido / refresco de símbolos y borra los
  registros de salud que publicó. Con cierre ordenado la ventana ciega baja a ≤10 s (lo que tarde
  otra réplica en barrer). Requiere `app.enableShutdownHooks()` en `apps/api/src/main.ts`, que hoy
  **no** existe (ver §12.3).

### Por qué la propiedad es por símbolo y no por bot

Un bot tiene exactamente un símbolo (`asset` + `pair`). Propiedad por símbolo ⇒ propiedad por bot
**por construcción**, con una sola suscripción WS por par compartida entre todos los bots de ese
par (requisito explícito del alcance §3.1 de la spec). Un lease por `configId` obligaría a N leases
y N suscripciones al mismo stream para el mismo par.

### Alternativas descartadas

| Alternativa | Por qué no |
| --- | --- |
| Un singleton global (una réplica dueña de todos los símbolos) | Concentra todo el fan-in de WS en un proceso y su muerte ciega el sistema entero, no un símbolo. La granularidad por símbolo reparte carga y reparte el riesgo. |
| Sin dueño + deduplicar en la puerta de acción | Abre N sockets y N lecturas REST, y hace que CA-007 dependa de ganar una carrera en vez de de una exclusión previa. La puerta de acción sigue existiendo (D3), pero como segunda barrera, no como única. |
| `jobId` fijo + repetible de Bull (patrón de `EvaluationService.onModuleInit`) | Sirve para que un *sweep periódico* no se multiplique, no para sostener una conexión WS con estado. Un repetible no da propiedad exclusiva de un socket. |
| Lease en Postgres (`SELECT ... FOR UPDATE SKIP LOCKED`) | Requiere una tabla y un latido transaccional cada 10 s por símbolo contra la base que además atiende el camino de trading. Redis ya está desplegado (Bull lo exige) y `SET NX PX` es la primitiva exacta. |

### El puerto de coordinación, y por qué NO degrada a memoria

Puerto nuevo `ReactiveCoordinationPort` (`apps/api/src/reactive/reactive-coordination.port.ts`),
con dos implementaciones y una fábrica al estilo de `resolveSharedCacheDriver`:

```ts
export const REACTIVE_COORDINATION = Symbol('REACTIVE_COORDINATION');

export interface ReactiveCoordinationPort {
  tryAcquire(key: string, holderId: string, ttlMs: number): Promise<boolean>;
  renew(key: string, holderId: string, ttlMs: number): Promise<boolean>;
  release(key: string, holderId: string): Promise<void>;
  tryConsumeToken(key: string, ttlMs: number): Promise<boolean>;
  setJson<T>(key: string, value: T, ttlMs: number): Promise<void>;
  getJson<T>(key: string): Promise<T | null>;
  isHealthy(): boolean;
}
```

- `RedisReactiveCoordination` (ioredis, `REDIS_URL`). `isHealthy()` pasa a `false` en el primer
  `error` del cliente y vuelve a `true` en el `ready` siguiente.
- `DisabledReactiveCoordination`: todo devuelve `false` / `null`, `isHealthy() === false`.
- Fábrica por env `REACTIVE_COORDINATION_DRIVER=redis`; **cualquier otro valor, o ausencia, deja el
  driver deshabilitado.** El loop reactivo entero nace apagado también a nivel infraestructura.

**`RedisSharedCache` degrada a memoria; este puerto NO.** El fallback en memoria de un caché sirve
un precio viejo; el fallback en memoria de una exclusión mutua sirve **una orden duplicada**. Regla
dura: **sin estado compartido no hay loop reactivo.** Cuando `isHealthy() === false`, el símbolo se
declara `DEGRADED` (D5) y el sistema cae a temporizador + REST — el mismo camino de degradación, sin
una segunda semántica de fallo.

### Qué garantiza CA-007

| Fuente de duplicación | Barrera |
| --- | --- |
| N suscripciones al mismo símbolo | Lease `rx:v1:owner:{symbol}` |
| N evaluaciones del fast path sobre la misma posición | Lease de símbolo (el fast path solo corre en el dueño) |
| N adelantos del ciclo por un mismo evento | Token de ventana `rx:v1:advance:{configId}:{windowEnd}` (D2) |
| Carrera fast path (dueño) ↔ ciclo LLM (worker de Bull, otra réplica) | Lease de bot `rx:v1:bot:{configId}` tomado dentro de `ActionGateService` (D3) |
| Conteo de caps fragmentado por proceso | Los contadores se leen de `bot_actions` en Postgres, nunca de memoria (D3) |

Ninguna de las cinco depende de la anterior: son barreras independientes. El estado en memoria del
detector (§4) es **solo optimización de costo**; la corrección no lo usa.

---

## 2. D2 — Cómo un evento adelanta el ciclo sin duplicarlo

### Decisión

**`Job.promote()` sobre el delayed que se localiza barriendo `getDelayed()` por `configId`, con un
token de un solo uso por ventana del temporizador.** No se toca la omisión del `jobId`.

### Invariante que sostiene todo lo demás

> **Dentro de la ventana vigente del temporizador, un evento material puede adelantar EL único ciclo
> de esa ventana. Nunca puede producir un segundo ciclo dentro de la misma ventana.**

Un adelanto **consume** el ciclo pendiente; no agrega uno. De ahí sale, en D4, la propiedad de que
el número de ciclos por unidad de tiempo con el loop encendido es idéntico al de la línea base.

### Secuencia exacta (la ejecuta el dueño del símbolo)

```
detectMaterialEvent(...) devuelve event !== null para (symbol, configId)

 1. Guardas de habilitación
      config.reactiveLoopEnabled === true      -> si no, salir
      config.isRunning === true                -> si no, salir
 2. Guarda de salud del stream
      resolveStreamHealth(symbol).state === 'HEALTHY'   -> si no, salir (RN-28)
 3. Ventana vigente
      w = coordination.getJson<{ windowEndMs }>(`rx:v1:window:{configId}`)
      w == null            -> salir  (no hay ciclo pendiente que adelantar: fail-closed)
      remaining = w.windowEndMs - now
      remaining <= 0       -> salir  (la ventana ya venció; el temporizador dispara solo)
 4. Token de adelanto, uno por ventana
      ok = coordination.tryConsumeToken(`rx:v1:advance:{configId}:{w.windowEndMs}`, remaining)
      ok === false         -> salir en silencio (evento repetido o adelanto ya gastado)
 5. Localizar el delayed
      const delayed = await queue.getDelayed();
      const job = delayed.find((j) => j.data?.configId === configId);
      job == null          -> salir  (ya está activo, waiting o removido: nada que promover)
 6. Promover
      try { await job.promote(); } catch { /* ya promovido o ya disparó: estado deseado */ }
 7. Observabilidad
      log + evento WS `agent:cycle-advanced` { configId, symbol, eventType, advancedByMs: remaining }
```

El paso 3 se apoya en una escritura nueva del processor: **inmediatamente después de que el
re-encolado de `runCycle` (`trading.processor.ts:576-580`) devuelve**, escribir

```ts
await coordination.setJson(`rx:v1:window:${configId}`, { windowEndMs: Date.now() + delay }, delay);
```

La clave del token incluye `windowEndMs` a propósito: un token con TTL igual al remanente de la
ventana vieja sobreviviría a la ventana siguiente y la dejaría sin adelanto durante minutos. Con la
clave scopeada por ventana, el residuo de la ventana anterior es irrelevante.

### `promote()` y no `remove()` + `add({ delay: 0 })`

`remove()` seguido de `add()` deja un intervalo en el que el `configId` **no tiene ningún job
programado**. Una muerte del proceso en ese intervalo deja el agente detenido en silencio para
siempre: exactamente el modo de falla que documenta el comentario de `trading.processor.ts:571-574`.
`promote()` mueve el job de `delayed` a `waiting` del lado de Bull y **preserva la invariante de un
solo job por `configId`** en la que se apoyan `TradingService.onModuleInit`, `stopAgentById` y los
tres barridos de parada. Cuando `promote()` falla es porque el job ya salió de `delayed` — el estado
que se quería alcanzar. **Nunca se cae a `add()` como fallback**: eso reintroduce el riesgo del
doble ciclo.

### Por qué se respeta la omisión del `jobId`

`promote()` opera sobre la instancia de job encontrada por barrido, no sobre un id. El barrido por
`j.data?.configId` es el mismo patrón que el repo ya usa en tres lugares. **Nada de este ciclo
agrega un `jobId` al re-encolado**, así que la razón documentada para omitirlo (Bull devolvería el
job activo en vez de crear el delayed) queda intacta.

### Idempotencia

| Escenario | Resultado |
| --- | --- |
| El mismo evento llega dos veces | El token es `SET NX`: la segunda consumición devuelve `false` (paso 4) |
| Dos réplicas ven el evento | Solo el dueño del símbolo detecta (D1); y aun si no, el token es atómico |
| El job ya está activo | `getDelayed()` no lo contiene (paso 5): no se hace nada, y al terminar re-encola su propia ventana nueva |
| El job disparó entre el paso 5 y el 6 | `promote()` lanza, se traga la excepción (paso 6) |
| No hay ventana registrada (Redis recién levantado, primer ciclo) | Paso 3 sale: sin adelanto hasta el primer re-encolado. Fail-closed |

### Guarda contra dos ciclos concurrentes sobre la misma posición

El adelanto **no** puede producir dos ciclos (la invariante de arriba). Lo que sí puede coexistir es
**un ciclo de LLM en curso y una acción del fast path sobre la misma posición** — que es
precisamente lo que US-01-011 exige que NO se bloquee. La guarda de esa coexistencia no vive acá:
vive en el lease de bot de `ActionGateService` (D3), que serializa **ejecuciones**, nunca
deliberaciones.

---

## 3. D3 — Dónde viven los caps y por qué no pueden ser eludidos

### Decisión

**Una sola puerta: `ActionGateService` (`apps/api/src/trading/action-gate.service.ts`).** Ninguna
orden automática llega al exchange sin pasar por ella. La aritmética de los caps es una función pura
de `libs/trading-engine`; el conteo sale de una tabla nueva en Postgres; la exclusión mutua sale de
un lease en Redis. Mismo precedente que `AggregateRiskService.assertBuyAllowed`, que sigue siendo la
única puerta del riesgo agregado — y de la que este gate **depende** en vez de duplicarla.

### 3.1 Resolución del conflicto: caps vs. stop duro

El funcional dejó los caps sin excepciones (RN-19 a RN-23) y registró el peligro en RN-25: con el
cap de acciones/hora agotado, un stop duro se difiere y la pérdida no se corta. **Se resuelve
distinguiendo la dirección de la exposición, no el origen de la acción.**

> **Regla de los caps (contrato): los caps restringen la ASUNCIÓN de riesgo, nunca su REDUCCIÓN.
> Toda acción ejecutada se contabiliza contra los caps; ninguna acción que reduce exposición puede
> ser bloqueada ni diferida por un cap.**

Aplicabilidad, cap por cap y acción por acción:

| `kind` | Exposición | `ACTIONS_PER_HOUR` | `MIN_INTERVAL` | `DAILY_LOSS` | ¿Cuenta al ejecutarse? |
| --- | --- | --- | --- | --- | --- |
| `BUY` | `INCREASING` | bloquea (difiere) | bloquea (difiere) | bloquea (descarta) | sí |
| `SELL_FULL` | `REDUCING` | no bloquea | no bloquea | no bloquea | sí |
| `SELL_PARTIAL` | `REDUCING` | no bloquea | no bloquea | no bloquea | sí |
| `PROTECTION_REARM` | `NEUTRAL` | bloquea (difiere) | bloquea (difiere) | no bloquea | sí |

Argumentos, uno por celda no obvia:

1. **Por qué la salida nunca se difiere.** Un cap de frecuencia existe para impedir sobre-operar. Un
   stop diferido no impide operar: impide *dejar de perder*. Convierte un mecanismo de seguridad en
   un amplificador de pérdida, y lo hace justo cuando el mercado se mueve rápido, que es cuando el
   cap está agotado. RN-25 nombra ese peligro; esta regla lo elimina de raíz en vez de mitigarlo con
   defaults holgados.
2. **Lema de acotación (por qué esto NO abre una vía de bypass a CA-004).** El fast path no puede
   comprar (RN-11), y el LLM solo puede vender sobre una posición existente. Por lo tanto el número
   de acciones `REDUCING` en cualquier ventana está acotado por
   `2 × maxConcurrentPositions` (a lo sumo un cierre total y un take-profit parcial por posición,
   porque `resolvePartialTakeProfit` inhibe un segundo escalón con `partialExitCount > 0`), y la
   cantidad de posiciones abiertas está acotada por los caps que sí bloquean las aperturas. **No
   existe ningún ciclo que genere salidas ilimitadas**, así que exceptuar las salidas del bloqueo no
   puede producir sobre-operación.
3. **Por qué las salidas igual se contabilizan.** Cada salida ejecutada consume presupuesto de las
   aperturas y de los re-armados posteriores. La intención del funcional —que ninguna acción sea una
   vía para *resetear* o *esquivar* el presupuesto— se conserva íntegra: lo que se exceptúa es el
   bloqueo, no la contabilidad.
4. **Por qué el re-armado sí se difiere por frecuencia.** Es la única de las cuatro acciones que
   puede repetirse indefinidamente sobre la misma posición y quema dos llamadas al exchange
   (cancelar + colocar). Diferirlo deja viva la protección **anterior**, que sigue siendo protección
   real en el exchange: el costo del diferimiento es un stop desactualizado, no un stop ausente.
5. **Por qué el re-armado NO se bloquea por pérdida diaria.** El freno de pérdida diaria existe para
   dejar de asumir riesgo. Un re-armado mantiene al día una protección ya colocada; bloquearlo
   dejaría un stop viejo en el exchange precisamente en el peor día.
6. **Por qué esto no relaja CA-004.** La exención no es una decisión discrecional: es una propiedad
   del **tipo** de acción, derivada por `classifyActionExposure(kind)` sobre un enum cerrado de
   cuatro valores. Ningún campo de la respuesta del LLM entra en esa clasificación, y el LLM no
   puede fabricar una acción `SELL_FULL` que abra exposición porque una venta no abre posiciones.

Redacción corregida de las reglas afectadas → §12.5.

### 3.2 Nivel de configuración

| Cap | Dónde vive | Por qué |
| --- | --- | --- |
| Máximo de acciones por hora | `TradingConfig.maxActionsPerHour` (**por bot**) | La frecuencia es una propiedad de la estrategia del bot: un scalper y un bot de tendencia del mismo usuario no comparten cadencia razonable |
| Tiempo mínimo entre ejecuciones | `TradingConfig.minActionIntervalSec` (**por bot**) | Idem |
| Pérdida diaria | `UserRiskPolicy.maxDailyLossUsd` (**por usuario**, ya existe) | Ya existe con semántica de **día calendario UTC** y un único lector (`AggregateRiskService`). Duplicarlo por bot crearía dos fuentes de verdad del mismo freno. Lo que RN-22 cambia es **qué acciones** frena, no su alcance |

**Consecuencia que hay que decir con todas las letras:** el freno de pérdida diaria es por usuario,
no por bot. Un bot puede quedar frenado por las pérdidas de otro bot del mismo usuario — que es
exactamente el comportamiento que hoy ya tiene el camino de BUY. La redacción de US-01-015 / RN-21
("mi bot") se corrige en §12.6.

**Los caps no son opcionales cuando el loop está encendido.** `maxActionsPerHour` y
`minActionIntervalSec` son `NOT NULL` con default (`6` y `60`) y se leen **solo** cuando
`reactiveLoopEnabled = true`. Como esa columna nace en `false`, CA-001 se cumple; y como los caps no
son nullables, **no existe la combinación "loop encendido sin límite de frecuencia"**.

### 3.3 Sobre qué estado se cuenta: tabla nueva `bot_actions`

`AgentDecision` / `Trade` y sus índices **no alcanzan**. Justificación de la migración, punto por
punto:

1. `Trade` solo existe para una orden **ejecutada**. RN-24 / US-01-016 exigen que la acción
   **bloqueada o diferida** quede consultable, y eso no tiene fila donde vivir.
2. `Trade` no tiene `configId` (solo `positionId`). El conteo por bot exigiría un join a `Position`,
   y para un `BUY` bloqueado antes de que exista la posición el join no tiene contra qué resolver.
3. `Trade` **no tiene fila para un re-armado de protección**, que RN-18 cuenta como acción. Contar
   sobre `Trade` sub-contaría el cap de forma sistemática: el error va en la dirección insegura.
4. `AgentDecision` es el log de decisiones del LLM: alimenta el subsistema de evaluación
   (`agent_decision_evaluations`, win rate, `/agents/scorecard`) y exige `indicators`,
   `newsHeadlines`, `waitMinutes`, `decision`, `confidence` y `reasoning`. Escribir una fila por cada
   acción bloqueada del fast path contaminaría el scorecard y obligaría a fabricar esos payloads.
   Además RN-24 pide que "bloqueado por un cap" sea **distinguible** de un `HOLD` — meterlo en la
   misma tabla trabaja en contra de ese requisito.
5. **Escribir en `AgentDecision` rompería el gate determinista, y con él CA-003.** Es el argumento
   decisivo y el único que es una regresión de corrección, no de higiene.
   `TradingProcessor.runCycle` toma la decisión previa como `recentDbDecisions[0]` — la más nueva
   por `createdAt` para ese `configId` — y `DecisionGateService.extractPreviousSnapshot` le exige
   `metadata.gate.snapshot` validado campo por campo (`isValidGateSnapshot`). Una fila escrita por
   el fast path o por un bloqueo de cap se colaría como "la más nueva" **sin** ese snapshot, el
   gate resolvería `NO_PREVIOUS_DECISION` y el ciclo siguiente llamaría al LLM. El mecanismo de
   observabilidad de RN-24 estaría causando, por sí solo, una llamada extra por acción del fast
   path: exactamente lo que CA-003 prohíbe. Con `bot_actions` como tabla aparte, `AgentDecision`
   queda intacta y la referencia del gate también.

Los índices existentes de `AgentDecision` (`[userId, createdAt]`) y `Trade` (`[userId, executedAt]`)
son por usuario, no por bot: tampoco sirven para la ventana móvil por `configId`.

**Corolario para el harness (§4.4), que hay que tener presente al escribir el assert por
escenario:** una salida del fast path sí cambia legítimamente `positionsFingerprint`, así que el
ciclo siguiente resolverá `POSITIONS_CHANGED` y llamará al LLM. **No es una regresión** —la línea
base hace lo mismo cuando `checkOpenPositions` cierra la posición dentro del ciclo— pero adelanta
esa llamada en el tiempo. El escenario congelado que incluya una salida del fast path debe
compararse contra una línea base que también cierre esa posición, o el assert `<=` fallará por una
diferencia de fase, no de costo.

`bot_actions` es un **ledger append-only** que sirve a tres cosas a la vez: contador de los caps,
registro consultable de bloqueos (RN-24) y evidencia de CA-004 para el reviewer. Definición completa
en §9.

### 3.4 Contrato de la puerta

```ts
// apps/api/src/trading/action-gate.service.ts
export interface ActionRequest {
  userId: string;
  configId: string;
  symbol: string;
  mode: TradingMode;
  kind: BotActionKind;                 // 'BUY' | 'SELL_FULL' | 'SELL_PARTIAL' | 'PROTECTION_REARM'
  source: BotActionSource;             // 'FAST_PATH' | 'LLM_CYCLE'
  positionId: string | null;
  decisionId: string | null;
  /** Estado esperado; se revalida contra Postgres dentro del lease (US-01-012). */
  expected: { positionStatus: 'OPEN'; quantity: number; partialExitCount: number } | null;
  detail: string;
}

export type ActionOutcome = 'EXECUTED' | 'BLOCKED' | 'DEFERRED' | 'SUPERSEDED';

export interface ActionResult<T> {
  outcome: ActionOutcome;
  blockedBy: ActionCapId | null;       // 'ACTIONS_PER_HOUR' | 'MIN_INTERVAL' | 'DAILY_LOSS' | null
  detail: string;
  value: T | null;                     // resultado de execute() cuando outcome === 'EXECUTED'
}

/** Única puerta de toda acción automática que llega al exchange. */
authorizeAndRun<T>(request: ActionRequest, execute: () => Promise<T>): Promise<ActionResult<T>>;
```

Secuencia interna, en este orden:

```
 1. PASSTHROUGH — si config.reactiveLoopEnabled === false:
       ejecutar execute() sin lease, sin conteo y SIN escribir bot_actions.
       Devuelve { outcome: 'EXECUTED' }. Es la garantía literal de CA-001: con el loop apagado,
       la puerta es transparente y el comportamiento observable es el de hoy.
 2. FAIL-CLOSED DE INFRAESTRUCTURA — si !coordination.isHealthy():
       { outcome: 'BLOCKED', blockedBy: null, detail: 'COORDINATION_UNAVAILABLE' }.
       Sin estado compartido no se ejecutan acciones automáticas del loop.
 3. LEASE DE BOT — tryAcquire(`rx:v1:bot:{configId}`, instanceId, botActionLeaseTtlMs)
       false -> { outcome: 'DEFERRED', detail: 'BOT_BUSY' }
       Se libera en finally con CAS. Cubre autorización + ejecución + registro; NUNCA cubre
       la deliberación del LLM (US-01-011).
 4. REVALIDACIÓN CONTRA EL ESTADO VIGENTE (US-01-012, RN-16)
       si request.expected != null: releer la Position de Postgres.
       status !== 'OPEN' || quantity/partialExitCount cambiados
         -> { outcome: 'SUPERSEDED', blockedBy: null, detail: 'POSITION_CHANGED' } + fila en bot_actions
 5. CONTADORES SOBRE ESTADO COMPARTIDO
       executedActionsInLastHour = count(bot_actions where config_id = ? and outcome = 'EXECUTED'
                                          and occurred_at >= now - 1h)
       lastExecutedActionAtMs    = max(occurred_at) del mismo filtro
       dailyLossReached          = aggregateRisk.evaluateDailyLoss({ userId, mode }).reached
 6. DECISIÓN PURA — evaluateActionCaps({ now, kind, ...contadores, ...caps, dailyLossReached })
 7. BLOQUEO — si !allowed: fila en bot_actions (outcome según disposition, blockedBy) +
       evento WS `agent:action-blocked` + return. execute() NO se invoca.
 8. EJECUCIÓN — await execute(); fila en bot_actions con outcome 'EXECUTED'.
       Si execute() lanza: se propaga y se registra fila con outcome 'BLOCKED',
       blockedBy: null, detail: 'EXECUTION_ERROR: ...'.
```

El paso 5 se ejecuta **dentro** del lease: por eso dos réplicas nunca leen el mismo contador y
ambas ejecutan. El paso 4 es la respuesta concreta a US-01-012: **lease → relectura → decidir →
ejecutar**. Una decisión de LLM que llega después de que el fast path cerró la posición produce
`SUPERSEDED`: la decisión queda registrada en `agent_decisions` para trazabilidad y **no genera
ninguna orden**.

**`evaluateDailyLoss` es un método nuevo, de solo lectura, de `AggregateRiskService`:**

```ts
evaluateDailyLoss(input: { userId: string; mode: TradingMode }):
  Promise<{ reached: boolean; realizedPnlTodayUsd: number; maxDailyLossUsd: number | null }>;
```

Sin notificaciones, sin pausar agentes, sin efectos. `assertBuyAllowed` se refactoriza para usarlo
internamente, de modo que **la aritmética del freno de pérdida diaria siga teniendo una sola
implementación** y `AggregateRiskService` siga siendo la única puerta del riesgo agregado.

### 3.5 Todos los lectores de la puerta (enumeración obligatoria)

| Camino | Origen | `kind` | Estado |
| --- | --- | --- | --- |
| `TradingProcessor.executeBuy` | `LLM_CYCLE` | `BUY` | pasa a llamar `authorizeAndRun` |
| `TradingProcessor.executeLLMSell` | `LLM_CYCLE` | `SELL_FULL` | pasa a llamar `authorizeAndRun` |
| `TradingProcessor.executePartialTakeProfit` (vía `checkOpenPositions`) | `LLM_CYCLE` | `SELL_PARTIAL` | pasa a llamar `authorizeAndRun` |
| `TradingProcessor.closePositionAtMarket` (`TIME_EXIT`, `STOP_LOSS`, `TRAILING_STOP`, `TAKE_PROFIT`) | `LLM_CYCLE` | `SELL_FULL` | pasa a llamar `authorizeAndRun` |
| `TradingProcessor.ensureNativeProtection` cuando el trailing movió el stop | `LLM_CYCLE` | `PROTECTION_REARM` | pasa a llamar `authorizeAndRun` |
| `FastPathService` (las cuatro acciones de RN-9) | `FAST_PATH` | según acción | nuevo |

**Fuera de la puerta, por decisión explícita:**

| Camino | Por qué queda fuera |
| --- | --- |
| `TradingService.closePositionManually` | Es una acción **del humano**, no automática. RN-21 habla de acciones automáticas del bot; un cap que le impida a un trader cerrar su propia posición es un bug, no una protección |
| `ReconciliationService` | No coloca órdenes por decisión del bot: sincroniza el estado con órdenes que el exchange ya ejecutó |
| Colocación de protección nativa **post-BUY** (`placeNativeProtection` dentro de `executeBuy`) | Es parte indivisible de la compra que ya pasó por la puerta; contarla aparte cobraría dos acciones por una decisión |
| Órdenes de protección ya descansando en el exchange | Las ejecuta Binance sin intervención del bot (CA explícito de US-01-015) |

---

## 4. D4 — Umbral de evento material y presupuesto de LLM

### 4.1 Umbral de precio: se reusa `gatePriceChangePct`, no se crea uno propio

**Decisión: se reusa.** Tres razones:

1. El funcional ya lo cerró (US-01-001, tercer criterio; RN-3) y es un campo que ya existe en
   `TradingConfig` (default `0.005`) y en ambos DTOs.
2. Dos umbrales distintos podrían **contradecirse**. Si el umbral del evento fuera mayor que el del
   gate, habría movimientos que el gate considera material y el evento no ve: el disparo llegaría
   tarde. Si fuera menor, el evento despertaría ciclos que el gate resuelve como "precio estable":
   un ciclo gastado a cambio de nada.
3. Un solo número que el trader entiende como "cuánto tiene que moverse el precio para que esto sea
   noticia", con un solo lugar donde tocarlo.

**Consecuencia que el implementor debe conocer:** como el evento tipo 1 usa exactamente el umbral
del gate, un evento tipo 1 garantiza que el gate va a reportar `PRICE_MOVED` en ese instante ⇒
**un ciclo adelantado por evento tipo 1 va a llamar al LLM.** Por eso el token de un solo uso por
ventana (D2) es la pieza que sostiene CA-003, no un detalle de implementación.

### 4.2 Archivo de umbrales

Ningún umbral lo elige el implementor. Dos archivos, al estilo de `DEFAULT_GATE_THRESHOLDS`:

```ts
// libs/analysis/src/lib/reactive/reactive-thresholds.ts
export interface MaterialEventThresholds {
  /** Se inyecta desde TradingConfig.gatePriceChangePct; no tiene default propio en runtime. */
  priceChangePct: number;
  /** Distancia mínima a un nivel para CONFIRMAR de qué lado está el precio (histéresis, RN-6). */
  levelConfirmDistancePct: number;
  /** Ratio volumen observado / volumen esperado a esta altura de la vela. */
  volumeSpikeRatio: number;
  /** Piso de la fracción transcurrida de la vela, para no dividir por ~0 al abrirla. */
  volumeMinElapsedFraction: number;
  /** Throttle de evaluación del detector por símbolo. */
  minEvaluationIntervalMs: number;
}

export const DEFAULT_MATERIAL_EVENT_THRESHOLDS: MaterialEventThresholds = {
  priceChangePct: 0.005,           // espejo del default de gatePriceChangePct
  levelConfirmDistancePct: 0.002,
  volumeSpikeRatio: 2.5,
  volumeMinElapsedFraction: 0.1,
  minEvaluationIntervalMs: 250,
};
```

```ts
// apps/api/src/reactive/reactive-runtime-thresholds.ts
export interface ReactiveRuntimeThresholds {
  ownerLeaseTtlMs: number;            // 30_000
  ownerRenewIntervalMs: number;       // 10_000
  ownerSweepIntervalMs: number;       // 10_000
  symbolRefreshIntervalMs: number;    // 30_000
  healthPublishIntervalMs: number;    // 5_000
  streamTickMaxAgeMs: number;         // 20_000
  streamHeartbeatMaxAgeMs: number;    // 90_000
  streamHealthTtlMs: number;          // 25_000
  streamWarmupTicks: number;          // 2
  wsPingIntervalMs: number;           // 30_000
  wsPongTimeoutMs: number;            // 10_000
  botActionLeaseTtlMs: number;        // 30_000
  degradedNotifyAfterMs: number;      // 60_000
  trailingPersistIntervalMs: number;  // 30_000
}
```

Justificación de los que no son obvios: `streamTickMaxAgeMs = 20_000` porque `@miniTicker` publica
cada ~1 s por símbolo, así que 20 s son 20 latidos perdidos y no un hueco normal;
`streamHealthTtlMs = streamTickMaxAgeMs + healthPublishIntervalMs` para que la ausencia del registro
implique degradación sin ventana ambigua; `ownerLeaseTtlMs = 3 × ownerRenewIntervalMs` para tolerar
dos renovaciones perdidas antes de ceder la propiedad.

### 4.3 Qué es un evento material — definición ejecutable

Función pura nueva, `libs/analysis/src/lib/reactive/material-event.ts`:

```ts
export type MaterialEventType = 'PRICE_MOVED' | 'LEVEL_BREAK' | 'VOLUME_SPIKE';

/** Estado del detector entre ticks. Lo guarda el llamador; la función NO muta su entrada. */
export interface MaterialEventState {
  /** clave = nivel serializado con toFixed(8); valor = último lado CONFIRMADO (-1 | 1) */
  confirmedSideByLevel: Record<string, -1 | 1>;
  lastVolumeEventCandleOpenTime: number | null;
  lastEvaluatedAtMs: number | null;
}

export interface MaterialEventReference {
  /** Precio de cierre de la última decisión. Llega EXPLÍCITO: IndicatorSnapshot no tiene `close`. */
  close: number;
  takenAt: number;
  supportResistance: { support: number[]; resistance: number[] };
  volumeAverage: number;
}

export interface DetectMaterialEventInput {
  now: number;
  tick: { price: number; timestamp: number };
  candle: { volume: number; openTime: number; closeTime: number } | null;
  reference: MaterialEventReference | null;
  state: MaterialEventState;
  thresholds: MaterialEventThresholds;
  referenceMaxAgeMs: number;   // se reusa DEFAULT_GATE_THRESHOLDS.previousDecisionMaxAgeMs (90 min)
}

export interface DetectMaterialEventResult {
  event: MaterialEventType | null;
  detail: string;
  state: MaterialEventState;   // estado nuevo, devuelto por valor
}

export function detectMaterialEvent(input: DetectMaterialEventInput): DetectMaterialEventResult;
```

Reglas internas, en este orden (primero que matchea gana; el `detail` explica el resto):

1. **Guardas fail-closed.** `reference == null` ⇒ sin evento. `now - reference.takenAt >
   referenceMaxAgeMs` ⇒ sin evento (los niveles y el promedio de volumen de una decisión de hace más
   de 90 minutos no describen el mercado actual). `now - state.lastEvaluatedAtMs <
   minEvaluationIntervalMs` ⇒ sin evento.
2. **`PRICE_MOVED` (RN-3).** `|tick.price - reference.close| / reference.close >
   thresholds.priceChangePct`.
3. **`LEVEL_BREAK` (RN-4, RN-6).** Para cada nivel `L` de `support ∪ resistance`:
   `side = sign(tick.price - L)`; el lado se **confirma** solo si
   `|tick.price - L| / L >= levelConfirmDistancePct`. Hay evento cuando un lado confirmado difiere
   del último lado confirmado registrado para ese nivel. Dentro de la banda no se actualiza nada y
   no hay evento: esa histéresis de un solo parámetro es la regla de no-ruido de RN-6.
4. **`VOLUME_SPIKE` (RN-5).**
   `elapsed = clamp((now - candle.openTime) / (candle.closeTime - candle.openTime), volumeMinElapsedFraction, 1)`;
   `expected = reference.volumeAverage * elapsed`;
   evento si `expected > 0 && candle.volume / expected >= volumeSpikeRatio`, y si
   `candle.openTime !== state.lastVolumeEventCandleOpenTime` (un solo evento de volumen por vela).

**Por qué la normalización por fracción transcurrida** (corrección semántica de RN-5, ver §12.1): el
volumen de la vela en curso crece monótonamente durante la hora, así que compararlo crudo contra el
promedio de velas cerradas daría una avalancha de falsos positivos al final de cada vela y falsos
negativos al principio. La comparación sigue siendo **relativa al propio símbolo**, como RN-5 exige.

### 4.4 Presupuesto de LLM y verificación de CA-003

**Propiedad que el diseño garantiza:**

> Con el loop encendido, el número de **ciclos de decisión** de un `configId` en cualquier ventana
> del temporizador es exactamente el mismo que con el loop apagado: uno. Un evento material no suma
> un ciclo, adelanta el que ya estaba pendiente.

De ahí, y de que **el gate no se modifica** (sigue siendo quien decide si se llama al LLM, y sigue
produciendo a lo sumo una llamada de ciclo), sale el techo de CA-003.

**El harness se extiende, no se reemplaza** (`apps/api/src/orchestrator/cost-harness/`):

1. `scenarios.fixture.ts` gana una derivación —no una invención— del camino de precios:
   ```ts
   export function buildScenarioTicks(scenario: CostScenario, tickCount: number):
     Array<{ price: number; volume: number; timestamp: number }>;
   ```
   Interpolación lineal de `previous.close` a `close` entre `previous.takenAt` y
   `snapshotTakenAt`, con el volumen sostenido en `indicators.volume.current`. **Supuesto de
   modelado declarado:** es el camino de mínima suposición entre los dos únicos puntos que el
   escenario conoce; no se inventan picos ni retrocesos que el fixture no contiene. Como el camino es
   monótono, un escenario cuyos extremos son estables en precio **no puede** producir un evento
   tipo 1 — la propiedad se cumple por construcción del fixture, no por elección de números.
2. Spec nueva `reactive-cost-harness.spec.ts`, dos corridas sobre los **mismos 12 escenarios
   congelados**: `BASELINE` (`reactiveLoopEnabled: false`) y `REACTIVE` (`reactiveLoopEnabled: true`),
   reusando `CountingLLMClient` y `scoreRun` sin tocarlos.
3. Asserts, **por escenario** además del agregado:
   - `cycles(REACTIVE, s) === cycles(BASELINE, s) === 1` para los 12.
   - `llmCalls(REACTIVE, s) <= llmCalls(BASELINE, s)` para los 12.
   - `advancesGranted(REACTIVE, s) <= 1` para los 12 (invariante del token de ventana).
   - **No vacuidad:** `sum(advancesGranted) >= 1` sobre los 12 — si ningún escenario adelanta, el
     test no está probando nada.
   - Agregado: `sum(llmCalls REACTIVE) <= sum(llmCalls BASELINE)`.

**Lo que este ciclo NO puede prometer:** que el costo *baje*. Ver §12.4.

---

## 5. D5 — Semántica de degradación del stream

### 5.1 Contrato

```ts
// libs/shared/src/types/interfaces.ts
export type StreamHealthState = 'HEALTHY' | 'DEGRADED' | 'UNKNOWN';

export interface StreamHealthRecord {
  symbol: string;
  ownerId: string;
  connectedAt: number;
  lastTickAtMs: number;
  lastHeartbeatAtMs: number;
  publishedAt: number;
}
```

```ts
// libs/analysis/src/lib/reactive/stream-health.ts  (pura)
export type StreamHealthReason = 'NO_RECORD' | 'TICK_STALE' | 'HEARTBEAT_STALE' | null;

export function resolveStreamHealth(input: {
  now: number;
  record: StreamHealthRecord | null;
  thresholds: { tickMaxAgeMs: number; heartbeatMaxAgeMs: number };
}): { state: StreamHealthState; reason: StreamHealthReason };
```

- `record == null` ⇒ `{ state: 'UNKNOWN', reason: 'NO_RECORD' }`. **Todo consumidor trata `UNKNOWN`
  igual que `DEGRADED`.** No existe ningún camino en el que la ausencia de información se lea como
  salud.
- `now - lastTickAtMs > tickMaxAgeMs` ⇒ `DEGRADED / TICK_STALE`.
- `now - lastHeartbeatAtMs > heartbeatMaxAgeMs` ⇒ `DEGRADED / HEARTBEAT_STALE`.
- En cualquier otro caso, `HEALTHY`.

**El registro solo lo escribe el dueño vivo del símbolo**, cada `healthPublishIntervalMs` (5 s), con
`PX = streamHealthTtlMs` (25 s). Por eso la misma expiración que transfiere la propiedad declara la
degradación: **no existe un estado que diga "sano" sin un dueño refrescándolo.** La regla dura del
hallazgo F queda garantizada por la estructura del dato, no por una comprobación que alguien podría
olvidar.

### 5.2 Qué hace el bot mientras dura

| Aspecto | Con el símbolo `DEGRADED` / `UNKNOWN` |
| --- | --- |
| Disparo por evento material | **Suspendido** (guarda del paso 2 de la secuencia de D2). RN-28 |
| Fast path por tick | **Suspendido**: no hay ticks confiables |
| Ciclo por temporizador | **Sigue igual que hoy**, con precio por REST. RN-29 |
| `checkOpenPositions` del ciclo | Sigue corriendo con precio REST: los reflejos no desaparecen, bajan de frecuencia a la de hoy |
| `isRunning` del bot | **No se toca.** La degradación nunca pausa un agente |
| Recuperación | Automática con el primer registro fresco. Sin intervención manual (RN-29) |
| Arranque en frío tras reconectar | El fast path espera `streamWarmupTicks = 2` ticks antes de accionar, para no operar sobre el primer frame de una conexión recién levantada. El disparo por evento no espera: un precio lejano tras un corte **es** una novedad material |

### 5.3 Observabilidad

1. **Consultable:** `GET /trading/stream-health` (EP-015, §10) — estado por símbolo de las configs
   del usuario autenticado.
2. **Evento WS:** `market:stream-health` por `emitToAll`, **solo en la transición** (sano→degradado y
   degradado→sano), nunca por tick. Payload
   `{ symbol, state, reason, lastTickAt, ownerId, changedAt }`.
3. **Notificación persistente:** si la degradación supera `degradedNotifyAfterMs` (60 s), una
   `Notification` por usuario afectado, con `NotificationType.AGENT_ERROR` y
   `JSON.stringify({ key: 'streamDegraded', symbol })`. **Se reusa un valor existente del enum a
   propósito:** agregar un valor a un enum de Postgres es un `ALTER TYPE`, la única migración que el
   motor no trata como aditiva trivial, y no vale ese costo por una etiqueta.
4. **Registro de la transición:** log estructurado + el propio evento WS. No se persiste una tabla de
   transiciones: RN-27 pide que el estado sea consultable y que el cambio quede registrado, y ambas
   cosas quedan cubiertas sin una tabla más.

### 5.4 Heartbeat: lo que hay que agregarle a `BinanceWsClient`

Hoy `BinanceWsClient` **no tiene heartbeat** y no detecta una conexión medio abierta: un socket TCP
que quedó colgado produce silencio permanente y `autoReconnect` nunca se dispara porque el evento
`close` no llega. Extensiones **aditivas** (los 7 tests existentes deben seguir pasando):

1. `on('ping')` y `on('pong')` ⇒ `emit('heartbeat', { at: Date.now() })`.
2. `ws.ping()` propio cada `wsPingIntervalMs`; si no llega `pong` en `wsPongTimeoutMs`,
   `ws.terminate()` para que `autoReconnect` actúe.
3. `addStreams(streams: string[])` / `removeStreams(streams: string[])`: con el socket conectado
   envían `{ method: 'SUBSCRIBE' | 'UNSUBSCRIBE', params, id }`; sin conectar, solo actualizan la
   lista pendiente. Hace falta porque el conjunto de símbolos activos cambia cuando un bot arranca o
   para, y hoy la lista de suscripciones solo se puede fijar antes de `connect()`.
4. `isConnected(): boolean`.

Streams por símbolo: `{symbol}@miniTicker` (precio, ~1/s: alimenta el fast path y los eventos tipo 1
y 2) y `{symbol}@kline_1h` (vela en curso: alimenta el evento tipo 3 y da el `close` coherente con el
timeframe del ciclo). El intervalo va en la constante `REACTIVE_KLINE_INTERVAL = '1h'`, **que debe
coincidir con el timeframe con el que se construye el `IndicatorSnapshot`** (`getKlines('1h', 200)`).

---

## 6. Contratos puros nuevos en `libs/`

### 6.1 `libs/shared` — vocabulario común

En `src/types/interfaces.ts` (van acá porque los necesitan `data-fetcher` como productor y
`analysis` como consumidor; es la regla vigente de la constitución de `shared`):

```ts
export interface MarketTick {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface MarketCandleTick {
  symbol: string;
  interval: string;
  openTime: number;
  closeTime: number;
  close: number;
  volume: number;
  isClosed: boolean;
}
```

`TickerUpdate` / `KlineUpdate` de `data-fetcher` **no se tocan** (7 tests dependen de ellos): el
adaptador de `apps/api` mapea `TickerUpdate → MarketTick` y `KlineUpdate → MarketCandleTick`. La
forma del wire del productor y el vocabulario del consumidor son cosas distintas.

### 6.2 `libs/trading-engine` — plan del fast path

```ts
// libs/trading-engine/src/lib/fast-path.ts
export type FastPathActionKind =
  | 'HARD_STOP_EXIT'
  | 'TRAILING_EXIT'
  | 'PARTIAL_TAKE_PROFIT'
  | 'PROTECTION_REARM';

export interface FastPathPositionSnapshot {
  id: string;
  entryPrice: number;
  quantity: number;
  stopPrice: number | null;
  highWaterPrice: number | null;
  trailingActive: boolean;
  partialExitCount: number;
  protectionStatus: string;
}

export interface FastPathConfigSnapshot {
  stopLossPct: number;
  trailingStopEnabled: boolean;
  trailingStopPct: number;
  trailingActivationPct: number;
  partialTpEnabled: boolean;
  partialTpTriggerPct: number;
  partialTpSellPct: number;
  moveStopToBreakevenAfterPartial: boolean;
  nativeProtectionEnabled: boolean;
  takeProfitPct: number;
}

export interface PlanFastPathInput {
  now: number;
  currentPrice: number;
  position: FastPathPositionSnapshot;
  config: FastPathConfigSnapshot;
  isSandbox: boolean;
  lotStep: number;
  minNotional: number;
}

export type FastPathPlan =
  | { action: 'NONE'; trailing: TrailingState; reason: string }
  | { action: 'HARD_STOP_EXIT'; trailing: TrailingState; effectiveStop: number }
  | { action: 'TRAILING_EXIT'; trailing: TrailingState; effectiveStop: number }
  | { action: 'PARTIAL_TAKE_PROFIT'; trailing: TrailingState; partial: PartialTakeProfitResult }
  | { action: 'PROTECTION_REARM'; trailing: TrailingState; desiredStopPrice: number };

export function planFastPath(input: PlanFastPathInput): FastPathPlan;
```

Orden interno **fijo**, primero que matchea gana — es el mismo orden de la máquina de salidas de
`checkOpenPositions`, menos las dos ramas que no pertenecen al fast path:

```
1. trailing = updateTrailingStop(estado, currentPrice, cfgTrailing, config.stopLossPct)
2. effectiveStop = trailing.stopPrice ?? entryPrice * (1 - config.stopLossPct)
   currentPrice <= effectiveStop
     -> trailing.trailingActive ? 'TRAILING_EXIT' : 'HARD_STOP_EXIT'
3. resolvePartialTakeProfit(...) != null  -> 'PARTIAL_TAKE_PROFIT'
4. trailing.stopPrice !== position.stopPrice
     && resolveProtectionRearm({...}).action === 'REARM'  -> 'PROTECTION_REARM'
5. 'NONE'  (el llamador persiste el trailing si cambió; persistir NO es una acción — RN-18)
```

**`planFastPath` NO invoca `evaluateSellPolicy`, y `shouldExitByTime` queda fuera.** Justificación en
§12.2.

### 6.3 `libs/trading-engine` — caps

```ts
// libs/trading-engine/src/lib/risk/action-caps.ts
export type BotActionKind = 'BUY' | 'SELL_FULL' | 'SELL_PARTIAL' | 'PROTECTION_REARM';
export type ActionExposure = 'INCREASING' | 'REDUCING' | 'NEUTRAL';
export type ActionCapId = 'ACTIONS_PER_HOUR' | 'MIN_INTERVAL' | 'DAILY_LOSS';

export function classifyActionExposure(kind: BotActionKind): ActionExposure;

export interface ActionCapsInput {
  now: number;
  kind: BotActionKind;
  executedActionsInLastHour: number;
  lastExecutedActionAtMs: number | null;
  maxActionsPerHour: number;
  minActionIntervalMs: number;
  dailyLossReached: boolean;
}

export type ActionCapsDecision =
  | { allowed: true; reason: string }
  | { allowed: false; blockedBy: ActionCapId; disposition: 'DEFERRED' | 'DISCARDED'; reason: string };

export function evaluateActionCaps(input: ActionCapsInput): ActionCapsDecision;
```

Orden de evaluación (fija el `blockedBy` que se reporta):

```
1. classifyActionExposure(kind) === 'REDUCING'   -> { allowed: true }   // §3.1
2. dailyLossReached && exposure === 'INCREASING' -> DAILY_LOSS / DISCARDED
3. lastExecutedActionAtMs != null
     && now - lastExecutedActionAtMs < minActionIntervalMs -> MIN_INTERVAL / DEFERRED
4. executedActionsInLastHour >= maxActionsPerHour          -> ACTIONS_PER_HOUR / DEFERRED
5. { allowed: true }
```

**Prueba de CA-004 a nivel de firma:** la entrada completa son un timestamp, un enum cerrado, dos
contadores, dos números de configuración y un booleano. **No hay ningún parámetro por el que pueda
entrar una salida del LLM.** Test ejecutable que lo respalda: correr el mismo escenario bloqueado
variando `LLMDecision.confidence` en todo su rango y `reasoning` con textos arbitrarios, y afirmar
que el resultado del gate es invariante y que el mock del transporte **no** fue invocado. Prohibido
afirmarlo con string-matching sobre el código fuente.

### 6.4 `libs/analysis` — detector y salud

Ya especificados en §4.3 y §5.1. Ambos exportados por el barrel de `libs/analysis`. Ninguno de los
dos importa `libs/data-fetcher`.

---

## 7. Orquestación en `apps/api`

### 7.1 Módulos y grafo de dependencias

```
ReactiveCoordinationModule   (hoja: provee REACTIVE_COORDINATION, igual que SharedCacheModule)
        ^                 ^
        |                 |
   TradingModule  <---  ReactiveModule
```

Unidireccional, sin ciclos. `ReactiveModule` importa `TradingModule` (para `ActionGateService` y
`PositionActionService`) y registra la cola `TRADING_QUEUE` por su cuenta para poder promover jobs.
`TradingModule` **no** importa `ReactiveModule`.

### 7.2 Piezas nuevas

| Archivo | Responsabilidad |
| --- | --- |
| `src/reactive/reactive-coordination.port.ts` | Puerto + símbolo de DI |
| `src/reactive/redis-reactive-coordination.service.ts` | Implementación ioredis con CAS Lua |
| `src/reactive/disabled-reactive-coordination.service.ts` | Implementación apagada (todo `false`/`null`) |
| `src/reactive/reactive-coordination.module.ts` | Fábrica por env, exporta el puerto |
| `src/reactive/reactive-runtime-thresholds.ts` | Umbrales de infraestructura (§4.2) |
| `src/reactive/market-stream.service.ts` | Propiedad por símbolo, ciclo de vida del WS, fan-out de ticks. `OnModuleInit` + `OnApplicationShutdown` |
| `src/reactive/stream-health.service.ts` | Publica y resuelve el estado por símbolo; emite transiciones |
| `src/reactive/material-event.service.ts` | Compone `detectMaterialEvent` y ejecuta la secuencia de adelanto de D2 |
| `src/reactive/fast-path.service.ts` | Compone `planFastPath` y delega la ejecución en `PositionActionService` a través de `ActionGateService` |
| `src/trading/action-gate.service.ts` | **Única puerta** de toda acción automática (§3.4) |
| `src/trading/position-action.service.ts` | Ejecución de salidas y re-armados, extraída del processor (§7.3) |

### 7.3 Extracción de `PositionActionService` (obligatoria, no opcional)

El fast path necesita cerrar posiciones, vender parcial y re-armar protección. Esas tres cosas hoy
son métodos privados de `TradingProcessor` (1961 líneas). **Reimplementarlas en el fast path sería
una segunda implementación del camino de salida y la vía directa a violar CA-006** — el error exacto
que la lección "al centralizar una regla, enumerar todos sus lectores" describe.

`PositionActionService` (`apps/api/src/trading/position-action.service.ts`) expone:

```ts
closeAtMarket(ctx: CloseAtMarketContext): Promise<{ tradeId: string; exitPrice: number }>;
executePartialTakeProfit(ctx: PartialTakeProfitContext): Promise<{ tradeId: string }>;
rearmProtection(ctx: RearmProtectionContext): Promise<{ protectionStatus: string }>;
```

Reglas de la extracción:

- Es **preservadora de comportamiento**: `closePositionAtMarket`, `executePartialTakeProfit`,
  `ensureNativeProtection`, `attemptProtectionPlacement`, `applyProtectionOutcome` y
  `releaseProtectionIfNeeded` se mueven tal cual y `TradingProcessor` **delega**.
- `releaseProtectionIfNeeded` queda **dentro** de `closeAtMarket` y de
  `executePartialTakeProfit`, antes de todo `placeMarketOrder(SELL)`. Así CA-006 se cumple para el
  fast path por construcción: no hay forma de vender sin pasar por el método que libera.
- Evidencia de que la extracción no cambió nada: `trading.processor.exit-machine.spec.ts`,
  `trading.processor.native-protection.spec.ts`, `trading.processor.protection-rearm.spec.ts`,
  `trading.processor.sell-policy.spec.ts` y `trading.processor.isolation.spec.ts` siguen pasando
  **sin cambiar sus aserciones** (imports y wiring sí pueden cambiar).

### 7.4 Camino de un tick, de punta a punta

```
BinanceWsClient 'ticker' (solo en el dueño del símbolo)
  -> MarketStreamService: mapea a MarketTick, actualiza lastTickAtMs, publica salud (throttled 5 s)
  -> si warmup incompleto -> descartar
  -> para cada TradingConfig activa del símbolo con reactiveLoopEnabled = true:

     A) FAST PATH   (RN-1: en CADA tick, sea o no evento material)
        posiciones OPEN del configId (cache en proceso, invalidada por cada acción propia
        y refrescada cada symbolRefreshIntervalMs)
        plan = planFastPath({ now, currentPrice, position, config, isSandbox, lotStep, minNotional })
        plan.action === 'NONE'
            -> persistir trailing solo si cambió stopPrice, o como mucho cada
               trailingPersistIntervalMs si solo se movió highWaterPrice. NO es una acción (RN-18)
        plan.action !== 'NONE'
            -> actionGate.authorizeAndRun({ kind mapeado, source: 'FAST_PATH', expected: {...} },
                 () => positionAction.<método correspondiente>(...))

     B) DISPARO POR EVENTO   (RN-2)
        detectMaterialEvent({ now, tick, candle, reference, state, thresholds, referenceMaxAgeMs })
        event !== null -> secuencia de adelanto de D2
```

Mapeo `FastPathActionKind → BotActionKind`:
`HARD_STOP_EXIT | TRAILING_EXIT → SELL_FULL`; `PARTIAL_TAKE_PROFIT → SELL_PARTIAL`;
`PROTECTION_REARM → PROTECTION_REARM`.

`lotStep` y `minNotional` se resuelven **una vez por símbolo** al tomar la propiedad
(`getSymbolFilters`, ya cacheado por proceso en `BinanceRestClient`), no por tick.

### 7.5 De dónde sale la referencia de la última decisión

De la última `AgentDecision` del `configId`: `metadata.gate.snapshot` (`close`, `takenAt`) y
`indicators` (`supportResistance`, `volume.average`). Reglas duras:

- El `close` llega **explícito** desde `metadata.gate.snapshot.close`. **`IndicatorSnapshot` no tiene
  `close`**: castear esperando ese campo devuelve `undefined` en silencio.
- `metadata` e `indicators` son `Json`: se validan con un type guard —el patrón de
  `isValidGateSnapshot` de `decision-gate.service.ts`— y **nunca** con un cast. Payload inválido o
  incompleto ⇒ `reference = null` ⇒ sin eventos (fail-closed).
- El snapshot se persiste hoy en `metadata.gate` **corra o no el gate** (el objeto `gate` incluye
  `snapshot: current` incluso con `reason: 'DISABLED'`), así que la referencia existe sin exigir
  `deterministicGateEnabled`.
- La referencia se refresca por `configId` cuando aparece una `AgentDecision` nueva; entre ciclos es
  fija. **Los niveles y el promedio de volumen envejecen con la ventana**, y por eso la guarda de
  `referenceMaxAgeMs` (90 min, el `previousDecisionMaxAgeMs` que ya existe) es parte del contrato.
- **Una acción del fast path NO actualiza la referencia**: no es una decisión. Si la actualizara,
  cada salida suprimiría la detección de eventos posteriores.
- `AgentDecision.confidence` se persiste en escala **0–1** (`confidencePct = confidence * 100` es lo
  que se compara contra `buyThreshold`/`sellThreshold`). Cualquier consumidor nuevo de ese campo debe
  usarlo como 0–1.

---

## 8. Configuración nueva de `TradingConfig`

Tres columnas, y solo tres. **Criterio para decidir columna vs. constante: es columna el límite de
seguridad que el trader debe poder fijar; es constante del archivo de umbrales el parámetro de
detección que el sistema calibra.**

| Campo | Tipo Prisma | Default | Rango DTO | Rol |
| --- | --- | --- | --- | --- |
| `reactiveLoopEnabled` | `Boolean` | `false` | booleano | Interruptor maestro del ciclo entero |
| `maxActionsPerHour` | `Int` | `6` | `1..60` | Cap de acciones por hora móvil (por bot) |
| `minActionIntervalSec` | `Int` | `60` | `5..3600` | Tiempo mínimo entre acciones ejecutadas (por bot) |

- Los tres se declaran en **`CreateTradingConfigDto` y en `UpdateTradingConfigDto`**. Un campo nuevo
  declarado en uno solo hace que el request entero responda 400 por `forbidNonWhitelisted: true`.
- `maxActionsPerHour` y `minActionIntervalSec` **solo se leen cuando `reactiveLoopEnabled = true`**,
  así que sus defaults no alteran ninguna instalación existente (CA-001) y a la vez hacen imposible
  encender el loop sin caps.
- El interruptor es **uno solo**. Cada una de las cuatro acciones del fast path ya está gobernada por
  su propio flag existente (`trailingStopEnabled`, `partialTpEnabled`, `nativeProtectionEnabled`), así
  que no hacen falta sub-interruptores nuevos.
- UI de estos campos: **fuera de alcance** (deuda de UI ya diferida, `out_of_scope` del brief).

---

## 9. Schema de datos

### 9.1 Tabla nueva `bot_actions`

```prisma
enum BotActionKind {
  BUY
  SELL_FULL
  SELL_PARTIAL
  PROTECTION_REARM
}

enum BotActionSource {
  FAST_PATH
  LLM_CYCLE
}

enum BotActionOutcome {
  EXECUTED
  BLOCKED
  DEFERRED
  SUPERSEDED
}

enum BotActionCap {
  ACTIONS_PER_HOUR
  MIN_INTERVAL
  DAILY_LOSS
}

model BotAction {
  id         String            @id @default(cuid())
  userId     String
  configId   String
  kind       BotActionKind
  source     BotActionSource
  outcome    BotActionOutcome
  blockedBy  BotActionCap?
  /// Referencia de auditoría, sin FK a propósito (ver nota)
  positionId String?
  /// Referencia de auditoría, sin FK a propósito (ver nota)
  decisionId String?
  detail     String?
  occurredAt DateTime          @default(now())

  user   User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  config TradingConfig @relation(fields: [configId], references: [id], onDelete: Cascade)

  @@index([configId, occurredAt])
  @@index([userId, occurredAt])
  @@map("bot_actions")
}
```

Decisiones de modelado:

- **`positionId` y `decisionId` sin FK, a propósito.** El ledger es auditoría: debe sobrevivir a la
  desaparición de lo que referencia. Un `ON DELETE CASCADE` borraría la evidencia y un
  `ON DELETE SET NULL` la borraría en silencio. `userId` y `configId` sí llevan FK con `CASCADE`
  porque son datos operativos del bot y no tienen sentido huérfanos.
- **No hay columna `exposure`.** Es derivable de `kind` con `classifyActionExposure`; persistirla
  sería una segunda fuente de verdad que puede divergir de la función pura.
- `@@index([configId, occurredAt])` sirve a las dos consultas del gate: el `count` de la ventana móvil
  de una hora y el `max(occurredAt)` de la última acción.
- Alta obligatoria del getter `botAction` en `PrismaService` (los getters son 1:1 con los modelos).

### 9.2 Columnas nuevas en `trading_configs`

```prisma
reactiveLoopEnabled   Boolean @default(false)
maxActionsPerHour     Int     @default(6)
minActionIntervalSec  Int     @default(60)
```

Y las back-relations en `User` y `TradingConfig`: `botActions BotAction[]`.

### 9.3 SQL aditivo (no hay BD disponible: se escribe a mano)

Archivo: `apps/api/prisma/migrations/<timestamp>_add_reactive_loop/migration.sql`.

```sql
CREATE TYPE "BotActionKind"    AS ENUM ('BUY','SELL_FULL','SELL_PARTIAL','PROTECTION_REARM');
CREATE TYPE "BotActionSource"  AS ENUM ('FAST_PATH','LLM_CYCLE');
CREATE TYPE "BotActionOutcome" AS ENUM ('EXECUTED','BLOCKED','DEFERRED','SUPERSEDED');
CREATE TYPE "BotActionCap"     AS ENUM ('ACTIONS_PER_HOUR','MIN_INTERVAL','DAILY_LOSS');

CREATE TABLE "bot_actions" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "configId"   TEXT NOT NULL,
  "kind"       "BotActionKind"    NOT NULL,
  "source"     "BotActionSource"  NOT NULL,
  "outcome"    "BotActionOutcome" NOT NULL,
  "blockedBy"  "BotActionCap",
  "positionId" TEXT,
  "decisionId" TEXT,
  "detail"     TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bot_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_bot_actions_config_occurred" ON "bot_actions" ("configId", "occurredAt");
CREATE INDEX "idx_bot_actions_user_occurred"   ON "bot_actions" ("userId", "occurredAt");

ALTER TABLE "bot_actions"
  ADD CONSTRAINT "bot_actions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bot_actions"
  ADD CONSTRAINT "bot_actions_configId_fkey"
  FOREIGN KEY ("configId") REFERENCES "trading_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trading_configs"
  ADD COLUMN "reactiveLoopEnabled"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maxActionsPerHour"    INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN "minActionIntervalSec" INTEGER NOT NULL DEFAULT 60;
```

Enteramente aditivo: cuatro `CREATE TYPE`, un `CREATE TABLE` y tres `ADD COLUMN` con default. **No
hay ningún `ALTER TYPE ... ADD VALUE`** (ver §5.3, punto 3) ni migración de `TradingMode`.

---

## 10. Contratos de API

### 10.1 Endpoints nuevos

**EP-015 — `GET /trading/stream-health`**

| | |
| --- | --- |
| Auth | `Authorization: Bearer <jwt>` |
| Query | ninguno |
| 200 | `{ symbols: [{ symbol, state: 'HEALTHY'\|'DEGRADED'\|'UNKNOWN', reason: string\|null, lastTickAt: string\|null, ownerId: string\|null, updatedAt: string\|null }] }` |
| 401 | JWT ausente o inválido |

Devuelve una entrada por símbolo distinto de las `TradingConfig` del usuario con `isRunning = true`.
Un símbolo sin registro se reporta `UNKNOWN / NO_RECORD`, nunca se omite: la ausencia de información
es información.

**EP-016 — `GET /trading/actions`**

| | |
| --- | --- |
| Auth | `Authorization: Bearer <jwt>` |
| Query | `configId?` (string), `outcome?` (`EXECUTED\|BLOCKED\|DEFERRED\|SUPERSEDED`), `since?` (ISO-8601), `limit?` (1..200, default 50), `cursor?` (id) |
| 200 | `{ items: [{ id, configId, kind, source, outcome, blockedBy, positionId, decisionId, detail, occurredAt }], nextCursor: string\|null }` |
| 401 | JWT ausente o inválido |

Es el "registro consultable" que exigen RN-24 y US-01-016. **Sin este endpoint el requisito queda
cumplido solo en la base y el trader nunca ve por qué su bot no actuó.** Que `blockedBy` sea un enum
propio y no un `Decision` es lo que hace "bloqueado por un cap" observable y distinto de un `HOLD`
ordinario (segundo criterio de US-01-016).

### 10.2 Endpoints modificados

| ID | Cambio |
| --- | --- |
| **EP-006** `POST /trading/config` | Acepta `reactiveLoopEnabled?`, `maxActionsPerHour?`, `minActionIntervalSec?` en el body. `status: "updated"` |
| **EP-007** `PUT /trading/config/{id}` | Idem. `status: "updated"` |

### 10.3 Eventos WebSocket (no van a `api.json`)

| Evento | Emisión | Payload |
| --- | --- | --- |
| `market:stream-health` | `emitToAll`, **solo en transición** | `{ symbol, state, reason, lastTickAt, ownerId, changedAt }` |
| `agent:cycle-advanced` | `emitToUser(userId)` | `{ configId, symbol, eventType, advancedByMs }` |
| `agent:action-blocked` | `emitToUser(userId)` | `{ configId, kind, source, outcome, blockedBy, detail, occurredAt }` |

---

## 11. Entradas que hay que escribir en los registros SDD

**No las escribe este documento** (las escribe el implementor / reviewer al cerrar). Quedan
declaradas acá para que nadie las invente:

### `sdd/schema.json` → app-key `apps/api`

| Tabla | Operación | Campos clave |
| --- | --- | --- |
| `bot_actions` | **CREAR** | `module: "reactive-execution-loop"`, `spec: "sdd/specs/spec-e-burgos-005-reactive-execution-loop"`, `status: "defined"`, `created_in_cycle: 1`, `updated_in_cycle: null`, `migration_file` apuntando al SQL de §9.3, `columns` de §9.1 en snake/camel según el resto del registro, `indexes`: `pk_bot_actions`, `idx_bot_actions_config_occurred`, `idx_bot_actions_user_occurred`, `changelog: []` |
| `trading_configs` | **MODIFICAR** | `updated_in_cycle: 1`, `status: "updated"`, tres columnas nuevas, y una entrada de `changelog`: `{ cycle: 1, date: "2026-08-29", change: "reactiveLoopEnabled, maxActionsPerHour y minActionIntervalSec para el loop reactivo; los tres nacen sin alterar el comportamiento", migration: "<archivo>" }` |

### `sdd/api.json` → app-key `apps/api`

| Endpoint | Operación |
| --- | --- |
| `EP-015 GET /trading/stream-health` | **CREAR**, `status: "defined"`, `created_in_cycle: 1`, `module: "reactive-execution-loop"` |
| `EP-016 GET /trading/actions` | **CREAR**, `status: "defined"`, `created_in_cycle: 1`, `module: "reactive-execution-loop"` |
| `EP-006 POST /trading/config` | **MODIFICAR**: `status: "updated"`, `updated_in_cycle: 1`, changelog con los tres campos nuevos del body |
| `EP-007 PUT /trading/config/{id}` | **MODIFICAR**: idem |

`pnpm sdd:validate` en verde después de escribirlas (`api.schema.json` y `db-schema.schema.json` son
`additionalProperties: false`).

---

## 12. Correcciones al funcional y al brief

El reviewer valida contra **esta** redacción.

### 12.1 RN-5 — el "ratio de volumen" no existe en el stream

`TickerUpdate.volume` de `@miniTicker` es el volumen **rodante de 24 h**, no el volumen del intervalo.
Compararlo contra `IndicatorSnapshot.volume.average` (promedio de velas de 1 h cerradas) es comparar
magnitudes distintas y produciría un ratio permanentemente enorme: el detector dispararía en todos los
ticks.

**Corrección:** el evento de volumen se calcula sobre la **vela en curso del mismo timeframe del
indicador** (`@kline_1h`), normalizada por la fracción transcurrida de la vela (§4.3, punto 4). Sigue
siendo relativa al propio símbolo, que es lo que RN-5 exige.

### 12.2 RN-9 y US-01-006 — qué es "el stop duro" en el código

RN-9 dice que el stop duro lo decide `evaluateSellPolicy` con resultado `LOSS_CUT`. En el código,
`evaluateSellPolicy` **no es el stop**: es la política que autoriza el `SELL` **del LLM**, y su rama
`LOSS_CUT` es un corte discrecional que depende de `signalConfidence` (la confianza de la última
decisión del LLM) y de un edge ratio. El stop real es la comparación
`currentPrice <= max(stop persistido, nivel trailed)` de la máquina de salidas de
`checkOpenPositions`.

**Corrección:**

- El stop duro del fast path es la comparación determinista contra `effectiveStop`, etiquetada
  `HARD_STOP_EXIT` o `TRAILING_EXIT` según `trailingActive` — la **misma** comparación que usa la
  máquina existente, para que los dos caminos no puedan discrepar nunca.
- **El fast path no invoca `evaluateSellPolicy`.** Meterlo permitiría cerrar una posición sin que
  ningún stop se haya tocado, en base a una confianza del LLM de hace media hora: es una decisión
  estratégica, y RN-12 la reserva explícitamente al LLM. Como efecto lateral desaparece el problema
  de la confianza envejecida.
- `shouldExitByTime` queda fuera del fast path: es una salida gobernada por el reloj, no por el
  precio; un tick no aporta nada que el ciclo por temporizador no vea igual.

El set de RN-9 sigue teniendo cuatro acciones y el resto del funcional no cambia.

### 12.3 Falta `enableShutdownHooks` (y no hay ningún `OnApplicationShutdown` en el repo)

Verificado: no existe `app.enableShutdownHooks()` en `main.ts` ni un solo `OnApplicationShutdown` en
`apps/api`. Sin él, `ReactiveModule` nunca libera los leases al desplegar y **cada deploy cuesta hasta
40 s de ventana ciega por símbolo**, en vez de ≤10 s. Es una línea en `main.ts` y es parte del
alcance de este ciclo. Lo que el hook limpia está enumerado en §1.

### 12.4 CA-003: el costo no sube; **bajar no está en el alcance de este ciclo**

El brief dice "el loop reactivo debe BAJAR el costo de LLM por bot/día". El diseño garantiza
**no-incremento**, que es lo que CA-003 literalmente pide ("no supera la línea base"), y no puede
garantizar una baja. Razón estructural: RN-4 prohíbe eliminar el temporizador y RN-3 fija el umbral
del evento en el mismo `gatePriceChangePct` del gate. Con esas dos restricciones, el número de
evaluaciones del gate por ventana es exactamente uno, encendido o apagado el loop — el loop cambia
**cuándo** ocurre esa evaluación, no cuántas ocurren. La reducción de llamadas de LLM ya la entregó
el gate de `spec-001`; el aporte de este ciclo es **latencia a costo constante**.

Si en un ciclo posterior se quisiera una baja real, la palanca es dejar de disparar el ciclo por
temporizador cuando la ventana entera no tuvo ningún evento material — pero eso exige que el detector
cubra también las condiciones no-precio del gate (EMA, RSI, huellas de noticias, macro y posiciones),
que hoy solo se recalculan una vez por ciclo. Es un ciclo propio, no un ajuste.

### 12.5 RN-19, RN-20, RN-21, RN-22 y RN-25 — redacción corregida

- **RN-19'** — Máximo de acciones por hora: cap sobre las acciones (RN-18) ejecutadas por un bot en
  una ventana móvil de una hora. Al alcanzarse, la siguiente acción elegible **que aumenta exposición
  (`BUY`) o que es un re-armado de protección** se **difiere**. **Las acciones que reducen exposición
  (venta total, venta parcial) nunca se difieren por este cap**: se ejecutan y se contabilizan.
- **RN-20'** — Tiempo mínimo entre ejecuciones: idéntico alcance que RN-19'. Se mide entre acciones
  efectivamente ejecutadas del mismo `configId`, no entre eventos detectados.
- **RN-21'** — Límite de pérdida diaria: al alcanzarse, quedan **descartadas** por el resto del día
  calendario UTC todas las acciones automáticas nuevas **que aumentan exposición** (apertura de
  posición). **Las salidas y los re-armados de protección siguen permitidos**: el freno existe para
  dejar de asumir riesgo, no para impedir dejar de asumirlo. Se levanta solo al iniciar el día
  siguiente.
- **RN-22'** — La ampliación respecto de hoy sigue en pie —el freno deja de ser exclusivo del camino
  de `BUY` y pasa a evaluarse en la misma puerta para el camino reactivo y el del LLM— con el alcance
  de RN-21'. El freno sigue siendo **por usuario** (`UserRiskPolicy.maxDailyLossUsd`, día calendario
  UTC), no por bot.
- **RN-23** — sin cambios y reforzada: la clasificación por exposición es una función pura de un enum
  cerrado de acciones; ningún campo del LLM entra en `ActionCapsInput` (§6.3).
- **RN-25'** — Deja de ser una recomendación con riesgo abierto. El riesgo que describía (un stop duro
  diferido por el cap dejando sin red a un bot con `nativeProtectionEnabled: false`) **queda eliminado
  por RN-19' y RN-21'**: una salida no se difiere nunca. Se mantiene la recomendación de habilitar la
  protección nativa, ahora sin consecuencia de seguridad asociada a los caps.

### 12.6 US-01-015 / RN-21 — el freno de pérdida diaria es por usuario

La historia dice "mi bot ya perdió en el día". La implementación evalúa `UserRiskPolicy` **por
usuario**, con la semántica de día calendario UTC que ya existe. Redacción corregida: *"si la cuenta
del trader ya perdió en el día lo que configuró como máximo tolerable, **todos** sus bots dejan de
abrir exposición hasta el día siguiente"*. Justificación en §3.2.

### 12.7 Escalones múltiples de take-profit parcial: **no se tocan**

La guarda `partialExitCount > 0 => null` de `resolvePartialTakeProfit` **queda como está**. Cambiarla
obliga a decidir la progresión del stop entre escalones y multiplica las llamadas al exchange por
posición, atacando de frente el presupuesto de caps que este mismo ciclo introduce. Es un cambio de
estrategia, no de latencia. Además, el **lema de acotación** de §3.1 —que sostiene la exención de las
salidas— se apoya en que hay a lo sumo un parcial por posición: **cualquier ciclo futuro que habilite
escalones múltiples debe revisar ese lema antes de tocar nada**.

### 12.8 CA-003 reinterpretada por el funcional (RN-31): validada

La reinterpretación de "costo en USD" a "número de llamadas al LLM por escenario congelado" es
correcta y se adopta: el costo es función determinista y monótona del número de llamadas para un mismo
modelo y tamaño de prompt, y ningún assert de este ciclo se expresa en dólares. Se **refuerza** con la
condición de no vacuidad de §4.4 (al menos un escenario debe adelantar), porque un test donde ningún
adelanto ocurre satisface la desigualdad sin probar nada.

---

## 13. Verificación por criterio de aceptación

| CA | Cómo se verifica | Dónde |
| --- | --- | --- |
| **CA-001** | Con `reactiveLoopEnabled: false`: `ActionGateService` es passthrough (no lease, no conteo, no fila en `bot_actions`), `MarketStreamService` no toma leases de símbolos sin bots reactivos, y el harness corre `BASELINE` con el mismo número de llamadas y el mismo conjunto y orden de órdenes que hoy | `action-gate.service.spec.ts`, `reactive-cost-harness.spec.ts`, specs existentes del processor sin cambios |
| **CA-002** | Un evento material promueve el delayed (mock de `Queue.getDelayed`/`Job.promote`) y una ventana sin evento no produce ninguna llamada al LLM | `material-event.service.spec.ts`, `reactive-cost-harness.spec.ts` |
| **CA-003** | Assert **por escenario** de `llmCalls(REACTIVE) <= llmCalls(BASELINE)`, más `cycles` iguales, más no vacuidad de adelantos | `reactive-cost-harness.spec.ts` |
| **CA-004** | El mock del transporte **no** es invocado cuando el cap bloquea; el resultado del gate es invariante ante todo el rango de `confidence` y ante `reasoning` arbitrario | `action-caps.spec.ts` (pura), `action-gate.service.spec.ts` |
| **CA-005** | `resolveStreamHealth` con registro ausente / tick viejo / heartbeat viejo; y con símbolo degradado, cero eventos materiales y el ciclo por temporizador intacto | `stream-health.spec.ts` (pura), `market-stream.service.spec.ts` |
| **CA-006** | Toda salida del fast path pasa por `PositionActionService.closeAtMarket`, que llama `releaseProtectionIfNeeded` antes de `placeMarketOrder(SELL)`: se afirma sobre el **orden de invocación del mock del executor**, nunca sobre el texto fuente | `position-action.service.spec.ts` |
| **CA-007** | Dos instancias del servicio contra un `ReactiveCoordinationPort` fake compartido: un solo dueño por símbolo, un solo adelanto por evento, una sola orden por acción, y contadores leídos de Postgres | `market-stream.service.spec.ts`, `action-gate.service.spec.ts` |

Prohibiciones vigentes en todos estos tests: nada de `readFileSync` + match entre dos símbolos; nada
de assert en dólares; nada de comentarios narrativos en el código de producción — la documentación de
todo lo de acá vive en este documento.

---

## 14. Riesgos conocidos que el ciclo acepta

1. **Ventana ciega de hasta 40 s por símbolo** ante muerte abrupta del dueño (≤10 s con cierre
   ordenado). Mitigación: durante la ventana el símbolo se lee `UNKNOWN` ⇒ degradado ⇒ temporizador +
   REST, y las protecciones nativas ya colocadas siguen vivas en el exchange.
2. **Los niveles de soporte/resistencia y el promedio de volumen envejecen dentro de la ventana**
   (solo se recalculan por ciclo). Acotado por la guarda de 90 minutos.
3. **Un evento tipo 1 garantiza una llamada al LLM** en el ciclo adelantado (§4.1). El token de un
   solo uso por ventana es lo único que lo mantiene dentro del presupuesto: **es la pieza que no se
   puede relajar** sin romper CA-003.
4. **`RedisSharedCache` degrada a memoria y `ReactiveCoordinationPort` no.** Dos puertos con política
   de fallo opuesta conviviendo en el mismo backend es una asimetría deliberada y contraintuitiva:
   está justificada en §1 y debe quedar en la constitución de `apps/api` al consolidar el contexto.
5. **La extracción de `PositionActionService`** toca el archivo más caliente del repo. Se mitiga
   exigiendo que las cinco specs existentes del processor pasen sin cambiar sus aserciones (§7.3).
