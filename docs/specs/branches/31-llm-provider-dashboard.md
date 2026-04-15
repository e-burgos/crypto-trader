# Spec 31 — LLM Provider Dashboard: Modelos Dinámicos + Consumo y Costos

**Fecha:** 2026-04-13  
**Versión:** 1.5  
**Estado:** Propuesto  
**Branch:** `feature/llm-provider-dashboard`  
**Dependencias:** Spec 23 (settings-page), Spec 17 (ai-chatbot)

| Versión | Fecha      | Cambios                                                                                                                                                                                         |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-04-13 | Versión inicial (Claude / OpenAI / Groq)                                                                                                                                                        |
| 1.1     | 2026-04-13 | Agrega Google Gemini y Mistral AI como proveedores soportados                                                                                                                                   |
| 1.2     | 2026-04-13 | Auditoría de código actual: corrige callers reales, documenta inconsistencias de modelos, añade SubAgentService como caller, corrige ChatService (streaming directo, no LLMProviderClient)      |
| 1.3     | 2026-04-13 | Agrega Together AI como sexto proveedor (plataforma de inferencia open-weight, ideal para testing con free tier)                                                                                |
| 1.4     | 2026-04-14 | Ranking global de modelos, configuración primario/secundario para News Analysis y Trading Agent, model switching en Chat, auto-naming de agentes                                                |
| 1.5     | 2026-04-14 | Dashboard de consumo y disponibilidad por proveedor: mini-dashboard individual con tokens, costos, disponibilidad y uso. Health check proactivo + rate limit tracking. Fase I de implementación |

---

## 1. Resumen ejecutivo

Actualmente los modelos disponibles de cada proveedor LLM están **hardcodeados** en el frontend y el backend. Esto genera tres problemas:

1. **Modelos desactualizados**: los proveedores actualizan su catálogo continuamente. Los modelos `gpt-4-turbo` (deprecated) y `mixtral-8x7b-32768` (deprecated en Groq) ya no deben mostrarse.
2. **Sin visibilidad de consumo**: el usuario no sabe cuántos tokens ha consumido ni cuánto le ha costado usar el LLM en la plataforma.
3. **Cobertura de proveedores insuficiente**: solo soportamos 3 proveedores. Google Gemini, Mistral AI y Together AI tienen fuerte adopción en el sector financiero, dev community y ecosistema open-weight y no están disponibles.

Esta spec introduce:

- **Soporte para 6 proveedores**: Anthropic Claude, OpenAI, Groq, **Google Gemini**, **Mistral AI** y **Together AI**.
- **Listado dinámico de modelos**: la app consulta la API del proveedor con la API key del usuario y retorna los modelos realmente disponibles.
- **Dashboard de consumo por proveedor**: mini-dashboard individual por cada provider mostrando tokens consumidos, costos estimados, disponibilidad en tiempo real y desglose de uso por origen.
- **Tracking de uso y tokens**: cada llamada LLM registra `inputTokens`, `outputTokens` y `costUsd` calculado con un catálogo de precios estático mantenido en la API.
- **Dashboard de consumo** en Settings → tab "Modelos IA": tabla de uso por proveedor/modelo, costo estimado acumulado y período seleccionable.

> **¿Por qué Gemini, Mistral y Together AI?** Ver sección 12 — Análisis de adopción y justificación.

---

## 2. Arquitectura

### 2.1 Flujo de modelo dinámico

```
Frontend (Settings > AI tab)
  │
  ├─ Al hacer click en un provider con API key guardada
  │   └─ GET /users/me/llm/:provider/models
  │        └─ LLMModelsService
  │             └─ Proxy → API del proveedor
  │                  ├─ Anthropic → api.anthropic.com/v1/models
  │                  ├─ OpenAI   → api.openai.com/v1/models
  │                  ├─ Groq     → api.groq.com/openai/v1/models
  │                  ├─ Gemini   → generativelanguage.googleapis.com/v1beta/models
  │                  ├─ Mistral  → api.mistral.ai/v1/models
  │                  └─ Together → api.together.xyz/v1/models
  │                       └─ Retorna lista filtrada (solo text generation)
  │
  └─ Muestra select dinámico con los modelos del proveedor
```

### 2.2 Flujo de tracking de uso

```
Llamadas LLM sincrónicas (trading / analysis / orchestrator sub-agents)
  │
  └─ LLMProviderClient.complete(system, user)
       └─ Retorna { text: string, usage: LLMUsage }
            └─ El caller invoca LLMUsageService.log(userId, provider, model, usage, source)

Llamadas LLM streaming (chat)
  │
  └─ ChatService.streamClaude/streamOpenAI/streamGroq (axios directo, SSE)
       └─ Extraer usage del evento final del stream (message_stop / [DONE])
            └─ LLMUsageService.log(userId, provider, model, usage, 'CHAT')
```

> **Nota importante**: `ChatService` NO usa `LLMProviderClient.complete()`. Tiene métodos privados
> (`streamClaude`, `streamOpenAI`, `streamGroq`) que hacen llamadas axios directas con `stream: true`.
> El tracking para chat requiere parsear el evento final del stream para extraer usage metadata.
> Para streaming, Claude envía `message_delta` con `usage` al final, OpenAI/Groq incluyen `usage`
> en el último chunk cuando se usa `stream_options: { include_usage: true }`.

### 2.3 Componentes nuevos

| Componente                    | Tipo              | Responsabilidad                                 |
| ----------------------------- | ----------------- | ----------------------------------------------- |
| `LLMModelsService`            | NestJS Service    | Proxy a APIs de proveedores para listar modelos |
| `LLMUsageService`             | NestJS Service    | Log de llamadas + cálculo de costo              |
| `MODEL_PRICING`               | Constante backend | Catálogo de precios por modelo ($/1M tokens)    |
| `llm_usage_logs`              | Prisma Model      | Tabla de registro de uso                        |
| `LLMUsageLog` (frontend hook) | React Query       | Fetcher para stats de uso                       |
| `AIModelsDashboard`           | React component   | UI de uso y costos en Settings                  |
| `DynamicModelSelect`          | React component   | Select de modelos cargado dinámicamente         |

---

## 3. Modelos de datos

### 3.1 Nueva tabla: `LlmUsageLog` + actualización del enum `LLMProvider`

> **⚠️ El enum `LLMProvider` existe en DOS ubicaciones** que deben actualizarse simultáneamente:
>
> 1. `apps/api/prisma/schema.prisma` — fuente de verdad para la DB (actualmente: `CLAUDE | OPENAI | GROQ`)
> 2. `libs/shared/src/types/enums.ts` — usado por la lib `@crypto-trader/shared` (actualmente: `CLAUDE | OPENAI | GROQ`)
>
> Además, el enum generado por Prisma en `apps/api/generated/prisma/enums` se regenera automáticamente con `prisma generate`.

```prisma
// Extender el enum existente con los nuevos proveedores
enum LLMProvider {
  CLAUDE
  OPENAI
  GROQ
  GEMINI    // nuevo
  MISTRAL   // nuevo
  TOGETHER  // nuevo
}

model LlmUsageLog {
  id           String      @id @default(cuid())
  userId       String
  user         User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider     LLMProvider
  model        String
  inputTokens  Int
  outputTokens Int
  costUsd      Float       // calculado al momento con MODEL_PRICING
  source       LLMSource   // TRADING | CHAT | ANALYSIS | NEWS
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

### 3.2 Actualización de la interfaz `LLMProviderClient`

```typescript
// libs/analysis/src/lib/llm/llm-types.ts — ACTUALIZAR

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMResponse {
  text: string;
  usage: LLMUsage;
}

export interface LLMProviderClient {
  readonly name: string;
  // complete() ahora retorna LLMResponse en vez de string
  complete(systemPrompt: string, userPrompt: string): Promise<LLMResponse>;
}
```

> **Backward compatibility**: los callers actuales de `complete()` sólo usan `result.text`. El cambio implica actualizar todos los callers para desestructurar `{ text }`.

### 3.3 Catálogo de precios `MODEL_PRICING`

```typescript
// apps/api/src/llm/model-pricing.ts

export const MODEL_PRICING: Record<
  string,
  {
    input: number;
    output: number;
    label: string;
    contextWindow: number;
    deprecated?: boolean;
  }
> = {
  // Anthropic
  'claude-opus-4-6': {
    input: 5.0,
    output: 25.0,
    label: 'Claude Opus 4.6',
    contextWindow: 1_000_000,
  },
  'claude-sonnet-4-6': {
    input: 3.0,
    output: 15.0,
    label: 'Claude Sonnet 4.6',
    contextWindow: 1_000_000,
  },
  'claude-haiku-4-5-20251001': {
    input: 1.0,
    output: 5.0,
    label: 'Claude Haiku 4.5',
    contextWindow: 200_000,
  },
  // Legacy (mantener para registros históricos)
  'claude-opus-4-5': {
    input: 5.0,
    output: 25.0,
    label: 'Claude Opus 4.5',
    contextWindow: 200_000,
  },
  'claude-sonnet-4-20250514': {
    input: 3.0,
    output: 15.0,
    label: 'Claude Sonnet 4',
    contextWindow: 200_000,
  },
  'claude-3-5-sonnet-20241022': {
    input: 3.0,
    output: 15.0,
    label: 'Claude 3.5 Sonnet',
    contextWindow: 200_000,
  },
  'claude-3-haiku-20240307': {
    input: 0.25,
    output: 1.25,
    label: 'Claude 3 Haiku',
    contextWindow: 200_000,
  },
  // OpenAI
  'gpt-5.4': {
    input: 2.5,
    output: 15.0,
    label: 'GPT-5.4',
    contextWindow: 1_000_000,
  },
  'gpt-5.4-mini': {
    input: 0.75,
    output: 4.5,
    label: 'GPT-5.4 Mini',
    contextWindow: 400_000,
  },
  'gpt-5.4-nano': {
    input: 0.2,
    output: 1.25,
    label: 'GPT-5.4 Nano',
    contextWindow: 400_000,
  },
  // Legacy OpenAI
  'gpt-4o': {
    input: 2.5,
    output: 10.0,
    label: 'GPT-4o',
    contextWindow: 128_000,
  },
  'gpt-4o-mini': {
    input: 0.15,
    output: 0.6,
    label: 'GPT-4o Mini',
    contextWindow: 128_000,
  },
  'gpt-4-turbo': {
    input: 10.0,
    output: 30.0,
    label: 'GPT-4 Turbo (legacy)',
    contextWindow: 128_000,
    deprecated: true,
  },
  // Groq
  'llama-3.3-70b-versatile': {
    input: 0.59,
    output: 0.79,
    label: 'Llama 3.3 70B',
    contextWindow: 131_072,
  },
  'llama-3.1-8b-instant': {
    input: 0.05,
    output: 0.08,
    label: 'Llama 3.1 8B Instant',
    contextWindow: 131_072,
  },
  'openai/gpt-oss-120b': {
    input: 0.15,
    output: 0.6,
    label: 'GPT OSS 120B',
    contextWindow: 131_072,
  },
  'meta-llama/llama-4-scout-17b-16e-instruct': {
    input: 0.11,
    output: 0.34,
    label: 'Llama 4 Scout 17B',
    contextWindow: 131_072,
  },
  // Legacy Groq
  'mixtral-8x7b-32768': {
    input: 0.24,
    output: 0.24,
    label: 'Mixtral 8x7B (deprecated)',
    contextWindow: 32_768,
    deprecated: true,
  },
  // Google Gemini (solo modelos de text generation)
  'gemini-2.5-pro': {
    input: 1.25,
    output: 10.0,
    label: 'Gemini 2.5 Pro',
    contextWindow: 1_000_000,
  },
  'gemini-2.5-flash': {
    input: 0.3,
    output: 2.5,
    label: 'Gemini 2.5 Flash',
    contextWindow: 1_000_000,
  },
  'gemini-2.5-flash-lite': {
    input: 0.1,
    output: 0.4,
    label: 'Gemini 2.5 Flash-Lite',
    contextWindow: 1_000_000,
  },
  'gemini-3.1-pro-preview': {
    input: 2.0,
    output: 12.0,
    label: 'Gemini 3.1 Pro Preview',
    contextWindow: 2_000_000,
  },
  'gemini-3-flash-preview': {
    input: 0.5,
    output: 3.0,
    label: 'Gemini 3 Flash Preview',
    contextWindow: 1_000_000,
  },
  'gemini-3.1-flash-lite-preview': {
    input: 0.25,
    output: 1.5,
    label: 'Gemini 3.1 Flash-Lite Preview',
    contextWindow: 1_000_000,
  },
  // Mistral AI
  'mistral-large-latest': {
    input: 2.0,
    output: 6.0,
    label: 'Mistral Large 3',
    contextWindow: 131_072,
  },
  'mistral-medium-latest': {
    input: 0.4,
    output: 2.0,
    label: 'Mistral Medium 3.1',
    contextWindow: 131_072,
  },
  'mistral-small-latest': {
    input: 0.1,
    output: 0.3,
    label: 'Mistral Small 4',
    contextWindow: 131_072,
  },
  'open-mistral-nemo': {
    input: 0.15,
    output: 0.15,
    label: 'Mistral Nemo 12B',
    contextWindow: 131_072,
  },
  // Together AI (plataforma de inferencia open-weight)
  'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8': {
    input: 0.27,
    output: 0.85,
    label: 'Llama 4 Maverick 17B',
    contextWindow: 1_000_000,
  },
  'meta-llama/Llama-4-Scout-17B-16E-Instruct': {
    input: 0.18,
    output: 0.59,
    label: 'Llama 4 Scout 17B',
    contextWindow: 512_000,
  },
  'deepseek-ai/DeepSeek-R1': {
    input: 3.0,
    output: 7.0,
    label: 'DeepSeek R1',
    contextWindow: 163_840,
  },
  'Qwen/Qwen3-235B-A22B-fp8': {
    input: 0.5,
    output: 0.5,
    label: 'Qwen 3 235B',
    contextWindow: 131_072,
  },
  'meta-llama/Llama-3.3-70B-Instruct-Turbo': {
    input: 0.59,
    output: 0.79,
    label: 'Llama 3.3 70B Turbo',
    contextWindow: 131_072,
  },
};
```

> **Nota**: Los precios son en USD por 1M tokens. La fórmula es: `costUsd = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000`  
> Los precios de Gemini reflejan el tier Paid (prompts ≤ 200k tokens) según pricing page de Google AI Studio (2026-04-09).  
> Los precios de Mistral reflejan el tier de API pública según la plateforme de Mistral AI.
> Los precios de Together AI reflejan el tier serverless según la página de precios de Together (2026-04-13).

> **⚠️ Nota v1.2 — Modelos default actuales en providers**:
>
> - `ClaudeProvider` default: `claude-sonnet-4-20250514` (no `claude-sonnet-4-6`)
> - `OpenAIProvider` default: `gpt-4o-mini`
> - `GroqProvider` default: `llama-3.3-70b-versatile`
>
> El `MODEL_PRICING` incluye modelos actuales Y los propuestos como actualización.
> Al implementar, actualizar también los defaults de cada provider constructor si se quiere migrar a modelos más nuevos.

---

## 4. API Endpoints

### 4.1 `GET /users/me/llm/:provider/models`

Lista los modelos disponibles del proveedor consultando su API directamente con la API key del usuario.

**Auth:** JWT obligatorio  
**Parámetros**: `provider: 'CLAUDE' | 'OPENAI' | 'GROQ' | 'GEMINI' | 'MISTRAL' | 'TOGETHER'`

**Response `200`:**

```typescript
{
  provider: string;
  models: Array<{
    id: string; // API ID del modelo
    name: string; // Nombre legible
    contextWindow: number;
    maxOutput?: number;
    pricing?: {
      // Desde MODEL_PRICING si disponible
      input: number; // USD / 1M tokens
      output: number; // USD / 1M tokens
    };
    deprecated?: boolean;
  }>;
  fetchedAt: string; // ISO timestamp
}
```

**Response `404`:** El usuario no tiene API key configurada para ese proveedor  
**Response `502`:** El proveedor no respondió / API key inválida

**Caché**: TTL 5 minutos por usuario+proveedor (in-memory o Redis si disponible)

---

### 4.2 `GET /users/me/llm/usage`

Retorna estadísticas de uso agregadas del usuario.

**Auth:** JWT obligatorio  
**Query params:**

- `period`: `'7d' | '30d' | '90d' | 'all'` (default: `'30d'`)
- `provider`: opcional, filtra por proveedor

**Response `200`:**

```typescript
{
  period: string;
  from: string; // ISO date
  to: string; // ISO date
  totalCostUsd: number; // suma total
  totalInputTokens: number;
  totalOutputTokens: number;
  byProvider: Array<{
    provider: string;
    label: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    callCount: number;
    byModel: Array<{
      model: string;
      label: string;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      callCount: number;
    }>;
    bySource: Array<{
      source: 'TRADING' | 'CHAT' | 'ANALYSIS' | 'NEWS';
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      callCount: number;
    }>;
  }>;
  dailySeries: Array<{
    // para gráfico de línea
    date: string; // YYYY-MM-DD
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
  }>;
}
```

---

### 4.3 Provider APIs consultadas (backend-only, no expuestas al frontend)

| Proveedor     | Endpoint                                                                | Auth Header                                         | Formato respuesta                                                     |
| ------------- | ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| Anthropic     | `GET https://api.anthropic.com/v1/models`                               | `x-api-key: {key}`, `anthropic-version: 2023-06-01` | `{ data: [{ id, display_name, type }] }`                              |
| OpenAI        | `GET https://api.openai.com/v1/models`                                  | `Authorization: Bearer {key}`                       | `{ data: [{ id, created, object }] }`                                 |
| Groq          | `GET https://api.groq.com/openai/v1/models`                             | `Authorization: Bearer {key}`                       | `{ data: [{ id, context_window }] }`                                  |
| Google Gemini | `GET https://generativelanguage.googleapis.com/v1beta/models?key={key}` | (key en query param)                                | `{ models: [{ name, supportedGenerationMethods, inputTokenLimit }] }` |
| Mistral AI    | `GET https://api.mistral.ai/v1/models`                                  | `Authorization: Bearer {key}`                       | `{ data: [{ id, capabilities.completion_chat }] }`                    |
| Together AI   | `GET https://api.together.xyz/v1/models`                                | `Authorization: Bearer {key}`                       | `{ data: [{ id, type, context_length }] }`                            |

**Filtros por proveedor para devolver solo modelos de text generation:**

- **Anthropic**: incluir `type === 'model'`, campo `id` contiene `claude-`
- **OpenAI**: incluir ids que empiecen con `gpt-`; excluir `whisper`, `dall-e`, `tts-`, `babbage`, `davinci`, `text-`
- **Groq**: incluir modelos con `context_window > 0`; excluir `whisper`
- **Gemini**: incluir solo los que tengan `supportedGenerationMethods` contiene `generateContent`; excluir modelos con `name` que contenga `embedding`, `aqa`, `imagen`, `veo`, `lyria`, `tts`
- **Mistral**: incluir solo modelos con `capabilities.completion_chat === true`; excluir modelos con `id` que contenga `embed`, `moderation`, `tts`, `transcribe`
- **Together**: incluir solo modelos con `type === 'chat'`; excluir modelos con `id` que contenga `embed`, `rerank`, `moderation`, `vision` (a menos que también soporten chat)

---

## 5. Cambios en providers existentes

### 5.1 Actualización de `ClaudeProvider`

```typescript
async complete(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
  const { data } = await axios.post(/* ... */);
  return {
    text: data.content?.[0]?.text ?? '',
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    },
  };
}
```

### 5.2 Actualización de `OpenAIProvider`

```typescript
async complete(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
  const { data } = await axios.post(/* ... */);
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}
```

### 5.3 Actualización de `GroqProvider`

```typescript
async complete(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
  const { data } = await axios.post(/* ... */);
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}
```

### 5.4 Nuevo `GeminiProvider`

**Archivo nuevo:** `libs/analysis/src/lib/llm/gemini.provider.ts`

Gemini usa una API nativa diferente a OpenAI (no compatible con `chat/completions`). Utiliza el endpoint `generateContent`:

```typescript
export class GeminiProvider implements LLMProviderClient {
  readonly name = 'gemini';
  private readonly apiKey: string;
  private readonly model: string;

  async complete(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<LLMResponse> {
    const { data } = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30000 },
    );
    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }
}
```

### 5.5 Nuevo `MistralProvider`

**Archivo nuevo:** `libs/analysis/src/lib/llm/mistral.provider.ts`

Mistral es totalmente compatible con el formato OpenAI (`chat/completions`):

```typescript
export class MistralProvider implements LLMProviderClient {
  readonly name = 'mistral';

  async complete(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<LLMResponse> {
    const { data } = await axios.post(
      'https://api.mistral.ai/v1/chat/completions',
      {
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }
}
```

### 5.7 Nuevo `TogetherProvider`

**Archivo nuevo:** `libs/analysis/src/lib/llm/together.provider.ts`

Together AI es totalmente compatible con el formato OpenAI (`chat/completions`):

```typescript
export class TogetherProvider implements LLMProviderClient {
  readonly name = 'together';

  async complete(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<LLMResponse> {
    const { data } = await axios.post(
      'https://api.together.xyz/v1/chat/completions',
      {
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }
}
```

> **Nota de compatibilidad**: OpenAI, Groq, Mistral y Together AI comparten el mismo formato de `usage` (`prompt_tokens`/`completion_tokens`). Gemini usa `usageMetadata.promptTokenCount`/`candidatesTokenCount`. Anthropic usa `usage.input_tokens`/`output_tokens`.

---

## 6. Integración de tracking en callers existentes

Los servicios que llaman a LLMs deben registrar el usage. Hay dos patrones distintos:

### 6.1 Callers que usan `LLMProviderClient.complete()` (sincrónico)

Estos desestructuran `{ text, usage }` de la respuesta y pasan el usage al `LLMUsageService`.

| Servicio                 | Source label           | Archivo                                             | Notas                                                                                      |
| ------------------------ | ---------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `LLMAnalyzer.analyze()`  | `ANALYSIS` / `TRADING` | `libs/analysis/src/lib/llm/llm-analyzer.ts`         | Lib pura (sin DI). Retornar `LLMAnalysisResult { decision, usage }` para que el caller log |
| `SubAgentService.call()` | `CHAT` / `TRADING`     | `apps/api/src/orchestrator/sub-agent.service.ts`    | Usa `provider.complete()` directamente. Cambiar retorno de `string` a `LLMResponse`        |
| `OrchestratorService`    | `CHAT` / `TRADING`     | `apps/api/src/orchestrator/orchestrator.service.ts` | Llama a `SubAgentService.call()` — recibirá el usage transitivamente                       |

### 6.2 Callers que usan streaming directo (axios SSE)

Estos NO usan `LLMProviderClient` y requieren cambios en los métodos de streaming.

| Servicio                                                        | Source label | Archivo                             | Notas                                                                                                                         |
| --------------------------------------------------------------- | ------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ChatService.streamClaude()`                                    | `CHAT`       | `apps/api/src/chat/chat.service.ts` | Parsear evento `message_delta` con `usage` del stream de Anthropic                                                            |
| `ChatService.streamOpenAI()`                                    | `CHAT`       | `apps/api/src/chat/chat.service.ts` | Agregar `stream_options: { include_usage: true }` al request; parsear `usage` del último chunk                                |
| `ChatService.streamGroq()`                                      | `CHAT`       | `apps/api/src/chat/chat.service.ts` | Mismo patrón que OpenAI (formato compatible)                                                                                  |
| Nuevos: `streamGemini()`, `streamMistral()`, `streamTogether()` | `CHAT`       | `apps/api/src/chat/chat.service.ts` | Crear métodos de streaming para los nuevos providers. Mistral y Together: formato OpenAI. Gemini: formato nativo (SSE propio) |

> **⚠️ Corrección v1.2**: La spec v1.1 asumía que `ChatService` usaba `LLMProviderClient.complete()`. En realidad,
> `ChatService` tiene métodos privados `streamClaude()`, `streamOpenAI()`, `streamGroq()` que hacen llamadas
> axios directas con `stream: true` y `responseType: 'stream'` para SSE. El tracking de chat requiere:
>
> 1. Extraer usage tokens del evento final de cada stream provider
> 2. Crear `streamGemini()`, `streamMistral()` y `streamTogether()` como nuevos métodos de streaming
> 3. Agregar los nuevos providers al switch de `ChatService` (actualmente solo 3 cases)

> **Nota**: No existe `NewsFeedService` en la API. El análisis de noticias lo maneja `news-analysis.scheduler.ts`
> a través del `OrchestratorService` → `SubAgentService`, por lo que se trackea como `ANALYSIS` transitivamente.
> Se elimina la referencia a `NewsFeedService` y source `NEWS` de la tabla para esta versión.

---

## 7. Frontend — Cambios en Settings > Tab "Modelos IA"

### 7.1 `DynamicModelSelect` — Selector de modelo dinámico

Reemplaza el `<select>` hardcodeado actual. Al montar:

1. Verifica si el proveedor tiene API key guardada (`isActive`)
2. Si sí → llama `GET /users/me/llm/:provider/models`
3. Muestra spinner durante la carga
4. Puebla el select con los modelos recibidos
5. Si hay error → muestra los modelos del fallback estático (lista hardcodeada mínima)

```
┌─────────────────────────────────────────────────────┐
│  Modelo                                             │
│  ┌────────────────────────────────────────────────┐ │
│  │  Claude Sonnet 4.6                         ▼   │ │
│  │  ─────────────────────────────────────────     │ │
│  │  ✓ claude-sonnet-4-6     1M ctx  $3/$15/MTok   │ │
│  │    claude-opus-4-6       1M ctx  $5/$25/MTok   │ │
│  │    claude-haiku-4-5      200k ctx $1/$5/MTok   │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

Cada opción del dropdown muestra:

- Nombre del modelo
- Ventana de contexto (abreviada: `1M`, `200k`, `131k`)
- Precio input/output en formato compacto

### 7.2 `AIUsageDashboard` — Panel de consumo

Sección nueva debajo de la lista de proveedores en el tab "Modelos IA".

```
┌──────────────────────────────────────────────────────────────────┐
│  📊 Consumo de tokens y costos estimados                         │
│  Período: [30 días ▼]                            [Actualizar]    │
│                                                                    │
│  Total acumulado: $0.0042 USD  │  12,450 tokens                  │
│                                                                    │
│  ┌──────────────┬──────────┬──────────┬──────────┬────────────┐  │
│  │ Proveedor    │ Llamadas │ In Toks  │ Out Toks │ Costo est. │  │
│  ├──────────────┼──────────┼──────────┼──────────┼────────────┤  │
│  │ Anthropic    │    23    │  8,200   │  2,100   │  $0.0031   │  │
│  │   └ sonnet-4 │    23    │  8,200   │  2,100   │  $0.0031   │  │
│  │ Groq         │    18    │  1,800   │    350   │  $0.0011   │  │
│  │   └ llama-70b│    18    │  1,800   │    350   │  $0.0011   │  │
│  └──────────────┴──────────┴──────────┴──────────┴────────────┘  │
│                                                                    │
│  Por origen:  Trading 65%  │  Chat 25%  │  Noticias 10%          │
│                                                                    │
│  ──── Costo diario ────────────────────────────────────────────   │
│  [sparkline chart últimos 30 días]                                 │
└──────────────────────────────────────────────────────────────────┘
```

**Notas UI:**

- Los costos son **estimados** — se muestra disclaimer "Los costos son estimados basados en precios publicados por cada proveedor y pueden diferir de tu factura real."
- Si no hay datos → estado vacío: "Aún no hay uso registrado. Comienza a usar los agentes para ver estadísticas."
- El gráfico sparkline usa la `dailySeries` del endpoint.

---

## 8. Caché y rendimiento

- **Modelos dinámicos**: cacheados 5 minutos en memoria (Map en el servicio) — evita múltiples llamadas a la API del proveedor por sesión.
- **Usage stats**: sin caché propio — la query a `llm_usage_logs` es ligera (filtra por `userId` + rango de fechas).
- **Tabla `llm_usage_logs`**: índice compuesto `(userId, createdAt)` e índice `(userId, provider)` — suficiente para las queries de dashboard.

---

## 9. Fases de implementación

### Fase A — Backend core (providers + tracking)

1. Migración Prisma: nuevo modelo `LlmUsageLog` + enum `LLMSource` + extender `LLMProvider` con `GEMINI`, `MISTRAL` y `TOGETHER`
2. Actualizar enum `LLMProvider` en `libs/shared/src/types/enums.ts` (espejo del enum Prisma)
3. Actualizar `LLMProviderClient` interface: `complete()` → `LLMResponse`
4. Actualizar `ClaudeProvider`, `OpenAIProvider`, `GroqProvider` para retornar usage
5. Crear `GeminiProvider` (nuevo, API nativa)
6. Crear `MistralProvider` (nuevo, compatible OpenAI)
   6b. Crear `TogetherProvider` (nuevo, compatible OpenAI)
7. Actualizar `llm-factory.ts` para incluir `GEMINI`, `MISTRAL` y `TOGETHER`
8. Actualizar `LLMAnalyzer.analyze()` — retornar `{ decision, usage }` en vez de solo `LLMDecision`
9. Actualizar `SubAgentService.call()` — desestructurar `{ text, usage }` del `provider.complete()` (actualmente retorna `string`)
10. Crear `LLMUsageService` con método `log()` y `getStats()`
11. Crear `MODEL_PRICING` constante (con los 6 proveedores)
12. Integrar `LLMUsageService.log()` en `SubAgentService` y callers de `LLMAnalyzer`
13. Agregar tracking en métodos de streaming de `ChatService`:
    - Modificar `streamClaude()` para capturar `message_delta.usage` al final del stream
    - Modificar `streamOpenAI()` y `streamGroq()` para enviar `stream_options: { include_usage: true }` y capturar usage del último chunk
    - Crear `streamGemini()`, `streamMistral()` y `streamTogether()` para streaming con los nuevos providers
    - Agregar cases `GEMINI`, `MISTRAL` y `TOGETHER` al switch de `ChatService`

### Fase B — Backend API endpoints

1. Crear `LLMModelsService` con caché en memoria (5 min TTL)
2. Endpoint `GET /users/me/llm/:provider/models`
3. Endpoint `GET /users/me/llm/usage`
4. Tests unitarios para `LLMUsageService` y `LLMModelsService`

### Fase C — Frontend dynamic models

> **⚠️ Estado actual de inconsistencias de modelos (v1.2)**:
> Los 4 archivos que listan modelos tienen listas **diferentes** entre sí:
>
> - `settings.tsx`: Claude usa `claude-opus-4-5`, `claude-3-5-sonnet-20241022`, `claude-3-haiku-20240307` (más viejos)
> - `news-feed.tsx`: Claude usa `claude-sonnet-4-20250514`, `claude-opus-4-20250514` (más nuevos); OpenAI incluye `gpt-4.1-mini`
> - `onboarding.tsx`: Claude usa `claude-3-5-sonnet-20241022`, `claude-3-haiku-20240307` (legacy)
> - `chat.service.ts` (backend): incluye `gpt-4-turbo` (deprecated) y `mixtral-8x7b-32768` (deprecated)
>
> El `DynamicModelSelect` resuelve esto: la fuente de verdad pasan a ser las APIs de los providers.
> Los fallback estáticos sólo se usan si la API falla, y deben unificarse.

1. Hook `useLLMProviderModels(provider)` → React Query
2. Hook `useLLMUsageStats(period)` → React Query
3. Componente `DynamicModelSelect` para Settings
4. Actualizar `LLM_PROVIDERS` en `settings.tsx` — agregar Gemini, Mistral y Together con modelos de fallback **actualizados**
5. Actualizar `PROVIDER_MODELS` y `PROVIDER_LABELS` en `chat.service.ts` (backend) — agregar `GEMINI`, `MISTRAL` y `TOGETHER`, remover deprecated
6. Actualizar `LLM_PROVIDERS` en `news-feed.tsx` — agregar Gemini, Mistral y Together (nota: este archivo usa formato `{ value, label }` por modelo, no strings planos)
7. Actualizar `LLM_PROVIDERS` en `onboarding.tsx` — agregar Gemini, Mistral y Together con `helpLink` y `helpLinkText`
8. Agregar colores de provider en `llm-selector.tsx` `PROVIDER_COLORS`: `GEMINI: 'text-blue-400'`, `MISTRAL: 'text-orange-400'` y `TOGETHER: 'text-emerald-400'`
9. Actualizar `LLMKeyDto` en `apps/api/src/auth/dto/auth.dto.ts` — agregar `GEMINI`, `MISTRAL` y `TOGETHER` al array del decorator `@ApiProperty`

### Fase D — Frontend usage dashboard

1. Componente `AIUsageDashboard` (tabla + totales + breakdown por origen)
2. Sparkline chart de costo diario (usando librería de charts existente o SVG inline)
3. Integrar en `settings.tsx` tab `ai`
4. Localización i18n (`es` / `en`) para nuevos textos

---

## 10. Out of scope

- Alertas de presupuesto (límite de gasto configurable) — futura spec
- Exportar CSV de uso — futura spec
- Precios en tiempo real vía API de facturación de los proveedores (ninguno expone esto públicamente con API key básica)
- Facturación real vs. estimada — los proveedores no exponen el consumo real via API sin tier especial

---

## 11. Decisiones de diseño

| Decisión                                          | Alternativa descartada              | Razón                                                                                                                                  |
| ------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Catálogo de precios estático (`MODEL_PRICING`)    | Scraping de páginas de pricing      | Pricing pages no tienen API pública; el catálogo estático es mantenible y transparente                                                 |
| Caché en memoria (Map) para modelos               | Redis                               | El tiempo de vida de 5 min hace que Redis sea over-engineering. Un Map con timestamp es suficiente                                     |
| `LLMUsageService` separado del provider           | Lógica de tracking en cada provider | Principio de responsabilidad única. Los providers sólo completan texto, el tracking es incumbencia del servicio                        |
| `dailySeries` incluida en el response de `/usage` | Endpoint separado para el gráfico   | Reduce roundtrips. El agregado diario es barato de calcular en la misma query                                                          |
| Deprecados visibles pero marcados                 | Ocultar modelos deprecated          | Los usuarios pueden tener créditos guardados, historial de uso o preferencia por modelos legacy                                        |
| GeminiProvider usa API nativa (`generateContent`) | OpenAI-compat layer de Google       | El OpenAI compatibility layer de Google es experimental. La API nativa es más estable y tiene mejor soporte de `usageMetadata`         |
| Mistral usa endpoint estándar OpenAI-compat       | SDK propio de Mistral               | El SDK de Mistral agrega dependencia innecesaria; el endpoint HTTP es idéntico al formato OpenAI                                       |
| Together AI incluido para testing                 | Solo Groq para open-weight          | Together ofrece modelos únicos (DeepSeek R1, Qwen 3) no disponibles en Groq, free tier de $5, y es ideal para validar flujos sin costo |

---

## 12. Análisis de adopción y justificación de proveedores

### 12.1 Panorama de adopción (Abril 2026)

Basado en relevancia para desarrolladores y el sector financiero/fintech:

| Proveedor              | Tier   | Fortalezas para fintech                                                                               | Adopción dev |
| ---------------------- | ------ | ----------------------------------------------------------------------------------------------------- | ------------ |
| **Anthropic (Claude)** | Tier 1 | Contexto largo (1M tokens), análisis de documentos financieros, compliance Q&A, safety                | ⭐⭐⭐⭐⭐   |
| **OpenAI (GPT)**       | Tier 1 | Más utilizado globalmente, ecosistema maduro, function calling avanzado                               | ⭐⭐⭐⭐⭐   |
| **Google (Gemini)**    | Tier 1 | 2M tokens context, Grounding con Google Search, costo competitivo, integración con GCP                | ⭐⭐⭐⭐     |
| **Mistral AI**         | Tier 2 | GDPR-nativo (soberanía de datos europea), open-weight disponible, fintech europeo, precio/rendimiento | ⭐⭐⭐       |
| **Groq**               | Tier 2 | Velocidad de inferencia extrema (~500 tps), ideal para decisiones de trading en tiempo real           | ⭐⭐⭐       |
| **Together AI**        | Tier 2 | Catálogo amplio de open-weight (DeepSeek R1, Qwen 3, Llama 4), $5 free tier, ideal para testing       | ⭐⭐⭐       |

### 12.2 Justificación por proveedor

**Google Gemini** — por qué incluirlo:

- Context window de **2M tokens** (Gemini 3.1 Pro) — máximo del mercado, clave para análisis de historial de trading largo
- Tier de pricing más barato entre los frontier models: `gemini-2.5-flash` a $0.30/$2.50 contra `gpt-5.4-mini` a $0.75/$4.50
- **Free tier generoso** (Google AI Studio) — permite a usuarios empezar sin costo
- Grounding nativo con Google Search → análisis de noticias financieras más preciso
- Fuerte adopción en Asia-Pacific y enterprise con GCP
- API endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`

**Mistral AI** — por qué incluirlo:

- El único proveedor europeo Tier-2 con modelos de **soberanía de datos** (se puede desplegar en infra propia)
- **Muy popular en fintech europeo** (GDPR compliance, residencia de datos UE por defecto)
- Modelos open-weight disponibles: usuarios con infra propia no pagan por token
- `mistral-large-latest` compite con Claude Sonnet a menor precio ($2/$6 vs $3/$15)
- API totalmente compatible con el formato OpenAI → implementación trivial
- API endpoint: `https://api.mistral.ai/v1/chat/completions`

**Together AI** — por qué incluirlo:

- **$5 de crédito gratis** al registrar — ideal para testear la plataforma sin costo
- Catálogo amplio de **modelos open-weight** no disponibles en otros providers: DeepSeek R1, Qwen 3 235B, Llama 4 Maverick/Scout
- Modelos de razonamiento (DeepSeek R1) útiles para análisis financiero complejo
- Velocidad competitiva (~200 tps) con precios bajos (Llama 4 Scout a $0.18/$0.59)
- API **100% compatible con formato OpenAI** → implementación copy-paste del MistralProvider
- Permite validar que la plataforma funciona correctamente con N proveedores distintos usando modelos baratos
- API endpoint: `https://api.together.xyz/v1/chat/completions`

### 12.3 Proveedores NO incluidos y justificación

| Proveedor          | Razón de exclusión                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cohere**         | Fuerte en embeddings/RAG pero modelos de completion menos competitivos en 2026. Se puede agregar en Spec futura si hay demanda.                  |
| **xAI (Grok)**     | Prometedor pero uso limitado en enterprise fintech. API aún maturing.                                                                            |
| **Amazon Bedrock** | Proxy/gateway para otros modelos (Claude, Llama). Complejidad de autenticación AWS distinta. Evaluar como provider independiente en spec futura. |
| **Fireworks**      | Plataforma de inferencia similar a Together AI. Redundante ahora que Together AI está incluido como proveedor.                                   |

---

## 13. Estado actual del código (auditoría v1.2)

Referencia rápida del estado actual de los archivos que esta spec modifica, para evitar suposiciones incorrectas durante la implementación.

### 13.1 Archivos LLM en `libs/analysis/`

| Archivo              | Estado actual                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `llm-types.ts`       | `complete()` retorna `Promise<string>`. No tiene `LLMUsage` ni `LLMResponse`.                                                     |
| `claude.provider.ts` | Default model: `claude-sonnet-4-20250514`. Retorna `string`.                                                                      |
| `openai.provider.ts` | Default model: `gpt-4o-mini`. Retorna `string`.                                                                                   |
| `groq.provider.ts`   | Default model: `llama-3.3-70b-versatile`. Retorna `string`.                                                                       |
| `llm-factory.ts`     | Switch con 3 cases: `CLAUDE`, `OPENAI`, `GROQ`. Importa de `@crypto-trader/shared`. Debe agregar `GEMINI`, `MISTRAL`, `TOGETHER`. |
| `llm-analyzer.ts`    | `analyze()` retorna `Promise<LLMDecision>`. Llama `provider.complete()` y parsea con `parseLLMResponse(raw)`.                     |
| `index.ts`           | Exporta los 3 providers, `LLMAnalyzer`, `createLLMProvider`. Debe exportar los 3 nuevos providers.                                |

### 13.2 Archivos backend API

| Archivo                | Estado actual                                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chat.service.ts`      | `PROVIDER_LABELS` y `PROVIDER_MODELS` con 3 providers. Streaming con `streamClaude()`, `streamOpenAI()`, `streamGroq()` (métodos privados, axios directo con `responseType: 'stream'`). NO usa `LLMProviderClient`. |
| `sub-agent.service.ts` | `call()` retorna `Promise<string>`. Usa `provider.complete(systemPrompt, userPrompt)` directamente.                                                                                                                 |
| `auth.dto.ts`          | `LLMKeyDto` con `@ApiProperty({ enum: ['CLAUDE', 'OPENAI', 'GROQ'] })`.                                                                                                                                             |
| `schema.prisma`        | `enum LLMProvider { CLAUDE OPENAI GROQ }`. No existe `LlmUsageLog`.                                                                                                                                                 |

### 13.3 Archivos frontend con listas de modelos (inconsistentes entre sí)

| Archivo            | Formato                              | Claude models                                                       | OpenAI models                           | Groq models                                                         |
| ------------------ | ------------------------------------ | ------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------- |
| `settings.tsx`     | `string[]`                           | `claude-opus-4-5`, `claude-3-5-sonnet-*`, `claude-3-haiku-*`        | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`  | `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`                   |
| `news-feed.tsx`    | `{ value, label }[]`                 | `claude-sonnet-4-20250514`, `claude-haiku-3-5-*`, `claude-opus-4-*` | `gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini` | `llama-3.3-70b-*`, `llama-3.1-8b-*`, `mixtral-8x7b-*`               |
| `onboarding.tsx`   | `string[]` + `helpLink/helpLinkText` | `claude-3-5-sonnet-*`, `claude-3-haiku-*`                           | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`  | `llama-3.3-70b-*`, `llama-3.1-8b-*`                                 |
| `llm-selector.tsx` | `PROVIDER_COLORS` map                | N/A (solo colores)                                                  | N/A                                     | N/A — solo CLAUDE/OPENAI/GROQ. Debe agregar GEMINI/MISTRAL/TOGETHER |

### 13.4 Directorio `apps/api/src/llm/` — NO EXISTE

Debe crearse como nuevo módulo NestJS con:

- `llm.module.ts`
- `llm-usage.service.ts`
- `llm-models.service.ts`
- `model-pricing.ts`

---

## 14. Ranking Global de Modelos — Pre-configuración del Sistema

> **Fuente**: [Artificial Analysis LLM Leaderboard](https://artificialanalysis.ai/leaderboards/models) (Abril 2026)

La plataforma necesita un ranking interno de proveedores/modelos que sirva como:

1. **Fallback automático**: si el proveedor primario falla, el sistema usa el siguiente en el ranking.
2. **Sugerencia al usuario**: al crear un agente o configurar news analysis, el sistema propone el mejor modelo disponible según sus API keys activas.
3. **Resolución de `preferCheap`**: el SubAgentService usa este ranking para elegir el modelo más barato que cumpla un umbral mínimo de calidad.

### 14.1 Ranking por Intelligence Index (Abril 2026)

Basado en el Artificial Analysis Intelligence Index (score 0-100):

```typescript
// apps/api/src/llm/model-ranking.ts

export interface ModelRank {
  provider: LLMProvider;
  model: string;
  label: string;
  intelligenceScore: number;
  tier: 'FRONTIER' | 'STRONG' | 'BUDGET';
  speed: 'FAST' | 'MEDIUM' | 'SLOW';
  costTier: 'PREMIUM' | 'STANDARD' | 'CHEAP' | 'FREE';
  /** Recommended use cases */
  bestFor: ('TRADING' | 'CHAT' | 'NEWS' | 'CLASSIFY')[];
}

export const MODEL_RANKING: ModelRank[] = [
  // ── Tier FRONTIER (Intelligence ≥ 44) ──────────────────────────────────
  {
    provider: 'GEMINI',
    model: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro Preview',
    intelligenceScore: 57,
    tier: 'FRONTIER',
    speed: 'MEDIUM',
    costTier: 'PREMIUM',
    bestFor: ['TRADING'],
  },
  {
    provider: 'OPENAI',
    model: 'gpt-5.4',
    label: 'GPT-5.4',
    intelligenceScore: 57,
    tier: 'FRONTIER',
    speed: 'SLOW',
    costTier: 'PREMIUM',
    bestFor: ['TRADING'],
  },
  {
    provider: 'CLAUDE',
    model: 'claude-opus-4-6',
    label: 'Claude Opus 4.6',
    intelligenceScore: 53,
    tier: 'FRONTIER',
    speed: 'SLOW',
    costTier: 'PREMIUM',
    bestFor: ['TRADING'],
  },
  {
    provider: 'CLAUDE',
    model: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    intelligenceScore: 52,
    tier: 'FRONTIER',
    speed: 'MEDIUM',
    costTier: 'STANDARD',
    bestFor: ['TRADING', 'CHAT', 'NEWS'],
  },
  {
    provider: 'OPENAI',
    model: 'gpt-5.4-mini',
    label: 'GPT-5.4 Mini',
    intelligenceScore: 49,
    tier: 'FRONTIER',
    speed: 'FAST',
    costTier: 'STANDARD',
    bestFor: ['TRADING', 'CHAT', 'NEWS'],
  },
  {
    provider: 'GEMINI',
    model: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash',
    intelligenceScore: 46,
    tier: 'FRONTIER',
    speed: 'FAST',
    costTier: 'STANDARD',
    bestFor: ['TRADING', 'CHAT', 'NEWS'],
  },
  {
    provider: 'OPENAI',
    model: 'gpt-5.4-nano',
    label: 'GPT-5.4 Nano',
    intelligenceScore: 44,
    tier: 'FRONTIER',
    speed: 'FAST',
    costTier: 'CHEAP',
    bestFor: ['NEWS', 'CLASSIFY', 'CHAT'],
  },

  // ── Tier STRONG (Intelligence 28-43) ───────────────────────────────────
  {
    provider: 'CLAUDE',
    model: 'claude-haiku-4-5-20251001',
    label: 'Claude 4.5 Haiku',
    intelligenceScore: 37,
    tier: 'STRONG',
    speed: 'FAST',
    costTier: 'STANDARD',
    bestFor: ['CHAT', 'NEWS', 'CLASSIFY'],
  },
  {
    provider: 'GEMINI',
    model: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    intelligenceScore: 35,
    tier: 'STRONG',
    speed: 'MEDIUM',
    costTier: 'STANDARD',
    bestFor: ['TRADING', 'NEWS'],
  },
  {
    provider: 'GEMINI',
    model: 'gemini-3.1-flash-lite-preview',
    label: 'Gemini 3.1 Flash-Lite',
    intelligenceScore: 34,
    tier: 'STRONG',
    speed: 'FAST',
    costTier: 'CHEAP',
    bestFor: ['NEWS', 'CLASSIFY'],
  },
  {
    provider: 'GROQ',
    model: 'openai/gpt-oss-120b',
    label: 'GPT OSS 120B (Groq)',
    intelligenceScore: 33,
    tier: 'STRONG',
    speed: 'FAST',
    costTier: 'CHEAP',
    bestFor: ['NEWS', 'CLASSIFY'],
  },
  {
    provider: 'MISTRAL',
    model: 'mistral-small-latest',
    label: 'Mistral Small 4',
    intelligenceScore: 28,
    tier: 'STRONG',
    speed: 'FAST',
    costTier: 'CHEAP',
    bestFor: ['NEWS', 'CLASSIFY', 'CHAT'],
  },
  {
    provider: 'TOGETHER',
    model: 'deepseek-ai/DeepSeek-R1',
    label: 'DeepSeek R1',
    intelligenceScore: 27,
    tier: 'STRONG',
    speed: 'SLOW',
    costTier: 'STANDARD',
    bestFor: ['TRADING'],
  },
  {
    provider: 'MISTRAL',
    model: 'magistral-medium-latest',
    label: 'Magistral Medium 1.2',
    intelligenceScore: 27,
    tier: 'STRONG',
    speed: 'MEDIUM',
    costTier: 'STANDARD',
    bestFor: ['TRADING', 'CHAT'],
  },

  // ── Tier BUDGET (Intelligence < 28) ────────────────────────────────────
  {
    provider: 'MISTRAL',
    model: 'mistral-large-latest',
    label: 'Mistral Large 3',
    intelligenceScore: 23,
    tier: 'BUDGET',
    speed: 'MEDIUM',
    costTier: 'STANDARD',
    bestFor: ['CHAT'],
  },
  {
    provider: 'GEMINI',
    model: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    intelligenceScore: 22,
    tier: 'BUDGET',
    speed: 'FAST',
    costTier: 'CHEAP',
    bestFor: ['NEWS', 'CLASSIFY'],
  },
  {
    provider: 'MISTRAL',
    model: 'mistral-medium-latest',
    label: 'Mistral Medium 3.1',
    intelligenceScore: 21,
    tier: 'BUDGET',
    speed: 'MEDIUM',
    costTier: 'STANDARD',
    bestFor: ['CHAT'],
  },
  {
    provider: 'TOGETHER',
    model: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
    label: 'Llama 4 Maverick',
    intelligenceScore: 18,
    tier: 'BUDGET',
    speed: 'FAST',
    costTier: 'CHEAP',
    bestFor: ['NEWS', 'CLASSIFY'],
  },
  {
    provider: 'GROQ',
    model: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3 70B (Groq)',
    intelligenceScore: 14,
    tier: 'BUDGET',
    speed: 'FAST',
    costTier: 'CHEAP',
    bestFor: ['CLASSIFY'],
  },
  {
    provider: 'TOGETHER',
    model: 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
    label: 'Llama 4 Scout',
    intelligenceScore: 14,
    tier: 'BUDGET',
    speed: 'FAST',
    costTier: 'CHEAP',
    bestFor: ['CLASSIFY'],
  },
];
```

### 14.2 Función de resolución de modelo sugerido

```typescript
/**
 * Given the user's active providers and a target use case,
 * returns the best available model from the ranking.
 */
export function suggestModel(
  activeProviders: LLMProvider[],
  useCase: 'TRADING' | 'CHAT' | 'NEWS' | 'CLASSIFY',
  preferCheap = false,
): ModelRank | null {
  const candidates = MODEL_RANKING.filter((m) =>
    activeProviders.includes(m.provider),
  ).filter((m) => m.bestFor.includes(useCase));

  if (!candidates.length) return null;

  if (preferCheap) {
    // Sort: cheapest first, then by intelligence (descending) within same cost tier
    return candidates.sort(
      (a, b) =>
        COST_ORDER[a.costTier] - COST_ORDER[b.costTier] ||
        b.intelligenceScore - a.intelligenceScore,
    )[0];
  }

  // Default: best intelligence first
  return candidates[0]; // already sorted by intelligenceScore desc
}

const COST_ORDER = { FREE: 0, CHEAP: 1, STANDARD: 2, PREMIUM: 3 };
```

### 14.3 Configuración default sugerida por la plataforma

Cuando un usuario tiene múltiples providers activos, el sistema sugiere:

| Contexto                        | Primario sugerido               | Secundario sugerido  | Criterio                        |
| ------------------------------- | ------------------------------- | -------------------- | ------------------------------- |
| **Trading Agent (conservador)** | Claude Sonnet 4.6               | Gemini 3 Flash       | Balance intelligence/costo      |
| **Trading Agent (moderado)**    | GPT-5.4 Mini                    | Claude Sonnet 4.6    | Mejor velocidad, buen reasoning |
| **Trading Agent (agresivo)**    | Gemini 3.1 Pro / GPT-5.4        | Claude Opus 4.6      | Máximo intelligence             |
| **News Analysis**               | GPT-5.4 Nano / Gemini 2.5 Flash | Groq Llama 3.3 70B   | Barato + rápido para batch      |
| **Chat**                        | Según preferencia del usuario   | N/A (cambio en vivo) | UX                              |
| **Intent Classification**       | Groq (fastest)                  | Mistral Small 4      | Más barato + rápido posible     |

---

## 15. Configuración de Provider/Modelo para News Analysis

El usuario debe poder elegir qué modelo usar para el análisis de sentimiento de noticias, tanto manual como automático (cuando el Trading Agent lo necesita).

### 15.1 Modelo de datos

Extender la tabla existente `NewsConfig` (ya tiene `botEnabled`, `newsCount`, etc.):

```prisma
model NewsConfig {
  // campos existentes...
  botEnabled       Boolean @default(false)
  newsCount        Int     @default(20)
  // NUEVOS campos:
  primaryProvider  LLMProvider? // null = usar default del sistema (más inteligente disponible)
  primaryModel     String?      // null = usar selectedModel de la credencial
  fallbackProvider LLMProvider? // null = sin fallback
  fallbackModel    String?
}
```

### 15.2 Lógica de resolución (backend)

```typescript
// market.service.ts — runAnalysis()

async function resolveLLMForNews(userId: string, newsConfig: NewsConfig) {
  // 1. Si el usuario configuró primario, intentar ese
  if (newsConfig.primaryProvider && newsConfig.primaryModel) {
    const cred = await findActiveCred(userId, newsConfig.primaryProvider);
    if (cred)
      return {
        provider: newsConfig.primaryProvider,
        model: newsConfig.primaryModel,
        apiKey: decrypt(cred),
      };
  }

  // 2. Si primario falla, intentar fallback
  if (newsConfig.fallbackProvider && newsConfig.fallbackModel) {
    const cred = await findActiveCred(userId, newsConfig.fallbackProvider);
    if (cred)
      return {
        provider: newsConfig.fallbackProvider,
        model: newsConfig.fallbackModel,
        apiKey: decrypt(cred),
      };
  }

  // 3. Último recurso: suggestModel() del ranking global
  const activeProviders = await getActiveProviders(userId);
  const suggested = suggestModel(activeProviders, 'NEWS', true); // preferCheap para news
  if (!suggested) throw new Error('No LLM credentials available');
  const cred = await findActiveCred(userId, suggested.provider);
  return {
    provider: suggested.provider,
    model: suggested.model,
    apiKey: decrypt(cred),
  };
}
```

### 15.3 UI — Sección en News Feed Settings

Dentro del panel de configuración de noticias existente, agregar:

```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 Modelo de IA para Análisis de Sentimiento                  │
│                                                                 │
│  Primario:                                                      │
│  ┌──────────────────┐  ┌───────────────────────────────┐       │
│  │  Anthropic   ▼   │  │  Claude Sonnet 4.6        ▼   │       │
│  └──────────────────┘  └───────────────────────────────┘       │
│                                                                 │
│  Secundario (fallback):                                         │
│  ┌──────────────────┐  ┌───────────────────────────────┐       │
│  │  Groq         ▼   │  │  Llama 3.3 70B            ▼   │       │
│  └──────────────────┘  └───────────────────────────────┘       │
│                                                                 │
│  💡 El sistema sugiere GPT-5.4 Nano como primario (barato y    │
│     rápido para clasificación batch) y Groq como fallback.     │
│                                                                 │
│  ☑ Usar automáticamente en el Trading Agent                    │
│     (cuando el bot necesita sentimiento de noticias)            │
└─────────────────────────────────────────────────────────────────┘
```

**Notas UI:**

- Solo mostrar providers con API key activa en los dropdowns
- El select de modelo se carga dinámicamente (`DynamicModelSelect`)
- Mostrar sugerencia del sistema basada en `suggestModel(activeProviders, 'NEWS', true)`
- Si no configuran nada → el sistema elige automáticamente del ranking

---

## 16. Configuración de Provider/Modelo por Trading Agent

Cada Trading Agent (config) puede tener su propio par primario/secundario de provider + modelo.

### 16.1 Modelo de datos

Extender la tabla `TradingConfig`:

```prisma
model TradingConfig {
  // campos existentes...
  name                  String
  asset                 Asset
  pair                  QuoteCurrency
  mode                  TradingMode
  // NUEVOS campos:
  primaryProvider       LLMProvider?  // null = usar default del ranking
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

### 16.2 Lógica de resolución (backend)

```typescript
// trading.processor.ts — dentro del ciclo de trading

async function resolveLLMForTrading(
  userId: string,
  config: TradingConfig,
  preferCheap = false,
) {
  // 1. Primario configurado en la config del agente
  if (config.primaryProvider && config.primaryModel) {
    const cred = await findActiveCred(userId, config.primaryProvider);
    if (cred)
      return {
        provider: config.primaryProvider,
        model: config.primaryModel,
        apiKey: decrypt(cred),
      };
  }

  // 2. Fallback configurado en la config del agente
  if (config.fallbackProvider && config.fallbackModel) {
    const cred = await findActiveCred(userId, config.fallbackProvider);
    if (cred)
      return {
        provider: config.fallbackProvider,
        model: config.fallbackModel,
        apiKey: decrypt(cred),
      };
  }

  // 3. Ranking global — filtrar por riskProfile
  const activeProviders = await getActiveProviders(userId);
  const useCase = preferCheap ? 'CLASSIFY' : 'TRADING';
  const suggested = suggestModel(activeProviders, useCase, preferCheap);
  if (!suggested) throw new Error('No LLM credentials available');
  const cred = await findActiveCred(userId, suggested.provider);
  return {
    provider: suggested.provider,
    model: suggested.model,
    apiKey: decrypt(cred),
  };
}
```

### 16.3 Auto-naming de Trading Agents

Al crear/editar un agente, si el usuario no ingresa nombre manualmente, el sistema genera uno automáticamente:

```typescript
// Formato: {Asset}-{Perfil}-{Provider}:{ModelShort}
// Ejemplos:
function generateAgentName(config: {
  asset: string;
  riskProfile: RiskProfile;
  primaryProvider?: string;
  primaryModel?: string;
}): string {
  const profiles = {
    CONSERVATIVE: 'Safe',
    MODERATE: 'Balanced',
    AGGRESSIVE: 'Alpha',
  };
  const profile = profiles[config.riskProfile] ?? 'Balanced';
  const model = config.primaryModel
    ? (config.primaryModel.split('/').pop()?.split('-').slice(0, 2).join('-') ??
      '')
    : 'Auto';
  const provider = config.primaryProvider ?? 'Auto';
  return `${config.asset}-${profile}-${provider}:${model}`;
}

// Ejemplos generados:
// "BTC-Safe-CLAUDE:sonnet-4"     → conservador con Claude Sonnet
// "ETH-Alpha-OPENAI:gpt-5"      → agresivo con GPT-5.4
// "BTC-Balanced-Auto:Auto"       → sistema elige automáticamente
// "ETH-Safe-GROQ:llama-3"       → conservador con Groq (barato)
```

### 16.4 UI — Formulario de creación/edición de Trading Agent

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚙️ Configuración del Agente                                   │
│                                                                 │
│  Nombre:  [BTC-Balanced-CLAUDE:sonnet-4          ]  [🔄 Auto]  │
│                                                                 │
│  Par:     [BTC/USDT ▼]     Modo: [SANDBOX ▼]                   │
│                                                                 │
│  Perfil de riesgo:                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│  │🛡 Conser-│  │⚖ Mode-  │  │🚀 Agre-  │                     │
│  │  vador   │  │  rado    │  │  sivo    │                     │
│  └──────────┘  └──────────┘  └──────────┘                     │
│                                                                 │
│  ── Modelo de IA ──────────────────────────────────────────     │
│                                                                 │
│  Primario:                                                      │
│  ┌──────────────────┐  ┌───────────────────────────────┐       │
│  │  Anthropic   ▼   │  │  Claude Sonnet 4.6  ★     ▼   │       │
│  └──────────────────┘  └───────────────────────────────┘       │
│                                                                 │
│  Secundario (fallback):                                         │
│  ┌──────────────────┐  ┌───────────────────────────────┐       │
│  │  Google      ▼   │  │  Gemini 3 Flash           ▼   │       │
│  └──────────────────┘  └───────────────────────────────┘       │
│                                                                 │
│  💡 Para perfil "Moderado" con BTC, el sistema recomienda:     │
│     • Primario: GPT-5.4 Mini (rápido, buen razonamiento)       │
│     • Secundario: Claude Sonnet 4.6 (excelente en análisis)    │
│                                                                 │
│  ── Parámetros de Trading ─────────────────────────────────     │
│  [resto del formulario actual: thresholds, SL, TP, etc.]       │
└─────────────────────────────────────────────────────────────────┘
```

**Notas UI:**

- ★ indica el modelo sugerido por el ranking del sistema para el perfil seleccionado
- El nombre se auto-genera al cambiar par/perfil/provider pero el usuario puede editarlo
- Botón 🔄 Auto regenera el nombre desde los valores actuales
- `preferCheap` se activará internamente para los sub-agentes de clasificación (intent) dentro del orquestador

### 16.5 Impacto en SubAgentService

Actualmente `SubAgentService.getProvider()` siempre busca la credencial más reciente. Con este cambio:

```typescript
// sub-agent.service.ts — getProvider() actualizado

async getProvider(
  userId: string,
  preferCheap = false,
  /** Override: usar este provider/modelo específico (del TradingConfig) */
  override?: { provider: LLMProvider; model: string },
): Promise<LLMProviderClient> {
  // 1. Si hay override del config del agente, usar ese
  if (override) {
    const cred = await this.prisma.lLMCredential.findFirst({
      where: { userId, provider: override.provider, isActive: true },
    });
    if (cred) {
      const apiKey = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv);
      return createLLMProvider(override.provider, apiKey, override.model);
    }
    // Si la credencial del override no está activa, caer al flujo normal
  }

  // 2. Flujo actual (preferCheap → Groq, else más reciente)
  // ... código existente ...
}
```

El `OrchestratorService.orchestrateDecision()` pasará el override desde la `TradingConfig` del agente.

---

## 17. Cambio de Provider/Modelo en Chat (mid-session)

El usuario puede cambiar de provider y modelo dentro de una conversación activa, sin crear una nueva sesión.

### 17.1 Comportamiento

- Al crear sesión: se usa el provider/model seleccionado en el modal de "Nueva Sesión"
- Durante la sesión: dos selectores compactos (inline) sobre el input de texto permiten cambiar provider y modelo
- El cambio aplica solo a los **mensajes siguientes** — el historial conserva qué modelo generó cada respuesta
- El cambio se persiste en la sesión (actualiza `ChatSession.provider` y `ChatSession.model`)

### 17.2 Modelo de datos

Ya existe `ChatSession.provider` y `ChatSession.model`. Solo se necesita:

1. Un nuevo endpoint (o reusar update) para cambiar provider/model mid-session
2. Guardar en cada `ChatMessage` qué modelo generó la respuesta (campo nuevo)

```prisma
model ChatMessage {
  // campos existentes...
  // NUEVO: guardar qué modelo generó esta respuesta
  generatedBy   String?  // e.g. "CLAUDE:claude-sonnet-4-6" — solo en messages role=ASSISTANT
}
```

### 17.3 API

```
PATCH /chat/sessions/:id
Body: { provider?: LLMProvider, model?: string }
Response: { id, provider, model, updatedAt }
```

### 17.4 UI — Selectores inline sobre el input

Inspirado en el chat de GitHub Copilot en VS Code:

```
┌─────────────────────────────────────────────────────────────────┐
│  [Conversación de chat...]                                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Anthropic ▾  │  claude-sonnet-4-6 ▾                    │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                         │   │
│  │  Escribe un mensaje...                          [Enviar]│   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Detalles de diseño:**

- Los selectores son text buttons con dropdown, estilo ghost, tamaño `xs`
- Color del texto según `PROVIDER_COLORS` (e.g. Claude = purple, OpenAI = green)
- Solo mostrar providers con API key activa
- Al cambiar provider, el select de modelo se recarga dinámicamente
- El dropdown de modelo muestra: nombre, context window, precio compacto
- Animación sutil al cambiar (flash del borde o del provider badge)

### 17.5 Frontend state

```typescript
// chat.store.ts — agregar al store de Zustand

interface ChatState {
  // existentes...
  activeSessionId: string | null;
  // NUEVOS:
  sessionProvider: LLMProvider | null; // override local del provider
  sessionModel: string | null; // override local del modelo
  setSessionLLM: (provider: LLMProvider, model: string) => void;
}
```

Al enviar un mensaje, el frontend incluye `provider` y `model` en el body de `POST /chat/sessions/:id/messages`.
El backend usa estos valores en vez de los de la sesión original.

---

## 18. Actualización de Fases de Implementación

> Las fases A-D originales (secciones 9) se mantienen. Se agregan las nuevas fases:

### Fase E — Ranking global + resolución inteligente de modelos

1. Crear `apps/api/src/llm/model-ranking.ts` con `MODEL_RANKING` y `suggestModel()`
2. Actualizar `SubAgentService.getProvider()` con parámetro `override`
3. Actualizar `SubAgentService.call()` para aceptar override de provider/model
4. Integrar `suggestModel()` en resolución de `preferCheap`
5. Endpoint `GET /users/me/llm/suggested?useCase=TRADING|NEWS|CHAT` que retorna sugerencias personalizadas
6. Tests unitarios para `suggestModel()`

### Fase F — Configuración de News Analysis (primario/secundario)

1. Migración Prisma: agregar `primaryProvider`, `primaryModel`, `fallbackProvider`, `fallbackModel` a `NewsConfig`
2. Actualizar `MarketService.runAnalysis()` para usar `resolveLLMForNews()`
3. UI: selectores de provider/modelo en el panel de configuración de noticias
4. i18n para nuevos textos

### Fase G — Configuración de Trading Agent (primario/secundario + riskProfile + auto-name)

1. Migración Prisma: agregar `primaryProvider`, `primaryModel`, `fallbackProvider`, `fallbackModel`, `riskProfile` a `TradingConfig`
2. Agregar enum `RiskProfile { CONSERVATIVE, MODERATE, AGGRESSIVE }` al schema
3. Actualizar `TradingProcessor` para pasar override de provider/model al `OrchestratorService`
4. Actualizar `OrchestratorService.orchestrateDecision()` para pasar override a `SubAgentService`
5. Implementar `generateAgentName()` y lógica de auto-naming
6. Endpoint sugerido → devolver nombre generado + modelo recomendado según perfil/par
7. UI: formulario de creación/edición con perfil de riesgo, selectores de proveedor, auto-name
8. i18n para nuevos textos

### Fase H — Chat mid-session provider switching

1. Migración Prisma: agregar `generatedBy` a `ChatMessage`
2. Endpoint `PATCH /chat/sessions/:id` para actualizar provider/model
3. Actualizar `ChatService.sendMessage()` para aceptar override de provider/model del request body
4. Guardar `generatedBy` en cada mensaje de assistant
5. UI: selectores inline sobre el input del chat
6. Actualizar `chat.store.ts` con `sessionProvider`/`sessionModel`
7. i18n para nuevos textos

### Fase I — Dashboard de consumo y disponibilidad por proveedor

1. Crear `ProviderHealthService` en `apps/api/src/llm/` con health check, rate limit tracking y estado de disponibilidad
2. Extender `LlmUsageLog` o crear vista materializada para agregados rápidos por provider
3. Endpoint `GET /users/me/llm/providers/status` — retorna estado individual de cada proveedor activo
4. Endpoint `GET /users/me/llm/providers/:provider/usage` — retorna detalle de consumo de un proveedor específico
5. Backend: capturar y persistir headers de rate-limit de cada llamada LLM (en memoria, no en DB)
6. Backend: crear `ProviderQuotaChecker` — para providers que exponen balance (Together AI), consultar periódicamente
7. Componente `ProviderStatusCard` — mini-dashboard individual por proveedor
8. Componente `ProviderStatusGrid` — grid de cards en la sección "Modelos IA" de Settings
9. Lógica de `availabilityScore` — semáforo Disponible / Limitado / No disponible basado en health + rate limits + error rate
10. Integrar notificación proactiva si un proveedor pasa a "No disponible" mientras hay agentes activos que lo usan
11. i18n para nuevos textos (`es` / `en`)

---

## 19. Dashboard de Consumo y Disponibilidad por Proveedor

Cada proveedor LLM activo del usuario tiene su **mini-dashboard individual** que muestra: tokens consumidos, disponibilidad en tiempo real, costos estimados y desglose de uso. Esto permite al usuario saber de un vistazo si un proveedor sigue operativo y cuánto le está costando.

### 19.1 Fuentes de datos

Los datos del dashboard combinan **dos fuentes**:

| Fuente                                   | Datos                                                                             | Confiabilidad                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Interna** (`LlmUsageLog`)              | Tokens consumidos, costo estimado, uso por origen, historial de llamadas, errores | ✅ Siempre disponible — es nuestra propia DB         |
| **Externa** (APIs de billing/rate-limit) | Balance restante, rate limits en tiempo real, cuota consumida                     | ⚠️ Parcial — depende del proveedor y tipo de API key |

#### 19.1.1 APIs de billing/usage por proveedor

| Proveedor         | API disponible         | Endpoint                                                                                                                            | Accesible con API key normal | Notas                                                                                              |
| ----------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| **Anthropic**     | Rate limits en headers | Headers de response: `anthropic-ratelimit-tokens-remaining`, `anthropic-ratelimit-tokens-limit`, `anthropic-ratelimit-tokens-reset` | ✅ Sí                        | Se capturan de cada response. No hay billing API con key estándar                                  |
| **OpenAI**        | Usage API (org admin)  | `GET /organization/usage/completions`                                                                                               | ❌ Requiere admin key        | Solo funciona con org admin API key; la mayoría de users tienen project key. Usar tracking interno |
| **Google Gemini** | No disponible          | —                                                                                                                                   | —                            | AI Studio free tier no expone billing. Google Cloud Billing API requiere service account OAuth     |
| **Groq**          | Rate limits en headers | Headers: `x-ratelimit-remaining-tokens`, `x-ratelimit-limit-tokens`, `x-ratelimit-reset-tokens`                                     | ✅ Sí                        | Free tier con rate limits. Headers disponibles en cada response                                    |
| **Mistral**       | No disponible          | —                                                                                                                                   | —                            | No expone billing/usage API pública con API key estándar                                           |
| **Together AI**   | Rate limits en headers | Headers: `x-ratelimit-remaining-tokens`, `x-ratelimit-limit-tokens`                                                                 | ✅ Sí                        | Free tier de $5. Los headers de rate limit se capturan de cada response                            |

#### 19.1.2 Estrategia de captura de rate limits

Los headers de rate-limit se capturan **pasivamente** de cada response LLM (sin llamadas extra):

```typescript
// libs/analysis/src/lib/rate-limit-tracker.ts

export interface ProviderRateLimits {
  tokensRemaining: number | null;
  tokensLimit: number | null;
  requestsRemaining: number | null;
  requestsLimit: number | null;
  resetAt: Date | null;
  capturedAt: Date;
}

/** In-memory store — one entry per userId+provider, updated on every LLM response */
const rateLimitCache = new Map<string, ProviderRateLimits>();

export function captureRateLimits(
  userId: string,
  provider: LLMProvider,
  headers: Record<string, string>,
): void {
  const key = `${userId}:${provider}`;
  const parsed = parseRateLimitHeaders(provider, headers);
  if (parsed) rateLimitCache.set(key, { ...parsed, capturedAt: new Date() });
}

export function getRateLimits(
  userId: string,
  provider: LLMProvider,
): ProviderRateLimits | null {
  const entry = rateLimitCache.get(`${userId}:${provider}`);
  if (!entry) return null;
  // Stale después de 10 min
  if (Date.now() - entry.capturedAt.getTime() > 600_000) return null;
  return entry;
}

function parseRateLimitHeaders(
  provider: LLMProvider,
  headers: Record<string, string>,
): Omit<ProviderRateLimits, 'capturedAt'> | null {
  switch (provider) {
    case 'CLAUDE':
      return {
        tokensRemaining: num(headers['anthropic-ratelimit-tokens-remaining']),
        tokensLimit: num(headers['anthropic-ratelimit-tokens-limit']),
        requestsRemaining: num(
          headers['anthropic-ratelimit-requests-remaining'],
        ),
        requestsLimit: num(headers['anthropic-ratelimit-requests-limit']),
        resetAt: headers['anthropic-ratelimit-tokens-reset']
          ? new Date(headers['anthropic-ratelimit-tokens-reset'])
          : null,
      };
    case 'OPENAI':
      return {
        tokensRemaining: num(headers['x-ratelimit-remaining-tokens']),
        tokensLimit: num(headers['x-ratelimit-limit-tokens']),
        requestsRemaining: num(headers['x-ratelimit-remaining-requests']),
        requestsLimit: num(headers['x-ratelimit-limit-requests']),
        resetAt: headers['x-ratelimit-reset-tokens']
          ? new Date(headers['x-ratelimit-reset-tokens'])
          : null,
      };
    case 'GROQ':
    case 'TOGETHER':
      return {
        tokensRemaining: num(headers['x-ratelimit-remaining-tokens']),
        tokensLimit: num(headers['x-ratelimit-limit-tokens']),
        requestsRemaining: num(headers['x-ratelimit-remaining-requests']),
        requestsLimit: num(headers['x-ratelimit-limit-requests']),
        resetAt: headers['x-ratelimit-reset-tokens']
          ? new Date(headers['x-ratelimit-reset-tokens'])
          : null,
      };
    default: // GEMINI, MISTRAL — no rate limit headers available
      return null;
  }
}

function num(val: string | undefined): number | null {
  if (!val) return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}
```

### 19.2 Backend — `ProviderHealthService`

```typescript
// apps/api/src/llm/provider-health.service.ts

export interface ProviderStatus {
  provider: LLMProvider;
  /** AVAILABLE | LIMITED | UNAVAILABLE */
  availability: 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE';
  /** 0-100 score: 100=fully available, 0=down */
  availabilityScore: number;
  /** Reason if not fully available */
  reason?: string;
  /** Rate limit snapshot (null if not captured yet) */
  rateLimits: ProviderRateLimits | null;
  /** Usage stats from internal tracking */
  usage: {
    totalTokensIn: number;
    totalTokensOut: number;
    totalCalls: number;
    totalErrors: number;
    estimatedCostUsd: number;
    /** Breakdown by source */
    bySource: {
      source: LLMSource;
      tokensIn: number;
      tokensOut: number;
      calls: number;
      costUsd: number;
    }[];
    /** Daily series for sparkline (last 30 days) */
    dailySeries: {
      date: string;
      costUsd: number;
      tokens: number;
      calls: number;
    }[];
  };
  /** Last successful call timestamp */
  lastSuccessAt: Date | null;
  /** Last error message (if any) */
  lastError: string | null;
  /** API key status */
  keyStatus: 'ACTIVE' | 'INVALID' | 'INACTIVE';
}
```

#### 19.2.1 Lógica de `availabilityScore`

El score se calcula combinando múltiples señales:

```typescript
function calculateAvailabilityScore(
  keyStatus: string,
  rateLimits: ProviderRateLimits | null,
  recentErrorRate: number, // 0-1, últimas 50 llamadas
  lastSuccessAge: number | null, // ms desde último éxito
): { score: number; availability: string; reason?: string } {
  // 1. Key inactiva o inválida → 0
  if (keyStatus === 'INACTIVE')
    return {
      score: 0,
      availability: 'UNAVAILABLE',
      reason: 'API key not configured',
    };
  if (keyStatus === 'INVALID')
    return {
      score: 0,
      availability: 'UNAVAILABLE',
      reason: 'API key invalid or expired',
    };

  let score = 100;
  const reasons: string[] = [];

  // 2. Error rate penalty
  if (recentErrorRate > 0.5) {
    score -= 60;
    reasons.push(`High error rate (${Math.round(recentErrorRate * 100)}%)`);
  } else if (recentErrorRate > 0.2) {
    score -= 30;
    reasons.push(`Elevated error rate (${Math.round(recentErrorRate * 100)}%)`);
  }

  // 3. Rate limit penalty
  if (
    rateLimits?.tokensRemaining !== null &&
    rateLimits?.tokensLimit !== null
  ) {
    const pct = rateLimits.tokensRemaining / rateLimits.tokensLimit;
    if (pct < 0.05) {
      score -= 40;
      reasons.push('Token quota nearly exhausted (<5%)');
    } else if (pct < 0.2) {
      score -= 15;
      reasons.push(`Token quota low (${Math.round(pct * 100)}% remaining)`);
    }
  }

  // 4. Staleness penalty — no success in last 30 min
  if (lastSuccessAge !== null && lastSuccessAge > 30 * 60 * 1000) {
    score -= 10;
    reasons.push('No successful calls in last 30 minutes');
  }

  score = Math.max(0, Math.min(100, score));

  let availability: string;
  if (score >= 70) availability = 'AVAILABLE';
  else if (score >= 30) availability = 'LIMITED';
  else availability = 'UNAVAILABLE';

  return {
    score,
    availability,
    reason: reasons.length ? reasons.join('; ') : undefined,
  };
}
```

#### 19.2.2 Health check proactivo

Para providers con agentes de trading activos, se ejecuta un health check periódico liviano:

```typescript
// Cada 5 min para providers usados por agentes activos
async function healthCheck(
  provider: LLMProvider,
  apiKey: string,
): Promise<boolean> {
  try {
    // Lightweight call: list-models (no consume tokens)
    switch (provider) {
      case 'CLAUDE':
        // GET https://api.anthropic.com/v1/models (headers only)
        await axios.head('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          timeout: 5000,
        });
        break;
      case 'OPENAI':
        await axios.get('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 5000,
          params: { limit: 1 },
        });
        break;
      case 'GROQ':
        await axios.get('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 5000,
        });
        break;
      case 'GEMINI':
        await axios.get(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=1`,
          { timeout: 5000 },
        );
        break;
      case 'MISTRAL':
        await axios.get('https://api.mistral.ai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 5000,
        });
        break;
      case 'TOGETHER':
        await axios.get('https://api.together.xyz/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 5000,
        });
        break;
    }
    return true;
  } catch {
    return false;
  }
}
```

### 19.3 Endpoints

#### `GET /users/me/llm/providers/status`

Retorna el estado de **todos** los proveedores activos del usuario.

```typescript
// Response: ProviderStatus[]
[
  {
    provider: 'CLAUDE',
    availability: 'AVAILABLE',
    availabilityScore: 95,
    rateLimits: {
      tokensRemaining: 78000,
      tokensLimit: 80000,
      requestsRemaining: 985,
      requestsLimit: 1000,
      resetAt: '2026-04-14T12:00:00Z',
      capturedAt: '2026-04-14T11:55:23Z',
    },
    usage: {
      totalTokensIn: 45200,
      totalTokensOut: 12800,
      totalCalls: 87,
      totalErrors: 2,
      estimatedCostUsd: 0.0218,
      bySource: [
        {
          source: 'TRADING',
          tokensIn: 32000,
          tokensOut: 8500,
          calls: 62,
          costUsd: 0.0155,
        },
        {
          source: 'CHAT',
          tokensIn: 10200,
          tokensOut: 3800,
          calls: 18,
          costUsd: 0.0052,
        },
        {
          source: 'NEWS',
          tokensIn: 3000,
          tokensOut: 500,
          calls: 7,
          costUsd: 0.0011,
        },
      ],
      dailySeries: [
        { date: '2026-04-13', costUsd: 0.0085, tokens: 24000, calls: 35 },
        { date: '2026-04-14', costUsd: 0.0133, tokens: 34000, calls: 52 },
      ],
    },
    lastSuccessAt: '2026-04-14T11:55:23Z',
    lastError: null,
    keyStatus: 'ACTIVE',
  },
  // ... más providers
];
```

#### `GET /users/me/llm/providers/:provider/usage?period=30d`

Retorna detalle de consumo de un proveedor específico con granularidad diaria completa.

Query params:

- `period`: `7d` | `30d` | `90d` (default: `30d`)

### 19.4 UI — Mini-Dashboard por Proveedor (`ProviderStatusCard`)

Cada proveedor activo se muestra como una card individual dentro de un grid:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  📊 Estado de Proveedores LLM                           [Actualizar] (30d ▾)│
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐         │
│  │  🟢 Anthropic (Claude)       │  │  🟢 OpenAI                   │         │
│  │                              │  │                              │         │
│  │  Disponibilidad: █████████░ 95 │  │  Disponibilidad: ████████░░ 82 │     │
│  │                              │  │                              │         │
│  │  ── Tokens ──────────────── │  │  ── Tokens ──────────────── │         │
│  │  Entrada:     45,200        │  │  Entrada:     22,100        │         │
│  │  Salida:      12,800        │  │  Salida:       6,400        │         │
│  │  Total:       58,000        │  │  Total:       28,500        │         │
│  │                              │  │                              │         │
│  │  ── Costos ─────────────── │  │  ── Costos ─────────────── │         │
│  │  Estimado:    $0.0218 USD   │  │  Estimado:    $0.0142 USD   │         │
│  │  [▁▂▃▅▇█▅▃] últimos 30d    │  │  [▁▁▂▃▃▅▇█] últimos 30d    │         │
│  │                              │  │                              │         │
│  │  ── Uso ────────────────── │  │  ── Uso ────────────────── │         │
│  │  87 llamadas │ 2 errores    │  │  45 llamadas │ 0 errores    │         │
│  │  Trading 71% │ Chat 21%     │  │  Chat 60% │ Trading 30%     │         │
│  │  News 8%                    │  │  News 10%                    │         │
│  │                              │  │                              │         │
│  │  ── Rate Limits ─────────   │  │  ── Rate Limits ─────────   │         │
│  │  Tokens: 78K / 80K (97%)    │  │  ⚠ No disponible (proj key) │         │
│  │  Requests: 985 / 1,000      │  │                              │         │
│  │  Reset: en 5 min            │  │                              │         │
│  │                              │  │                              │         │
│  │  Último éxito: hace 5 min   │  │  Último éxito: hace 12 min  │         │
│  └──────────────────────────────┘  └──────────────────────────────┘         │
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐         │
│  │  🟡 Groq                     │  │  🔴 Together AI               │         │
│  │                              │  │                              │         │
│  │  Disponibilidad: ██████░░░░ 55 │  │  Disponibilidad: ░░░░░░░░░░  0 │     │
│  │  ⚠ Token quota low (18%)    │  │  ✖ API key invalid or expired│         │
│  │                              │  │                              │         │
│  │  ── Tokens ──────────────── │  │  ── Tokens ──────────────── │         │
│  │  Entrada:      8,400        │  │  Entrada:          0        │         │
│  │  Salida:       1,200        │  │  Salida:           0        │         │
│  │  Total:        9,600        │  │  Total:            0        │         │
│  │                              │  │                              │         │
│  │  ── Costos ─────────────── │  │  ── Costos ─────────────── │         │
│  │  Estimado:    $0.0008 USD   │  │  Estimado:    $0.00         │         │
│  │  [▁▁▁▁▂▃▅▇] últimos 30d    │  │  Sin datos                  │         │
│  │                              │  │                              │         │
│  │  ── Uso ────────────────── │  │  ── Uso ────────────────── │         │
│  │  32 llamadas │ 5 errores    │  │  0 llamadas │ 0 errores     │         │
│  │  News 75% │ Classify 25%   │  │  —                          │         │
│  │                              │  │                              │         │
│  │  ── Rate Limits ─────────   │  │  ── Rate Limits ─────────   │         │
│  │  Tokens: 1.4K / 8K (18%)   │  │  N/A                        │         │
│  │  ⚠ Reset: en 32 seg        │  │                              │         │
│  │                              │  │                              │         │
│  │  Último éxito: hace 1 min   │  │  Nunca utilizado            │         │
│  └──────────────────────────────┘  └──────────────────────────────┘         │
│                                                                              │
│  ℹ Los costos son estimados basados en precios publicados por cada          │
│    proveedor y pueden diferir de tu factura real.                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 19.5 Detalle de cada sección de la card

#### 1. Header + Semáforo de disponibilidad

| Indicador | Rango        | Color             | Significado                                                                                         |
| --------- | ------------ | ----------------- | --------------------------------------------------------------------------------------------------- |
| 🟢        | Score 70-100 | `text-green-400`  | **Disponible** — proveedor operativo, key válida, sin problemas de rate limit                       |
| 🟡        | Score 30-69  | `text-yellow-400` | **Limitado** — funcionando pero con rate limits bajos, error rate elevado, o sin respuesta reciente |
| 🔴        | Score 0-29   | `text-red-400`    | **No disponible** — key inválida, expirada, error rate >50%, o quota agotada                        |

Barra visual de disponibilidad: barra horizontal de 10 segmentos rellenos según el score.

#### 2. Tokens consumidos

- **Entrada** (input/prompt tokens): total acumulado en el período
- **Salida** (output/completion tokens): total acumulado en el período
- **Total**: suma de ambos
- Formateado con separador de miles: `45,200`
- Fuente: `LlmUsageLog` (tracking interno)

#### 3. Costos estimados

- **Estimado**: cálculo usando `MODEL_PRICING` × tokens consumidos
- Fórmula: `(tokensIn × pricePerInputToken) + (tokensOut × pricePerOutputToken)`
- Sparkline chart SVG inline con los últimos 30 días de `dailySeries`
- Disclaimer visible en el footer del grid

#### 4. Uso

- **Llamadas totales** y **errores** en el período
- **Breakdown por origen** como porcentaje: Trading X% │ Chat Y% │ News Z%
- Colores del breakdown: Trading=blue, Chat=purple, News=amber, Classify=gray
- Si un origen no tiene uso → no se muestra

#### 5. Rate Limits (cuando disponible)

- Muestra tokens restantes vs. límite con porcentaje
- Muestra requests restantes vs. límite
- Tiempo hasta reset
- Si el proveedor no expone rate limits → mostrar "No disponible" con tooltip explicando por qué

#### 6. Meta

- **Último éxito**: timestamp del último `LlmUsageLog` sin error, formateado como tiempo relativo ("hace 5 min")
- **Último error**: si hay, mostrar mensaje del error truncado

### 19.6 Notificación proactiva

Si un proveedor pasa de `AVAILABLE` a `UNAVAILABLE` y hay agentes de trading activos que usan ese proveedor:

1. Se emite una notificación toast en el frontend: "⚠️ {Provider} no está disponible. El agente {agentName} cambiará al proveedor secundario."
2. Si el agente tiene fallback configurado → se usa automáticamente (ya definido en §16.2)
3. Si no tiene fallback → se usa `suggestModel()` del ranking global (§14.2)
4. Se registra un log en `LlmUsageLog` con `source: 'SYSTEM'` indicando el failover

### 19.7 Frontend state

```typescript
// Hook: useProviderStatus()
// React Query: key ['llm', 'providers', 'status'], refetchInterval: 60_000 (cada 1 min)

const { data: providerStatuses, isLoading } = useQuery({
  queryKey: ['llm', 'providers', 'status'],
  queryFn: () => api.get('/users/me/llm/providers/status'),
  refetchInterval: 60_000,
  staleTime: 30_000,
});
```

### 19.8 Ubicación en la UI

El grid de `ProviderStatusCard`s se ubica en **Settings > Tab "Modelos IA"**, entre la lista de proveedores (con sus API keys) y el `AIUsageDashboard` existente (§7.2):

```
Settings > Modelos IA
├── Lista de proveedores (API keys + badge Active/Invalid/Inactive)
├── 📊 Estado de Proveedores LLM   ← ⭐ NUEVO (§19)
│   └── Grid de ProviderStatusCards
├── 📊 Consumo total y costos       ← Existente (§7.2 AIUsageDashboard)
│   └── Tabla agregada + sparkline
└── Ranking de modelos               ← Futuro (§14)
```

### 19.9 Decisiones de diseño

| Decisión                                             | Alternativa descartada                      | Razón                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Rate limits en memoria (Map, no DB)                  | Persistir en DB                             | Los rate limits son efímeros (reset cada minuto/hora). Persistirlos es desperdicio de I/O                             |
| Health check con list-models (no consume tokens)     | Ping con completion de 1 token              | List-models es gratuito en todos los providers. Un completion consume tokens y dinero                                 |
| Health check solo para providers con agentes activos | Health check para todos                     | Evita llamadas innecesarias. Si el user tiene 6 keys pero solo usa 2, solo checkea esas 2                             |
| Sparkline SVG inline                                 | Chart.js / Recharts                         | El sparkline es mínimo (30 puntos, sin ejes). SVG inline evita dependencia de librería de charts para algo tan simple |
| Score numérico 0-100 + semáforo 3 estados            | Solo semáforo sin score                     | El score permite ordenar providers por disponibilidad y tomar decisiones automáticas de failover                      |
| Captura pasiva de rate limits (de cada response)     | Polling periódico a endpoint de rate limits | No existe endpoint dedicado de rate limits en ningún provider. Los headers vienen gratis con cada response            |
