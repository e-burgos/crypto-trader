# Context Prompt — apps/api

> Entry point para agentes que trabajen sobre `apps/api`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-01 | Fecha: 2026-08-19
> Fragmentos consolidados: spec-e-burgos-001 cycle-03 (2026-08-18) + spec-e-burgos-004 cycle-01 (2026-08-19)

- **Tipo:** app
- **Estado:** proyecto pre-existente adoptado por el arnés SDD. **spec-e-burgos-001 cerrada (3 ciclos)** + **spec-e-burgos-004 cycle-01 completado**.
  - **cycle-01 — poda y observabilidad de costo.** El núcleo de agentes quedó con una sola ruta viva: se eliminaron `src/agents/tools/` completo (6 tools + registry + interface + module), `context-planner.service.ts`, `model-router.service.ts` y `buildNewsAggregator_unused()`; diff neto −610 líneas en `src/agents` + `src/orchestrator`. Costo LLM, evaluación de decisiones y system prompts quedaron cerrados (ver `constitution.md` §3.1-3.2).
  - **cycle-02 — venta inteligente y gestión activa de riesgo.** El análisis que el sistema ya pagaba ahora determina cuánto se compra, cuándo se corta una pérdida y cuánto riesgo agregado se acepta: política de SELL, sizing modulado, órdenes nativas SL/TP/OCO con reconciliación, trailing/parciales/salida por tiempo, riesgo agregado por usuario y FK `Trade.decisionId`. 16 tasks, 5 migraciones SQL escritas a mano, 391 tests en verde. **Invariante verificable en el SQL:** los 6 interruptores nuevos (`lossCutEnabled`, `smartSizingEnabled`, `nativeProtectionEnabled`, `trailingStopEnabled`, `partialTpEnabled`, `maxPositionHoldMinutes`) nacen apagados y `user_risk_policies` nace sin fila. Se dropearon las tablas huérfanas `agent_tool_invocations` (+ enum `AgentToolName`) y `agent_model_policies` en migración dedicada y separable (reverse SQL en `cycles/cycle-02/architect.md` §11.3).
  - **cycle-03 — cierre de spec-001, reducción de costo LLM.** Gate determinista pre-LLM (apagado por default), `AgentDecision.llmCostUsd` con escritor real (resuelve el hallazgo C — el dashboard ya no reporta ~$0), re-arme de la OCO nativa (cierra la degradación a polling que dejó cycle-02), caché de señales compartido entre bots/usuarios (`SHARED_SIGNAL_CACHE_ENABLED`), harness determinista del −50 % de costo dentro de `nx test api`, y guard estático anti-regresión (`forbidden-symbols.spec.ts`). `EP-008 GET /trading/positions` pasó a `implemented`.
  - **spec-e-burgos-004 cycle-01 — credenciales de fuentes externas por cascada.** `DataSourceCredentialResolver` reemplaza la dependencia de que un admin cargue una fila por trader: `trader propia → admin shared:true → ninguna`, único lugar con esa lógica. `DataSourceRegistryService.fetchFromProvider` llavea caché/rate-limiter/circuit-breaker por `(fuente, dueño de credencial)`; salud en BD y métricas siguen por nombre de fuente.
- Módulos clave: auth, users, trading, analysis, llm, orchestrator, openrouter, market, notifications, analytics, admin, chat, agents.
- Cómo correr: `pnpm docker:infra && pnpm dev:api` (localhost:3000). Testear: `pnpm nx test api`; integración: `pnpm nx e2e api-e2e`. **`pnpm db:seed` es obligatorio en cualquier entorno nuevo** — sin los 6 `AgentDefinition` la app no arranca.
- Schema Prisma en `apps/api/prisma/schema.prisma` — modelos principales: User, BinanceCredential, LLMCredential, TradingConfig, Position, Trade, AgentDecision, Notification, ChatSession/ChatMessage, AgentConfig, PlatformLLMProvider, SandboxWallet.
- Eventos WebSocket: `trade:executed`, `position:updated`, `agent:decision`, `price:tick`, `notification:new`.
- Consume `libs/trading-engine` para `simulateTrade` y `getKlines(..., range)` de `libs/data-fetcher` desde `MarketService.getPriceAt()`.

- Identidad de agentes unificada: existe una sola estructura `ResolvedAgentModel` y `toAgentId(slot)` en `agent-identity.ts` es la única puerta de conversión — no queda ningún `as unknown as AgentId` en el árbol.

## Qué sigue

- **`executeLLMSell` conserva su `$transaction` de wallet SANDBOX inline** — `creditSandboxWallet` ya se usa en los otros dos sitios (post-BUY, re-arme, venta parcial). Las aserciones por *string-matching* de `trading.processor.isolation.spec.ts` cortan un rango de texto que hoy también contiene `creditSandboxWallet`/`executePartialTakeProfit`/`closePositionAtMarket`, así que ya no prueban solo lo que su nombre dice. Unificar el tercer sitio y reescribir esas aserciones van juntos.
- **`getOrComputeNews` existe pero no está cableado** en `orchestrator.service.ts` (bloque ~152-187 byte-idéntico a propósito): cablearlo requiere decidir la huella `newsFingerprint` de contenido. Es capacidad instalada, no comportamiento activo.
- **Fail-open de AEGIS al degradar:** una pierna de sub-agente truncada entra a la síntesis como `'{}'`, y `parseAegisVerdict('{}')` cae por `.catch()` a `verdict: 'PASS'`. Pre-existente, pero `max_tokens: 350` en `risk_gate` vuelve el truncado más realista. Evaluar un verdict explícito de "no evaluado" que no habilite operar.
- **`DataSourcesController` y otros controllers con `@Body()` tipado inline no pasan por el `ValidationPipe` global** (ver `constitution.md` §4) — migrar a DTO classes es deuda abierta.
- Los 17 campos nuevos de `TradingConfig` y la política de riesgo agregado (EP-004/EP-005) solo se pueden configurar por API — sin UI.
- Quedan 2 enumeraciones de `agentId` fuera de `agent-identity.ts` (`orchestrator/dto/intent-classification.dto.ts` y `chat.service.ts`): son listas de "agentes enrutables desde chat", concepto distinto del mapeo identidad↔slot. Unificar solo si se les da nombre propio.
