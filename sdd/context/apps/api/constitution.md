# Constitución — apps/api

> Versión 1.3 | Última actualización: cycle-01 | Fecha: 2026-08-19
> Fragmentos consolidados: spec-e-burgos-001 cycle-03 (2026-08-18) + spec-e-burgos-004 cycle-01 (2026-08-19)

## 1. Propósito

- **Tipo:** app
- **Rol en el sistema:** Backend NestJS de la plataforma: autenticación JWT, gestión de usuarios y claves cifradas, ciclo de vida del agente de trading, análisis LLM, mercado, notificaciones, analytics, chat IA y administración.

## 2. Stack tecnológico

- **NestJS 11** (HTTP + DI + módulos), **Prisma 7** + **PostgreSQL 16**, **Redis 7** (cache + pub/sub), **Bull 4** (colas de análisis/órdenes/noticias/evaluación), **Socket.io 4** (gateway WebSocket), **Passport + JWT** (access 15min + refresh rotation), **bcrypt**, **class-validator**.
- Build: `@swc-node/register` en dev, Webpack en producción. Deploy: Railway (Dockerfile en `apps/api/Dockerfile`).

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
| `aegisVerdictSchema` (`src/orchestrator/dto/`) | **Única** lectura del verdict de AEGIS: `blockReasons: AegisBlockReason[]` tipado (zod, un `.catch()` por campo para degradar a neutro ante payload parcial). `isOverridableBlock` es **fail-closed**: sin `blockReasons`, con array vacío o con cualquier motivo fuera del conjunto anulable, el BLOCK se respeta. El regex `isFalseConcentrationBlock` sobre `reason` fue eliminado y **no se reintroduce**.            |
| `ReconciliationService` (`src/trading/`)     | **Única** puerta de sincronización con el exchange; corre como paso previo a toda decisión del ciclo (antes del health check del LLM), solo en LIVE/TESTNET. Idempotente por **transición condicional** (`updateMany` con `status: 'OPEN'` esperado + guard `claimed.count === 0`), nunca por conteo de trades. Barre OCO zombie por `clientOrderId` con prefijo `prot-`, preservando antes las `PROTECTED` de otras configs del mismo usuario/símbolo. |
| `DecisionGateService` (`src/orchestrator/decision-gate.service.ts`) | **Único** gate determinista pre-LLM: resuelve HOLD sin llamar al LLM cuando las 5 condiciones de "sin señal" se cumplen a la vez, persistiendo una `AgentDecision` con `llmCostUsd = 0`. **Fail-closed**: reconciliación no confirmada, indicadores incompletos/stale, sin decisión previa o sin snapshot en la previa → llama al LLM. Nace apagado (`deterministicGateEnabled` default `false`). |
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

## 4. Convenciones propias

- Controladores solo reciben/delegan/responden; la lógica de negocio vive en Services. Errores vía `HttpException`.
- DTOs con `class-validator` + `class-transformer`. Migraciones solo vía `prisma migrate dev`/`deploy`; cuando no hay BD disponible se escribe el SQL aditivo a mano y se registra en `sdd/schema.json`.
- Claves de usuario (Binance/LLM/News) cifradas AES-256-GCM; modo Sandbox enforced server-side.
- Correr: `pnpm dev:api` (necesita `pnpm docker:infra`). Tests: `pnpm nx test api` (Jest).
- Wiring de módulos vigente y unidireccional: `AgentConfigModule → LlmModule`, `TradingModule → EvaluationModule`, `TradingModule → AgentDomainModule`. El `eslint-disable @nx/enforce-module-boundaries` vive en `agent-config-resolver.service.ts`.
- **`ValidationPipe` global con `forbidNonWhitelisted: true`:** un campo nuevo de `TradingConfig` que no esté declarado en `CreateTradingConfigDto` **y** `UpdateTradingConfigDto` hace que el request entero responda 400 — no que el campo se ignore.
- **Los getters de `PrismaService` son 1:1 con los modelos:** dropear un modelo sin borrar su getter (o agregarlo sin declararlo) rompe el build.
- Todo interruptor de comportamiento de trading nace **apagado** en la migración: una instalación existente que despliegue sin tocar su config debe producir exactamente las mismas órdenes que antes.
- `src/testing/source-scanner.ts` + `forbidden-symbols.spec.ts`: guard estático que falla el build si reaparecen `isFalseConcentrationBlock` o el cast `as unknown as AgentId` en `apps/api`/`libs/`.
- Controllers que tipan `@Body()` con object types inline (ej. `DataSourcesController`) **no** pasan por el `ValidationPipe` global — `toValidate` saltea el metatype `Object`. Migrar a DTO classes antes de confiar en `whitelist`/`forbidNonWhitelisted` ahí.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
