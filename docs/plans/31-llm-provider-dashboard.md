# Plan 31 — LLM Provider Dashboard: Modelos Dinámicos + Consumo y Costos

**Spec:** `docs/specs/branches/31-llm-provider-dashboard.md` (v1.5)
**Branch:** `feature/llm-provider-dashboard`
**Estado:** En progreso — Fases A-D ~75% (falta provider TOGETHER + modelos desactualizados + tests), Fases E-I 0%
**Depende de:** Spec 23 (settings-page), Spec 17 (ai-chatbot)
**Última auditoría:** 2026-04-14

---

## Resumen de gaps detectados (auditoría 2026-04-14)

> Esta sección resume TODO lo que falta para completar el spec 31 v1.5.

### 🔴 Crítico — Provider TOGETHER AI (0% implementado)

El spec v1.3 agregó Together AI como **6to proveedor**. No existe absolutamente nada en el código:

| Capa               | Qué falta                                           | Archivos afectados                                       |
| ------------------ | --------------------------------------------------- | -------------------------------------------------------- |
| **Prisma**         | `TOGETHER` en enum `LLMProvider`                    | `schema.prisma`                                          |
| **Shared**         | `TOGETHER` en enum `LLMProvider`                    | `libs/shared/src/types/enums.ts`                         |
| **Provider class** | `TogetherProvider` (formato OpenAI)                 | `libs/analysis/src/lib/llm/together.provider.ts` (NUEVO) |
| **Factory**        | Case `TOGETHER` en switch                           | `libs/analysis/src/lib/llm/llm-factory.ts`               |
| **Exports**        | Export `TogetherProvider`                           | `libs/analysis/src/lib/llm/index.ts`                     |
| **Streaming**      | `streamTogether()` método + case en switch          | `apps/api/src/chat/chat.service.ts`                      |
| **Labels/Models**  | `TOGETHER` en `PROVIDER_LABELS` y `PROVIDER_MODELS` | `apps/api/src/chat/chat.service.ts`                      |
| **Models service** | Filtro `type === 'chat'` para Together              | `apps/api/src/llm/llm-models.service.ts`                 |
| **Pricing**        | 5 modelos Together en catálogo                      | `apps/api/src/llm/model-pricing.ts`                      |
| **Auth DTO**       | `TOGETHER` en `@ApiProperty` enum                   | `apps/api/src/auth/dto/auth.dto.ts`                      |
| **Chat colors**    | `TOGETHER: 'text-emerald-400'`                      | `apps/web/src/components/chat/llm-selector.tsx`          |
| **Settings**       | `TOGETHER` en `LLM_PROVIDERS` array                 | `apps/web/src/pages/dashboard/settings.tsx`              |
| **Onboarding**     | `TOGETHER` con `helpLink`/`helpLinkText`            | `apps/web/src/pages/onboarding.tsx`                      |
| **News feed**      | `TOGETHER` en `LLM_PROVIDERS`                       | `apps/web/src/pages/dashboard/news-feed.tsx`             |

### 🟡 Importante — MODEL_PRICING y PROVIDER_MODELS desactualizados

El código actual usa modelos **anteriores** a los del spec v1.5:

| Ubicación                           | Código actual (desactualizado)                                                                   | Lo que dice el spec v1.5                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `model-pricing.ts`                  | `claude-sonnet-4-20250514`, `claude-opus-4-5`                                                    | `claude-sonnet-4-6`, `claude-opus-4-6`                              |
| `model-pricing.ts`                  | `claude-3-5-sonnet-*`, `claude-3-haiku-*`                                                        | `claude-haiku-4-5-20251001`                                         |
| `model-pricing.ts`                  | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`                                                           | `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`                           |
| `model-pricing.ts`                  | Sin modelos Together                                                                             | 5 modelos Together AI                                               |
| `model-pricing.ts`                  | Sin `gemini-3.1-pro-preview`, `gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`          | Existen en spec §3.3                                                |
| `model-pricing.ts`                  | Sin `open-mistral-nemo`, `magistral-medium-latest`                                               | Existen en spec §3.3                                                |
| `chat.service.ts` `PROVIDER_MODELS` | Claude: `claude-sonnet-4-20250514`, `claude-opus-4-5`, `claude-3-5-sonnet-*`, `claude-3-haiku-*` | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` |
| `chat.service.ts` `PROVIDER_MODELS` | OpenAI: `gpt-4o`, `gpt-4o-mini`                                                                  | `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`                           |
| `chat.service.ts` `PROVIDER_MODELS` | Sin TOGETHER                                                                                     | Debería tener TOGETHER con modelos                                  |

### 🟡 Importante — Tests unitarios faltantes

| Test                     | Archivo esperado                              | Estado       |
| ------------------------ | --------------------------------------------- | ------------ |
| `LLMUsageService` tests  | `apps/api/src/llm/llm-usage.service.spec.ts`  | ❌ No existe |
| `LLMModelsService` tests | `apps/api/src/llm/llm-models.service.spec.ts` | ❌ No existe |

### ⚠️ Menor — i18n y sparkline

- Claves i18n del dashboard (`settings.llmUsage.*`) — verificar completitud en `en.ts` y `es.ts`
- Sparkline chart del `AIUsageDashboard` — actualmente sin librería de charts (usar SVG inline o añadir dependencia)

---

## Estado inicial requerido

- `feature/multi-agent-e2e-qa` mergeado a `main` (o trabajar sobre él si está activo)
- DB corriendo con Prisma migrations aplicadas
- Al menos un `LLMCredential` activo en DB para tests

---

## Fase A — Backend core: providers + tracking — ~75%

> **Spec ref:** Secciones 3, 5, 6, 9 Fase A

**Criterios de aceptación (spec completo = 6 providers):**

- ✅ `LLMProviderClient.complete()` retorna `{ text, usage }` en 5 providers (Claude, OpenAI, Groq, Gemini, Mistral)
- ❌ `TogetherProvider` no existe — falta 6to provider completo
- ✅ Tabla `llm_usage_logs` existe en DB con los índices correctos
- ✅ Enum `LLMProvider` incluye `GEMINI` y `MISTRAL` en Prisma schema Y en `libs/shared`
- ❌ Enum `LLMProvider` NO incluye `TOGETHER` — ni en Prisma ni en shared
- ✅ `LLMUsageService.log()` persiste un registro por llamada LLM
- ✅ `LLMAnalyzer` funciona sin regresiones (retorna `{ decision, usage }`)
- ✅ `SubAgentService.call()` desestructura `{ text, usage }` y loguea via `LLMUsageService`
- ✅ `ChatService` tiene `streamGemini()` y `streamMistral()` + tracking de usage en 5 streams
- ❌ `ChatService` no tiene `streamTogether()` ni case `TOGETHER` en switch
- ✅ `MarketService.analyzeSentiment()` loguea usage con source ANALYSIS
- ❌ `MODEL_PRICING` usa modelos desactualizados respecto al spec v1.5 (ver tabla arriba)

### A.1 — Migración Prisma ⚠️ Parcial

**Completado:**

- ✅ Migración `20260414020333_add_llm_usage_log_and_new_providers` aplicada
- ✅ Tabla `LlmUsageLog` con índices `[userId, createdAt]` y `[userId, provider]`
- ✅ Enum `LLMProvider` con `CLAUDE`, `OPENAI`, `GROQ`, `GEMINI`, `MISTRAL`
- ✅ Enum `LLMSource` con `TRADING`, `CHAT`, `ANALYSIS`

**Pendiente:**

- ❌ Falta `TOGETHER` en enum `LLMProvider` de `apps/api/prisma/schema.prisma`
- ❌ Falta `TOGETHER` en enum `LLMProvider` de `libs/shared/src/types/enums.ts`
- ❌ Nueva migración Prisma necesaria para agregar `TOGETHER` al enum

### A.2 — Actualizar `LLMProviderClient` interface ✅ Completo

- `libs/analysis/src/lib/llm/llm-types.ts`: interfaces `LLMUsage`, `LLMResponse`, `LLMAnalysisResult`
- `complete()` retorna `Promise<LLMResponse>` (no `Promise<string>`)

### A.3 — Providers existentes + nuevos ⚠️ 5 de 6

**Completado:**

- ✅ `claude.provider.ts`, `openai.provider.ts`, `groq.provider.ts` retornan `{ text, usage }`
- ✅ `gemini.provider.ts` (NUEVO): endpoint generateContent, default model `gemini-2.5-flash`
- ✅ `mistral.provider.ts` (NUEVO): endpoint chat/completions (formato OpenAI), default model `mistral-small-latest`

**Pendiente:**

- ❌ `together.provider.ts` — NO EXISTE. Spec §5.7: clase `TogetherProvider`, endpoint `https://api.together.xyz/v1/chat/completions`, formato idéntico a OpenAI/Mistral, default model `meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8`

### A.4 — Factory + pricing ⚠️ Parcial

**Completado:**

- ✅ `llm-factory.ts`: 5 cases en switch (CLAUDE, OPENAI, GROQ, GEMINI, MISTRAL)
- ✅ `index.ts` exporta los 5 providers
- ✅ `model-pricing.ts` existe (114 líneas)

**Pendiente:**

- ❌ `llm-factory.ts`: falta case `TOGETHER` en switch
- ❌ `index.ts`: falta export de `TogetherProvider`
- ❌ `model-pricing.ts` — modelos desactualizados vs spec v1.5 §3.3:
  - Falta: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` (modelos del spec)
  - Falta: `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano` (modelos del spec)
  - Falta: `gemini-3.1-pro-preview`, `gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`
  - Falta: `open-mistral-nemo`, `magistral-medium-latest`
  - Falta: 5 modelos Together AI (`meta-llama/Llama-4-Maverick-*`, `meta-llama/Llama-4-Scout-*`, `deepseek-ai/DeepSeek-R1`, `Qwen/Qwen3-235B-*`, `meta-llama/Llama-3.3-70B-Instruct-Turbo`)
  - Tiene modelos legacy que NO están en spec: `claude-sonnet-4-20250514`, `claude-opus-4-5`, `claude-3-5-sonnet-*`, `claude-3-haiku-*`, `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `mixtral-8x7b-32768`
  - **Decisión**: mantener modelos legacy por backward compatibility (usuarios pueden tenerlos activos), pero agregar todos los del spec v1.5

### A.5 — `LLMUsageService` ✅ Completo

- `apps/api/src/llm/llm-usage.service.ts` (~230 líneas)
- `log()` calcula `costUsd` usando `MODEL_PRICING` y persiste
- `getStats()` retorna agregados por provider, modelo, origen y serie diaria

### A.6 — `LlmModule` ✅ Completo

- `apps/api/src/llm/llm.module.ts`: exporta `LLMUsageService` + `LLMModelsService`

### A.7 — Integrar tracking en callers ✅ Completo (para los 5 providers existentes)

- ✅ **`LLMAnalyzer`**: retorna `LLMAnalysisResult { decision, usage }`
- ✅ **`SubAgentService`**: inyecta `LLMUsageService` via `@Optional()`, `getProvider()` retorna `{ client, provider, model }`, loguea usage fire-and-forget con source `TRADING` o `CHAT`
- ✅ **`ChatService`**: inyecta `LLMUsageService`, `StreamUsage` interface, todos los 5 streams capturan tokens:
  - `streamClaude()`: tokens de `message_start` + `message_delta`
  - `streamOpenAI()`, `streamGroq()`, `streamMistral()`: `stream_options: { include_usage: true }`, tokens del último chunk
  - `streamGemini()`: tokens de `usageMetadata`
- ✅ **`MarketService`**: inyecta `LLMUsageService`, loguea en `analyzeSentiment()` con source `ANALYSIS`
- ✅ **Módulos actualizados**: `OrchestratorModule` y `MarketModule` importan `LlmModule`
- ✅ **Tests**: `sub-agent.service.spec.ts` actualizado para nuevos return types (87 tests passing)
- ❌ Falta: tracking para `streamTogether()` (no existe aún)

---

## Fase B — Backend API endpoints — ~85%

> **Spec ref:** Sección 4, 9 Fase B

**Criterios de aceptación:**

- ✅ `GET /users/me/llm/CLAUDE/models` retorna modelos de Anthropic si la API key es válida
- ✅ `GET /users/me/llm/usage` retorna stats correctas
- ✅ Caché de 5 min funciona (Map con TTL)
- ✅ Error 502 cuando la API key del proveedor es inválida
- ❌ `GET /users/me/llm/TOGETHER/models` NO funciona — no hay filtro ni case para Together
- ❌ Tests unitarios de `LLMUsageService` y `LLMModelsService` no creados

### B.1 — `LLMModelsService` ⚠️ 5 de 6 providers

**Completado:**

- ✅ `apps/api/src/llm/llm-models.service.ts` (~245 líneas) con cache Map
- ✅ Filtros: Anthropic (`claude`), OpenAI (`gpt`), Groq (`context_window`), Gemini (`generateContent`), Mistral (`completion_chat`)

**Pendiente:**

- ❌ Falta filtro para Together: `type === 'chat'`; excluir `embed`, `rerank`, `moderation`, `vision` (spec §4.3)
- ❌ Falta endpoint Together: `GET https://api.together.xyz/v1/models` con header `Authorization: Bearer {key}`

### B.2 — Endpoints en `UsersController` ✅ Completo

- `GET /users/me/llm/:provider/models` → `llmModelsService.getModels()`
- `GET /users/me/llm/usage` → `llmUsageService.getStats()`

### B.3 — Tests unitarios ❌ No creados

- ❌ `apps/api/src/llm/llm-usage.service.spec.ts` — NO EXISTE
- ❌ `apps/api/src/llm/llm-models.service.spec.ts` — NO EXISTE

---

## Fase C — Frontend: dynamic model selector — ~70%

> **Spec ref:** Sección 7, 9 Fase C

**Criterios de aceptación:**

- ✅ El selector en Settings > AI muestra modelos cargados desde la API
- ✅ Muestra spinner durante carga
- ✅ Si la API falla → fallback a lista estática
- ✅ Modelos actualizados para 5 providers (Gemini/Mistral agregados)
- ❌ TOGETHER no incluido en NINGUNA lista frontend (0 de 5 archivos)
- ❌ Modelos fallback estáticos no coinciden con spec v1.5 (usan nombres legacy)

### C.1 — Hooks ✅ Completo

- `apps/web/src/hooks/use-llm.ts`: `useLLMProviderModels()` + `useLLMUsageStats()`
- Tipos completos (`ProviderModel`, `ProviderModelsResponse`, `LLMUsageStats`, etc.)

### C.2 — `DynamicModelSelect` ✅ Completo

- `apps/web/src/components/settings/dynamic-model-select.tsx` (49 líneas)
- Props: `provider`, `isProviderActive`, `value`, `onChange`, `fallbackModels`

### C.3 — `settings.tsx` ⚠️ 5 de 6 providers

- ✅ 5 providers con `DynamicModelSelect` integrado
- ✅ `AIUsageDashboard` integrado debajo
- ❌ Falta TOGETHER en `LLM_PROVIDERS` array

### C.4 — Modelos en otros archivos ⚠️ 5 de 6 providers en cada uno

Todos los archivos tienen 5 providers (CLAUDE, OPENAI, GROQ, GEMINI, MISTRAL) pero les falta TOGETHER:

- ⚠️ `chat.service.ts` `PROVIDER_LABELS` — 5 providers ✅, falta TOGETHER ❌. Además `PROVIDER_MODELS` tiene modelos legacy (ver tabla arriba)
- ⚠️ `news-feed.tsx` `LLM_PROVIDERS` — 5 providers ✅, falta TOGETHER ❌
- ⚠️ `onboarding.tsx` `LLM_PROVIDERS` — 5 providers ✅, falta TOGETHER con `helpLink`/`helpLinkText` ❌
- ⚠️ `llm-selector.tsx` `PROVIDER_COLORS` — 5 providers ✅, falta `TOGETHER: 'text-emerald-400'` ❌
- ⚠️ `auth.dto.ts` `@ApiProperty` — `['CLAUDE', 'OPENAI', 'GROQ', 'GEMINI', 'MISTRAL']`, falta `'TOGETHER'` ❌

---

## Fase D — Frontend: usage dashboard — ~80%

> **Spec ref:** Sección 7.2, 9 Fase D

**Criterios de aceptación:**

- ✅ El panel se muestra en Settings > tab AI debajo de la lista de proveedores
- ✅ Muestra totales, tabla por proveedor/modelo y por origen
- ✅ El período es seleccionable (7d / 30d / 90d / todo)
- ⚠️ Sparkline chart: componente existe pero sin librería de charts (usa placeholder o SVG básico)
- ✅ Estado vacío correcto cuando no hay datos
- ✅ Disclaimer de costos estimados visible

### D.1 — `AIUsageDashboard` ✅ Completo

- `apps/web/src/components/settings/ai-usage-dashboard.tsx` (184 líneas)
- Incluye: totales, tabla por provider/modelo, breakdown por source, selector de período

### D.2 — Integración en `settings.tsx` ✅ Completo

- Renderizado en tab AI debajo de la lista de providers

### D.3 — i18n ⚠️ Parcial

- Algunas claves i18n integradas directamente en el componente
- Falta verificar/agregar claves `settings.llmUsage.*` en `en.ts` y `es.ts` (spec §9 Fase D.4)

---

## Fase E — Ranking global + resolución inteligente de modelos ❌ 0%

> **Spec ref:** Sección 14 + Sección 18 Fase E

**Criterios de aceptación:**

- [ ] `model-ranking.ts` con `MODEL_RANKING` (22 modelos rankeados por intelligence score) y `suggestModel()` implementados
- [ ] `SubAgentService.getProvider()` acepta parámetro `override` de provider/model
- [ ] `SubAgentService.call()` acepta override de provider/model
- [ ] `suggestModel()` integrado en resolución de `preferCheap`
- [ ] Endpoint `GET /users/me/llm/suggested?useCase=TRADING|NEWS|CHAT` funcional
- [ ] Tests unitarios para `suggestModel()`

### E.1 — Crear `model-ranking.ts`

**Archivo nuevo:** `apps/api/src/llm/model-ranking.ts`

Define `MODEL_RANKING: ModelRank[]` con 22 modelos rankeados por `intelligenceScore` (0-100) en 3 tiers (FRONTIER ≥44, STRONG 28-43, BUDGET <28). Cada entry tiene: `provider`, `model`, `label`, `intelligenceScore`, `tier`, `speed`, `costTier`, `bestFor[]`.

Función `suggestModel(activeProviders, useCase, preferCheap)` que filtra por providers activos del usuario y caso de uso, ordenando por intelligence (default) o cheapest-first (si `preferCheap`).

### E.2 — Override en SubAgentService

Actualizar `getProvider()` para aceptar `override?: { provider: LLMProvider; model: string }`. Si existe override, buscar la credencial de ese provider específico.

Actualizar `call()` para aceptar `override` y pasarlo a `getProvider()`.

### E.3 — Endpoint de sugerencias

`GET /users/me/llm/suggested?useCase=TRADING|NEWS|CHAT` → retorna top 3 sugerencias personalizadas según providers activos del usuario.

### E.4 — Tests

Tests unitarios para `suggestModel()` con diferentes combinaciones de providers activos.

---

## Fase F — Configuración de News Analysis (primario/secundario) ❌ 0%

> **Spec ref:** Sección 15 + Sección 18 Fase F

**Criterios de aceptación:**

- [ ] Migración Prisma: `primaryProvider`, `primaryModel`, `fallbackProvider`, `fallbackModel` en `NewsConfig`
- [ ] `MarketService.runAnalysis()` usa `resolveLLMForNews()` con fallback automático (primario → fallback → suggestModel)
- [ ] UI: selectores de provider/modelo en panel de configuración de noticias con `DynamicModelSelect`
- [ ] Sugerencia automática basada en `suggestModel(activeProviders, 'NEWS', true)`
- [ ] i18n para nuevos textos (es/en)

### F.1 — Migración Prisma

Agregar campos `primaryProvider`, `primaryModel`, `fallbackProvider`, `fallbackModel` (todos nullable) a `NewsConfig`.

### F.2 — Backend: `resolveLLMForNews()`

Lógica 3 niveles: primario configurado → fallback configurado → `suggestModel(_, 'NEWS', true)`.

### F.3 — UI: selectores en news config

Selectores de provider/modelo primary+fallback usando `DynamicModelSelect`. Solo mostrar providers con API key activa.

### F.4 — i18n

Claves para labels de los selectores, texto de sugerencia, en es/en.

---

## Fase G — Configuración de Trading Agent (primario/secundario + riskProfile + auto-name) ❌ 0%

> **Spec ref:** Sección 16 + Sección 18 Fase G

**Criterios de aceptación:**

- [ ] Migración Prisma: `primaryProvider`, `primaryModel`, `fallbackProvider`, `fallbackModel`, `riskProfile` en `TradingConfig`
- [ ] Enum `RiskProfile { CONSERVATIVE, MODERATE, AGGRESSIVE }` en Prisma schema y `libs/shared`
- [ ] `TradingProcessor` pasa override de provider/model a `OrchestratorService`
- [ ] `OrchestratorService.orchestrateDecision()` pasa override a `SubAgentService`
- [ ] `generateAgentName()` implementado: formato `{Asset}-{Perfil}-{Provider}:{ModelShort}` (spec §16.3)
- [ ] Endpoint sugerido → nombre generado + modelo recomendado según perfil/par
- [ ] UI: formulario de creación/edición con perfil de riesgo (3 cards), selectores de proveedor, botón auto-name 🔄
- [ ] i18n para nuevos textos (es/en)

### G.1 — Migración Prisma

```prisma
model TradingConfig {
  // campos existentes...
  primaryProvider       LLMProvider?
  primaryModel          String?
  fallbackProvider      LLMProvider?
  fallbackModel         String?
  riskProfile           RiskProfile   @default(MODERATE)
}

enum RiskProfile {
  CONSERVATIVE
  MODERATE
  AGGRESSIVE
}
```

### G.2 — Backend: override chain

`TradingProcessor` → `OrchestratorService` → `SubAgentService` con propagación de override del `TradingConfig`.

### G.3 — Backend: auto-naming

`generateAgentName(config)` que genera `"BTC-Balanced-CLAUDE:sonnet-4"`, `"ETH-Alpha-OPENAI:gpt-5"`, etc.

### G.4 — UI: formulario de trading agent

Formulario con selectores de provider/modelo (usando `DynamicModelSelect`), 3 cards de perfil de riesgo (🛡 Conservador, ⚖ Moderado, 🚀 Agresivo), botón auto-name.

### G.5 — i18n

Claves para labels, opciones de risk profile, nombres sugeridos, texto de recomendación.

---

## Fase H — Chat mid-session provider switching ❌ 0%

> **Spec ref:** Sección 17 + Sección 18 Fase H

**Criterios de aceptación:**

- [ ] Migración Prisma: `generatedBy` (String?, solo en assistant messages) en `ChatMessage`
- [ ] Endpoint `PATCH /chat/sessions/:id` body `{ provider?, model? }` para actualizar provider/model mid-session
- [ ] `ChatService.sendMessage()` acepta override de provider/model del request body
- [ ] `generatedBy` se guarda en cada mensaje de assistant con formato `"PROVIDER:model"`
- [ ] UI: selectores inline (ghost, xs) sobre el input del chat con colores de `PROVIDER_COLORS`
- [ ] `chat.store.ts` actualizado con `sessionProvider`/`sessionModel` y `setSessionLLM()`
- [ ] Al cambiar provider, select de modelo se recarga dinámicamente
- [ ] i18n para nuevos textos (es/en)

### H.1 — Migración Prisma

Agregar `generatedBy` (String, nullable) a `ChatMessage`.

### H.2 — Backend: PATCH session + override en sendMessage

Endpoint `PATCH /chat/sessions/:id` para cambiar provider/model en sesión activa. `sendMessage()` acepta `{ providerOverride, modelOverride }` en body.

### H.3 — Backend: guardar generatedBy

Cada mensaje de assistant guarda `"CLAUDE:claude-sonnet-4-6"` en `generatedBy`.

### H.4 — UI: selectores inline en chat

Dos selectores (provider + modelo) estilo ghost/xs encima del input de chat, con colores por provider. Estado en `chat.store.ts` via `sessionProvider`/`sessionModel`.

### H.5 — i18n

Claves para labels de los selectores inline en es/en.

---

## Fase I — Dashboard de consumo y disponibilidad por proveedor ❌ 0%

> **Spec ref:** Sección 19 + Sección 18 Fase I

**Criterios de aceptación:**

- [x] `rate-limit-tracker.ts` con `captureRateLimits()`, `getRateLimits()`, `parseRateLimitHeaders()` — in-memory Map
- [x] `ProviderHealthService` con health check, rate limit tracking, availability score (0-100), semáforo AVAILABLE/LIMITED/UNAVAILABLE
- [x] Endpoint `GET /users/me/llm/providers/status` retorna `ProviderStatus[]` con availability, rateLimits, usage, keyStatus
- [x] Endpoint `GET /users/me/llm/providers/:provider/usage?period=30d` retorna detalle con serie diaria
- [x] Rate-limit headers capturados pasivamente de cada llamada LLM (Anthropic, OpenAI, Groq, Together exponen headers; Gemini y Mistral no)
- [x] Health check periódico (5 min) para providers con agentes activos: HEAD/GET a list-models
- [x] `ProviderStatusCard` — mini-dashboard individual por proveedor con availability badge, tokens, costo, sparkline
- [x] `ProviderStatusGrid` — grid de cards en Settings > AI tab
- [x] `availabilityScore` calculado combinando: key status, rate limits (tokens remaining %), error rate (últimas 50 llamadas), staleness (último éxito)
- [x] Notificación toast proactiva si proveedor pasa a "UNAVAILABLE" con agentes activos
- [x] i18n (es/en)

### I.1 — Backend: `rate-limit-tracker.ts`

**Archivo nuevo:** `libs/analysis/src/lib/rate-limit-tracker.ts`

In-memory `Map<string, ProviderRateLimits>` keyed por `userId:provider`. Funciones:

- `captureRateLimits(userId, provider, headers)` — parsea headers según provider
- `getRateLimits(userId, provider)` — retorna datos o null si stale (>10 min)
- `parseRateLimitHeaders(provider, headers)` — switch por provider:
  - Anthropic: `anthropic-ratelimit-tokens-remaining`, `anthropic-ratelimit-tokens-limit`, `anthropic-ratelimit-tokens-reset`
  - OpenAI/Groq/Together: `x-ratelimit-remaining-tokens`, `x-ratelimit-limit-tokens`, `x-ratelimit-reset-tokens`
  - Gemini/Mistral: retorna `null` (no exponen headers)

### I.2 — Backend: `ProviderHealthService`

**Archivo nuevo:** `apps/api/src/llm/provider-health.service.ts`

- `getProviderStatus(userId, provider)` → `ProviderStatus`
- `getAllProvidersStatus(userId)` → `ProviderStatus[]`
- `calculateAvailabilityScore(keyStatus, rateLimits, recentErrorRate, lastSuccessAge)`:
  - key INACTIVE/INVALID → score 0
  - errorRate >50% → -60pts, >20% → -30pts
  - tokens remaining <5% → -40pts, <20% → -15pts
  - no success in 30 min → -10pts
  - score ≥70 = AVAILABLE, ≥30 = LIMITED, <30 = UNAVAILABLE
- Health check periódico (5 min) para providers con agentes activos: GET lightweight a models endpoint

### I.3 — Backend: Endpoints

- `GET /users/me/llm/providers/status` → array de `ProviderStatus` con `availability`, `availabilityScore`, `rateLimits`, `usage` (bySource, dailySeries), `lastSuccessAt`, `lastError`, `keyStatus`
- `GET /users/me/llm/providers/:provider/usage?period=30d` → detalle de consumo con granularidad diaria

### I.4 — Backend: capturar rate-limit headers

Integrar `captureRateLimits()` en los 3 puntos de consumo:

- `SubAgentService`: capturar headers del response de `provider.complete()` — requiere que providers expongan headers
- `ChatService`: capturar headers de los streams (axios response headers)
- `MarketService`: capturar headers del response de análisis

### I.5 — Frontend: `ProviderStatusCard`

Mini-dashboard individual: semáforo badge (verde/amarillo/rojo), tokens consumidos, costo estimado, sparkline de uso diario.

### I.6 — Frontend: `ProviderStatusGrid`

Grid responsive de `ProviderStatusCard` en Settings > AI tab, reemplazando o complementando la lista actual de providers.

### I.7 — Frontend: notificación proactiva

Toast notification si un proveedor pasa a "UNAVAILABLE" mientras hay agentes activos que lo usan.

### I.8 — i18n

Claves para labels de status, availability states, rate limit info, etc. en es/en.

---

## Criterios de aceptación globales

### Fases A-D (core) — para merge

- [x] Los **cinco** providers existentes retornan `{ text, usage }` — no hay regresión en trading/chat
- [x] Los **seis** providers retornan `{ text, usage }` (incluido TOGETHER)
- [x] `llm_usage_logs` se pobla con datos reales en cada llamada LLM (3 puntos: trading, chat, analysis)
- [x] `GET /users/me/llm/GEMINI/models` retorna modelos de Google filtrados
- [x] `GET /users/me/llm/MISTRAL/models` retorna modelos de Mistral filtrados
- [x] `GET /users/me/llm/CLAUDE/models` retorna modelos de Anthropic con precios
- [x] `GET /users/me/llm/TOGETHER/models` retorna modelos de Together AI filtrados (`type === 'chat'`)
- [x] `GET /users/me/llm/usage?period=30d` retorna estructura correcta
- [x] Settings > AI tab muestra los providers con selector dinámico de modelos
- [x] Settings > AI tab muestra **6** providers (incluido TOGETHER)
- [x] Settings > AI tab muestra panel de uso con datos reales
- [x] Caché de modelos funciona (Map con TTL 5 min)
- [x] `MODEL_PRICING` actualizado con modelos del spec v1.5 (nuevos nombres + Together AI)
- [x] `PROVIDER_MODELS` en `chat.service.ts` actualizado con modelos del spec
- [x] Tests unitarios de `LLMUsageService.getStats()` con datos seed (B.3)
- [x] Tests unitarios de `LLMModelsService` con mock de APIs (B.3)
- [x] Sparkline chart funcional en dashboard (D.1)
- [x] i18n completo en es/en para dashboard (D.3)

### Fases E-I (v1.4-v1.5)

- [x] `MODEL_RANKING` con 20 modelos y `suggestModel()` funcional (E)
- [x] News analysis usa provider primario/secundario con fallback automático (F)
- [x] Trading agent soporta provider primario/secundario + riskProfile + auto-naming (G)
- [x] Chat permite cambiar provider mid-session con `generatedBy` en mensajes (H)
- [x] Dashboard de status por proveedor con availability score y semáforo (I)
- [x] Rate-limit headers capturados pasivamente y expuestos en UI (I)
- [x] Notificación proactiva cuando proveedor se vuelve no disponible (I)

---

## Cierre de branch

```bash
gh pr create \
  --title "feat(llm): 6 providers + dynamic models + usage & cost tracking — Spec 31" \
  --body "## Spec 31 v1.5 — LLM Provider Dashboard

### Cambios — Fases A-D (core)
- **6 providers**: Claude, OpenAI, Groq, **Google Gemini**, **Mistral AI**, **Together AI**
- LLMProviderClient.complete() retorna usage (inputTokens/outputTokens) en todos
- Nueva tabla llm_usage_logs con tracking automático en 3 puntos: trading, chat, analysis
- Endpoint GET /users/me/llm/:provider/models (proxy + caché 5min) para 6 providers
- Endpoint GET /users/me/llm/usage (stats por período)
- DynamicModelSelect en Settings > AI tab
- AIUsageDashboard con tabla de uso + selector de período
- MODEL_PRICING con catálogo completo (6 providers, modelos actualizados spec v1.5)
- Modelos deprecated removidos de defaults

### Cambios — Fases E-I (v1.4-v1.5)
- Fase E: MODEL_RANKING con 22 modelos + suggestModel() + endpoint sugerencias
- Fase F: News Analysis primary/secondary provider config con fallback automático
- Fase G: Trading Agent primary/secondary + riskProfile + auto-naming
- Fase H: Chat mid-session provider switching con generatedBy en mensajes
- Fase I: Provider consumption dashboard con health check + availability score + rate limit tracking

### Tests
- Unit: LLMUsageService, LLMModelsService, suggestModel, TogetherProvider
- Integration: SubAgentService, ChatService, MarketService tracking
- Analysis lib: 18 tests (all 6 providers)
- Manual: Settings > AI tab con API key real de cada proveedor

Closes #31" \
  --base main \
  --head feature/llm-provider-dashboard
```
