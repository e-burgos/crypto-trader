# Context Prompt — apps/api

> Entry point para agentes que trabajen sobre `apps/api`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-01 | Fecha: 2026-08-17

- **Tipo:** app
- **Estado:** proyecto pre-existente adoptado por el arnés SDD. **1 ciclo SDD completado** (spec-e-burgos-001 cycle-01 — poda y observabilidad de costo). El núcleo de agentes quedó con una sola ruta viva: se eliminaron `src/agents/tools/` completo (6 tools + registry + interface + module), `context-planner.service.ts`, `model-router.service.ts` y `buildNewsAggregator_unused()`; diff neto −610 líneas en `src/agents` + `src/orchestrator`. Costo LLM, evaluación de decisiones y system prompts quedaron cerrados (ver `constitution.md` §3.1-3.2).
- Módulos clave: auth, users, trading, analysis, llm, orchestrator, openrouter, market, notifications, analytics, admin, chat, agents.
- Cómo correr: `pnpm docker:infra && pnpm dev:api` (localhost:3000). Testear: `pnpm nx test api`; integración: `pnpm nx e2e api-e2e`. **`pnpm db:seed` es obligatorio en cualquier entorno nuevo** — sin los 6 `AgentDefinition` la app no arranca.
- Schema Prisma en `apps/api/prisma/schema.prisma` — modelos principales: User, BinanceCredential, LLMCredential, TradingConfig, Position, Trade, AgentDecision, Notification, ChatSession/ChatMessage, AgentConfig, PlatformLLMProvider, SandboxWallet.
- Eventos WebSocket: `trade:executed`, `position:updated`, `agent:decision`, `price:tick`, `notification:new`.
- Consume `libs/trading-engine` para `simulateTrade` y `getKlines(..., range)` de `libs/data-fetcher` desde `MarketService.getPriceAt()`.

## Qué sigue

- **Cycle-02 (en curso): venta inteligente y gestión activa de riesgo.** Cablear `RiskBudgetService`, `PortfolioContextService` y `simulateTrade` al camino real de ejecución (`TradingProcessor`/`OrderExecutor`) — hasta entonces siguen sin inyectores por diseño. Política de SELL en pérdida, sizing modulado, verdict `REDUCE`, órdenes nativas SL/TP, trailing/parciales, límites agregados, FK `Trade.decisionId`.
- **Tablas huérfanas, deliberadamente no dropeadas:** `agent_tool_invocations` (+ enum `AgentToolName`) y `agent_model_policies` quedaron sin escritores tras la poda. Su destino se decide en cycle-02/03, con migración propia — no borrarlas por estética de diff.
- Pendiente: fusionar `ResolvedAgentConfig` y `ResolvedAgentClient` y eliminar el cast `as unknown as AgentId` en el borde `resolveClient → resolveConfig`, migrando `agent-config.controller.ts`, `admin-agent-config.controller.ts` y `market.service.ts` al vocabulario `ModelSlotId`.
- Pendiente: `EvaluationProcessor.evaluate` hace check-then-create sobre el UNIQUE `(decisionId, horizonMinutes)`; capturar `P2002` para que la colisión concurrente sea un no-op explícito y no un job fallido.
- Quedan 2 enumeraciones de `agentId` fuera de `agent-identity.ts` (`orchestrator/dto/intent-classification.dto.ts` y `chat.service.ts`): son listas de "agentes enrutables desde chat", concepto distinto del mapeo identidad↔slot. Unificar solo si se les da nombre propio.
