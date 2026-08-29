# Context Prompt — apps/web

> Entry point para agentes que trabajen sobre `apps/web`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-01 | Fecha: 2026-08-19
> Fragmentos consolidados: spec-e-burgos-001 cycle-03 (2026-08-18) + spec-e-burgos-004 cycle-01 (2026-08-19)

- **Tipo:** app
- **Estado:** proyecto pre-existente adoptado por el arnés SDD. **2 ciclos SDD completados** — primer trabajo real en `apps/web` dentro del arnés.
  - **spec-e-burgos-001 cycle-03** — cerró el deploy-blocker heredado de cycle-02 de `apps/api` (pantalla de configuración de agentes leía `config.agentId`/`'fallback'` contra un wire que ya usaba `slot`/`'preset'`; ver `constitution.md` §3). Sumó el panel de costo LLM por bot/día (`EP-009`) en analytics.
  - **spec-e-burgos-004 cycle-01** — el trader gestiona sus propias API keys de data sources desde `/dashboard/settings/data-sources` (categoría, salud y estado de acceso `Your key`/`Admin shared`/`No key`, derivado del servidor — la key nunca vuelve al cliente salvo los últimos 4 caracteres).
- Páginas del dashboard: overview, chart, positions, bot-analysis, news, config, settings (agents, data-sources), notifications, analytics, help, admin (solo ADMIN).
- Cómo correr: `pnpm dev:web` (Vite en localhost:4200, requiere API en localhost:3000). Testear: `pnpm nx test web`.
- Env vars: `VITE_API_URL`, `VITE_WS_URL`.
- Componentes UI stateless se importan del design system `@crypto-trader/ui` (`libs/ui`) — nunca crear primitives locales duplicados.

## Qué sigue

- Los 17 campos de `TradingConfig` y la política de riesgo agregado (EP-004/EP-005) siguen sin UI — solo por API.
- Backend expone columnas de estado de protección/trailing de posiciones (`EP-008`) sin presentación visual todavía.
- No hay UI de admin para el flag `shared` de credenciales de data sources — se setea por API (`PUT /admin/data-sources/:id/credential`). Tampoco distingue la pantalla de noticias credencial propia de compartida, aunque el backend ya resuelve la cascada para `NewsApiCredential`.
- Quedan referencias a `agentId` en los hooks de **admin** (`/admin/agent-configs`): es otro wire, no el de configuración de agentes del usuario — unificar solo si se toca.
