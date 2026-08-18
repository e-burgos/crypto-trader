# spec-e-burgos-001 cycle-03 — 2026-08-18

## Estado

- **Cerrado el deploy-blocker heredado de cycle-02.** La pantalla de configuración de agentes
  estaba rota en producción: cycle-02 renombró `agentId` → `slot` y `'fallback'` → `'preset'` en
  el wire de `GET /users/me/agents/config` y `/health`, y `apps/web` seguía leyendo
  `config.agentId` — nombres de agente vacíos, filtros `risk`/`routing` que no matcheaban y
  guardar disparaba `PUT /users/me/agents/undefined/config`.
  `hooks/use-agent-config.ts` y `pages/dashboard/settings/agents.tsx` ya consumen `slot` y el
  union completo de `ResolutionSource` (`override | user | admin | preset | credential`).
- Primer ciclo con trabajo real en `apps/web` dentro de esta spec.
- Panel nuevo de **costo LLM por bot/día** en la página de analytics, contra `EP-009`. Es la cara
  visible del hallazgo C: el dashboard dejaba de reportar ~$0 porque nadie escribía el costo real.

## Estructura

- `src/pages/dashboard/settings/agent-source-badge.ts` — `resolveSourceBadge()` traduce el
  `source` del wire a `{ labelKey, tone }`. Un valor fuera del union degrada esa fila a tono
  `unknown` en vez de romper el render de la pantalla entera.
- `src/pages/dashboard/settings/agents-wire.fixture.ts` — fixture del response real
  post-cycle-02, compartido por los tests de la página y del hook.
- `src/hooks/use-agent-costs.ts` + `src/components/analytics/agent-cost-panel.tsx` — panel de
  costo por TanStack Query, textos por `t('clave')` en `es.ts` y `en.ts`.

## Dependencias

- Los tipos del wire de agentes ahora se importan de `@crypto-trader/shared`
  (`ResolvedAgentModelWire`, `AgentHealthReportWire`, `ResolutionSource`) en lugar de declararse
  localmente. Ese era el motivo por el que el `tsc` de `apps/web` no detectaba el desalineamiento:
  el front declaraba su propia interfaz del response.

## Qué sigue

- **El criterio de done de este wire es "test en verde", no "typecheck en verde".** Aunque los
  tipos ahora se comparten, la cobertura que protege la pantalla son los tests de comportamiento
  sobre el fixture del wire — mantenerlos al tocar la pantalla de agentes.
- **UI de los 17 campos de `TradingConfig` y de la política de riesgo agregado
  (`EP-004`/`EP-005`)** — deuda diferida a una spec de UI dedicada; hoy solo por API.
- **Columnas de estado de protección/trailing de posiciones** — el backend las expone desde este
  ciclo (`EP-008`), sin presentación visual todavía.
- Quedan referencias a `agentId` en los hooks de **admin** (`/admin/agent-configs`): son otro wire,
  no el de configuración de agentes del usuario, y no estaban en alcance.
