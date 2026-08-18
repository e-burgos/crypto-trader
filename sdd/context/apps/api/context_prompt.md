# Context Prompt — apps/api

> Entry point para agentes que trabajen sobre `apps/api`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-02 | Fecha: 2026-08-17

- **Tipo:** app
- **Estado:** proyecto pre-existente adoptado por el arnés SDD. **2 ciclos SDD completados** (spec-e-burgos-001).
  - **cycle-01 — poda y observabilidad de costo.** El núcleo de agentes quedó con una sola ruta viva: se eliminaron `src/agents/tools/` completo (6 tools + registry + interface + module), `context-planner.service.ts`, `model-router.service.ts` y `buildNewsAggregator_unused()`; diff neto −610 líneas en `src/agents` + `src/orchestrator`. Costo LLM, evaluación de decisiones y system prompts quedaron cerrados (ver `constitution.md` §3.1-3.2).
  - **cycle-02 — venta inteligente y gestión activa de riesgo.** El análisis que el sistema ya pagaba ahora determina cuánto se compra, cuándo se corta una pérdida y cuánto riesgo agregado se acepta: política de SELL, sizing modulado, órdenes nativas SL/TP/OCO con reconciliación, trailing/parciales/salida por tiempo, riesgo agregado por usuario y FK `Trade.decisionId`. 16 tasks, 5 migraciones SQL escritas a mano, 391 tests en verde. **Invariante verificable en el SQL:** los 6 interruptores nuevos (`lossCutEnabled`, `smartSizingEnabled`, `nativeProtectionEnabled`, `trailingStopEnabled`, `partialTpEnabled`, `maxPositionHoldMinutes`) nacen apagados y `user_risk_policies` nace sin fila. Se dropearon las tablas huérfanas `agent_tool_invocations` (+ enum `AgentToolName`) y `agent_model_policies` en migración dedicada y separable (reverse SQL en `cycles/cycle-02/architect.md` §11.3).
- Módulos clave: auth, users, trading, analysis, llm, orchestrator, openrouter, market, notifications, analytics, admin, chat, agents.
- Cómo correr: `pnpm docker:infra && pnpm dev:api` (localhost:3000). Testear: `pnpm nx test api`; integración: `pnpm nx e2e api-e2e`. **`pnpm db:seed` es obligatorio en cualquier entorno nuevo** — sin los 6 `AgentDefinition` la app no arranca.
- Schema Prisma en `apps/api/prisma/schema.prisma` — modelos principales: User, BinanceCredential, LLMCredential, TradingConfig, Position, Trade, AgentDecision, Notification, ChatSession/ChatMessage, AgentConfig, PlatformLLMProvider, SandboxWallet.
- Eventos WebSocket: `trade:executed`, `position:updated`, `agent:decision`, `price:tick`, `notification:new`.
- Consume `libs/trading-engine` para `simulateTrade` y `getKlines(..., range)` de `libs/data-fetcher` desde `MarketService.getPriceAt()`.

- Identidad de agentes unificada: existe una sola estructura `ResolvedAgentModel` y `toAgentId(slot)` en `agent-identity.ts` es la única puerta de conversión — no queda ningún `as unknown as AgentId` en el árbol.

## Qué sigue

- ⚠️ **`apps/web` quedó desalineado con el wire de `/users/me/agents/config` y `/users/me/agents/health` — prerrequisito de deploy, no un nice-to-have.** La fusión en `ResolvedAgentModel` renombró `agentId` → `slot` y el valor `source: 'fallback'` → `'preset'` (union completo: `'override' | 'user' | 'admin' | 'preset' | 'credential'`). `apps/web` sigue leyendo `config.agentId` en `pages/dashboard/settings/agents.tsx` y tipándolo en `hooks/use-agent-config.ts`: nombres de agente vacíos, filtros `'risk'`/`'routing'` que no matchean y guardado que dispara `PUT /users/me/agents/undefined/config`. El typecheck no lo detecta porque el front declara su propia interfaz del response.
- **Con `nativeProtectionEnabled` + (`trailingStopEnabled` | `partialTpEnabled`) simultáneos, la posición degrada a protección por polling:** no se re-arma la OCO cuando el trailing o el breakeven mueven el stop. Es seguro (`checkOpenPositions` cancela la OCO obsoleta y cierra a mercado en el stop trailed local, con latencia de un ciclo), pero la OCO viva conserva el **take-profit original** y puede llenar el TP fijo que la máquina local da por deshabilitado durante el trailing. Ambos flags nacen apagados.
- **`GET /trading/positions` (EP-008) no expone los campos nuevos de `Position`** (`protectionStatus`, `stopPrice`, `takeProfitPrice`, `highWaterPrice`, `trailingActive`, `initialQuantity`, `partialExitCount`, `realizedPnl`, `exitReason`): el `select` de `TradingService.getPositions` no se extendió. Sin esto la UI no puede mostrar una posición desprotegida ni el estado del trailing.
- **No hay guard automatizado que impida reintroducir `isFalseConcentrationBlock` ni `as unknown as AgentId`.** Hoy están ausentes y se verificó por grep; el repo ya tiene el patrón (`readFileSync` sobre el fuente en `trading.processor.isolation.spec.ts`) para escribirlo en una línea.
- `checkOpenPositions` sigue con `closeAtMarket` y el crédito de wallet SANDBOX inline: dos specs de regresión hacen *string-matching* sobre el rango de texto fuente entre `private async checkOpenPositions` y `private parseSymbolForSandbox`. **Antes de refactorizar ese método hay que reescribir esas dos aserciones.**
- Los 17 campos nuevos de `TradingConfig` y la política de riesgo agregado (EP-004/EP-005) solo se pueden configurar por API — sin UI.
- Quedan 2 enumeraciones de `agentId` fuera de `agent-identity.ts` (`orchestrator/dto/intent-classification.dto.ts` y `chat.service.ts`): son listas de "agentes enrutables desde chat", concepto distinto del mapeo identidad↔slot. Unificar solo si se les da nombre propio.
