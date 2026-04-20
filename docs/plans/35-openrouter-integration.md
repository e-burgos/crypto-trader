# Plan 35 — OpenRouter: Proveedor LLM Primario Recomendado

**Spec:** docs/specs/branches/35-openrouter-integration.md  
**Branch:** feature/openrouter-integration  
**Depende de:** Spec 34 (ui-design-system-consolidation) mergeada en main

---

## Estado inicial requerido

```bash
# Verificar que estamos en main y actualizado
git checkout main && git pull origin main

# Verificar que spec 34 está mergeada
git log main --oneline -5

# Verificar que el enum LLMProvider existe con 6 valores
grep -A8 'enum LLMProvider' apps/api/prisma/schema.prisma
grep -A8 'enum LLMProvider' libs/shared/src/types/enums.ts

# Verificar que la factory tiene 6 providers
cat libs/analysis/src/lib/llm/llm-factory.ts

# Verificar AI tab actual en settings
grep -n 'aiSubTab' apps/web/src/pages/dashboard/settings.tsx
```

---

## Fase A — Backend: OpenRouterProvider + enum + migración

### A.1 — Extender enum LLMProvider

**Archivos:**

- `apps/api/prisma/schema.prisma` — agregar `OPENROUTER` al enum `LLMProvider`
- `libs/shared/src/types/enums.ts` — agregar `OPENROUTER = 'OPENROUTER'`

### A.2 — Migración Prisma

```bash
cd apps/api
pnpm prisma migrate dev --name add-openrouter-provider
pnpm prisma generate
```

### A.3 — Agregar campo `fallbackModels` a `LLMCredential`

**Archivo:** `apps/api/prisma/schema.prisma`

```prisma
model LLMCredential {
  // ... campos existentes
  fallbackModels  String[]  @default([])
}
```

```bash
pnpm prisma migrate dev --name add-fallback-models-to-llm-credential
pnpm prisma generate
```

### A.4 — Crear OpenRouterProvider

**Archivo nuevo:** `libs/analysis/src/lib/llm/openrouter.provider.ts`

Implementar `LLMProviderClient`:

- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Headers: `Authorization: Bearer ${apiKey}`, `HTTP-Referer: https://cryptotrader.app`
- Formato: OpenAI-compatible (messages array con system + user)
- Soporte para `route: 'fallback'` + `models[]` cuando `fallbackModels` está configurado
- Parsear `usage` del response (formato OpenAI: `prompt_tokens`, `completion_tokens`)

### A.5 — Actualizar factory

**Archivo:** `libs/analysis/src/lib/llm/llm-factory.ts`

Agregar:

```typescript
case LLMProvider.OPENROUTER:
  return new OpenRouterProvider({ apiKey, model });
```

### A.6 — Actualizar model-ranking.ts

**Archivo:** `apps/api/src/llm/model-ranking.ts`

Agregar modelos de OpenRouter al ranking. Usar los mismos modelos existentes pero con provider `OPENROUTER` y model IDs en formato OpenRouter (`anthropic/claude-sonnet-4`, etc.).

### A.7 — Actualizar model-pricing.ts

**Archivo:** `apps/api/src/llm/model-pricing.ts`

Agregar entradas para modelos OpenRouter. Nota: los precios de OpenRouter incluyen un markup (~5-20%) sobre el precio directo.

### A.8 — Extender LLMModelsService

**Archivo:** `apps/api/src/users/` o donde esté `LLMModelsService`

Agregar caso para `OPENROUTER`:

- `GET https://openrouter.ai/api/v1/models` con API key del usuario
- Filtrar modelos de text generation
- Retornar con pricing info (OpenRouter lo incluye en la respuesta)

### A.9 — Ajustar SubAgentService para fallback OpenRouter

**Archivo:** `apps/api/src/orchestrator/sub-agent.service.ts`

En `getProvider()`: cuando el provider es OPENROUTER y hay `fallbackModels` configurados, crear el `OpenRouterProvider` con los fallback models para que los incluya en el request.

### A.10 — Tests unitarios

- `libs/analysis/src/lib/llm/openrouter.provider.spec.ts` — test de complete(), manejo de errores, fallback
- Actualizar `apps/api/src/orchestrator/sub-agent.service.spec.ts` con mock de OPENROUTER

### Verificación Fase A

```bash
pnpm nx test api --testPathPattern="openrouter|sub-agent|llm"
pnpm nx build api
```

---

## Fase B — Frontend: Rediseño de Settings AI con 3 sub-tabs

### B.1 — Extraer LLMProvidersGrid

**Archivo nuevo:** `apps/web/src/containers/settings/llm-providers-grid.tsx`

Extraer el grid de 6 providers (las cards con API key + DynamicModelSelect + validación) del `SettingsPage` a un componente reutilizable. Sin cambios funcionales.

### B.2 — Crear OpenRouterPrimaryTab

**Archivo nuevo:** `apps/web/src/containers/settings/openrouter-primary-tab.tsx`

Card destacada con:

- Badge "Recomendado"
- Descripción de beneficios (una key, fallback, billing unificado, 200+ modelos)
- Input de API key
- DynamicModelSelect para modelo principal (cargado desde OpenRouter API)
- Toggle de fallback + selects de modelos de respaldo
- Botones Guardar / Test / Delete
- Link a `openrouter.ai/keys`

### B.3 — Cambiar sub-tabs de AI

**Archivo:** `apps/web/src/pages/dashboard/settings.tsx`

Cambiar `type AISubTab = 'keys' | 'analytics'` → `type AISubTab = 'primary' | 'providers' | 'analytics'`

Renderizar:

- `primary` → `<OpenRouterPrimaryTab />`
- `providers` → `<LLMProvidersGrid />` (con banner de sugerencia OpenRouter arriba)
- `analytics` → `<AIUsageDashboard />` + `<ProviderStatusGrid />`

### B.4 — Banner de sugerencia en tab Providers

En `LLMProvidersGrid`, agregar banner superior:

```
💡 Con OpenRouter puedes acceder a todos estos proveedores con una sola API key → [Configurar]
```

El botón "Configurar" cambia a la sub-tab `primary`.

### B.5 — Actualizar Onboarding StepLLM

**Archivo:** `apps/web/src/pages/onboarding.tsx` (y componente StepLLM)

- OpenRouter como primera opción con badge "Recomendado"
- Separator visual "— o configura un proveedor directo —"
- Los 6 providers actuales debajo

### B.6 — Traducciones i18n

**Archivos:** `apps/web/src/i18n/locales/en.json`, `es.json`

Keys nuevas:

- `settings.aiSubTabs.primary` → "Primary Provider" / "Proveedor Primario"
- `settings.aiSubTabs.providers` → "Other Providers" / "Otros Proveedores"
- `settings.openrouter.*` — título, descripción, beneficios, fallback, etc.
- `onboarding.openrouterRecommended` → "Recommended" / "Recomendado"

### B.7 — Agregar OPENROUTER a listas de providers del frontend

**Archivos:**

- `apps/web/src/pages/dashboard/settings.tsx` — agregar a `LLM_PROVIDERS` (aunque se usa mayormente en la tab primary)
- `apps/web/src/components/config/components.tsx` — agregar a `LLM_PROVIDERS` fallback list

### Verificación Fase B

```bash
pnpm nx build web
pnpm nx test web
# Verificar visualmente que las 3 tabs funcionan
```

---

## Fase C — Fallback automático + polish

### C.1 — Lógica de fallback en OpenRouterProvider

**Archivo:** `libs/analysis/src/lib/llm/openrouter.provider.ts`

Si se instancia con `fallbackModels`, incluir en el body:

```json
{ "route": "fallback", "models": ["model1", "model2", "model3"] }
```

### C.2 — UI de fallback en OpenRouterPrimaryTab

- Checkbox "Activar fallback automático"
- Cuando activo: mostrar 1-3 selects de modelos de respaldo
- Guardar en `LLMCredential.fallbackModels`

### C.3 — Mostrar modelo usado en respuesta

OpenRouter retorna el modelo real usado en `response.model`. Loguearlo en `LlmUsageLog` para que las analíticas muestren qué modelo se usó realmente (útil cuando fallback redirige).

### C.4 — E2E tests

**Archivo:** `e2e/openrouter-settings.spec.ts`

- Navegar a Settings → AI → Proveedor Primario
- Verificar que OpenRouter card existe con badge recomendado
- Verificar tabs: Primary / Providers / Analytics
- Verificar que la tab Providers muestra banner de sugerencia

### Verificación Fase C

```bash
pnpm nx build api && pnpm nx build web
pnpm nx test api && pnpm nx test web
pnpm playwright test e2e/openrouter-settings.spec.ts
```

---

## Criterios de aceptación

- [ ] `OPENROUTER` existe como valor en enum `LLMProvider` (Prisma + shared)
- [ ] `OpenRouterProvider` implementa `LLMProviderClient` y funciona con la API de OpenRouter
- [ ] `llm-factory.ts` crea `OpenRouterProvider` para `OPENROUTER`
- [ ] Settings → AI tiene 3 sub-tabs: Proveedor Primario, Otros Proveedores, Analíticas
- [ ] OpenRouter aparece como provider destacado con badge "Recomendado"
- [ ] DynamicModelSelect funciona para modelos de OpenRouter
- [ ] Onboarding muestra OpenRouter como primera opción
- [ ] Fallback automático configurable desde UI
- [ ] Tests unitarios pasan para OpenRouterProvider
- [ ] Build limpio de api y web
- [ ] Traducciones en y es para todas las keys nuevas

---

## Cierre de branch

```bash
# Push
git push origin feature/openrouter-integration

# PR
gh pr create \
  --base main \
  --head feature/openrouter-integration \
  --title "feat: OpenRouter integration as primary LLM provider (#35)" \
  --body "## Spec 35 — OpenRouter: Proveedor LLM Primario Recomendado

### Cambios

**Backend:**
- Nuevo \`OpenRouterProvider\` implementando \`LLMProviderClient\`
- Enum \`LLMProvider\` extendido con \`OPENROUTER\`
- Campo \`fallbackModels\` en \`LLMCredential\`
- Proxy de modelos OpenRouter en \`LLMModelsService\`
- Model ranking y pricing actualizados

**Frontend:**
- Settings → AI rediseñado con 3 sub-tabs
- OpenRouter como proveedor primario recomendado con card destacada
- Fallback automático configurable
- Onboarding actualizado para recomendar OpenRouter
- Traducciones i18n (en/es)

### Tests
- Unit tests para \`OpenRouterProvider\`
- E2E test para flujo de settings

### Spec
docs/specs/branches/35-openrouter-integration.md"
```

Actualizar `docs/plans/crypto-trader-branch-plan.md` con fila 35.
