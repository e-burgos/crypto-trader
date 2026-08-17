# spec-e-burgos-001 cycle-01 — 2026-08-17

## Estado

El núcleo de agentes queda con **una sola ruta viva**. Se eliminaron los subsistemas registrados en
DI que ningún caller invocaba: `src/agents/tools/` completo (6 tools + `agent-tool-registry.ts` +
`agent-tool.interface.ts` + `agent-tools.module.ts`), `src/agents/tools/context-planner.service.ts`,
`src/agents/model-router.service.ts` y el método muerto `buildNewsAggregator_unused()` de
`trading.processor.ts`. Diff neto en `src/agents` + `src/orchestrator`: **−610 líneas**.

Tres subsistemas que estaban a medio cablear quedaron cerrados:

- **Costo LLM.** `LLMUsageService.log()` ya no resuelve contra `model-pricing.ts` estático: usa
  `ModelPricingService` y persiste el origen de la tarifa. El dashboard de costos deja de reportar
  $0 indistinguible para el tráfico OpenRouter.
- **Evaluación de decisiones.** `scheduleEvaluation()` ahora se dispara al persistir cada
  `AgentDecision` y la evaluación se resuelve contra precio real de mercado. `/agents/scorecard`
  deja de devolver ceros por falta de disparador.
- **System prompts.** `AgentDefinition` (BD) es la única fuente. El hardcode `AGENT_SYSTEM_PROMPTS`
  (~295 líneas) y el fallback silencioso de `resolveSystemPrompt` ya no existen.

`resuelve: context_prompt.md §"Qué sigue"` en lo referido a código muerto en `src/agents` y a la
duplicación de resolución provider/modelo.

## Estructura

**Patrones nuevos que todo agente que toque `apps/api` debe conocer:**

| Pieza                                          | Regla                                                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/agents/agent-identity.ts`                 | **Único** archivo que conoce el mapeo identidad↔slot. `PERSONA_AGENT_IDS`/`PersonaAgentId` (6, tienen `AgentDefinition`), `MODEL_SLOT_IDS`/`ModelSlotId` (7, configurables), `resolveModelSlot`, `isPersonaAgent`, `isModelSlot`. El enum Prisma `AgentId` tiene 8 valores porque son 6 personas ∪ 7 slots — no se migra (architect cycle-01 §7). **No razonar el mapeo en otro archivo.** |
| `AgentConfigResolverService.resolveClient()`   | **Única** puerta para obtener un cliente LLM de agente. Cascada completa: `override → user → admin → preset → primera credencial activa`, y `NoLLMCredentialError` si nada resuelve. Incluye `assertProviderActive` + `decrypt` + construcción del cliente. `SubAgentService.getProvider` fue borrado; `OrchestratorService` inyecta el resolver directamente. |
| `AgentPromptService`                           | **Única** fuente de system prompts. Caché TTL 60 s + `invalidate(agentId)` que llama `AdminAgentsService` al editar. **Fail-fast en `onModuleInit`**: si falta alguno de los 6 `AgentDefinition` (o está inactivo, o su prompt está vacío) la app **no arranca**. **Consecuencia operativa: `pnpm db:seed` es parte del bootstrap de cualquier entorno nuevo — dev, CI y e2e.** |
| `ModelPricingService`                          | Cascada de tarifa: `LIVE_OPENROUTER → STALE_CACHE (last-good en memoria, sin expiración) → STATIC_TABLE (MODEL_PRICING) → UNPRICED`. **Nunca lanza.** Tarifa contra `actualModel ?? model` (OpenRouter puede servir un fallback). `MODEL_PRICING` sigue vivo para los 6 proveedores directos; no se le agregan entradas OpenRouter. |
| `src/agents/domain/` (`AgentDomainModule`)     | `RiskBudgetService` y `PortfolioContextService`: lógica de dominio pura sobre Prisma, sin contrato de tool ni LLM. **Registrado en `AppModule` pero todavía sin inyectores — es andamio deliberado para el cycle-02, no código muerto nuevo.** |

**Semántica de evaluación:** `AgentOutcomeStatus` suma `NOT_EVALUABLE` (horizonte vencido sin precio
de mercado). `PENDING` y `NOT_EVALUABLE` quedan **excluidos** del win rate y se exponen aparte como
`pendingCount`/`notEvaluableCount` en `/agents/scorecard` y `/agents/scorecard/summary`.
`cleanup()` manda las `PENDING` de más de 48 h a `NOT_EVALUABLE`, ya no a `NEUTRAL`.

**Jobs de la cola `agent-evaluation`:** `evaluate` (delayed, `jobId: eval:{decisionId}:{horizon}`),
`schedule-evaluations` (repetible `*/15 * * * *`, red de seguridad si Redis pierde los delayed) y
`cleanup` (repetible `30 3 * * *`). Los dos repetibles se registran en
`EvaluationService.onModuleInit` con `jobId` fijo + `removeRepeatable` previo, para que N réplicas
no multipliquen el sweep. Llamar `scheduleEvaluation` siempre fire-and-forget con `.catch`: la
telemetría nunca puede tumbar el ciclo de trading.

**Migraciones del ciclo (2, aditivas, sin backfill):**
`20260817120000_add_llm_usage_pricing_source` (enum `PricingSource` + columna nullable
`LlmUsageLog.pricingSource`) y `20260817130000_add_not_evaluable_and_evaluation_unique`
(`NOT_EVALUABLE` + `@@unique([decisionId, horizonMinutes])`).

**Wiring de módulos nuevo:** `AgentConfigModule → LlmModule` (para `PlatformLLMProviderService`) y
`TradingModule → EvaluationModule`. Ambas unidireccionales; el `eslint-disable
@nx/enforce-module-boundaries` que vivía en `sub-agent.service.ts` se mudó a
`agent-config-resolver.service.ts`.

## Dependencias

Sin librerías nuevas. `apps/api` pasa a depender de `libs/trading-engine` para `simulateTrade` y
consume `getKlines(..., range)` de `libs/data-fetcher` desde `MarketService.getPriceAt()`.

## Qué sigue

- **Tablas huérfanas, deliberadamente no dropeadas:** `agent_tool_invocations` (+ enum
  `AgentToolName`) y `agent_model_policies` quedaron sin escritores tras la poda. Su destino es
  decisión del cycle-02/03, con migración propia — no borrarlas por estética de diff.
- El cycle-02 debe **cablear** `RiskBudgetService`, `PortfolioContextService` y `simulateTrade` al
  camino real de ejecución (`TradingProcessor`/`OrderExecutor`). Hasta entonces siguen sin
  inyectores por diseño.
- Pendiente: fusionar `ResolvedAgentConfig` y `ResolvedAgentClient` y eliminar el cast
  `as unknown as AgentId` en el borde `resolveClient → resolveConfig`, migrando
  `agent-config.controller.ts`, `admin-agent-config.controller.ts` y `market.service.ts` al
  vocabulario `ModelSlotId`.
- Pendiente: `EvaluationProcessor.evaluate` hace check-then-create sobre el UNIQUE; capturar `P2002`
  para que la colisión concurrente sea un no-op explícito y no un job fallido.
- Quedan 2 enumeraciones de `agentId` fuera de `agent-identity.ts`
  (`orchestrator/dto/intent-classification.dto.ts` y `chat.service.ts`): son listas de "agentes
  enrutables desde chat", concepto distinto del mapeo identidad↔slot. Unificar solo si se les da
  nombre propio.
- Comportamiento de trading **sin cambios** en este ciclo (sizing, SELL, SL/TP, umbrales): es el
  alcance del cycle-02.
