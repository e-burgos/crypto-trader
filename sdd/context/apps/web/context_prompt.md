# Context Prompt — apps/web

> Entry point para agentes que trabajen sobre `apps/web`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.

- **Tipo:** app
- **Estado:** proyecto pre-existente adoptado por el arnés SDD — sin ciclos SDD completados todavía.
- Páginas del dashboard: overview, chart, positions, bot-analysis, news, config, settings, notifications, analytics, help, admin (solo ADMIN).
- Cómo correr: `pnpm dev:web` (Vite en localhost:4200, requiere API en localhost:3000). Testear: `pnpm nx test web`.
- Env vars: `VITE_API_URL`, `VITE_WS_URL`.
- Componentes UI stateless se importan del design system `@crypto-trader/ui` (`libs/ui`) — nunca crear primitives locales duplicados.
