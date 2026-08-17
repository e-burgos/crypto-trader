# Architect — Cycle 03: Reducción del costo por decisión

> **Input:** `cycles/cycle-03/brief.yaml` + `cycles/cycle-03/functional.md` (HU-03-01..12, CA-038..081, RF-01..12)
> **Output:** `sdd/specs/spec-e-burgos-001-agents-simplification/cycles/cycle-03/architect.md`
> **Generado por:** sdd-architect
> **Fecha:** 2026-08-17
> **Registros actualizados:** `sdd/api.json` (EP-008 → `updated`, EP-009 y EP-010 nuevos), `sdd/schema.json`
> (`trading_configs` → `updated`, `agent_decisions` registrada)

---

## 0. Resumen de decisiones

| #      | Decisión                                                                                                                                                                                                                                                                                        | Sección |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **D1** | Gate determinista: función pura `evaluateDeterministicGate` en `libs/analysis/src/lib/gate/`, orquestada por `DecisionGateService` (apps/api) y llamada desde `TradingProcessor` **entre el paso 8 y el paso 9**. Umbrales fijos abajo. El HOLD determinista persiste `AgentDecision` con `llmCostUsd = 0`, `llmCallCount = 0` y emite `agent:decision` por el mismo camino de código. | §2      |
| **D2** | Caché compartido detrás del puerto `SharedCachePort` con dos adaptadores: `InMemorySharedCache` (default, CI) y `RedisSharedCache` (ioredis, producción multi-réplica). Driver por env, `getOrCompute` con single-flight in-process y stale-on-failure. Claves sin `userId`. TTL técnica 5 min / macro 4 h / noticias 10 min content-addressed. | §3      |
| **D3** | Prompt caching: capacidad estática por (proveedor, modelo) en `libs/analysis/src/lib/llm/prompt-cache.ts`; la marca `cache_control` se inyecta en `ClaudeProvider` y `OpenRouterProvider` **solo si el prefijo estimado supera el mínimo cacheable del modelo**. Con los prompts actuales (650-830 tok) **no se marca nada** — y eso es el comportamiento correcto, no un fallo. | §4      |
| **D4** | `max_tokens` por tarea: tabla `AGENT_TASK_MAX_TOKENS` en `apps/api/src/orchestrator/agent-task-limits.ts`, llega al proveedor por un tercer parámetro opcional `LLMCallOptions` de `LLMProviderClient.complete()`. Truncado detectado con `LLMResponse.truncated` y tratado como respuesta no confiable. | §5      |
| **D5** | `llmCostUsd`: `LLMUsageService.log()` pasa a **devolver** el costo que ya calcula; `SubAgentService` lo empuja a un `LlmCostAccumulator` por ciclo; `OrchestratorService` lo cierra y lo transporta en `DecisionPayload`; `TradingProcessor` lo persiste. Endpoint nuevo **EP-009** `GET /analytics/agent-costs` + **EP-010** `GET /admin/analytics/llm-costs`, ambos sobre el mismo método de servicio. | §6      |
| **D6** | Harness: `apps/api/src/orchestrator/cost-harness/` — 12 escenarios fixture versionados, doble corrida (baseline / optimizado) con `CountingLLMClient`, proxy de costo determinista, assert de invocaciones **y** de proxy ≤ 50 %, más assert por escenario de no-silenciamiento. Corre como spec Jest normal. | §7      |
| **D7** | apps/web deploy-blocker: los tipos del wire se mudan a `libs/shared` (`AgentSlotWireId`, `ResolutionSource`, `ResolvedAgentModelWire`, `AgentHealthReportWire`), `apps/web` borra su interfaz local y migra **22 sitios de lectura** de `agentId` → `slot`. `resolveSourceBadge()` cubre el union completo + CE-08. | §8      |
| **D8** | Re-arme de OCO: decisión pura `resolveProtectionRearm()` en `libs/trading-engine` (umbral 0.1 %), orquestación `ensureNativeProtection()` en `TradingProcessor` reutilizando `placeProtectionWithRetry`. Cancelación fallida → `UNPROTECTED` **sin** recolocar (fail-closed); colocación fallida → `UNPROTECTED` + notificación + WS, mismo camino que cycle-02. | §9      |
| **D9** | `getPositions`: `select` extendido con los 9 campos, mapeo explícito de nulos (CE-11 = campo siempre presente). Guard estático como función pura `scanForbiddenSymbols()` + spec que arma los patrones por fragmentos. Los dos specs frágiles se reescriben **antes** de cualquier refactor de `checkOpenPositions`. | §10     |
| **D10** | Migración SQL a mano única: 2 columnas en `trading_configs`, 1 columna + 1 índice en `agent_decisions`. Nada más. | §11     |

### 0.1 Invariante rector del ciclo

> **Un ahorro que silencia una decisión no es un ahorro.** Toda pieza de este ciclo es
> **fail-closed hacia el gasto**: ante duda, dato faltante, stale, no confirmado o no comparable,
> el sistema **paga el análisis completo**. El gate, el caché y el prompt caching nacen apagados;
> encenderlos es un acto explícito. Ninguna optimización puede introducir un camino en el que el
> bot deje de operar sin que eso haga fallar un test.

### 0.2 De dónde sale realmente el −50 %

Este ciclo **no reparte el ahorro en partes iguales entre las cuatro palancas**, y el diseño lo
dice en vez de disimularlo:

| Palanca                | Ahorro esperado en el escenario de referencia | Por qué                                                                                                          |
| ---------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Gate determinista      | **alto** (elimina 5-6 llamadas del ciclo entero) | La mayoría de los ciclos no cambian nada evaluable; el gate los resuelve con 0 llamadas.                          |
| `max_tokens` por tarea | **medio** (techo de salida −40 a −80 % por tarea) | El output se tarifa ~5× el input; hoy toda tarea reserva 1024 tokens y `risk_gate` usa ~120.                       |
| Caché compartido       | **medio, creciente con N bots**                 | Con 1 bot no ahorra nada; con N bots sobre el mismo par el costo deja de ser lineal.                               |
| Prompt caching         | **≈ 0 hoy** (ver §4.2)                          | Los system prompts miden 650-830 tokens y el mínimo cacheable de Anthropic es 1024 (2048 en Haiku): **no cachean**. |

El harness (§7) mide el conjunto; el criterio de aceptación se sostiene con gate + `max_tokens`
aun si el prompt caching aporta exactamente cero.

---

## 1. Evidencia leída antes de decidir

`orchestrator.service.ts` (708 líneas), `sub-agent.service.ts` (278), `trading.processor.ts` (1731),
`market/data-source-cache.service.ts`, `llm/model-pricing.service.ts`, `llm/llm-usage.service.ts`,
`analytics/analytics.service.ts` + `analytics.controller.ts`, `trading/protection-retry.ts`,
`trading/trading.service.ts::getPositions`, `agents/agent-config-resolver.service.ts`,
`agents/agent-identity.ts`, los 7 `libs/analysis/src/lib/llm/*.provider.ts`,
`libs/trading-engine/src/lib/order-executor.ts` + `position-manager.ts`,
`libs/shared/src/types/interfaces.ts` + `enums.ts` + `constants/`, `libs/openrouter/`,
`apps/web/src/hooks/use-agent-config.ts`, `apps/web/src/pages/dashboard/settings/agents.tsx`,
`apps/api/prisma/schema.prisma`, los dos specs frágiles, y los contextos consolidados de
`apps/api`, `apps/web`, `libs/analysis`, `libs/openrouter`, `libs/trading-engine`.

### 1.1 Hallazgos que condicionan el diseño (no estaban en el brief)

1. **El system prompt no alcanza el mínimo cacheable.** El brief y el functional asumen que
   marcar los 650-830 tokens del system prompt con `cache_control` produce ahorro. El mínimo de
   prefijo cacheable de Anthropic es **1024 tokens** (**2048** en modelos clase Haiku); por debajo
   la marca se acepta y **no cachea nada, sin error**. Marcarla igual sería un ahorro fantasma que
   además ensucia el body. → §4.

2. **`reconcile()` hoy se `.catch()`ea y su resultado se descarta** (`trading.processor.ts`
   ~líneas 152-186). CE-01 (fail-closed si la reconciliación no confirmó estado) **no es
   implementable** sin capturar ese resultado. Es un cambio obligatorio de `runCycle`, no opcional.

3. **`checkOpenPositions` (paso 11) corre siempre**, con independencia de la decisión del paso 9.
   → El gate puede aplicar **con posiciones abiertas**: no desprotege nada, porque la máquina de
   salidas (stop, trailing, parciales, time-exit) no depende del LLM. El gate cortocircuita
   exclusivamente el paso 9.

4. **`LLMUsageService.log()` ya calcula el costo real y lo tira.** Resuelve tarifa con
   `ModelPricingService` y persiste `costUsd` en `llm_usage_logs`, pero devuelve `void`. Escribir
   `AgentDecision.llmCostUsd` **no requiere recalcular tarifa** — solo devolver lo ya computado.
   Cualquier diseño que resuelva pricing una segunda vez es una duplicación evitable.

5. **El "caché de sentimiento" existente no es un caché**: es una relectura de
   `agent_decisions.metadata` de la última decisión del **mismo usuario** dentro de
   `NewsConfig.intervalMinutes` (líneas ~172-207). No comparte entre usuarios y no tiene puerto
   propio. → El caché compartido se agrega **delante** de ese bloque sin tocarlo, para que con la
   feature apagada el comportamiento sea byte-idéntico.

6. **`LLMResponse` no transporta `finish_reason`/`stop_reason`.** CE-06 (respuesta truncada por el
   nuevo `max_tokens`) **no es detectable hoy**. Campo nuevo obligatorio en el tipo y en los 7
   proveedores. Sin esto, bajar `max_tokens` es peligroso: una respuesta cortada parsea como JSON
   inválido y cae al `{}` silencioso de `safeParseJson`.

7. **`AGENT_META` de `agents.tsx` ya está indexado por slot** (`routing`, `synthesis`, `platform`,
   `operations`, `market`, `blockchain`, `risk`). Los nombres salen vacíos porque
   `AGENT_META[config.agentId]` con `agentId === undefined` cae al fallback
   `codename: config.agentId` = `undefined`. → El fix es literalmente cambiar la propiedad leída;
   el mapa de metadatos ya está bien.

8. **`agents.tsx:522` excluye `'orchestrator'`**, que no es ningún `ModelSlotId` — filtro muerto
   desde cycle-02.

9. **Los dos specs frágiles cortan el fuente hasta `private parseSymbolForSandbox`.** Cualquier
   extracción de método dentro de `checkOpenPositions` (que D8 necesita) rompe esas aserciones.
   → **TASK-014 debe cerrarse antes que TASK-011 y TASK-012.** Es una dependencia de orden real,
   no una preferencia.

10. **La ruta de configuración de agente sigue llamándose `:agentId` en el backend**
    (`PUT /users/me/agents/:agentId/config`) pero recibe un `ModelSlotId`. → El deploy-blocker de
    `apps/web` **no necesita ningún cambio de API**: es enteramente front + tipos compartidos.

---

## 2. D1 — Gate determinista pre-LLM (RF-01, HU-03-01, CA-038..042, CE-01..03)

### 2.1 Dónde vive cada mitad

| Pieza                            | Ubicación                                                  | Naturaleza                                                                                     |
| -------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Decisión de las 5 condiciones    | `libs/analysis/src/lib/gate/deterministic-gate.ts`         | **Función pura**, sin Prisma, sin `Date.now()` interno (recibe `now`), sin I/O. 100 % testeable. |
| Huella estable de datos variables | `libs/shared/src/utils/fingerprint.ts`                     | **Función pura** `fingerprint(value): string` — JSON con claves ordenadas + FNV-1a hex.          |
| Carga de contexto y fail-closed  | `apps/api/src/orchestrator/decision-gate.service.ts`       | Servicio Nest: lee la decisión previa, arma huellas, aplica CE-01/CE-02/CE-03.                   |
| Punto de invocación              | `apps/api/src/trading/trading.processor.ts` (paso 8b)      | Entre el snapshot enriquecido (paso 8) y `orchestrateDecision` (paso 9).                         |

**Por qué función pura en `libs/analysis` y no un servicio:** el gate es aritmética sobre un
`IndicatorSnapshot` y tres huellas. `libs/analysis` ya es el dueño de los indicadores y sus
umbrales (`RSI_OVERBOUGHT`/`RSI_OVERSOLD` viven en `libs/shared/constants`). Un servicio Nest
obligaría al harness (§7) y a los tests parametrizados de CA-039 a levantar el contenedor de DI
para probar aritmética. Mismo criterio con el que cycle-02 puso `evaluateSellPolicy` y
`resolveTradeQuantity` en `libs/trading-engine`.

**Por qué el paso 8b y no dentro de `orchestrateDecision`:** el gate debe evitar la llamada, no
abortarla; ponerlo dentro obligaría a `orchestrateDecision` a devolver un `DecisionPayload`
sintético y a duplicar el camino de persistencia. Además la señal de reconciliación (CE-01) y las
posiciones abiertas ya están en el `runCycle`, no en el orquestador.

**Por qué después del paso 8 y no antes:** es un gate **pre-LLM**, no pre-datos. La condición 5
necesita el snapshot macro de este ciclo; evaluarla contra el macro del ciclo anterior crearía un
punto ciego permanente (con el gate reteniendo, el macro nunca se re-consultaría y un cambio de
régimen jamás abriría el gate). Los data sources ya están cacheados por `DataSourceCacheService` y
su costo es de otro orden que el LLM.

### 2.2 Contrato de la función pura

```ts
// libs/analysis/src/lib/gate/deterministic-gate.ts
export type GateSkipReason =
  | 'DISABLED'
  | 'NO_PREVIOUS_DECISION'
  | 'PREVIOUS_DECISION_STALE'
  | 'RECONCILIATION_UNCONFIRMED'
  | 'INDICATORS_INCOMPLETE'
  | 'INDICATORS_STALE'
  | 'EMA_CROSS'
  | 'RSI_OUT_OF_BAND'
  | 'PRICE_MOVED'
  | 'POSITIONS_CHANGED'
  | 'NEWS_OR_MACRO_CHANGED';

export interface GateConditionReport {
  emaStable: boolean;
  rsiNeutral: boolean;
  priceStable: boolean;
  positionsStable: boolean;
  newsAndMacroStable: boolean;
}

export interface DeterministicGateSnapshot {
  close: number;
  rsi: number;
  ema9: number;
  ema21: number;
  emaTrend: string;
  macdCrossover: string;
  newsFingerprint: string;
  macroFingerprint: string;
  positionsFingerprint: string;
  takenAt: number;
}

export interface DeterministicGateInput {
  enabled: boolean;
  now: number;
  reconciliationConfirmed: boolean;
  current: DeterministicGateSnapshot | null;
  previous: DeterministicGateSnapshot | null;
  thresholds: DeterministicGateThresholds;
}

export type DeterministicGateResult =
  | { holds: true; conditions: GateConditionReport; snapshot: DeterministicGateSnapshot }
  | { holds: false; reason: GateSkipReason; conditions: Partial<GateConditionReport> };

export function evaluateDeterministicGate(
  input: DeterministicGateInput,
): DeterministicGateResult;

export function buildGateSnapshot(input: {
  indicators: IndicatorSnapshot;
  newsFingerprint: string;
  macroFingerprint: string;
  positionsFingerprint: string;
}): DeterministicGateSnapshot | null; // null si algún indicador no es finito → INDICATORS_INCOMPLETE
```

### 2.3 Umbrales exactos (el implementor no elige ninguno)

```ts
// libs/analysis/src/lib/gate/gate-thresholds.ts
export interface DeterministicGateThresholds {
  rsiLowerBand: number;
  rsiUpperBand: number;
  rsiMaxDelta: number;
  priceChangePct: number;
  snapshotMaxAgeMs: number;
  previousDecisionMaxAgeMs: number;
}

export const DEFAULT_GATE_THRESHOLDS: DeterministicGateThresholds = {
  rsiLowerBand: 40,
  rsiUpperBand: 60,
  rsiMaxDelta: 5,
  priceChangePct: 0.005,
  snapshotMaxAgeMs: 5 * 60_000,
  previousDecisionMaxAgeMs: 90 * 60_000,
};
```

Las cinco condiciones, **todas obligatorias y evaluadas contra `previous`**:

| # | Condición del functional         | Regla exacta                                                                                                                                                                                                                     | Motivo del valor                                                                                                                                                                     |
| - | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | Sin cruce de EMA                 | `sign(ema9 − ema21)` **igual** en `current` y `previous` **y** `emaTrend` igual **y** `current.macdCrossover === 'NONE'`                                                                                                            | El signo detecta el cruce entre ciclos; `trend` cubre el cruce con la EMA50; exigir MACD sin cruce **endurece** el gate (solo puede hacer que aplique menos, nunca más).                 |
| 2 | RSI en banda neutra              | `40 ≤ current.rsi ≤ 60` **y** `\|current.rsi − previous.rsi\| ≤ 5`                                                                                                                                                                  | `RSISignal.NEUTRAL` es 30-70, demasiado ancho: a RSI 69 el próximo tick puede ser sobrecompra. La banda del gate es deliberadamente **más angosta** que la del indicador.               |
| 3 | Sin cambio significativo de precio | `\|current.close − previous.close\| / previous.close < config.gatePriceChangePct` (default **0.005 = 0.5 %**)                                                                                                                       | 0.5 % en BTC/USDT a 15 min es ruido; por debajo de ese umbral ningún `buyThreshold`/`sellThreshold` razonable cambia de lado. Configurable por bot (columna nueva, §11).                |
| 4 | Sin cambio de posiciones          | `positionsFingerprint` igual. La huella cubre, por cada posición `OPEN` de `(userId, configId)` ordenada por `id`: `{ id, quantity, status, protectionStatus, stopPrice, trailingActive, partialExitCount }`                        | Incluye el estado de protección explícitamente (lo pide el functional). Cambia si se abrió, cerró, se movió el stop, se re-armó la OCO o hubo venta parcial.                            |
| 5 | Sin noticias/macro nuevos         | `newsFingerprint` **y** `macroFingerprint` iguales. Noticias: top-10 `{ headline, sentiment }`. Macro: `{ globalMarket, defiHealth, tokenUnlocks, fearGreed }` del `enrichedData` de este ciclo                                     | Content-addressed: no depende de timestamps del proveedor, que cambian sin que cambie la información.                                                                                   |

**Fail-closed (RN-02), en este orden de cortocircuito:**

| Situación                                                         | `reason`                     | CA/CE   |
| ----------------------------------------------------------------- | ---------------------------- | ------- |
| `deterministicGateEnabled === false`                              | `DISABLED`                   | CE-03   |
| No hay `AgentDecision` previa para el `configId`                  | `NO_PREVIOUS_DECISION`       | CA-042  |
| La previa no tiene `gateSnapshot` en `metadata` (fila pre-ciclo)  | `NO_PREVIOUS_DECISION`       | CA-042  |
| `now − previous.takenAt > 90 min`                                 | `PREVIOUS_DECISION_STALE`    | CE-02   |
| `reconciliationConfirmed === false` (LIVE/TESTNET)                | `RECONCILIATION_UNCONFIRMED` | CE-01   |
| Algún indicador ausente o no finito                               | `INDICATORS_INCOMPLETE`      | CE-02   |
| `now − indicators.timestamp > 5 min`                              | `INDICATORS_STALE`           | CE-02   |

En SANDBOX no hay reconciliación: `reconciliationConfirmed` se pasa como `true` (no hay estado de
exchange que confirmar). En LIVE/TESTNET vale `true` solo si `reconcile()` **resolvió sin lanzar**.

### 2.4 Cambio obligatorio en `runCycle` — capturar la reconciliación (hallazgo 1.1-2)

```ts
// apps/api/src/trading/trading.processor.ts — paso 2b, hoy descarta el resultado
let reconciliationConfirmed = true;
if ((isLiveMode || isTestnetMode) && binanceApiKey && binanceSecret) {
  reconciliationConfirmed = await this.reconciliationService
    .reconcile({ ... })
    .then(() => true)
    .catch((err) => {
      this.logger.warn(`Reconciliation failed ...`);
      return false;
    });
}
```

El comportamiento ante fallo **no cambia** (se sigue sin abortar el ciclo); lo único nuevo es que
el resultado deja de perderse.

### 2.5 Persistencia del HOLD determinista (CA-040, CA-041, RN-03)

El gate **no** crea un camino de persistencia paralelo. `DecisionGateService.evaluate()` devuelve
un `DecisionPayload` completo y `runCycle` sigue por el mismo `prisma.agentDecision.create` y el
mismo `gateway.emitToUser(userId, 'agent:decision', savedDecision)` que hoy — un solo punto de
escritura, un solo punto de emisión. CA-041 queda satisfecho **por construcción**: no hay dos
payloads posibles.

```ts
// DecisionPayload del gate
{
  decision: 'HOLD',
  confidence: 1.0,
  reasoning:
    'HOLD determinista: sin cruce de EMA, RSI 52.1 en banda 40-60, precio +0.12% (< 0.50%), ' +
    'posiciones y noticias sin cambios desde la decisión anterior. Sin llamada a LLM.',
  waitMinutes: config.minIntervalMinutes,
  orchestrated: false,
  subAgentResults: [],
  llmCostUsd: 0,
  llmCallCount: 0,
  gate: { applied: true, conditions: { ... }, snapshot: { ... } },
}
```

Reglas de la fila persistida:

- `llmCostUsd = 0` y `llmCallCount = 0` → distingue el HOLD del gate de una decisión LLM sin
  ambigüedad y **sin leer JSON** (§6.4).
- `reasoning` en lenguaje natural y autoexplicativo (RN-03): lista las cinco condiciones con sus
  valores reales, y termina en `Sin llamada a LLM.`
- `metadata.gate = { applied: true, conditions, snapshot }` — **el `snapshot` es lo que el próximo
  ciclo lee como `previous`.**
- `metadata.gate.snapshot` se escribe **también en las decisiones resueltas por LLM**, si no el
  gate nunca tendría un `previous` cuando el ciclo anterior sí llamó al LLM. Esto es aditivo sobre
  la columna `metadata Json?` ya existente → **sin migración**.
- `waitMinutes = config.minIntervalMinutes` siempre. El gate **nunca alarga la cadencia**: alargarla
  retrasaría el momento en que se detecta una señal real, que es exactamente el riesgo que este
  ciclo no puede correr.
- `indicators` y `newsHeadlines` se persisten igual que en una decisión LLM: el historial del bot
  no cambia de forma.

`scheduleEvaluation` se llama igual (fire-and-forget con `.catch`): un HOLD determinista es una
decisión evaluable como cualquier otra.

### 2.6 Interpretación explícita de "última decisión evaluada"

El functional dice "respecto de la última decisión **evaluada**". Se interpreta como **la última
`AgentDecision` persistida de ese `configId`**, no como la última con
`AgentDecisionEvaluation` cerrada. Motivo: las evaluaciones se cierran a horizonte (15 min / 1 h /
24 h); exigir una evaluación cerrada haría que el gate casi nunca aplique y, peor, compararía
contra un estado de mercado de horas atrás. La decisión anterior ya trae su propio `gateSnapshot`,
que es exactamente el dato necesario.

El `previous` se obtiene **sin query extra**: el paso 7b ya consulta las últimas 5 decisiones del
config; se le agrega `metadata: true` al `select` y se usa `recentDbDecisions[0]`.

---

## 3. D2 — Caché compartido por `(asset, pair, timeframe)` (RF-02, HU-03-02, CA-043..046, CE-04)

### 3.1 Redis vs Map por proceso — la decisión que el brief pide explícita

`DataSourceCacheService` es un `Map` por proceso. Con réplicas, un `Map` **no cumple** "compartido
entre bots y usuarios": cada réplica paga su propio cálculo, y el ahorro se divide por el número
de réplicas.

**Decisión: Redis es el destino de producción; el default de ejecución es in-memory; ambos detrás
de un puerto.** No es una decisión a medias, es la única que satisface las tres restricciones a la
vez:

- CI **no tiene Redis** (restricción del brief) → el default debe funcionar sin Redis.
- El functional exige compartir entre usuarios y bots con réplicas → hace falta Redis en producción.
- Los defaults deben ser conservadores → la feature nace apagada.

```
apps/api/src/cache/
├── shared-cache.port.ts            // SHARED_CACHE token + SharedCachePort
├── in-memory-shared-cache.service.ts
├── redis-shared-cache.service.ts   // ioredis (ya es dependencia del repo)
├── shared-cache.module.ts          // factory por env
└── signal-cache.service.ts         // claves + TTL de señal, encima del puerto
```

```ts
export const SHARED_CACHE = Symbol('SHARED_CACHE');

export interface SharedCachePort {
  getOrCompute<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T>;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  invalidate(key: string): Promise<void>;
}
```

Selección del adaptador en `shared-cache.module.ts`:

| `SHARED_CACHE_DRIVER` | Adaptador             | Cuándo                                                      |
| --------------------- | --------------------- | ----------------------------------------------------------- |
| ausente / `memory`    | `InMemorySharedCache` | **default** — dev, CI, tests, instalación de una sola réplica |
| `redis`               | `RedisSharedCache`    | producción multi-réplica (`REDIS_URL` ya existe para Bull)   |

`RedisSharedCache` **degrada, nunca rompe**: cualquier error de Redis se loguea una vez por
proceso y a partir de ahí el servicio delega en una instancia interna de `InMemorySharedCache`. Un
Redis caído no puede tumbar un ciclo de trading.

**Testeabilidad sin Redis (restricción del brief):** todos los tests de CA-043..046 y CE-04 corren
contra `InMemorySharedCache`, que implementa el mismo puerto. `RedisSharedCache` se testea con un
doble de `ioredis` (get/set/pexpire mockeados) — sin servidor.

### 3.2 `getOrCompute` — single-flight y stale (CA-043, CE-04)

Un `get`/`set` plano **no cumple CA-043**: N bots concurrentes fallan el `get` a la vez y disparan
N cálculos. Contrato obligatorio de `getOrCompute`:

1. Entrada vigente (`now − cachedAt < ttlMs`) → se devuelve.
2. Hay un `compute` en vuelo para la misma clave **en este proceso** → se devuelve la misma
   promesa (mapa `inFlight: Map<string, Promise<T>>`, borrado en `finally`). Esto es lo que hace
   que "solo el primero dispara el cálculo real".
3. No hay nada → se ejecuta `compute`, se guarda y se devuelve.
4. `compute` **rechaza** y existe entrada vencida pero retenida → se devuelve **stale**, se loguea
   (CE-04, mismo patrón que `DataSourceCacheService`). Sin stale → se propaga el error.

**Coalescencia entre procesos: no se intenta.** Un lock distribuido en Redis agrega un modo de
fallo (lock huérfano bloqueando ciclos) desproporcionado frente al ahorro. Entre réplicas el TTL
deduplica igual a partir de la primera escritura. Queda documentado, no oculto.

Retención de stale: la entrada se guarda con TTL físico `ttlMs × 6` y `cachedAt` lógico dentro del
valor, para que "vencida pero utilizable como stale" sea representable en ambos adaptadores.

### 3.3 Claves y TTL

```ts
// apps/api/src/cache/signal-cache.service.ts
export const DEFAULT_ANALYSIS_TIMEFRAME = '1h'; // el único que usa getKlines hoy

export const SIGNAL_TTL_TECHNICAL_MS = 5 * 60_000;       // 5 min
export const SIGNAL_TTL_MACRO_MS = 4 * 60 * 60_000;      // 4 h  (CIPHER)
export const SIGNAL_TTL_NEWS_MS = 10 * 60_000;           // 10 min
```

| Señal          | Clave                                                | TTL    | Justificación                                                                                                                                                     |
| -------------- | ---------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Técnica (SIGMA) | `sig:v1:tech:{asset}:{pair}:{timeframe}`             | 5 min  | Igual al `minIntervalMinutes` default: nunca sirve un valor más viejo que un ciclo mínimo. Los indicadores salen de velas de 1 h — dentro de 5 min no cambian de sentido. |
| Macro (CIPHER)  | `sig:v1:macro:{asset}:{pair}:{timeframe}`            | 4 h    | El régimen macro (globalMarket, DeFi TVL, unlocks) se mueve en horas, no en minutos. **CA-045** exige que sea del orden de horas y mayor que la técnica: 48× mayor.    |
| Noticias (SIGMA) | `sig:v1:news:{asset}:{pair}:{newsFingerprint}`       | 10 min | **Content-addressed**: la huella del set de noticias es parte de la clave, así que dos usuarios con distinto set jamás comparten resultado, y con el mismo set sí.    |

**`userId` no aparece en ninguna clave** (requisito explícito). Para la señal técnica y la macro
eso es seguro porque el input es público (velas de Binance, data sources globales). Para las
noticias, que **sí** dependen del `NewsConfig` de cada usuario, la seguridad la da la huella del
contenido en la clave, no el `userId`.

**CA-046 (aislamiento)** se cumple por construcción: `asset`, `pair` y `timeframe` son segmentos
separados de la clave. El prefijo `v1:` permite invalidar todo el espacio de claves de un deploy
cambiando la versión, sin borrar Redis a mano.

### 3.4 Atribución del resultado cacheado

Una entrada guarda `{ output, producedBy: { provider, model }, cachedAt }`. Cuando un bot consume
una entrada producida por el modelo de otro usuario, el `SubAgentResult` correspondiente se marca
`{ cached: true, cachedFrom: { provider, model } }` — la misma convención que ya usa el
`cached: true` del sentimiento. **La decisión no miente sobre qué modelo produjo qué**, y la
llamada no ocurrida **no suma costo**: el `LlmCostAccumulator` (§6) simplemente no recibe nada.

### 3.5 Activación (default conservador)

Env `SHARED_SIGNAL_CACHE_ENABLED`, default **`false`**. Con `false`, `SignalCacheService` es
pass-through: ejecuta `compute` siempre y el comportamiento actual (incluida la relectura per-user
de sentimiento) queda **byte-idéntico**.

El flag es de entorno y **no** por bot: un caché cuyo propósito es cruzar usuarios no puede ser
gobernado por la config de un bot — si el bot A lo apaga y el bot B lo prende, ¿qué comparte el
par? La decisión de compartir es del operador de la instalación.

El bloque de relectura per-user de sentimiento (`orchestrator.service.ts` ~172-207) **no se toca**.
El caché compartido se consulta **antes**; si no hay entrada (o está apagado), se cae al bloque
existente sin cambios.

---

## 4. D3 — Prompt caching de proveedor (RF-03, HU-03-03, CA-047..049, CE-05)

### 4.1 Dónde se inyecta

El brief menciona `libs/openrouter`. **Corrección arquitectónica:** `libs/openrouter` es solo el
catálogo dinámico de modelos (`OpenRouterModelsService`, SDK + caché 15 min); no arma ningún body
de `chat/completions`. Los bodies se arman en `libs/analysis/src/lib/llm/*.provider.ts`. La marca
`cache_control` va ahí, y solo en los dos proveedores que la aceptan.

```
libs/analysis/src/lib/llm/
├── prompt-cache.ts        // NUEVO — capacidad estática por (proveedor, modelo)
├── llm-types.ts           // + LLMCallOptions, + LLMResponse.truncated/cacheRead
├── claude.provider.ts     // system como array de bloques; cache_control condicional
├── openrouter.provider.ts // system content como array de partes; cache_control condicional
└── {openai,groq,gemini,mistral,together}.provider.ts  // aceptan las options, ignoran cachePrefix
```

```ts
// libs/analysis/src/lib/llm/prompt-cache.ts
export type PromptCacheStyle = 'anthropic-blocks' | 'implicit' | 'none';

export interface PromptCacheCapability {
  style: PromptCacheStyle;
  /** Prefijo mínimo, en tokens, por debajo del cual el proveedor NO cachea (y no avisa). */
  minPrefixTokens: number;
}

export function resolvePromptCacheCapability(
  providerName: string,
  model: string,
): PromptCacheCapability;

/** Heurística documentada: ~4 caracteres por token. Solo se usa para decidir si marcar. */
export function estimatePromptTokens(text: string): number;
```

Tabla de capacidad (estática, offline, determinista — no depende del catálogo ni de la red):

| Proveedor / modelo                                                  | `style`             | `minPrefixTokens` | Efecto en el body                                       |
| ------------------------------------------------------------------- | ------------------- | ----------------- | -------------------------------------------------------- |
| `claude`, modelo con `haiku` en el id                               | `anthropic-blocks`  | 2048              | `system` como array con `cache_control` en el 1.er bloque |
| `claude`, resto                                                     | `anthropic-blocks`  | 1024              | idem                                                      |
| `openrouter`, modelo `anthropic/*`                                  | `anthropic-blocks`  | 1024 (2048 haiku) | `messages[0].content` como array de partes con la marca   |
| `openrouter`, modelo `openai/*`, `deepseek/*`, `google/*`, `x-ai/*` | `implicit`          | 1024              | **ninguno** — el proveedor cachea solo                    |
| `openai`, `gemini`                                                  | `implicit`          | 1024              | **ninguno**                                               |
| `groq`, `mistral`, `together`, resto de `openrouter`                | `none`              | `Infinity`        | **ninguno**                                               |

`implicit` y `none` producen un body **idéntico** al de hoy → **CA-048 (degradación silenciosa) se
cumple por construcción**, no por un `try/catch`.

### 4.2 La marca solo se aplica si el prefijo supera el mínimo (hallazgo 1.1-1)

```ts
const capability = resolvePromptCacheCapability(this.name, this.model);
const shouldMark =
  capability.style === 'anthropic-blocks' &&
  estimatePromptTokens(systemPrompt) >= capability.minPrefixTokens;
```

**Consecuencia medida, no ocultada:** los system prompts vivos (`AgentDefinition`, 650-830 tokens)
quedan **por debajo** del mínimo en todos los casos → hoy **no se marca ninguno**. Marcarlos igual
produciría un body más grande, un test verde y cero ahorro: un ahorro fantasma.

Por eso el test de CA-047 se escribe con **dos casos**, y ambos son parte del criterio de done:

- prompt de ≥ 1024 tokens estimados + modelo Anthropic → la request lleva `cache_control`;
- prompt de 800 tokens + modelo Anthropic → la request **no** lleva `cache_control` (el ahorro
  fantasma es un bug, y este test lo previene).

`SubAgentService` loguea a nivel `debug`, una vez por agente,
`promptCache: { agent, estimatedTokens, minPrefixTokens, marked }`. Ese número es el insumo de la
deuda registrada abajo.

**Deuda documentada (fuera de alcance de este ciclo, con dato duro):** para que el prompt caching
aporte algo hay que llevar los system prompts por encima de 1024 tokens, y eso es contenido de la
tabla `AgentDefinition` (seed), no código. Se registra como follow-up con la medición del debug
log. El −50 % de este ciclo **no depende de esto** (§0.2).

### 4.3 CE-05 — rechazo explícito de la marca

Solo puede ocurrir en `anthropic-blocks`. En los dos proveedores que la envían:

```ts
try {
  return await this.post(bodyWithCacheControl);
} catch (err) {
  if (isCacheControlRejection(err)) {   // HTTP 400 cuyo cuerpo menciona cache_control
    return await this.post(bodyWithoutCacheControl);
  }
  throw err;
}
```

Un reintento, sin backoff (no es un error transitorio), y el ciclo no falla. Testeable con un
doble de axios que devuelve 400 la primera vez.

### 4.4 CA-049 — mismo resultado con y sin marca

El contenido enviado es **el mismo texto**; lo único que cambia es que `system` viaja como array de
un bloque en vez de string. **El user prompt no se toca**: la tentación de mover la parte estática
de `buildTaskUserPrompt` al bloque cacheable para superar el mínimo se rechaza explícitamente,
porque reordena el contenido que ve el modelo y pone en riesgo CA-049 a cambio de un ahorro que
§0.2 no necesita.

---

## 5. D4 — `max_tokens` por tarea (RF-04, HU-03-04, CA-050..052, CE-06)

### 5.1 La tabla y dónde vive

`AgentTask` está declarado en `apps/api/src/orchestrator/sub-agent.service.ts`; la tabla vive al
lado, en su propio archivo, para que sea la **única puerta** del límite de salida:

```ts
// apps/api/src/orchestrator/agent-task-limits.ts
export const AGENT_TASK_MAX_TOKENS: Readonly<Record<AgentTask, number>> = {
  risk_gate: 350,
  sizing_suggestion: 350,
  intent_classification: 200,
  news_technical_relevance: 250,
  ecosystem_impact: 300,
  technical_signal: 500,
  news_sentiment: 500,
  macro_context: 600,
  decision_synthesis: 700,
  cross_agent_synthesis: 1024,
};

export function resolveMaxTokensForTask(task: AgentTask): number {
  return AGENT_TASK_MAX_TOKENS[task] ?? 1024;
}
```

| Tarea                      | Límite | Por qué ese número                                                                                                      |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `risk_gate`                | 350    | JSON de 7 campos con `reason` corto y `alerts[]`. Medido sobre el formato exacto que exige `buildTaskUserPrompt`. Rango pedido por CA-050 (300-400). |
| `sizing_suggestion`        | 350    | JSON de 3 campos con `reasoning` de 2-4 oraciones. Ídem.                                                                  |
| `intent_classification`    | 200    | 4 campos cortos, tarea de clasificación.                                                                                 |
| `news_technical_relevance` | 250    | 3 campos, uno de ellos un array corto.                                                                                   |
| `ecosystem_impact`         | 300    | 4 campos, `summary` breve.                                                                                               |
| `technical_signal`         | 500    | El prompt pide explícitamente `reasoning` de 2-4 oraciones citando indicadores.                                          |
| `news_sentiment`           | 500    | Puede devolver `headlines[]` con una razón por titular.                                                                  |
| `macro_context`            | 600    | El prompt pide 3-5 oraciones **más** `keyFactors[]`.                                                                     |
| `decision_synthesis`       | 700    | Es la decisión final del ciclo; truncarla cuesta el ciclo entero. Se le deja el mayor margen del flujo de trading.        |
| `cross_agent_synthesis`    | 1024   | Respuesta de chat visible al usuario: **se deja el default actual**, no es parte del costo por decisión de trading.       |

**El límite es por tarea, no por agente ni por modelo (CA-051)**: `resolveMaxTokensForTask` recibe
únicamente el `task`. El test de CA-051 llama a la misma tarea con dos slots distintos y verifica
el mismo límite en la request armada.

### 5.2 Cómo llega al proveedor

`maxTokens` es hoy un parámetro **de constructor** del proveedor, y el cliente se construye en
`AgentConfigResolverService.resolveClient()`, que no conoce la tarea. Por eso el límite viaja
**por llamada**, en un tercer parámetro opcional:

```ts
// libs/analysis/src/lib/llm/llm-types.ts
export interface LLMCallOptions {
  maxTokens?: number;
  /** Reservado para D3; los proveedores sin soporte lo ignoran. */
  cacheSystemPrompt?: boolean;
}

export interface LLMProviderClient {
  readonly name: string;
  complete(
    systemPrompt: string,
    userPrompt: string,
    options?: LLMCallOptions,
  ): Promise<LLMResponse>;
}
```

Parámetro **opcional** → los 7 proveedores siguen compilando; cada uno resuelve
`options?.maxTokens ?? this.maxTokens`. `SubAgentService.call()` pasa
`{ maxTokens: resolveMaxTokensForTask(task) }`.

### 5.3 CE-06 — truncado (obligatorio, no opcional)

Sin esto, bajar `max_tokens` es peligroso: una respuesta cortada llega a `safeParseJson`, que la
degrada a `{}` **en silencio**, y AEGIS/FORGE quedan neutros sin que nadie se entere.

```ts
export interface LLMResponse {
  text: string;
  usage: LLMUsage;
  headers?: Record<string, string>;
  actualModel?: string;
  truncated?: boolean;   // NUEVO
  cacheReadTokens?: number; // NUEVO — telemetría de D3
}
```

Mapeo por proveedor: Claude → `stop_reason === 'max_tokens'`; OpenRouter/OpenAI/Groq/Mistral/
Together → `choices[0].finish_reason === 'length'`; Gemini → `finishReason === 'MAX_TOKENS'`.

`SubAgentService.call()`, si `response.truncated === true`, **lanza** `LLMTruncatedResponseError`
(clase nueva junto a la tabla de límites). Eso reutiliza el camino de error que ya existe y no
inventa maquinaria nueva:

- sub-agente en paralelo → su `Promise.allSettled` queda `rejected` → salida `'{}'`, exactamente
  como una llamada fallida hoy;
- `decision_synthesis` → cae en el `catch (synthErr)` existente → HOLD con explicación (o se
  repropaga si además todos los sub-agentes fallaron).

**Nunca se opera sobre un fragmento de decisión.**

---

## 6. D5 — `AgentDecision.llmCostUsd` real y visibilidad del costo (RF-05, RF-06)

### 6.1 Quién escribe el costo — cadena completa

```
ModelPricingService.resolve()   ← ya existe, cascada LIVE→STALE→STATIC→UNPRICED, nunca lanza
        ↓
LLMUsageService.log()           ← CAMBIA: devuelve el costo que ya calculaba (hoy lo descarta)
        ↓
SubAgentService.call()          ← empuja el resultado al accumulator del ciclo
        ↓
LlmCostAccumulator              ← NUEVO — una instancia por orchestrateDecision
        ↓
OrchestratorService             ← cierra el accumulator y lo pone en DecisionPayload
        ↓
TradingProcessor                ← lo persiste en agentDecision.create (único punto de escritura)
```

```ts
// apps/api/src/llm/llm-usage.service.ts — cambio de firma
export interface LLMUsageOutcome {
  costUsd: number | null;          // null ⇔ pricingSource === 'UNPRICED'
  pricingSource: PricingSourceValue;
  inputTokens: number;
  outputTokens: number;
}
async log(params: LLMUsageLogParams): Promise<LLMUsageOutcome>;
```

`log()` **sigue sin lanzar nunca**: ante error de persistencia devuelve
`{ costUsd: null, pricingSource: 'UNPRICED', ... }` y loguea, como hoy. No se resuelve pricing dos
veces (hallazgo 1.1-4).

```ts
// apps/api/src/llm/llm-cost-accumulator.ts
export class LlmCostAccumulator {
  track(p: Promise<LLMUsageOutcome>): void;   // el log es fire-and-forget; acá se retiene la promesa
  async settle(): Promise<LlmCostSummary>;    // Promise.allSettled sobre lo trackeado
}

export interface LlmCostSummary {
  llmCallCount: number;
  pricedCallCount: number;
  unpricedCallCount: number;
  costUsd: number | null;
}
```

`settle()` se llama en `OrchestratorService.orchestrateDecision()` justo antes del `return`, en
**todos** los caminos de retorno (BLOCK de AEGIS, fallo de síntesis, retorno normal). Esto elimina
la carrera del `fire-and-forget` actual sin volver bloqueante el logueo de uso.

### 6.2 Tres estados del costo, sin ambigüedad (CA-053, CA-054, CE-07)

| Situación                                                   | `llmCostUsd` | `llmCallCount` | Lectura                              |
| ----------------------------------------------------------- | ------------ | -------------- | ------------------------------------ |
| HOLD del gate determinista                                  | `0`          | `0`            | Costo cero **real y completo**       |
| Decisión LLM, todas las llamadas tarifadas                  | `> 0`        | `n > 0`        | Costo real                           |
| Decisión LLM, algunas tarifadas y otras no                  | suma de las tarifadas | `n > 0` | Costo **parcial**, marcado en metadata |
| Decisión LLM, **ninguna** tarifable (cascada agotada)       | `null`       | `n > 0`        | **Desconocido**, nunca "cero"        |

CE-07 se cumple porque el cero encubierto es imposible: `llmCostUsd = 0` con `llmCallCount > 0` no
puede ocurrir salvo con un modelo genuinamente gratuito, y en ese caso el cero es correcto.
`metadata.cost = { llmCallCount, pricedCallCount, unpricedCallCount, complete: boolean }` guarda el
detalle. **Ninguna decisión se descarta ni se excluye de la agregación** (CA-055).

### 6.3 Por qué `llmCallCount` es una columna y no un campo de `metadata`

CA-058 exige distinguir en el agregado el costo de decisiones LLM del de decisiones del gate.
Distinguirlas por `llmCostUsd === 0` es **incorrecto**: un modelo gratuito de OpenRouter produce
una decisión LLM legítima con costo 0. Distinguirlas leyendo `metadata` JSON obliga a filtrar en
memoria toda la tabla. Una columna `INTEGER NOT NULL DEFAULT 0` resuelve las dos cosas, es
agregable en SQL y cuesta una línea de migración (§11).

### 6.4 Contrato del endpoint de costo — y por qué **no** es una extensión de EP-003

| Eje              | EP-003 `GET /users/me/llm/usage`                    | EP-009 `GET /analytics/agent-costs` (nuevo)                     |
| ---------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| Fuente de verdad | `llm_usage_logs` (una fila **por llamada**)          | `agent_decisions.llmCostUsd` (una fila **por decisión**)          |
| Grano            | proveedor → modelo → día                             | bot → día                                                         |
| Incluye chat     | Sí (`LLMSource.CHAT`)                                | No: solo decisiones de trading                                    |
| Ve el gate       | No (una decisión del gate no genera ninguna llamada) | **Sí** — es justamente lo que hay que mostrar                     |
| Módulo           | `llm`                                                | `analytics`                                                       |

CA-055 y CA-057 **exigen** `AgentDecision` como fuente. Extender EP-003 obligaría a mezclar dos
granos y a fabricar filas sintéticas para las decisiones del gate. Son endpoints distintos con
fuentes distintas, y ambos son correctos: `Σ llm_usage_logs.costUsd ≥ Σ agent_decisions.llmCostUsd`
porque el primero incluye el chat. Eso se documenta; no se "arregla".

**EP-009 y EP-010 comparten un único método de servicio**, que es lo que hace que CA-057
("suma de individuales == agregado") pase por construcción y no por coincidencia:

```ts
// apps/api/src/analytics/analytics.service.ts
async getAgentCostBreakdown(params: {
  userId: string | null;   // null = toda la plataforma (solo desde el controller admin)
  period: '7d' | '30d' | '90d';
  mode?: TradingMode;
  configId?: string;
}): Promise<AgentCostBreakdown>;
```

```ts
export interface AgentCostBucket {
  costUsd: number;
  decisions: number;
  llmDecisions: number;      // llmCallCount > 0
  gateDecisions: number;     // llmCallCount === 0
  unpricedDecisions: number; // llmCostUsd === null
}

export interface AgentCostBreakdown extends AgentCostBucket {
  period: string;
  from: string;              // ISO
  to: string;                // ISO
  byBot: Array<AgentCostBucket & {
    configId: string | null;
    configName: string | null;
    asset: string;
    pair: string;
    mode: string;
  }>;
  dailySeries: Array<AgentCostBucket & {
    date: string;            // YYYY-MM-DD, día calendario UTC
    byBot: Array<{ configId: string | null; costUsd: number }>;
  }>;
}
```

**Día calendario UTC**, igual que el límite de pérdida diaria de `AggregateRiskService`
(cycle-02) — una sola noción de "día" en el sistema.

**Contrato para el implementor front (TASK-010):** el panel de `apps/web` consume EP-009 con
`period` y `mode` y dibuja (a) un total del período, (b) `dailySeries` como barras apiladas por
bot usando `dailySeries[].byBot`, (c) una tabla `byBot` con `costUsd`, `decisions`,
`llmDecisions`, `gateDecisions`. `unpricedDecisions > 0` se muestra como una nota
("N decisiones sin tarifa disponible"), **nunca sumado como 0**. Todo por TanStack Query, todo el
texto por `t()` en `es.ts` y `en.ts`.

### 6.5 CA-056 — el test de regresión del hallazgo C

`AnalyticsService` se prueba con un fixture de `AgentDecision` con `llmCallCount > 0` y
`llmCostUsd > 0`: el resultado del día no puede ser `0`. Es el test que hoy fallaría, porque nada
escribe el campo.

---

## 7. D6 — Harness determinista del −50 % (RF-07, HU-03-07, CA-059..063)

### 7.1 Ubicación y forma de ejecución

```
apps/api/src/orchestrator/cost-harness/
├── scenarios.fixture.ts        // 12 escenarios, versionados, NO generados en runtime (CA-059)
├── counting-llm-client.ts      // LLMProviderClient de doble que cuenta y no usa red
├── cost-model.ts               // proxy de costo determinista + constantes
└── llm-cost-harness.spec.ts    // el harness: doble corrida + asserts
```

Es un **spec de Jest normal** bajo `apps/api/src` → lo levanta `pnpm nx test api` y por lo tanto
`pnpm nx run-many -t test` (**CA-063**). No hay script aparte, no hay target nuevo, no hay
`describe.skip`.

### 7.2 Los 12 escenarios (CA-059)

Cada escenario es un objeto literal congelado:

```ts
export interface CostScenario {
  id: string;                       // 'flat-market-neutral-rsi'
  withSignal: boolean;              // el contrato: true ⇒ NUNCA puede resolver por el gate
  previous: DeterministicGateSnapshot;
  indicators: IndicatorSnapshot;
  openPositions: PositionFixture[];
  news: NewsFixture[];
  macro: Record<string, unknown>;
  reconciliationConfirmed: boolean;
}
```

| Grupo                       | N | `withSignal` | Qué cubre                                                                                 |
| --------------------------- | - | ------------ | ------------------------------------------------------------------------------------------ |
| Mercado plano               | 5 | `false`      | Las 5 condiciones cumplidas, con y sin posición abierta estable, con y sin macro presente.  |
| Una condición rota (1 c/u)  | 5 | `true`       | Cruce de EMA / RSI 72 / precio +1.2 % / posición cerrada / titular nuevo. **Espeja CA-039.** |
| Fail-closed                 | 2 | `true`       | Reconciliación no confirmada; snapshot de indicadores stale.                                |

Que 5 de 12 escenarios sean "sin señal" (41 %) es **deliberadamente pesimista** frente al
escenario real descrito por la spec (la mayoría de los ciclos terminan en HOLD): el harness debe
alcanzar el −50 % en condiciones peores que la realidad, no mejores.

### 7.3 Qué se cuenta

`CountingLLMClient implements LLMProviderClient` registra por llamada
`{ task, systemChars, userChars, maxTokens, cacheMarked }` y devuelve una respuesta canónica fija
por tarea (JSON válido, longitud fija) — determinista, sin red, sin LLM real.

```ts
// cost-model.ts
export const HARNESS_CHARS_PER_TOKEN = 4;
export const HARNESS_OUTPUT_WEIGHT = 5;       // el output se tarifa ~5× el input
export const HARNESS_CACHE_READ_WEIGHT = 0.1; // prefijo cacheado ≈ 0.1× del precio de input

export function scoreRun(calls: RecordedCall[]): { invocations: number; costProxy: number };
```

`costProxy = Σ (inputTokensProxy × factorCache) + Σ (maxTokens × 5)`.

El **techo** de salida (`max_tokens`) y no la salida real es lo correcto para esta métrica: es lo
que la optimización D4 cambia y lo que el usuario reserva por llamada. Se documenta explícitamente
en `cost-model.ts` que **esto es un proxy determinista, no la facturación del proveedor**; su
único propósito es que "−50 %" sea una aserción numérica reproducible en CI, no una estimación
—misma reinterpretación ejecutable que CA-001 (cycle-01) y CA-012 (cycle-02).

### 7.4 Las dos corridas y los asserts (CA-060, CA-061, CA-062)

| Parámetro                     | Corrida `baseline` | Corrida `optimized` |
| ----------------------------- | ------------------ | ------------------- |
| `deterministicGateEnabled`    | `false`            | `true`              |
| `SHARED_SIGNAL_CACHE_ENABLED` | `false`            | `true`              |
| `max_tokens`                  | 1024 fijo          | `AGENT_TASK_MAX_TOKENS` |
| prompt caching                | desactivado        | activo (aporta 0 con los prompts actuales — §4.2) |

```ts
expect(optimized.invocations).toBeLessThanOrEqual(baseline.invocations * 0.5);   // CA-061
expect(optimized.costProxy).toBeLessThanOrEqual(baseline.costProxy * 0.5);       // CA-061

for (const s of SCENARIOS.filter((x) => x.withSignal)) {                          // CA-062
  expect(optimized.byScenario[s.id].gateApplied).toBe(false);
}
```

**CA-062 se asserta por escenario, en un loop, nunca en agregado**: un solo escenario silenciado
hace fallar la suite aunque el promedio de ahorro se cumpla con creces. Ese es el punto entero del
harness.

Cálculo esperado en el fixture: baseline = 12 × 5 llamadas = 60; optimized = 7 × 5 = 35 (los 5
"sin señal" resuelven con 0), y el caché compartido colapsa las legs `technical_signal` y
`macro_context` de escenarios que comparten `(asset, pair, timeframe)` → ≈ 25-28 invocaciones
(≤ 30 = 50 %). El `costProxy` cae además por `max_tokens`. El margen es real, no ajustado.

---

## 8. D7 — Deploy-blocker de `apps/web` (RF-08, HU-03-08, CA-064..068, CE-08)

### 8.1 Los tipos del wire se comparten — y el typecheck vuelve a servir

Hoy `apps/web` **declara su propia interfaz** del response, y por eso el typecheck no vio el
renombre de cycle-02. Se corrige de raíz:

```ts
// libs/shared/src/types/agent-wire.ts  (NUEVO, exportado por el barrel)
export const AGENT_SLOT_WIRE_IDS = [
  'routing', 'synthesis', 'platform', 'operations', 'market', 'blockchain', 'risk',
] as const;
export type AgentSlotWireId = (typeof AGENT_SLOT_WIRE_IDS)[number];

export type ResolutionSource = 'override' | 'user' | 'admin' | 'preset' | 'credential';

export interface ResolvedAgentModelWire {
  slot: AgentSlotWireId;
  provider: string;
  model: string;
  source: ResolutionSource;
}

export interface AgentHealthItemWire extends ResolvedAgentModelWire {
  healthy: boolean;
  hasKey: boolean;
}

export interface AgentHealthReportWire {
  healthy: boolean;
  agents: AgentHealthItemWire[];
}
```

**`agent-identity.ts` sigue siendo la única puerta del mapeo identidad↔slot en `apps/api`** (regla
de §3.1 de la constitución): no importa nada de `libs/shared`. Lo que se agrega es una aserción de
tipo, en un archivo de una línea útil, que hace **fallar el build** si los dos vocabularios se
separan otra vez:

```ts
// apps/api/src/agents/agent-wire.assert.ts
const _slotsMatchWire: readonly AgentSlotWireId[] = MODEL_SLOT_IDS;
const _sourcesMatchWire: ResolutionSource = '' as ResolutionSourceApi;
```

`apps/web` **borra** `ResolvedAgentConfig`, `AgentHealthItem` y `AgentHealthReport` de
`use-agent-config.ts` e importa los tipos compartidos. RN-21 se respeta igual: el criterio de done
de este ciclo son los tests de comportamiento, no `tsc`; el tipo compartido es lo que evita la
**próxima** desalineación.

### 8.2 Los 22 sitios de lectura (lista cerrada — el implementor no busca)

`apps/web/src/hooks/use-agent-config.ts`

| Sitio                                          | Cambio                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `interface ResolvedAgentConfig` (líneas 6-11)  | **Borrar**; importar `ResolvedAgentModelWire` de `@crypto-trader/shared`                         |
| `interface AgentHealthItem` (13-20)            | **Borrar**; importar `AgentHealthItemWire`                                                       |
| `interface AgentHealthReport` (22-24)          | **Borrar**; importar `AgentHealthReportWire`                                                     |
| `useAgentConfigs()` (27-33)                    | `useQuery<ResolvedAgentModelWire[]>`                                                             |
| `useAgentHealth()` (35-43)                     | `useQuery<AgentHealthReportWire>`                                                                |
| `useUpdateAgentConfig()` (45-66)               | parámetro `agentId` → `slot`; URL `` `/users/me/agents/${slot}/config` ``                        |
| `useResetAgentConfig()` (68-82)                | ídem                                                                                             |
| `useApplyRecommendedPreset()` (~entries)       | `Object.entries(models)` produce `[slot, tiers]`; URL con `slot`                                 |

> Los hooks **admin** (`useAdminAgentConfigs`, `useUpdateAdminAgentConfig`,
> `useApplyRecommendedAdminPreset`) golpean `/admin/agent-configs/:agentId`, cuyo `@Param` sigue
> llamándose `agentId` pero **recibe un `ModelSlotId`** (hallazgo 1.1-10). Se renombra la variable
> local a `slot` por coherencia; **la ruta no cambia**.

`apps/web/src/pages/dashboard/settings/agents.tsx` — 22 lecturas de `.agentId` → `.slot`:

| Líneas                                    | Contexto                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| 212, 213, 244                             | `AGENT_META[config.slot]`, fallback `codename`, texto `({config.slot})` — **CA-064** |
| 347, 360                                  | `onSave(config.slot, …)`, `onReset(config.slot)` — **CA-066**            |
| 206, 207, 426, 427, 430, 431              | firmas y handlers: `agentId` → `slot` (props + mutations)                |
| 518 (×2), 522, 524, 545                   | filtros de categoría — **CA-065**                                        |
| 752, 753, 759, 761, 762                   | opciones del selector                                                     |
| 772, 773, 776, 781, 783, 800              | tarjetas de la lista                                                      |
| 819                                       | `key={selectedConfig.slot}`                                              |
| 233, 249, 250, 253-255                    | badge de `source` → `resolveSourceBadge()` (§8.3)                        |

**Corrección incluida (hallazgo 1.1-8):** en la línea 522 el array de exclusión
`['routing','synthesis','risk','orchestrator']` pierde `'orchestrator'`, que no es un
`AgentSlotWireId` y nunca matcheó nada.

### 8.3 `source`: union completo y CE-08

```ts
// apps/web/src/pages/dashboard/settings/agent-source-badge.ts
export type AgentSourceTone = 'override' | 'admin' | 'default' | 'unknown';

export function resolveSourceBadge(source: string): {
  labelKey: string;
  tone: AgentSourceTone;
} {
  switch (source as ResolutionSource) {
    case 'override':
    case 'user':       return { labelKey: 'settings.agents.usingOverride', tone: 'override' };
    case 'admin':      return { labelKey: 'settings.agents.usingAdmin',    tone: 'admin' };
    case 'preset':
    case 'credential': return { labelKey: 'settings.agents.usingDefault',  tone: 'default' };
    default:           return { labelKey: 'settings.agents.usingUnknown',  tone: 'unknown' };
  }
}
```

Función pura y exportada → **CA-067 se testea con un caso por valor del union**, sin montar la
página. La rama `default` es **CE-08**: un `source` desconocido degrada a un badge visible
"desconocido" en **esa fila**, sin romper el render de la pantalla. Claves nuevas
`settings.agents.usingUnknown` en `es.ts` **y** `en.ts` (convención no negociable de `apps/web`).

`'preset'` y `'credential'` caen al mismo tono que hoy tiene "default", que es exactamente lo que
significaban `'fallback'` y la primera credencial activa antes de cycle-02: **la UI no cambia de
semántica, deja de estar rota**.

### 8.4 Criterio de done: tests, no typecheck (CA-068, RN-21)

`apps/web/src/pages/dashboard/settings/agents.spec.tsx` +
`apps/web/src/hooks/use-agent-config.spec.tsx`, sobre un **fixture del response real post-cycle-02**
(`agents-wire.fixture.ts`, con los 7 slots y los 5 valores de `source`):

| CA     | Test                                                                                                    |
| ------ | -------------------------------------------------------------------------------------------------------- |
| CA-064 | Monta la pantalla con el fixture → los 7 codenames renderizados, ninguno vacío.                          |
| CA-065 | Los filtros `'risk'` y `'routing'` seleccionan exactamente los agentes esperados del fixture.            |
| CA-066 | Intercepta la llamada HTTP saliente al guardar → URL `= /users/me/agents/market/config`, nunca `undefined`. |
| CA-067 | `resolveSourceBadge()` — 5 casos, uno por valor del union.                                               |
| CE-08  | `resolveSourceBadge('marciano')` → tono `unknown`; la pantalla renderiza las otras 6 filas.              |

---

## 9. D8 — Re-arme de la protección nativa (RF-09, HU-03-09, CA-069..072, CE-09/CE-10)

### 9.1 Qué es función pura y qué es orquestación

```ts
// libs/trading-engine/src/lib/position-manager.ts (mismo archivo que updateTrailingStop)
export const PROTECTION_REARM_MIN_STOP_DELTA_PCT = 0.001; // 0.1 %

export interface ProtectionRearmInput {
  protectionStatus: string;
  activeStopPrice: number | null;   // el stop con el que se colocó la OCO viva
  desiredStopPrice: number | null;  // el stop que acaba de calcular el trailing/breakeven
  remainingQuantity: number;
  nativeProtectionEnabled: boolean;
  isSandbox: boolean;
}

export type ProtectionRearmDecision =
  | { action: 'NONE'; reason: 'DISABLED' | 'SANDBOX' | 'NOT_PROTECTED' | 'BELOW_THRESHOLD' | 'NO_STOP' }
  | { action: 'REARM'; deltaPct: number };

export function resolveProtectionRearm(input: ProtectionRearmInput): ProtectionRearmDecision;
```

Regla: `REARM` **solo si** `nativeProtectionEnabled` **y** `!isSandbox` **y**
`protectionStatus === 'PROTECTED'` **y** ambos precios son finitos y positivos **y**
`|desired − active| / active >= 0.001`. Todo lo demás es `NONE` con motivo. Aritmética pura,
testeable sin exchange → **CA-069/CA-070 se prueban acá**, con el mock del executor solo para el
efecto observable.

En SANDBOX nunca se re-arma: `SandboxOrderExecutor` se reconstruye en cada ciclo y su simulación
en memoria no sobrevive — la misma razón por la que cycle-02 ignora `nativeProtectionEnabled` en
SANDBOX.

La orquestación vive en `TradingProcessor`, en un método privado nuevo:

```ts
private async ensureNativeProtection(
  userId: string, config: any, symbol: string, mode: TradingMode,
  executor: OrderExecutorPort, position: any,
  levels: { stopPrice: number; takeProfitPrice: number; quantity: number },
): Promise<void>
```

### 9.2 Secuencia exacta y sus dos fallos (CA-071, CE-09, CE-10)

```
1. cancelProtectionOrder(symbol, { orderListId, stopOrderId })
   ├── falla ──▶ protectionStatus = 'UNPROTECTED' + protectionLastError
   │            + notificación 'positionUnprotected' + WS 'position:unprotected'
   │            ▶▶ NO se recoloca  (CE-09 — fail-closed)
   └── ok ─────▶ 2
2. protectionStatus = 'RELEASED'   (estado intermedio persistido: nunca hay un instante
                                    en el que la fila diga PROTECTED sin OCO viva)
3. placeProtectionWithRetry({
     executor,
     request: { symbol, quantity: remanente, stopPrice: nuevo,
                stopLimitPrice: nuevo × (1 − stopLimitOffsetPct),
                takeProfitPrice: recalculado, referencePrice: precio actual },
     startingFailureCount: position.protectionFailureCount,
     clientOrderIdFor: (a) => `prot-${position.id}-${a}`,
     beforeAttempt: (a) => update({ protectionFailureCount: a }),
   })
   ├── PLACED ─▶ protectionStatus = 'PROTECTED' + nuevos ids + protectionPlacedAt
   │             + protectionLastError = null
   └── FAILED ─▶ protectionStatus = 'UNPROTECTED' + protectionLastError
                 + notificación + WS 'position:unprotected'
                 + si config.closeOnProtectionFailure ⇒ closePositionAfterProtectionFailure()
                                                        (CE-10, mismo camino que cycle-02)
```

Decisiones que cierran los bordes:

- **CE-09 no recoloca.** Si la cancelación falla, la OCO vieja **puede seguir viva**; colocar una
  segunda protección sobre el mismo balance base da `-2010` y deja dos órdenes compitiendo.
  Marcar `UNPROTECTED` y esperar es el estado honesto: `ReconciliationService` corre antes de la
  próxima decisión, barre las OCO zombie por prefijo `prot-` y reconcilia la verdad. Mientras
  tanto la máquina local de `checkOpenPositions` sigue cubriendo la posición, que es exactamente
  la degradación segura que cycle-02 ya aceptaba.
- **`clientOrderId` sin columna nueva.** `startingFailureCount: position.protectionFailureCount`
  hace que el contador siga creciendo entre re-armes, así que `prot-{positionId}-{attempt}` nunca
  se repite. El prefijo `prot-` se conserva **obligatoriamente**: es lo que reconoce el barrido de
  OCO zombie de `ReconciliationService`. `protectionFailureCount` pasa a significar "intentos de
  colocación acumulados"; se documenta en `sdd/schema.json`.
- **CA-071 (sin TP zombie)** se cumple porque la única transición a `PROTECTED` está después de una
  cancelación **confirmada**: no existe camino en el que sobreviva una pierna de la orden anterior
  con el estado diciendo `PROTECTED`.

### 9.3 Los dos puntos de llamada

| Punto                                                             | Niveles con los que se re-arma                                                                                       |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `checkOpenPositions`, en la rama final `stopChanged` (~línea 1706) | `stopPrice = trailingState.stopPrice`, `takeProfitPrice = pos.takeProfitPrice`, `quantity = pos.quantity`. Se llama **después** de persistir el estado de trailing, para que un fallo del exchange no deje el estado local sin guardar. |
| Después de `executePartialTakeProfit`                              | La venta parcial ya llamó `releaseProtectionIfNeeded` → la posición queda `RELEASED` **sin ninguna protección**. Si sigue `OPEN` y `nativeProtectionEnabled`, se coloca de nuevo con el stop de breakeven y la **cantidad remanente**. `resolveProtectionRearm` devuelve `NONE` (`NOT_PROTECTED`), así que este camino llama directo a la colocación, sin cancelar. |

**CA-072** (regresión directa del escenario documentado en cycle-02) se prueba con
`nativeProtectionEnabled + trailingStopEnabled` activos: un movimiento de stop que cruza el 0.1 %
debe producir `cancelProtectionOrder` seguido de `placeProtectionOrder`, y **no** un cierre a
mercado local.

---

## 10. D9 — Follow-ups de test y de contrato (RF-10, RF-11, RF-12)

### 10.1 `getPositions` + EP-008 (CA-073..075, CE-11)

Al `select` de `TradingService.getPositions` (línea ~597) se le agregan los 9 campos:
`protectionStatus`, `stopPrice`, `takeProfitPrice`, `highWaterPrice`, `trailingActive`,
`initialQuantity`, `partialExitCount`, `realizedPnl`, `exitReason`.

**CE-11 — "valores definidos, no `null` inesperado ni campo ausente":** el contrato es
**presencia garantizada del campo**, no invención de valores. Cuatro campos tienen default en DB y
nunca son nulos (`protectionStatus: 'NONE'`, `trailingActive: false`, `partialExitCount: 0`,
`realizedPnl: 0`). Los cinco restantes son legítimamente nulos cuando no aplican
(`stopPrice`, `takeProfitPrice`, `highWaterPrice`, `initialQuantity`, `exitReason`) y se mapean
como `?? null` **explícito**: el campo siempre está en el JSON, con `null` como valor neutro
definido. Rellenar `stopPrice` con `0` para "evitar el null" sería un dato peligrosamente falso
para un cliente que lo lea como un nivel de stop.

**CA-074 (consistencia):** los valores salen del `select` de Prisma sin cálculo derivado. El test
compara la respuesta contra la fila mockeada, campo a campo.

EP-008 pasa a `status: "implemented"` en `sdd/api.json` (**CA-075**) — lo hace el implementor al
cerrar la task, no el arquitecto.

### 10.2 Guard estático anti-regresión (CA-076..078)

El problema no evidente: un archivo que *busca* `isFalseConcentrationBlock` **contiene** la cadena
`isFalseConcentrationBlock` y se encuentra a sí mismo. Diseño que lo resuelve:

```
apps/api/src/testing/
├── source-scanner.ts            // función pura, SIN ninguno de los literales prohibidos
└── forbidden-symbols.spec.ts    // arma los patrones por fragmentos + fixture temporal
```

```ts
// source-scanner.ts — recibe los patrones, no los conoce
export interface ForbiddenSymbolHit { file: string; line: number; pattern: string; }

export function scanForbiddenSymbols(
  roots: string[],
  patterns: string[],
  skipFiles: string[],
): ForbiddenSymbolHit[];
```

```ts
// forbidden-symbols.spec.ts
const FORBIDDEN = [
  'isFalse' + 'ConcentrationBlock',
  'as unknown ' + 'as AgentId',
];
```

La concatenación es deliberada y es la única forma de que el guard no se auto-detecte; queda
explicada acá, en el documento de arquitectura, y no como comentario en el código (cero comentarios).
El scanner además excluye su propio spec vía `skipFiles`.

Raíces escaneadas: `apps/api/src` y `libs/*/src`, extensiones `.ts`/`.tsx`, con `readFileSync`
recursivo — el mismo patrón que `trading.processor.isolation.spec.ts` ya usa.

| CA     | Test                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------- |
| CA-076 | `scanForbiddenSymbols(['apps/api/src','libs'], FORBIDDEN, [selfPath])` → falla si hay hits.             |
| CA-077 | Con el árbol actual → `[]`. Confirma que no es un falso positivo permanente.                            |
| CA-078 | Se escribe un archivo temporal con cada cadena en un `tmpdir` y se verifica que el scanner lo reporta.  |

### 10.3 Reescritura de los dos specs frágiles (CA-079..081) — **va primero**

> **Dependencia de orden (hallazgo 1.1-9): TASK-014 se cierra ANTES que TASK-011 y TASK-012.**
> Los dos specs cortan el fuente entre `private async checkOpenPositions` y
> `private parseSymbolForSandbox`; el re-arme de OCO de D8 y cualquier extracción de método
> los rompen. Refactorizar primero y "arreglar el test después" es exactamente el anti-patrón que
> HU-03-12 viene a eliminar.

**Patrón recomendado — extraer la unidad y testear el efecto, no el texto:**

1. Extraer el crédito de wallet SANDBOX (hoy inline en `closeAtMarket`, `executePartialTakeProfit`
   y `executeLLMSell`, tres copias del mismo `$transaction`) a un método privado único:

   ```ts
   private async creditSandboxWallet(
     userId: string, currency: string, proceeds: number, fee: number,
   ): Promise<void>   // $transaction(upsert + findUnique) + gateway.emitToUser('wallet:updated')
   ```

2. Extraer el cierre a mercado del closure `closeAtMarket` a un método privado
   `closePositionAtMarket(...)` con la misma firma que hoy tiene el closure.

3. Reescribir las dos aserciones como **comportamiento sobre el doble de Prisma**:

   | Spec                                        | Aserción vieja (texto fuente)                                              | Aserción nueva (comportamiento)                                                                                            |
   | ------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
   | `trading.processor.isolation.spec.ts` ~110  | `checkBody` matchea `$transaction` / `tx.sandboxWallet.upsert` / `findUnique` | Se invoca `creditSandboxWallet` con Prisma mockeado y se verifica que `$transaction` se usó y que dentro se llamó `sandboxWallet.upsert` + `findUnique`, y que se emitió `wallet:updated`. |
   | `...decision-traceability.spec.ts` ~183     | `body` **no** matchea `/decisionId/`                                        | Se ejecuta el camino de stop-loss de `checkOpenPositions` con mocks y se verifica que `prisma.trade.create` fue llamado con `data` **sin** `decisionId` (o `undefined`) — **CA-028 sigue verificándose, por efecto**. |

4. **CA-081** — test de regresión del propio patrón: se aplica un cambio cosmético a
   `checkOpenPositions` (reordenar la declaración de `trailingCfg`, renombrar una variable local) y
   los dos specs siguen verdes. Se ejecuta una vez, en la task, como evidencia; no queda como test
   permanente que edite el fuente.

Acceso al método privado desde el spec: cast de acceso tipado
`(processor as unknown as { closePositionAtMarket: (...args: unknown[]) => Promise<void> })`.
**No** es el cast `as unknown as AgentId` prohibido por CA-034; el guard de §10.2 busca esa cadena
literal exacta y no matchea.

**Las otras tres aserciones de slicing del isolation spec** (rangos de `executeLLMSell`,
`executeBuy` y `recentTrades`) **quedan fuera de alcance**: el functional nombra solo las dos de
`checkOpenPositions`. Se deja registrado como deuda para no ampliar el ciclo por la ventana.

---

## 11. D10 — Migración SQL (única, escrita a mano)

`apps/api/prisma/migrations/20260817160000_add_cost_gate_fields/migration.sql`

```sql
-- AlterTable
ALTER TABLE "trading_configs"
  ADD COLUMN "deterministicGateEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "gatePriceChangePct"       DOUBLE PRECISION NOT NULL DEFAULT 0.005;

-- AlterTable
ALTER TABLE "agent_decisions"
  ADD COLUMN "llmCallCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "agent_decisions_createdAt_idx" ON "agent_decisions"("createdAt");
```

**Por qué estas tres columnas y ninguna más:**

| Columna                    | Por qué es imprescindible                                                                                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deterministicGateEnabled` | RN-04 exige que la activación sea **explícita del dueño del bot** → tiene que ser per-config, no env. Nace `false`: una instalación existente que despliegue este ciclo no cambia de comportamiento. |
| `gatePriceChangePct`       | El functional habla del "umbral **configurado** de cambio significativo". Es el único de los cinco umbrales que depende del par y de la tolerancia del usuario; los otros cuatro son constantes de `libs/analysis`. |
| `llmCallCount`             | CA-058 (atribuir el ahorro a su causa) no es resoluble por `llmCostUsd === 0`: un modelo gratuito produce una decisión LLM con costo 0. Ver §6.3.                                              |
| índice `createdAt`         | El agregado de plataforma (EP-010) filtra por rango de fecha **sin** `userId`; el índice existente es `(userId, createdAt)` y no sirve para ese acceso.                                        |

**Lo que se resolvió sin migración, deliberadamente:** el `gateSnapshot` del ciclo anterior va en
`agent_decisions.metadata` (columna `Json?` ya existente); el contador de re-armes reutiliza
`protectionFailureCount`; el caché compartido no tiene tabla; el costo por bot/día se agrega desde
columnas ya presentes.

**Espejo en `schema.prisma`** (obligatorio, el SQL a mano no lo actualiza solo):

```prisma
model TradingConfig {
  // ...
  deterministicGateEnabled Boolean @default(false)
  gatePriceChangePct       Float   @default(0.005)
}

model AgentDecision {
  // ...
  llmCallCount Int @default(0)

  @@index([userId, createdAt])
  @@index([createdAt])
}
```

**DTOs (obligatorio por `forbidNonWhitelisted` — un campo no declarado responde 400 al request
entero, no lo ignora).** En `CreateTradingConfigDto` **y** `UpdateTradingConfigDto`:

```ts
@IsBoolean()
@IsOptional()
deterministicGateEnabled?: boolean;

@IsNumber({}, { message: 'Umbral de cambio de precio del gate debe ser un número válido' })
@Min(0.0005, { message: 'Umbral de cambio de precio del gate debe ser al menos $constraint1 (0.05%)' })
@Max(0.05,   { message: 'Umbral de cambio de precio del gate no puede superar $constraint1 (5%)' })
@IsOptional()
gatePriceChangePct?: number;
```

Rango justificado: por debajo de 0.05 % el gate no aplicaría nunca (todo movimiento lo abre) y por
encima de 5 % silenciaría movimientos que cualquier `buyThreshold` razonable considera señal.

`llmCallCount` **no va en ningún DTO**: lo escribe el servidor, nunca el cliente.

---

## 12. Contratos de API

### 12.1 EP-009 (nuevo) — costo LLM por bot y por día

```
GET /analytics/agent-costs
Authorization: Bearer <jwt>
```

| Query      | Tipo                    | Default | Descripción                                    |
| ---------- | ----------------------- | ------- | ----------------------------------------------- |
| `period`   | `7d\|30d\|90d`          | `30d`   | Ventana de agregación                           |
| `mode`     | `SANDBOX\|TESTNET\|LIVE`| —       | Filtra por modo del bot                         |
| `configId` | string                  | —       | Restringe a un bot                              |

**200**

```json
{
  "period": "30d",
  "from": "2026-07-18T00:00:00.000Z",
  "to": "2026-08-17T23:59:59.999Z",
  "costUsd": 12.4831,
  "decisions": 2880,
  "llmDecisions": 1104,
  "gateDecisions": 1776,
  "unpricedDecisions": 3,
  "byBot": [
    {
      "configId": "clx…",
      "configName": "BTC agresivo",
      "asset": "BTC",
      "pair": "USDT",
      "mode": "LIVE",
      "costUsd": 8.9102,
      "decisions": 1440,
      "llmDecisions": 620,
      "gateDecisions": 820,
      "unpricedDecisions": 1
    }
  ],
  "dailySeries": [
    {
      "date": "2026-08-17",
      "costUsd": 0.4123,
      "decisions": 96,
      "llmDecisions": 37,
      "gateDecisions": 59,
      "unpricedDecisions": 0,
      "byBot": [{ "configId": "clx…", "costUsd": 0.2841 }]
    }
  ]
}
```

**400** `period` inválido · **401** JWT ausente o inválido

### 12.2 EP-010 (nuevo) — costo LLM agregado de plataforma

```
GET /admin/analytics/llm-costs
Authorization: Bearer <jwt de rol ADMIN>
```

Query: `period` (igual), `mode` (igual), `userId` (opcional).
Response: misma forma que EP-009, con `byUser: [{ userId, costUsd, decisions, llmDecisions,
gateDecisions, unpricedDecisions }]` en lugar de `byBot` al nivel raíz (`dailySeries[].byBot` se
omite). **401** sin JWT · **403** rol distinto de ADMIN.

Ambos controllers delegan en `AnalyticsService.getAgentCostBreakdown()` — **un solo cálculo**
(CA-057).

### 12.3 EP-008 (actualizado)

Sin cambios de forma respecto de lo registrado en cycle-02: el contrato ya declaraba los 9 campos;
lo que cambia es que el `select` los devuelve de verdad. Se registra el cambio en el `changelog` y
el implementor lo pasa a `implemented`.

### 12.4 EP-003 — sin cambios

Se documenta la relación con EP-009 (§6.4) y la desigualdad esperada
`Σ llm_usage_logs.costUsd ≥ Σ agent_decisions.llmCostUsd`.

---

## 13. Mapa task → sección de este documento

| Task     | Sección | Nota                                                                             |
| -------- | ------- | -------------------------------------------------------------------------------- |
| TASK-001 | §8      | Deploy-blocker. Sin dependencias. Va primero.                                     |
| TASK-002 | §2.1-2.4| Incluye el cambio obligatorio de `runCycle` para CE-01.                           |
| TASK-003 | §2.5    | Reutiliza el `create` y el `emit` existentes; no crea camino paralelo.            |
| TASK-004 | §3      | El puerto y el adaptador in-memory alcanzan para todos los CA; Redis es adaptador. |
| TASK-005 | §4      | Leer §4.2 antes de escribir el test de CA-047: **dos casos**, no uno.             |
| TASK-006 | §5      | El campo `truncated` en los 7 proveedores es parte de la task, no un extra.       |
| TASK-007 | §6.1-6.3| Cambia la firma de `LLMUsageService.log()`.                                       |
| TASK-008 | §6.4, §12| Un método de servicio, dos controllers.                                          |
| TASK-009 | §7      | Depende de 002/004/005/006.                                                       |
| TASK-010 | §6.4    | Contrato del panel al final de §6.4.                                              |
| TASK-011 | §9      | **Después de TASK-014.**                                                          |
| TASK-012 | §10.1   | **Después de TASK-014.**                                                          |
| TASK-013 | §10.2   | Independiente.                                                                    |
| TASK-014 | §10.3   | **Primera de las tres de follow-up.**                                             |
| —        | §11     | La migración la aplica la primera task que la necesite (TASK-002).                |

---

## 14. Riesgos aceptados y deuda registrada

| Riesgo / deuda                                                                                                | Decisión                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| El prompt caching no ahorra nada con los system prompts actuales (650-830 tok < 1024)                         | **Aceptado y medido** (§4.2). Se registra follow-up para elevar los prompts en `AgentDefinition`; el −50 % no depende de eso.       |
| El caché compartido no coalesce entre réplicas (solo TTL)                                                     | **Aceptado** (§3.2). Un lock distribuido agrega un modo de fallo peor que el ahorro marginal.                                       |
| El caché sirve a un bot un resultado producido por el modelo de otro usuario                                  | **Aceptado y atribuido** (§3.4): el `SubAgentResult` marca `cached: true` + `cachedFrom`; la decisión no miente sobre su origen.    |
| El proxy de costo del harness no es la facturación real del proveedor                                          | **Aceptado y documentado** (§7.3). Es la reinterpretación ejecutable, con el precedente de CA-001 y CA-012.                          |
| Con la cancelación de OCO fallida la posición queda `UNPROTECTED` aunque la OCO vieja siga viva                | **Aceptado** (§9.2): es el estado honesto; `ReconciliationService` reconcilia y la máquina local sigue cubriendo la posición.        |
| Las otras 3 aserciones de slicing de `trading.processor.isolation.spec.ts` siguen frágiles                     | **Fuera de alcance** (§10.3), registrado como deuda para no ampliar el ciclo.                                                        |
| La UI de los 17 campos de `TradingConfig` (+ los 2 nuevos de este ciclo) sigue sin existir                     | **Fuera de alcance por decisión del orquestador**; los 2 campos nuevos del gate se suman a esa deuda de UI ya documentada.           |
