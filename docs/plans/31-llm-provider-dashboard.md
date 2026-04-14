# Plan 31 — LLM Provider Dashboard: Modelos Dinámicos + Consumo y Costos

**Spec:** `docs/specs/branches/31-llm-provider-dashboard.md`  
**Branch:** `feature/llm-provider-dashboard`  
**Estado:** Pendiente  
**Depende de:** Spec 23 (settings-page), Spec 17 (ai-chatbot)

---

## Estado inicial requerido

- `feature/multi-agent-e2e-qa` mergeado a `main` (o trabajar sobre él si está activo)
- DB corriendo con Prisma migrations aplicadas
- Al menos un `LLMCredential` activo en DB para tests

---

## Fase A — Backend core: providers + tracking

**Criterios de aceptación:**

- `LLMProviderClient.complete()` retorna `{ text, usage }` en los **cinco** providers
- Tabla `llm_usage_logs` existe en DB con los índices correctos
- Enum `LLMProvider` incluye `GEMINI` y `MISTRAL` (en Prisma schema Y en `libs/shared/src/types/enums.ts`)
- `LLMUsageService.log()` persiste un registro por llamada LLM
- `LLMAnalyzer` funciona sin regresiones (retorna `{ decision, usage }`)
- `SubAgentService.call()` desestructura `{ text, usage }` del `provider.complete()`
- `ChatService` tiene `streamGemini()` y `streamMistral()` + tracking de usage en todos los streams
- Tests unitarios de `LLMUsageService` pasan

### A.1 — Migración Prisma

```bash
# Agregar a schema.prisma
# 1. Extender enum LLMProvider existente:
enum LLMProvider {
  CLAUDE
  OPENAI
  GROQ
  GEMINI   // nuevo
  MISTRAL  // nuevo
}

# 2. Nuevo modelo:
model LlmUsageLog {
  id           String      @id @default(cuid())
  userId       String
  user         User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider     LLMProvider
  model        String
  inputTokens  Int
  outputTokens Int
  costUsd      Float
  source       LLMSource
  createdAt    DateTime    @default(now())

  @@index([userId, createdAt])
  @@index([userId, provider])
}

enum LLMSource {
  TRADING
  CHAT
  ANALYSIS
  NEWS
}
```

```bash
pnpm nx run api:prisma-migrate -- --name add-llm-usage-log-and-new-providers
# o
cd apps/api && npx prisma migrate dev --name add-llm-usage-log-and-new-providers
```

**También actualizar `libs/shared/src/types/enums.ts`** (espejo manual del enum Prisma):

```typescript
export enum LLMProvider {
  CLAUDE = 'CLAUDE',
  OPENAI = 'OPENAI',
  GROQ = 'GROQ',
  GEMINI = 'GEMINI', // nuevo
  MISTRAL = 'MISTRAL', // nuevo
}
```

### A.2 — Actualizar `LLMProviderClient` interface

**Archivo:** `libs/analysis/src/lib/llm/llm-types.ts`

Agregar:

```typescript
export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMResponse {
  text: string;
  usage: LLMUsage;
}
```

Cambiar la firma de:

```typescript
complete(systemPrompt: string, userPrompt: string): Promise<string>;
```

a:

```typescript
complete(systemPrompt: string, userPrompt: string): Promise<LLMResponse>;
```

### A.3 — Actualizar los tres providers existentes + crear dos nuevos

**Archivos existentes:** `claude.provider.ts`, `openai.provider.ts`, `groq.provider.ts`

Cada uno retorna `{ text, usage }` extrayendo los tokens de la respuesta de la API:

- **Claude**: `data.usage.input_tokens`, `data.usage.output_tokens`
- **OpenAI**: `data.usage.prompt_tokens`, `data.usage.completion_tokens`
- **Groq**: `data.usage.prompt_tokens`, `data.usage.completion_tokens`

**Archivos nuevos:**

`libs/analysis/src/lib/llm/gemini.provider.ts`

- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`
- Body: `{ system_instruction: { parts: [{ text }] }, contents: [{ role: 'user', parts: [{ text }] }] }`
- Usage: `data.usageMetadata.promptTokenCount` / `data.usageMetadata.candidatesTokenCount`
- Default model: `gemini-2.5-flash`

`libs/analysis/src/lib/llm/mistral.provider.ts`

- Endpoint: `POST https://api.mistral.ai/v1/chat/completions` (identical to OpenAI format)
- Usage: `data.usage.prompt_tokens` / `data.usage.completion_tokens`
- Default model: `mistral-small-latest`

### A.4 — Actualizar `llm-factory.ts`

Agregar casos `GEMINI` y `MISTRAL` en el switch:

```typescript
case LLMProvider.GEMINI:
  return new GeminiProvider({ apiKey, model });
case LLMProvider.MISTRAL:
  return new MistralProvider({ apiKey, model });
```

También actualizar `libs/analysis/src/lib/llm/index.ts` para exportar los nuevos providers.

**Archivo nuevo:** `apps/api/src/llm/model-pricing.ts`

Catálogo completo según Spec 31, sección 3.3.

### A.5 — Crear `LLMUsageService`

**Archivo nuevo:** `apps/api/src/llm/llm-usage.service.ts`

```typescript
@Injectable()
export class LLMUsageService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    userId: string;
    provider: LLMProvider;
    model: string;
    usage: LLMUsage;
    source: LLMSource;
  }): Promise<void> {
    const pricing = MODEL_PRICING[params.model];
    const costUsd = pricing
      ? (params.usage.inputTokens * pricing.input +
          params.usage.outputTokens * pricing.output) /
        1_000_000
      : 0;

    await this.prisma.llmUsageLog.create({
      data: {
        userId: params.userId,
        provider: params.provider,
        model: params.model,
        inputTokens: params.usage.inputTokens,
        outputTokens: params.usage.outputTokens,
        costUsd,
        source: params.source,
      },
    });
  }

  async getStats(
    userId: string,
    period: '7d' | '30d' | '90d' | 'all',
  ): Promise<LLMUsageStats> {
    // ... ver spec para estructura del response
  }
}
```

### A.6 — Crear `LlmModule` en API

**Archivo nuevo:** `apps/api/src/llm/llm.module.ts`

Exporta `LLMUsageService` y `LLMModelsService` (creado en Fase B).

### A.7 — Integrar tracking en callers

**`libs/analysis/src/lib/llm/llm-analyzer.ts`:**

`LLMAnalyzer` ya no puede llamar a `LLMUsageService` directamente (no tiene acceso a DI de NestJS). Solución: retornar el `usage` junto con el resultado del análisis para que el caller lo registre.

```typescript
// LLMAnalyzer.analyze() retorna:
export interface LLMAnalysisResult {
  decision: LLMDecision;
  usage: LLMUsage;
}
```

El caller (SubAgentService / TradingEngine) es quien llama a `LLMUsageService.log()` con el `userId` disponible.

**`apps/api/src/orchestrator/sub-agent.service.ts`:**

`SubAgentService.call()` actualmente retorna `Promise<string>` y llama `provider.complete(systemPrompt, userPrompt)`.
Debe desestructurar `{ text, usage }` del nuevo `LLMResponse`, inyectar `LLMUsageService`, y hacer log.

```typescript
// Antes:
return await provider.complete(systemPrompt, userPrompt);

// Después:
const { text, usage } = await provider.complete(systemPrompt, userPrompt);
await this.llmUsageService.log({
  userId,
  provider: /* del credential */,
  model: /* del credential */,
  usage,
  source: /* CHAT | TRADING según contexto */,
});
return text; // mantener retorno string para no romper callers del orchestrator
```

**`apps/api/src/chat/chat.service.ts`:**

> **⚠️ IMPORTANTE**: `ChatService` NO usa `LLMProviderClient.complete()`. Tiene métodos privados
> `streamClaude()`, `streamOpenAI()`, `streamGroq()` que hacen llamadas axios directas con
> `responseType: 'stream'` para SSE. El tracking requiere:

1. Inyectar `LLMUsageService` en el constructor
2. Modificar `streamClaude()`: parsear evento `message_delta` con `usage.output_tokens` del stream de Anthropic
3. Modificar `streamOpenAI()` y `streamGroq()`: agregar `stream_options: { include_usage: true }` al request body; parsear `usage` del último chunk
4. Crear `streamGemini()`: streaming nativo de Gemini (SSE con `generateContent?alt=sse`)
5. Crear `streamMistral()`: mismo formato que OpenAI (endpoint `https://api.mistral.ai/v1/chat/completions` con `stream: true`)
6. Agregar cases `GEMINI` y `MISTRAL` en el switch de provider del método de routing
7. Agregar `GEMINI` y `MISTRAL` a `PROVIDER_LABELS` y `PROVIDER_MODELS`

---

## Fase B — Backend API endpoints

**Criterios de aceptación:**

- `GET /users/me/llm/CLAUDE/models` retorna modelos de Anthropic si la API key es válida
- `GET /users/me/llm/usage` retorna stats correctas (testeado con datos seed)
- Caché de 5 min funciona (segunda llamada no llama a API externa)
- Error 502 cuando la API key del proveedor es inválida

### B.1 — Crear `LLMModelsService`

**Archivo nuevo:** `apps/api/src/llm/llm-models.service.ts`

```typescript
@Injectable()
export class LLMModelsService {
  private cache = new Map<
    string,
    { data: ProviderModel[]; fetchedAt: number }
  >();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 min

  constructor(private prisma: PrismaService) {}

  async getModels(
    userId: string,
    provider: LLMProvider,
  ): Promise<ProviderModelsResponse> {
    const cacheKey = `${userId}:${provider}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL) {
      return {
        provider,
        models: cached.data,
        fetchedAt: new Date(cached.fetchedAt).toISOString(),
      };
    }
    // ... obtener API key del usuario, llamar al proveedor, filtrar y enriquecer con MODEL_PRICING
  }
}
```

**Filtrado de modelos por proveedor:**

- **Anthropic**: incluir solo `type === 'model'` con ID que contenga `claude`
- **OpenAI**: incluir solo `id` que empiece con `gpt`; excluir `whisper`, `dall-e`, `tts-`, `embedding`
- **Groq**: incluir solo modelos con `context_window` (modelos de texto); excluir `whisper`
- **Gemini**: incluir solo los que tengan `supportedGenerationMethods` conteniendo `generateContent`; excluir `embedding`, `imagen`, `veo`, `lyria`, `tts`, `aqa`
- **Mistral**: incluir solo modelos con `capabilities.completion_chat === true`; excluir `embed`, `moderation`, `tts`, `transcribe`

### B.2 — Endpoints en `UsersController`

Agregar a `apps/api/src/users/users.controller.ts`:

```typescript
@Get('me/llm/:provider/models')
@UseGuards(JwtAuthGuard)
getProviderModels(@GetUser() user, @Param('provider') provider: string) {
  return this.llmModelsService.getModels(user.id, provider as LLMProvider);
}

@Get('me/llm/usage')
@UseGuards(JwtAuthGuard)
getLLMUsage(@GetUser() user, @Query('period') period = '30d') {
  return this.llmUsageService.getStats(user.id, period);
}
```

> Alternativa: módulo `/llm` separado con su propio controller. Preferir consistencia con la estructura existente (Users controller para datos del usuario).

### B.3 — Tests unitarios

**Archivos de test:**

- `apps/api/src/llm/llm-usage.service.spec.ts`
- `apps/api/src/llm/llm-models.service.spec.ts`

---

## Fase C — Frontend: dynamic model selector

**Criterios de aceptación:**

- El selector en Settings > AI muestra los modelos del proveedor cargados desde la API
- Muestra spinner durante carga
- Si la API falla → fallback a lista estática
- Los modelos deprecated se muestran con badge "deprecated"
- Modelos actualizados propagados a `onboarding.tsx` y `news-feed.tsx`

### C.1 — Nuevos hooks

**Archivo:** `apps/web/src/hooks/use-llm.ts` (nuevo o extender `use-user.ts`)

```typescript
export function useLLMProviderModels(provider: string, enabled: boolean) {
  return useQuery({
    queryKey: ['llm-models', provider],
    queryFn: () =>
      api.get(`/users/me/llm/${provider}/models`).then((r) => r.data),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useLLMUsageStats(period: string = '30d') {
  return useQuery({
    queryKey: ['llm-usage', period],
    queryFn: () =>
      api.get(`/users/me/llm/usage?period=${period}`).then((r) => r.data),
    staleTime: 60 * 1000,
  });
}
```

### C.2 — Componente `DynamicModelSelect`

**Archivo nuevo:** `apps/web/src/components/settings/dynamic-model-select.tsx`

Props:

```typescript
interface DynamicModelSelectProps {
  provider: string;
  isProviderActive: boolean; // tiene API key guardada
  value: string;
  onChange: (model: string) => void;
  fallbackModels: string[];
}
```

Muestra en el dropdown:

- Nombre del modelo (del catálogo `label` si disponible)
- Context window abreviado
- Precio (si disponible en MODEL_PRICING)
- Badge `deprecated` si aplica

### C.3 — Actualización de `settings.tsx`

Reemplazar el `<select>` estático por `<DynamicModelSelect>` para cada proveedor.

Actualizar el array `LLM_PROVIDERS` con los **5 proveedores** y modelos actualizados como fallback:

```typescript
const LLM_PROVIDERS = [
  {
    value: 'CLAUDE',
    label: 'Anthropic Claude',
    models: [
      'claude-opus-4-6',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ],
  },
  {
    value: 'OPENAI',
    label: 'OpenAI',
    models: ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano'],
  },
  {
    value: 'GROQ',
    label: 'Groq',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'openai/gpt-oss-120b',
    ],
  },
  {
    value: 'GEMINI',
    label: 'Google Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'],
  },
  {
    value: 'MISTRAL',
    label: 'Mistral AI',
    models: [
      'mistral-small-latest',
      'mistral-medium-latest',
      'mistral-large-latest',
    ],
  },
];
```

### C.4 — Actualizar modelos en otros archivos

> **⚠️ Nota v1.2**: Los arrays actuales son inconsistentes entre archivos (ver Spec 31 §13.3).
> Aprovechar esta tarea para **unificar** todos los arrays con los mismos modelos actualizados.

Actualizar los arrays hardcodeados en:

- `apps/api/src/chat/chat.service.ts` → `PROVIDER_MODELS` y `PROVIDER_LABELS` (agregar `GEMINI` y `MISTRAL`, remover `gpt-4-turbo` y `mixtral-8x7b-32768` deprecated)
- `apps/web/src/pages/dashboard/news-feed.tsx` → `LLM_PROVIDERS` (5 providers, formato `{ value, label }[]` por modelo)
- `apps/web/src/pages/onboarding.tsx` → `LLM_PROVIDERS` (5 providers, agregar `helpLink` y `helpLinkText` para Gemini y Mistral)
- `apps/web/src/components/chat/llm-selector.tsx` → `PROVIDER_COLORS` agregar `GEMINI: 'text-blue-400'` y `MISTRAL: 'text-orange-400'`
- `apps/api/src/auth/dto/auth.dto.ts` → `LLMKeyDto` `@ApiProperty` enum actualizar a `['CLAUDE', 'OPENAI', 'GROQ', 'GEMINI', 'MISTRAL']`

---

## Fase D — Frontend: usage dashboard

**Criterios de aceptación:**

- El panel se muestra en Settings > tab AI debajo de la lista de proveedores
- Muestra totales, tabla por proveedor/modelo y por origen
- El período es seleccionable (7d / 30d / 90d / todo)
- Sparkline chart visible con datos reales
- Estado vacío correcto cuando no hay datos
- Disclaimer de costos estimados visible

### D.1 — Componente `AIUsageDashboard`

**Archivo nuevo:** `apps/web/src/components/settings/ai-usage-dashboard.tsx`

Sub-componentes internos:

- `UsageTotalsCard` — costo total, tokens totales
- `UsageByProviderTable` — tabla expandible con rows por modelo
- `UsageBySourceBreakdown` — barra de porcentajes por origen (Trading / Chat / Noticias)
- `UsageDailyChart` — sparkline con SVG o librería de charts existente

### D.2 — Integrar en `settings.tsx`

```tsx
{
  activeTab === 'ai' && (
    <>
      {/* Lista de providers existente */}
      <div>...LLM_PROVIDERS.map...</div>

      {/* Nuevo dashboard de uso */}
      <AIUsageDashboard />
    </>
  );
}
```

### D.3 — i18n

Agregar claves en `es.json` y `en.json`:

```json
{
  "settings.llmUsage.title": "Consumo de tokens y costos estimados",
  "settings.llmUsage.period": "Período",
  "settings.llmUsage.totalCost": "Costo total estimado",
  "settings.llmUsage.disclaimer": "Los costos son estimados...",
  "settings.llmUsage.noData": "Aún no hay uso registrado...",
  "settings.llmUsage.provider": "Proveedor",
  "settings.llmUsage.calls": "Llamadas",
  "settings.llmUsage.inputTokens": "Tokens entrada",
  "settings.llmUsage.outputTokens": "Tokens salida",
  "settings.llmUsage.estimatedCost": "Costo est.",
  "settings.llmUsage.bySource": "Por origen",
  "settings.llmUsage.dailyCost": "Costo diario"
}
```

---

## Criterios de aceptación globales

- [ ] Los **cinco** providers retornan `{ text, usage }` — no hay regresión en trading/chat
- [ ] `llm_usage_logs` se pobla con datos reales en cada llamada LLM
- [ ] `GET /users/me/llm/GEMINI/models` retorna modelos de Google filtrados
- [ ] `GET /users/me/llm/MISTRAL/models` retorna modelos de Mistral filtrados
- [ ] `GET /users/me/llm/CLAUDE/models` retorna modelos de Anthropic con precios
- [ ] `GET /users/me/llm/usage?period=30d` retorna estructura correcta
- [ ] Settings > AI tab muestra los 5 proveedores con selector dinámico de modelos
- [ ] Settings > AI tab muestra panel de uso con datos reales
- [ ] No hay modelos deprecated activos como opción por defecto
- [ ] Caché de modelos funciona (mock de axios verifica solo 1 llamada en 5 min)
- [ ] Tests unitarios de `LLMUsageService.getStats()` con datos seed

---

## Cierre de branch

```bash
gh pr create \
  --title "feat(llm): dynamic model discovery + usage & cost tracking — Spec 31" \
  --body "## Spec 31 v1.1 — LLM Provider Dashboard

### Cambios
- **5 providers**: Claude, OpenAI, Groq, **Google Gemini**, **Mistral AI**
- LLMProviderClient.complete() retorna usage (inputTokens/outputTokens) en todos
- Nueva tabla llm_usage_logs con tracking automático de cada llamada
- Endpoint GET /users/me/llm/:provider/models (proxy + caché 5min) para 5 providers
- Endpoint GET /users/me/llm/usage (stats por período)
- DynamicModelSelect en Settings > AI tab
- AIUsageDashboard con tabla de uso + sparkline de costo diario
- MODEL_PRICING actualizados para todos los proveedores
- Modelos deprecated removidos (gpt-4-turbo, mixtral-8x7b)

### Tests
- Unit: LLMUsageService, LLMModelsService
- Manual: Settings > AI tab con API key real de cada proveedor

Closes #31" \
  --base main \
  --head feature/llm-provider-dashboard
```
