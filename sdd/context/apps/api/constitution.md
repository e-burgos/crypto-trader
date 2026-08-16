# Constitución — apps/api

> Versión 1.0 | Última actualización: cycle-0 (inicial)

## 1. Propósito

- **Tipo:** app
- **Rol en el sistema:** Backend NestJS de la plataforma: autenticación JWT, gestión de usuarios y claves cifradas, ciclo de vida del agente de trading, análisis LLM, mercado, notificaciones, analytics, chat IA y administración.

## 2. Stack tecnológico

- **NestJS 11** (HTTP + DI + módulos), **Prisma 7** + **PostgreSQL 16**, **Redis 7** (cache + pub/sub), **Bull 4** (colas de análisis/órdenes/noticias), **Socket.io 4** (gateway WebSocket), **Passport + JWT** (access 15min + refresh rotation), **bcrypt**, **class-validator**.
- Build: `@swc-node/register` en dev, Webpack en producción. Deploy: Railway (Dockerfile en `apps/api/Dockerfile`).

## 3. Estructura y patrones

- Un módulo NestJS por dominio en `apps/api/src/`: auth, users, trading, analysis, llm, orchestrator, openrouter, market, notifications, analytics, admin, chat, agents (AgentConfigModule).
- Pipeline del agente: Bull job → data-fetcher (OHLCV) → analysis (indicadores) → noticias → AgentConfigResolver → LLM → trading-engine (si confidence ≥ threshold) → DB + WebSocket.
- Depende de `libs/`: shared, analysis, data-fetcher, trading-engine, openrouter, providers.

## 4. Convenciones propias

- Controladores solo reciben/delegan/responden; la lógica de negocio vive en Services. Errores vía `HttpException`.
- DTOs con `class-validator` + `class-transformer`. Migraciones solo vía `prisma migrate dev`/`deploy`.
- Claves de usuario (Binance/LLM/News) cifradas AES-256-GCM; modo Sandbox enforced server-side.
- Correr: `pnpm dev:api` (necesita `pnpm docker:infra`). Tests: `pnpm nx test api` (Jest).

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
