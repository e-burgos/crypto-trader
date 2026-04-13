# Spec 31 — LLM Provider Dashboard: Modelos Dinámicos + Consumo y Costos

**Fecha:** 2026-04-13  
**Versión:** 1.1  
**Estado:** Propuesto  
**Branch:** `feature/llm-provider-dashboard`  
**Dependencias:** Spec 23 (settings-page), Spec 17 (ai-chatbot)

| Versión | Fecha      | Cambios                                                       |
| ------- | ---------- | ------------------------------------------------------------- |
| 1.0     | 2026-04-13 | Versión inicial (Claude / OpenAI / Groq)                      |
| 1.1     | 2026-04-13 | Agrega Google Gemini y Mistral AI como proveedores soportados |

---

## 1. Resumen ejecutivo

Actualmente los modelos disponibles de cada proveedor LLM están **hardcodeados** en el frontend y el backend. Esto genera tres problemas:

1. **Modelos desactualizados**: los proveedores actualizan su catálogo continuamente. Los modelos `gpt-4-turbo` (deprecated) y `mixtral-8x7b-32768` (deprecated en Groq) ya no deben mostrarse.
2. **Sin visibilidad de consumo**: el usuario no sabe cuántos tokens ha consumido ni cuánto le ha costado usar el LLM en la plataforma.
3. **Cobertura de proveedores insuficiente**: solo soportamos 3 proveedores. Google Gemini y Mistral AI tienen fuerte adopción en el sector financiero y dev community y no están disponibles.

Esta spec introduce:

- **Soporte para 5 proveedores**: Anthropic Claude, OpenAI, Groq, **Google Gemini** y **Mistral AI**.
- **Listado dinámico de modelos**: la app consulta la API del proveedor con la API key del usuario y retorna los modelos realmente disponibles.
- **Tracking de uso y tokens**: cada llamada LLM registra `inputTokens`, `outputTokens` y `costUsd` calculado con un catálogo de precios estático mantenido en la API.
- **Dashboard de consumo** en Settings → tab "Modelos IA": tabla de uso por proveedor/modelo, costo estimado acumulado y período seleccionable.

> **¿Por qué Gemini y Mistral?** Ver sección 12 — Análisis de adopción y justificación.

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
  │                  └─ Mistral  → api.mistral.ai/v1/models
  │                       └─ Retorna lista filtrada (solo text generation)
  │
  └─ Muestra select dinámico con los modelos del proveedor
```

### 2.2 Flujo de tracking de uso

```
Cualquier llamada LLM (trading / chat / news analysis)
  │
  └─ LLMProviderClient.complete(system, user)
       └─ Retorna { text: string, usage: LLMUsage }
            └─ LLMUsageService.log(userId, provider, model, usage, source)
                 └─ INSERT INTO llm_usage_logs
                      └─ costUsd = inputTokens * MODEL_PRICING[model].input
                                  + outputTokens * MODEL_PRICING[model].output
```

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

```prisma
// Extender el enum existente con los nuevos proveedores
enum LLMProvider {
  CLAUDE
  OPENAI
  GROQ
  GEMINI   // nuevo
  MISTRAL  // nuevo
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
};
```

> **Nota**: Los precios son en USD por 1M tokens. La fórmula es: `costUsd = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000`  
> Los precios de Gemini reflejan el tier Paid (prompts ≤ 200k tokens) según pricing page de Google AI Studio (2026-04-09).  
> Los precios de Mistral reflejan el tier de API pública según la plateforme de Mistral AI.

---

## 4. API Endpoints

### 4.1 `GET /users/me/llm/:provider/models`

Lista los modelos disponibles del proveedor consultando su API directamente con la API key del usuario.

**Auth:** JWT obligatorio  
**Parámetros**: `provider: 'CLAUDE' | 'OPENAI' | 'GROQ' | 'GEMINI' | 'MISTRAL'`

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

**Filtros por proveedor para devolver solo modelos de text generation:**

- **Anthropic**: incluir `type === 'model'`, campo `id` contiene `claude-`
- **OpenAI**: incluir ids que empiecen con `gpt-`; excluir `whisper`, `dall-e`, `tts-`, `babbage`, `davinci`, `text-`
- **Groq**: incluir modelos con `context_window > 0`; excluir `whisper`
- **Gemini**: incluir solo los que tengan `supportedGenerationMethods` contiene `generateContent`; excluir modelos con `name` que contenga `embedding`, `aqa`, `imagen`, `veo`, `lyria`, `tts`
- **Mistral**: incluir solo modelos con `capabilities.completion_chat === true`; excluir modelos con `id` que contenga `embed`, `moderation`, `tts`, `transcribe`

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

> **Nota de compatibilidad**: OpenAI, Groq y Mistral comparten el mismo formato de `usage` (`prompt_tokens`/`completion_tokens`). Gemini usa `usageMetadata.promptTokenCount`/`candidatesTokenCount`. Anthropic usa `usage.input_tokens`/`output_tokens`.

---

## 6. Integración de tracking en callers existentes

Los servicios que llaman a `complete()` deben desestructurar la respuesta y pasar el usage al `LLMUsageService`. El `LLMUsageService` se inyecta via DI donde sea necesario.

### Callers a actualizar

| Servicio                                 | Source label           | Archivo                                     |
| ---------------------------------------- | ---------------------- | ------------------------------------------- |
| `LLMAnalyzer.analyze()`                  | `ANALYSIS` / `TRADING` | `libs/analysis/src/lib/llm/llm-analyzer.ts` |
| `ChatService` (mensajes de chat)         | `CHAT`                 | `apps/api/src/chat/chat.service.ts`         |
| `NewsFeedService` (análisis de noticias) | `NEWS`                 | `apps/api/src/news/`                        |

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

1. Migración Prisma: nuevo modelo `LlmUsageLog` + enum `LLMSource` + extender `LLMProvider` con `GEMINI` y `MISTRAL`
2. Actualizar `LLMProviderClient` interface: `complete()` → `LLMResponse`
3. Actualizar `ClaudeProvider`, `OpenAIProvider`, `GroqProvider` para retornar usage
4. Crear `GeminiProvider` (nuevo, API nativa)
5. Crear `MistralProvider` (nuevo, compatible OpenAI)
6. Actualizar `llm-factory.ts` para incluir `GEMINI` y `MISTRAL`
7. Actualizar `LLMAnalyzer` (desestructurar `{ text }`)
8. Crear `LLMUsageService` con método `log()` y `getStats()`
9. Crear `MODEL_PRICING` constante (con los 5 proveedores)
10. Integrar `LLMUsageService.log()` en `LLMAnalyzer`, `ChatService`, `NewsFeedService` (si existe)

### Fase B — Backend API endpoints

1. Crear `LLMModelsService` con caché en memoria (5 min TTL)
2. Endpoint `GET /users/me/llm/:provider/models`
3. Endpoint `GET /users/me/llm/usage`
4. Tests unitarios para `LLMUsageService` y `LLMModelsService`

### Fase C — Frontend dynamic models

1. Hook `useLLMProviderModels(provider)` → React Query
2. Hook `useLLMUsageStats(period)` → React Query
3. Componente `DynamicModelSelect` para Settings
4. Actualizar `LLM_PROVIDERS` en `settings.tsx` — agregar Gemini y Mistral con modelos de fallback
5. Actualizar `PROVIDER_MODELS` y `PROVIDER_LABELS` en `chat.service.ts`
6. Actualizar `news-feed.tsx` y `onboarding.tsx` con nuevos providers y modelos
7. Agregar colores de provider en `llm-selector.tsx` para Gemini (azul) y Mistral (naranja)

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

| Decisión                                          | Alternativa descartada              | Razón                                                                                                                          |
| ------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Catálogo de precios estático (`MODEL_PRICING`)    | Scraping de páginas de pricing      | Pricing pages no tienen API pública; el catálogo estático es mantenible y transparente                                         |
| Caché en memoria (Map) para modelos               | Redis                               | El tiempo de vida de 5 min hace que Redis sea over-engineering. Un Map con timestamp es suficiente                             |
| `LLMUsageService` separado del provider           | Lógica de tracking en cada provider | Principio de responsabilidad única. Los providers sólo completan texto, el tracking es incumbencia del servicio                |
| `dailySeries` incluida en el response de `/usage` | Endpoint separado para el gráfico   | Reduce roundtrips. El agregado diario es barato de calcular en la misma query                                                  |
| Deprecados visibles pero marcados                 | Ocultar modelos deprecated          | Los usuarios pueden tener créditos guardados, historial de uso o preferencia por modelos legacy                                |
| GeminiProvider usa API nativa (`generateContent`) | OpenAI-compat layer de Google       | El OpenAI compatibility layer de Google es experimental. La API nativa es más estable y tiene mejor soporte de `usageMetadata` |
| Mistral usa endpoint estándar OpenAI-compat       | SDK propio de Mistral               | El SDK de Mistral agrega dependencia innecesaria; el endpoint HTTP es idéntico al formato OpenAI                               |

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

### 12.3 Proveedores NO incluidos y justificación

| Proveedor                   | Razón de exclusión                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cohere**                  | Fuerte en embeddings/RAG pero modelos de completion menos competitivos en 2026. Se puede agregar en Spec futura si hay demanda.                  |
| **xAI (Grok)**              | Prometedor pero uso limitado en enterprise fintech. API aún maturing.                                                                            |
| **Amazon Bedrock**          | Proxy/gateway para otros modelos (Claude, Llama). Complejidad de autenticación AWS distinta. Evaluar como provider independiente en spec futura. |
| **Together AI / Fireworks** | Plataformas de inference para open-weight models. Válidos como alternativa a Groq pero redundantes dado que ya tenemos Groq.                     |
