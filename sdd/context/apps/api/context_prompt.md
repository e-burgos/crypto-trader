# Context Prompt — apps/api

> Entry point para agentes que trabajen sobre `apps/api`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.

- **Tipo:** app
- **Estado:** proyecto pre-existente adoptado por el arnés SDD — sin ciclos SDD completados todavía.
- Módulos clave: auth, users, trading, analysis, llm, orchestrator, openrouter, market, notifications, analytics, admin, chat, agents.
- Cómo correr: `pnpm docker:infra && pnpm dev:api` (localhost:3000). Testear: `pnpm nx test api`; integración: `pnpm nx e2e api-e2e`.
- Schema Prisma en `apps/api/prisma/schema.prisma` — modelos principales: User, BinanceCredential, LLMCredential, TradingConfig, Position, Trade, AgentDecision, Notification, ChatSession/ChatMessage, AgentConfig, PlatformLLMProvider, SandboxWallet.
- Eventos WebSocket: `trade:executed`, `position:updated`, `agent:decision`, `price:tick`, `notification:new`.
