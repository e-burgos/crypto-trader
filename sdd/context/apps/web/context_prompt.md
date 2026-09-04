# Context Prompt — apps/web

> Entry point para agentes que trabajen sobre `apps/web`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-02 | Fecha: 2026-09-04
> Fragmentos consolidados: spec-e-burgos-001 cycle-03 (2026-08-18) + spec-e-burgos-004 cycle-01 (2026-08-19) + spec-e-burgos-008 cycle-02 (2026-09-01) + spec-e-burgos-009 cycle-01 (2026-09-03) + spec-e-burgos-009 cycle-02 (2026-09-04)

- **Tipo:** app
- **Estado:** proyecto pre-existente adoptado por el arnés SDD. **5 ciclos SDD completados** (2 en spec-e-burgos-001/004 + 1 en spec-e-burgos-008 + 2 en spec-e-burgos-009).
  - **spec-e-burgos-001 cycle-03** — cerró el deploy-blocker heredado de cycle-02 de `apps/api` (pantalla de configuración de agentes leía `config.agentId`/`'fallback'` contra un wire que ya usaba `slot`/`'preset'`; ver `constitution.md` §3). Sumó el panel de costo LLM por bot/día (`EP-009`) en analytics.
  - **spec-e-burgos-004 cycle-01** — el trader gestiona sus propias API keys de data sources desde `/dashboard/settings/data-sources` (categoría, salud y estado de acceso `Your key`/`Admin shared`/`No key`, derivado del servidor — la key nunca vuelve al cliente salvo los últimos 4 caracteres).
  - **spec-e-burgos-008 cycle-02** — la SPA se sirve desde el mismo VPS que la API, mismo origen (ver `constitution.md` §3.1): se destapó y corrigió el doble significado de `VITE_API_URL` entre `use-websocket.ts` y el resto del código (el WS fallaba en silencio) y se arregló un `Dockerfile` roto que nunca se había construido en CI. Cloudflare Pages queda fuera del stack.
  - **spec-e-burgos-009 cycle-01** — configuración avanzada del agente: los 40 campos de `TradingConfig` en alta, edición y detalle, siempre apagados por defecto; el wire se importa de `@crypto-trader/shared` y la interfaz local desapareció (ver `constitution.md` §3.2). Destapó FIX-e-burgos-026 (el POST persistía 18 de 40 campos) y 027 (`isActive` en el PUT respondía 500).
  - **spec-e-burgos-009 cycle-02** — pestaña **Entradas** en Posiciones sobre EP-017 con la URL como fuente de verdad, tiempo real por los seis eventos `entry-order:*`, entrada RESTING en el detalle del agente y notificaciones enlazadas por un único `getNotificationRoute` (ver `constitution.md` §3.3). La spec 009 cerró con este ciclo.
- Páginas del dashboard: overview, chart, positions, bot-analysis, news, config, settings (agents, data-sources), notifications, analytics, help, admin (solo ADMIN).
- Cómo correr: `pnpm dev:web` (Vite en localhost:4200, requiere API en localhost:3000). Testear: `pnpm nx test web`.
- Env vars: `VITE_API_URL` (en producción, **relativo**: `/api`, para que el mismo origen funcione sin hardcodear el host — ver `constitution.md` §3.1), `VITE_WS_URL` (escape solo si el gateway WS vive en otro origen).
- Componentes UI stateless se importan del design system `@crypto-trader/ui` (`libs/ui`) — nunca crear primitives locales duplicados.

## Qué sigue

- **Cancelar una entrada descansando desde la UI** necesita un endpoint nuevo (no existe `DELETE /trading/entry-orders/:id`): spec futura.
- La pestaña Entradas se validó contra fixtures y estado vacío: el trader de CI y el de producción operan en SANDBOX y no pueden tener entradas. Con el primer bot TESTNET en `LIMIT_MAKER` u `OCO`, revisarla con datos reales (no requiere cambios de UI).
- `isWithinRanges` sólo se consume en la edición: aplicarlo también en el stepper de alta para que el guard de rango sea simétrico.
- La política de riesgo agregado (EP-004/EP-005) y las columnas de estado de protección/trailing de posiciones (`EP-008`) siguen sin presentación visual.
- No hay UI de admin para el flag `shared` de credenciales de data sources — se setea por API (`PUT /admin/data-sources/:id/credential`). Tampoco distingue la pantalla de noticias credencial propia de compartida.
- Quedan referencias a `agentId` en los hooks de **admin** (`/admin/agent-configs`): es otro wire, no el de configuración de agentes del usuario — unificar solo si se toca.
- La UI todavía **no consume `StreamHealthState`**: observable por `EP-015` y por el evento WS `market:stream-health`, sin pantalla que lo muestre.
- Lo que **no** se ejercitó en producción es el camino con posiciones abiertas y trades: la base arrancó vacía (spec-e-burgos-008).
