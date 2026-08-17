# Constitución — apps/api

> Versión 1.1 | Última actualización: cycle-01 | Fecha: 2026-08-17

## 1. Propósito

- **Tipo:** app
- **Rol en el sistema:** Backend NestJS de la plataforma: autenticación JWT, gestión de usuarios y claves cifradas, ciclo de vida del agente de trading, análisis LLM, mercado, notificaciones, analytics, chat IA y administración.

## 2. Stack tecnológico

- **NestJS 11** (HTTP + DI + módulos), **Prisma 7** + **PostgreSQL 16**, **Redis 7** (cache + pub/sub), **Bull 4** (colas de análisis/órdenes/noticias/evaluación), **Socket.io 4** (gateway WebSocket), **Passport + JWT** (access 15min + refresh rotation), **bcrypt**, **class-validator**.
- Build: `@swc-node/register` en dev, Webpack en producción. Deploy: Railway (Dockerfile en `apps/api/Dockerfile`).

## 3. Estructura y patrones

- Un módulo NestJS por dominio en `apps/api/src/`: auth, users, trading, analysis, llm, orchestrator, openrouter, market, notifications, analytics, admin, chat, agents (AgentConfigModule, AgentDomainModule, EvaluationModule).
- Pipeline del agente: Bull job → data-fetcher (OHLCV) → analysis (indicadores) → noticias → AgentConfigResolver → LLM → trading-engine (si confidence ≥ threshold) → DB + WebSocket.
- Depende de `libs/`: shared, analysis, data-fetcher, trading-engine, openrouter, providers.

### 3.1 Piezas de una sola puerta (no razonar su lógica en otro archivo)

| Pieza                                        | Regla                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/agents/agent-identity.ts`               | **Único** archivo que conoce el mapeo identidad↔slot: `PERSONA_AGENT_IDS`/`PersonaAgentId` (6, con `AgentDefinition`), `MODEL_SLOT_IDS`/`ModelSlotId` (7, configurables), `resolveModelSlot`, `isPersonaAgent`, `isModelSlot`. El enum Prisma `AgentId` tiene 8 valores porque son 6 personas ∪ 7 slots — **no se migra** (architect cycle-01 §7). |
| `AgentConfigResolverService.resolveClient()` | **Única** puerta para obtener un cliente LLM de agente. Cascada `override → user → admin → preset → primera credencial activa`, `NoLLMCredentialError` si nada resuelve. Incluye `assertProviderActive` + `decrypt` + construcción del cliente.                                                                                    |
| `AgentPromptService`                         | **Única** fuente de system prompts (tabla `AgentDefinition`). Caché TTL 60 s + `invalidate(agentId)` desde `AdminAgentsService`. **Fail-fast en `onModuleInit`**: si falta alguno de los 6 `AgentDefinition` (inactivo o prompt vacío) la app no arranca → `pnpm db:seed` es parte del bootstrap de dev, CI y e2e.                |
| `ModelPricingService`                        | Cascada de tarifa `LIVE_OPENROUTER → STALE_CACHE (last-good en memoria) → STATIC_TABLE (MODEL_PRICING) → UNPRICED`. **Nunca lanza.** Tarifa contra `actualModel ?? model`. `MODEL_PRICING` sirve a los 6 proveedores directos; no se le agregan entradas OpenRouter.                                                              |
| `src/agents/domain/` (`AgentDomainModule`)   | `RiskBudgetService` y `PortfolioContextService`: dominio puro sobre Prisma, sin contrato de tool ni LLM. **Registrado en `AppModule` y todavía sin inyectores — andamio deliberado para el cycle-02, no código muerto nuevo.**                                                                                                     |

### 3.2 Evaluación de decisiones

- `AgentOutcomeStatus` incluye `NOT_EVALUABLE` (horizonte vencido sin precio de mercado). `PENDING` y `NOT_EVALUABLE` quedan **excluidos** del win rate y se exponen aparte como `pendingCount`/`notEvaluableCount` en `/agents/scorecard` y `/agents/scorecard/summary`. `cleanup()` manda las `PENDING` de más de 48 h a `NOT_EVALUABLE`.
- Cola `agent-evaluation`: `evaluate` (delayed, `jobId: eval:{decisionId}:{horizon}`), `schedule-evaluations` (repetible `*/15 * * * *`, red de seguridad si Redis pierde los delayed) y `cleanup` (repetible `30 3 * * *`). Los repetibles se registran en `EvaluationService.onModuleInit` con `jobId` fijo + `removeRepeatable` previo, para que N réplicas no multipliquen el sweep.
- `scheduleEvaluation` se llama **siempre fire-and-forget con `.catch`**: la telemetría nunca puede tumbar el ciclo de trading.

## 4. Convenciones propias

- Controladores solo reciben/delegan/responden; la lógica de negocio vive en Services. Errores vía `HttpException`.
- DTOs con `class-validator` + `class-transformer`. Migraciones solo vía `prisma migrate dev`/`deploy`; cuando no hay BD disponible se escribe el SQL aditivo a mano y se registra en `sdd/schema.json`.
- Claves de usuario (Binance/LLM/News) cifradas AES-256-GCM; modo Sandbox enforced server-side.
- Correr: `pnpm dev:api` (necesita `pnpm docker:infra`). Tests: `pnpm nx test api` (Jest).
- Wiring de módulos vigente y unidireccional: `AgentConfigModule → LlmModule`, `TradingModule → EvaluationModule`. El `eslint-disable @nx/enforce-module-boundaries` vive en `agent-config-resolver.service.ts`.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
