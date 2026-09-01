# Constitución — apps/api

> Versión 1.5 | Última actualización: cycle-04 | Fecha: 2026-09-01
> Fragmentos consolidados: spec-e-burgos-001 cycle-03 (2026-08-18) + spec-e-burgos-004 cycle-01 (2026-08-19) + spec-e-burgos-005 cycle-01 (2026-08-30) + spec-e-burgos-008 cycle-01..04 (2026-09-01)

## 1. Propósito

- **Tipo:** app
- **Rol en el sistema:** Backend NestJS de la plataforma: autenticación JWT, gestión de usuarios y claves cifradas, ciclo de vida del agente de trading, análisis LLM, mercado, notificaciones, analytics, chat IA y administración.

## 2. Stack tecnológico

- **NestJS 11** (HTTP + DI + módulos), **Prisma 7** + **PostgreSQL 16**, **Redis 7** (cache + pub/sub), **Bull 4** (colas de análisis/órdenes/noticias/evaluación), **Socket.io 4** (gateway WebSocket), **Passport + JWT** (access 15min + refresh rotation), **bcrypt**, **class-validator**.
- Build: `@swc-node/register` en dev, Webpack en producción. **Deploy: VPS propio (Hetzner CX23, Helsinki) vía `docker-compose.prod.yml`, detrás de nginx en `https://trader.estebanburgos.com.ar/api`** — Railway fue dado de baja como plataforma de despliegue (spec-e-burgos-008; ver §3.5).

## 3. Estructura y patrones

- Un módulo NestJS por dominio en `apps/api/src/`: auth, users, trading, analysis, llm, orchestrator, openrouter, market, notifications, analytics, admin, chat, agents (AgentConfigModule, AgentDomainModule, EvaluationModule).
- Pipeline del agente: Bull job → **reconciliación de estado del exchange (solo LIVE/TESTNET, antes de toda decisión)** → data-fetcher (OHLCV) → analysis (indicadores) → noticias → AgentConfigResolver → LLM → sizing modulado + política de SELL + riesgo agregado → trading-engine (si confidence ≥ threshold) → DB + WebSocket.
- Depende de `libs/`: shared, analysis, data-fetcher, trading-engine, openrouter, providers.
- `src/cache/` — caché de señales compartido entre bots/usuarios: `SharedCachePort` (adapters `InMemorySharedCache`/`RedisSharedCache`) + `SignalCacheService`, single-flight, sirve stale si el recálculo falla. Claves `sig:v1:{tech|macro|news}:...` sin `userId`. Activación explícita por `SHARED_SIGNAL_CACHE_ENABLED`; apagado es passthrough puro.

### 3.1 Piezas de una sola puerta (no razonar su lógica en otro archivo)

| Pieza                                        | Regla                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/agents/agent-identity.ts`               | **Único** archivo que conoce el mapeo identidad↔slot: `PERSONA_AGENT_IDS`/`PersonaAgentId` (6, con `AgentDefinition`), `MODEL_SLOT_IDS`/`ModelSlotId` (7, configurables), `resolveModelSlot`, `isPersonaAgent`, `isModelSlot`. El enum Prisma `AgentId` tiene 8 valores porque son 6 personas ∪ 7 slots — **no se migra** (architect cycle-01 §7). |
| `AgentConfigResolverService.resolveClient()` | **Única** puerta para obtener un cliente LLM de agente. Cascada `override → user → admin → preset → primera credencial activa`, `NoLLMCredentialError` si nada resuelve. Incluye `assertProviderActive` + `decrypt` + construcción del cliente.                                                                                    |
| `AgentPromptService`                         | **Única** fuente de system prompts (tabla `AgentDefinition`). Caché TTL 60 s + `invalidate(agentId)` desde `AdminAgentsService`. **Fail-fast en `onModuleInit`**: si falta alguno de los 6 `AgentDefinition` (inactivo o prompt vacío) la app no arranca → `pnpm db:seed` es parte del bootstrap de dev, CI y e2e.                |
| `ModelPricingService`                        | Cascada de tarifa `LIVE_OPENROUTER → STALE_CACHE (last-good en memoria) → STATIC_TABLE (MODEL_PRICING) → UNPRICED`. **Nunca lanza.** Tarifa contra `actualModel ?? model`. `MODEL_PRICING` sirve a los 6 proveedores directos; no se le agregan entradas OpenRouter.                                                              |
| `src/agents/domain/` (`AgentDomainModule`)   | `RiskBudgetService`, `PortfolioContextService` y `AggregateRiskService`: dominio puro sobre Prisma, sin contrato de tool ni LLM. `AggregateRiskService.assertBuyAllowed` es la **única** puerta del riesgo agregado por usuario (compone `PortfolioContextService` sin `configId` + `RiskBudgetService.assessAggregate`). `TradingModule` importa `AgentDomainModule`.                                                    |
| `AggregateRiskService` + `user_risk_policies` | Límite de exposición por activo, pérdida diaria máxima (**día calendario UTC**, no ventana móvil) y drawdown que pausa **todas** las configs del usuario. Vive en tabla propia 1:1 con `User`, **no** en `TradingConfig` ni en `AgentBudgetPolicy` — este último es presupuesto de **gasto de LLM**; límite de pérdida operativa ≠ presupuesto de tokens. La tabla nace **sin fila** ⇒ sin política, no se consulta nada. |
| `evaluateSellPolicy` (`libs/trading-engine`) | **Única** decisión de SELL. Dos caminos independientes: toma de ganancia (piso `minProfitPct`, idéntico al comportamiento previo) y corte de pérdida por señal (`lossCutEnabled`). **Fail-closed en cadena**: confianza ausente, no finita o fuera de `[0,1]` ⇒ nunca vende en pérdida. El veto absoluto de `minProfitPct` en `trading.processor.ts` ya no existe.                                                          |
| `resolveTradeQuantity` (`libs/trading-engine`) | **Única** aritmética de sizing: `factor = min(aegis × verdict, forge)` con `clamp(·,0,1)` en cada factor ⇒ el techo `balance × maxTradePct` es inviolable **por construcción**. `REDUCE` reduce tamaño (`reduceSizeFactor`), no bloquea; FORGE `skip` ⇒ tamaño 0 con `blockedBy: 'FORGE_SKIP'`, distinto de `AEGIS_BLOCK`.                                                                                             |
| `aegisVerdictSchema` (`src/orchestrator/dto/`) | **Única** lectura del verdict de AEGIS: `blockReasons: AegisBlockReason[]` tipado (zod, un `.catch()` por campo para degradar a neutro ante payload parcial). `isOverridableBlock` es **fail-closed**: sin `blockReasons`, con array vacío o con cualquier motivo fuera del conjunto anulable, el BLOCK se respeta. El regex `isFalseConcentrationBlock` sobre `reason` fue eliminado y **no se reintroduce**. **El gate ya no falla abierto ante un payload vacío (FIX-e-burgos-014):** antes, `verdict` con `.catch('PASS')` y `positionSizeMultiplier` con `.catch(1)` convertían una respuesta ilegible en un PASS a tamaño completo; ahora un verdict que no se pudo parsear es `BLOCK` con multiplicador `0` y alerta `AEGIS_UNPARSEABLE`. Los `.catch()` por campo se conservan para degradar un payload *parcial*; lo que cambió es que un payload *vacío* ya no se confunde con una autorización — `isAegisUnavailable()` distingue "AEGIS dijo PASS" de "AEGIS no dijo nada". |
| `ReconciliationService` (`src/trading/`)     | **Única** puerta de sincronización con el exchange; corre como paso previo a toda decisión del ciclo (antes del health check del LLM), solo en LIVE/TESTNET. Idempotente por **transición condicional** (`updateMany` con `status: 'OPEN'` esperado + guard `claimed.count === 0`), nunca por conteo de trades. Barre OCO zombie por `clientOrderId` con prefijo `prot-`, preservando antes las `PROTECTED` de otras configs del mismo usuario/símbolo. |
| `DecisionGateService` (`src/orchestrator/decision-gate.service.ts`) | **Único** gate determinista pre-LLM: resuelve HOLD sin llamar al LLM cuando las 5 condiciones de "sin señal" se cumplen a la vez, persistiendo una `AgentDecision` con `llmCostUsd = 0`. **Fail-closed**: reconciliación no confirmada, indicadores incompletos/stale, sin decisión previa o sin snapshot en la previa → llama al LLM. Nace apagado (`deterministicGateEnabled` default `false`). |
| `ActionGateService.authorizeAndRun` (`src/trading/action-gate.service.ts`) | **Única** puerta de toda acción automática — camino reactivo y camino del LLM por igual. Es el invariante central del loop reactivo: un cap no se puede eludir porque no hay segunda puerta. Toma el lease del bot, revalida la posición esperada (`SUPERSEDED` si cambió bajo el lease), evalúa los caps, ejecuta y escribe la fila en `bot_actions`, liberando el lease pase lo que pase. **Cualquier punto de ejecución nuevo pasa por acá, nunca llama al executor directo.** |
| `PositionActionService` (`src/trading/position-action.service.ts`) | Implementación **única** del camino de salida, extraída de `TradingProcessor`: `closeAtMarket`, `executePartialTakeProfit`, `rearmProtection`, `releaseProtectionIfNeeded` (+ privados `closePositionAfterProtectionFailure` y `creditSandboxWallet`). El fast path la reusa en vez de reimplementarla — eso es lo que garantiza liberar la protección nativa antes de vender en los cuatro caminos. `releaseProtectionIfNeeded` es **público** porque `executeLLMSell` también lo necesita. |
| `DataSourceCredentialResolver` (`market/data-source-credential-resolver.service.ts`) | **Única** cascada de credenciales de fuentes externas: `propia del trader → admin con shared:true → ninguna`. `MarketService` y `listSharedDataSourceIds()` (EP-011) delegan acá — ningún otro lugar consulta `dataSourceCredential`/`newsApiCredential` directo. El fallback compartido filtra por `role: 'ADMIN'` en la lectura, no confía en quién escribió el flag. |

### 3.2 Evaluación de decisiones

- `AgentOutcomeStatus` incluye `NOT_EVALUABLE` (horizonte vencido sin precio de mercado). `PENDING` y `NOT_EVALUABLE` quedan **excluidos** del win rate y se exponen aparte como `pendingCount`/`notEvaluableCount` en `/agents/scorecard` y `/agents/scorecard/summary`. `cleanup()` manda las `PENDING` de más de 48 h a `NOT_EVALUABLE`.
- Cola `agent-evaluation`: `evaluate` (delayed, `jobId: eval:{decisionId}:{horizon}`), `schedule-evaluations` (repetible `*/15 * * * *`, red de seguridad si Redis pierde los delayed) y `cleanup` (repetible `30 3 * * *`). Los repetibles se registran en `EvaluationService.onModuleInit` con `jobId` fijo + `removeRepeatable` previo, para que N réplicas no multipliquen el sweep.
- `scheduleEvaluation` se llama **siempre fire-and-forget con `.catch`**: la telemetría nunca puede tumbar el ciclo de trading.

### 3.3 Ejecución de órdenes y protección de posiciones (cycle-02)

- **Regla no negociable — cancelar la protección antes de vender.** Una OCO viva bloquea el balance base; todo camino de salida llama `releaseProtectionIfNeeded` (deja `RELEASED`) antes del `placeMarketOrder(SELL)`: `executeLLMSell`, `closeAtMarket` de `checkOpenPositions`, `executePartialTakeProfit` y `closePositionManually` de `TradingService`. **Cualquier camino de salida nuevo debe hacer lo mismo o falla con `-2010`.**
- **Protección nativa (solo LIVE/TESTNET, `nativeProtectionEnabled`):** tras confirmarse la compra, `executeBuy` coloca la OCO con `placeProtectionWithRetry` (`src/trading/protection-retry.ts`, única implementación del backoff: 3 intentos, 250/1000/3000 ms ±20 % jitter, solo ante códigos de Binance reintentables). `listClientOrderId = prot-{positionId}-{attempt}`, persistido antes de cada llamada. Agotados los intentos: `protectionStatus = UNPROTECTED` + notificación + evento WS `position:unprotected`; la posición **no** se cierra salvo `closeOnProtectionFailure` (default `false`). En SANDBOX el flag se ignora (el executor se reconstruye en cada ciclo y su simulación en memoria no sobrevive).
- **Re-arme de la OCO** cuando el trailing o el breakeven mueven el stop ≥0.1 %: `TradingProcessor.ensureNativeProtection` (+ `attemptProtectionPlacement`/`applyProtectionOutcome`, compartidos con la colocación post-BUY y la venta parcial) llama a `resolveProtectionRearm` (`libs/trading-engine`) y cancela+recoloca. Si la cancelación contra el exchange falla, la posición queda **desprotegida** — nunca se recoloca con la OCO vieja todavía viva (evita el `-2010`).
- **Máquina de salidas en `checkOpenPositions`**, orden fijo, primero que matchea gana: TIME_EXIT → STOP (efectivo = `max(stop persistido, nivel trailed)`) → PARTIAL_TP → TAKE_PROFIT fijo (**deshabilitado mientras `trailingStopEnabled` esté activo**) → persistir estado de trailing.
- `DecisionPayload` transporta `risk: AegisVerdict` y `sizing: ForgeSizingSummary` ya parseados: el processor **nunca** vuelve a parsear `subAgentResults`.
- `Position.quantity` significa **cantidad abierta remanente**; `initialQuantity` conserva la original y es `null` en filas históricas ⇒ los cálculos leen `initialQuantity ?? quantity`.
- `Trade.decisionId` (nullable, FK `ON DELETE SET NULL`) se setea en los 4 puntos de creación del flujo real; `null` en la reconciliación (lo ejecutó el exchange) y en el cierre manual.
- El contrato del JSON de AEGIS viaja en el **user prompt** de `buildTaskUserPrompt('risk_gate')` además del seed: el system prompt vive en la tabla `AgentDefinition` y una instalación ya seedeada no lo actualiza al desplegar.

### 3.4 Loop reactivo — despertar por evento y reflejos sin LLM (spec-005 cycle-01)

`src/reactive/` es la capa que hace que el bot reaccione al precio en lugar de al reloj. **Nace apagada** por `TradingConfig.reactiveLoopEnabled` (default `false`) y, además, la coordinación entre réplicas nace en su driver apagado.

| Archivo | Responsabilidad |
| --- | --- |
| `reactive-coordination.port.ts` | `ReactiveCoordinationPort` + símbolo de DI `REACTIVE_COORDINATION` |
| `redis-reactive-coordination.service.ts` | Implementación ioredis; lease y token con CAS en Lua |
| `disabled-reactive-coordination.service.ts` | Implementación apagada: todo `false`/`null`, `isHealthy() === false` |
| `reactive-coordination.module.ts` | Fábrica por env (`REACTIVE_COORDINATION_DRIVER`), exporta el puerto |
| `reactive-runtime-thresholds.ts` | Umbrales de infraestructura (leases, edades de stream, ping/pong, TTLs) |
| `market-stream.service.ts` | Dueño por símbolo, ciclo de vida del WS, fan-out de `tick`/`candle` |
| `stream-health.service.ts` | Publica y resuelve la salud por símbolo; emite la transición y notifica la degradación sostenida |
| `material-event.service.ts` | Compone `detectMaterialEvent` y ejecuta la secuencia de adelanto del ciclo |
| `fast-path.service.ts` | Compone `planFastPath` por tick y ejecuta vía `ActionGateService` → `PositionActionService` |

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

`ReactiveModule` está importado en `src/app/app.module.ts` y `reactive-module-wiring.spec.ts` es el candado que lo sostiene: borrar el import hace fallar ese spec, de modo que el módulo no puede volver a quedar huérfano. Importa `TradingModule` (por `ActionGateService` y `PositionActionService`), `NotificationsModule` (por la notificación de degradación sostenida) y registra `TRADING_QUEUE` por su cuenta para poder promover jobs. **`TradingModule` NO importa `ReactiveModule`.**

**Al tocar este grafo, empezar por acá:** `TradingModule` no re-exporta `BullModule` (`exports: [TradingService, PositionActionService, ActionGateService]`). Esa única omisión causa las dos deudas abiertas del módulo — obliga a `ReactiveModule` a registrar `TRADING_QUEUE` de nuevo (hay **dos `Bull.Queue`** para `trading-agent`, con dos pares de clientes ioredis) y deja al controller sin forma limpia de llegar a la capa reactiva. Las dos instancias comparten las claves de Redis (`bull:trading-agent:*`), así que `getDelayed()`/`promote()` cruzan sin problema y el adelanto por evento funciona: el costo es una conexión de más, no un bug.

**Claves de coordinación, todas versionadas `rx:v1:`** — al agregar una, seguir el prefijo:

| Clave | Qué es |
| --- | --- |
| `rx:v1:owner:{symbol}` | Lease del dueño del símbolo (una suscripción WS por símbolo) |
| `rx:v1:health:{symbol}` | `StreamHealthRecord` publicado, con TTL — lo lee cualquier réplica |
| `rx:v1:window:{configId}` | Fin de la ventana del temporizador vigente |
| `rx:v1:advance:{configId}:{windowEnd}` | Token de un solo uso: **un** adelanto por ventana |
| `rx:v1:bot:{configId}` | Lease de acción del bot: serializa las acciones de un mismo bot |

Cambios de acompañamiento en `src/trading/`:

- `bot-action-counters.ts` — las dos lecturas sobre `bot_actions` que alimentan los caps: conteo de la hora móvil y `max(occurredAt)` de la última acción ejecutada.
- `aggregate-risk.service.ts` — suma `evaluateDailyLoss` como **lectura pura** (sin efectos), para que el cap de pérdida diaria se pueda evaluar desde la puerta sin arrastrar el efecto de `assertBuyAllowed`.
- `trading.processor.ts` — pasó de ~1961 a ~1400 líneas al extraerse `PositionActionService`; sus 5 puntos de ejecución pasan por `authorizeAndRun` y escribe `rx:v1:window:{configId}` al re-encolar. **La omisión deliberada del `jobId` en el re-encolado sigue vigente y sigue siendo obligatoria** (reusar un jobId estático con el job activo hace que Bull devuelva el job existente y el agente se detenga en silencio); el adelanto por evento se hace con `Job.promote()`, no removiendo y re-encolando.

**Datos:** tabla nueva `bot_actions` (+4 enums), ledger sobre el que se cuentan los caps — `positionId`/`decisionId` **sin FK a propósito**: es auditoría y debe sobrevivir al borrado de lo que referencia. Getter `botAction` dado de alta en `PrismaService`. `trading_configs` suma `reactiveLoopEnabled`, `maxActionsPerHour`, `minActionIntervalSec`.

### 3.5 Infraestructura de producción — Hetzner (spec-e-burgos-008 cycle-01/02)

`apps/api` ya no corre en Railway. Su base y su cola viven en un **VPS propio de Hetzner (CX23,
Helsinki)**: `docker-compose.prod.yml` en la raíz del repo, con `infra/` conteniendo los scripts de
provisión, backup y verificación. **Sólo `nginx` publica puertos** — Postgres y Redis viven
exclusivamente en la red interna del compose. Inventario del servidor y línea de base medida:
[`docs/infra/hetzner-server.md`](../../../../docs/infra/hetzner-server.md).

| Archivo (`infra/`) | Para qué |
| --- | --- |
| `scripts/provision-01-base.sh` | Usuario no-root, swap, Docker, `unattended-upgrades` |
| `scripts/provision-02-sshd.sh` | Apaga la auth por contraseña |
| `scripts/provision-03-firewall.sh` | Firewall de Hetzner por API |
| `scripts/db-backup.sh` · `db-restore.sh` | Cadena de backup a R2 |
| `scripts/db-backup-cron-install.sh` | Cron horario, idempotente |
| `scripts/db-migrate.sh` | Migraciones desde contenedor efímero |
| `scripts/verify-network-isolation.sh` | Comprueba desde AFUERA que los puertos de datos no responden |
| `scripts/*.test.sh` | 49 aserciones que el CI corre **antes** de construir |
| `db/initdb/00-init.sql` | Base, rol de aplicación y extensión `vector` |

Postgres corre `pgvector/pgvector:pg16` con las migraciones aplicadas. Redis 7 corre con **AOF y
`noeviction`**. Backups horarios a Cloudflare R2 con restore verificado en una base descartable.

**Decisiones que un cambio futuro no puede romper:**

- **Redis en `noeviction` + AOF, NO `allkeys-lru`.** Acá Redis sostiene **las colas de Bull y los
  leases `rx:v1:*` del loop reactivo** (ver §3.4), no un cache descartable. Con `allkeys-lru`, bajo
  presión de memoria Redis descarta jobs y leases **en silencio**. Ver
  [`docs/infra/redis-degradation.md`](../../../../docs/infra/redis-degradation.md): se decidió
  **monitorear y no mitigar** — un fallback en memoria violaría el aislamiento entre réplicas y haría
  que los caps de frecuencia (§3.4) dejen de contar lo que realmente pasó.
- **Postgres y Redis sin `ports:`, nunca** — ni siquiera bindeados a `127.0.0.1` "para debuggear":
  para eso está `docker compose exec postgres psql` desde el propio VPS.
- **El healthcheck de Postgres consulta la base real**, no `pg_isready`: un `pg_isready` genérico da
  **falso verde durante `initdb`**, cuando Postgres levanta un servidor temporal en socket unix.
- **`pg_dump -Fc` por base, jamás `pg_dumpall`.** Un `pg_dumpall` lleva `CREATE DATABASE`/`\connect`
  embebidos y se auto-direcciona a producción. Un dump `-Fc` no contiene el destino, así que
  `pg_restore` exige `--dbname` — *"restaurar no puede pisar la base viva"* queda garantizado por
  **el formato del artefacto**, no por la disciplina del operador.
- **`.env.db` separado de `.env.production`.** El contenedor de Postgres no necesita ver las claves
  de Binance ni los JWT; un `env_file` único se las daría a los cinco contenedores.
- El archivado continuo de WAL quedó descartado a conciencia — ver
  [`docs/infra/rpo-decision.md`](../../../../docs/infra/rpo-decision.md): si el archivado se traba,
  Postgres retiene los segmentos y en 40 GB de disco eso termina con la base detenida — el mecanismo
  que protege pasa a ser el que tumba.
- **La IP del operador es residencial y cambia**: cuando pase, el puerto 22 deja de responder hasta
  editar la regla en el panel de Hetzner. Es el precio de administrar el firewall **fuera** de la VM.
- **El disco de 40 GB es el número a vigilar** — pasó de 4 % a 30 % sólo con desplegar (imágenes
  3,26 GB) y Hetzner **no permite achicar**. Los dumps horarios y los embeddings crecen sobre eso.

**Datos:** ninguna tabla nueva. La base de producción arranca vacía — los datos de Railway se
descartaron a conciencia (DEC-DATOS, spec §7): el trial venció y no había forma técnica de
extraerlos sin levantar el servicio. **Railway sigue existiendo** (trial vencido, deployments en
`REMOVED`), pero darlo de baja es acción del dueño de la cuenta — no la ejecuta un agente.

**Dependencias:** **Cloudflare R2** para los dumps (cuenta `cryptotradereb@gmail.com`) — es lo único
de Cloudflare que se usa, DNS y TLS quedaron fuera (DEC-DOM). **Hostinger** sirve el DNS de
`estebanburgos.com.ar`. Ninguna dependencia nueva de npm.

### 3.6 Health check real, seed de ADMIN y correcciones de riesgo/embeddings (spec-e-burgos-008 cycle-02)

- **`src/app/` — `HealthService` consulta Postgres con `SELECT 1` y hace `PING` a Redis**; el
  controller responde **503** cuando alguna está caída (antes devolvía `{status:'ok'}` fijo sin
  mirar nada). Timeout de 2 s por sonda — una dependencia colgada no puede colgar el chequeo, o un
  orquestador esperando respuesta nunca reinicia el contenedor. Usa una **conexión ioredis
  dedicada**, no una cola de Bull prestada: registrar una cola acá sumaría una tercera `Bull.Queue`
  para `trading-agent` (ver §3.4). `lazyConnect` para que un Redis caído no bloquee el arranque.
- **`prisma/seed.ts` — `seedSuperAdmin()` provisiona un único usuario `ADMIN`** desde
  `ADMIN_USERNAME`/`ADMIN_PASSWORD` y **converge en cada corrida** (rotar la contraseña es cambiar
  el secret y redesplegar, mismo contrato que el rol de aplicación en `00-init.sql`). **Fail-closed
  en producción**: sin esas variables lanza y, como el `CMD` del Dockerfile corre `db seed` antes de
  arrancar, **el contenedor no levanta**. Otros usuarios `ADMIN` se reportan con warning pero **no se
  borran**. No existe rol `SUPERADMIN`: `UserRole` es `TRADER | ADMIN`.
- **El gate de riesgo ya no falla abierto (FIX-e-burgos-014)** — ver la fila `aegisVerdictSchema` en
  §3.1.
- **Los embeddings pasan a OpenRouter con proveedor explícito.** `EmbeddingService` ya **no cae solo**
  de un proveedor a otro: vectores de modelos distintos viven en espacios distintos y una similitud
  coseno entre ellos no significa nada. Cambiar `EMBEDDING_PROVIDER` o `EMBEDDING_MODEL` **obliga a
  re-embeber todo lo guardado**. `assertShape()` es la **única** defensa de la dimensión: la columna
  `embedding` es `jsonb` y acepta cualquier largo en silencio.
  - `FIX-e-burgos-013` restauró `agent_document_chunks.embedding_vec vector(1024)` y su índice
    `ivfflat`, que la migración `20260413184109` había borrado como daño colateral de un diff
    autogenerado. Lo que impide la recaída no está en la migración sino en `schema.prisma`, que
    ahora declara la columna como `Unsupported("vector(1024)")` — mientras Prisma no sepa que
    existe, cualquier diff futuro la borra otra vez.
  - `OPEN_ROUTER_API_KEY` es **variable de entorno** además de vivir cifrada en `llm_credentials`: no
    es duplicación por descuido — los embeddings son **infraestructura de plataforma** y la
    credencial de la base es la del **chat de agentes**. Si los embeddings dependieran de la
    credencial de cada usuario, los documentos se indexarían con modelos distintos según quién los
    suba y el índice quedaría incomparable consigo mismo.

### 3.7 Persistencia de costo LLM en decisiones manuales (spec-e-burgos-008 cycle-03, FIX-e-burgos-015)

`TradingService.triggerAnalysis` persiste `llmCostUsd` y `llmCallCount` en la `AgentDecision`, igual
que el camino programado. Omitirlos dejaba en `NULL` toda decisión disparada desde el botón de
análisis manual, y el dashboard de costo subreportaba sin ningún error. **Sólo esos dos campos
existen en el modelo** — `pricedCallCount`/`unpricedCallCount` viven únicamente en el objeto interno
del processor; agregarlos al `create` tira `PrismaClientValidationError`. `llmCostUsd` usa `?? null`
y **nunca** `?? 0`: la columna es nullable para distinguir *"la corrida fue gratis"* de *"no se pudo
tarifar"* — confundirlas convierte una falla de tarifado en un cero creíble.

El ciclo de agente corre entero en Hetzner y queda registrado (CA-007), verificado con 6 ciclos
reales en SANDBOX contra la infraestructura de §3.5.

### 3.8 Observabilidad — alertas de infraestructura (spec-e-burgos-008 cycle-04)

`infra/scripts/daily-health-check.sh` corre por cron **`0 8 * * *` UTC** (05:00 Argentina, antes de
que el operador empiece el día) y hace seis verificaciones, cada una atada a un modo de falla que
este proyecto demostró que ocurre en silencio:

| Chequeo | El silencio que rompe |
| --- | --- |
| Disco | 40 GB que Hetzner **no deja achicar** (§3.5) |
| Contenedores | Si la API queda `unhealthy`, nginx sigue en pie devolviendo 502 |
| Backups | El cron horario de backup escribe a un log que nadie lee: 24 chances diarias de fallar |
| Certificado | Vence el 2026-11-30; si la renovación falla, el sitio cae sin aviso previo |
| `/api/health` | Exige el **cuerpo**, no el código — un 200 con la base caída sería el mismo fail-open que corrigió `HealthService` (§3.6) |
| Truncados de LLM | Un sub-agente que trunca degrada la decisión sin ningún error — así se coló `FIX-e-burgos-014` (§3.1/§3.6) |

**El aviso va a la tabla `Notification` de la propia plataforma**, tipo nuevo `INFRA_ALERT`, con su
evento WebSocket — agregar un servicio externo sumaría un punto de falla justo cuando algo está roto.
`INFRA_ALERT` es un tipo propio y no `AGENT_ERROR`: *"mi bot falló"* y *"el servidor se queda sin
disco"* son urgencias distintas que el operador tiene que poder distinguir. Con esto son tres crons:
backup horario, renovación del certificado dos veces al día, y este.

El chequeo **no mide uso de memoria de Redis** — con `noeviction` (§3.5) un Redis lleno falla las
escrituras en vez de descartar jobs, que es lo buscado, pero no se ve venir. La ventana entre que
algo cae y las 08:00 UTC no está cubierta por ningún monitor externo; un uptime check gratuito
contra `/api/health` cerraría el hueco (mejora, no requisito).

## 4. Convenciones propias

- Controladores solo reciben/delegan/responden; la lógica de negocio vive en Services. Errores vía `HttpException`.
- DTOs con `class-validator` + `class-transformer`. Migraciones solo vía `prisma migrate dev`/`deploy`; cuando no hay BD disponible se escribe el SQL aditivo a mano y se registra en `sdd/schema.json`.
- Claves de usuario (Binance/LLM/News) cifradas AES-256-GCM; modo Sandbox enforced server-side.
- Correr: `pnpm dev:api` (necesita `pnpm docker:infra`). Tests: `pnpm nx test api` (Jest).
- Wiring de módulos vigente y unidireccional: `AgentConfigModule → LlmModule`, `TradingModule → EvaluationModule`, `TradingModule → AgentDomainModule`. El `eslint-disable @nx/enforce-module-boundaries` vive en `agent-config-resolver.service.ts`.
- **`ValidationPipe` global con `forbidNonWhitelisted: true`:** un campo nuevo de `TradingConfig` que no esté declarado en `CreateTradingConfigDto` **y** `UpdateTradingConfigDto` hace que el request entero responda 400 — no que el campo se ignore.
- **Los getters de `PrismaService` son 1:1 con los modelos:** dropear un modelo sin borrar su getter (o agregarlo sin declararlo) rompe el build.
- Todo interruptor de comportamiento de trading nace **apagado** en la migración: una instalación existente que despliegue sin tocar su config debe producir exactamente las mismas órdenes que antes.
- **`main.ts` llama `app.enableShutdownHooks()`** — es **prerrequisito** de los `OnApplicationShutdown` de `src/reactive/`. Sin esa línea Nest nunca los invoca y los timers/leases quedan colgados.
- `src/testing/source-scanner.ts` + `forbidden-symbols.spec.ts`: guard estático que falla el build si reaparecen `isFalseConcentrationBlock` o el cast `as unknown as AgentId` en `apps/api`/`libs/`.
- Controllers que tipan `@Body()` con object types inline (ej. `DataSourcesController`) **no** pasan por el `ValidationPipe` global — `toValidate` saltea el metatype `Object`. Migrar a DTO classes antes de confiar en `whitelist`/`forbidNonWhitelisted` ahí.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
