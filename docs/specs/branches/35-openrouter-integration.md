# Spec 35 — OpenRouter: Proveedor LLM Primario Recomendado

**Fecha:** 2026-04-18  
**Versión:** 1.0  
**Estado:** Propuesto  
**Branch:** `feature/openrouter-integration`  
**Dependencias:** Spec 31 (llm-provider-dashboard), Spec 34 (ui-design-system-consolidation)

---

## 1. Resumen ejecutivo

Actualmente CryptoTrader soporta 6 proveedores LLM (Claude, OpenAI, Groq, Gemini, Mistral, Together), cada uno requiriendo su propia API key. Esto genera fricción:

1. **Onboarding complejo**: el usuario debe registrarse en múltiples plataformas y gestionar múltiples keys.
2. **Sin fallback automático**: si un provider falla, el sistema no puede redirigir a otro automáticamente.
3. **Gestión de créditos fragmentada**: el usuario paga en 6 plataformas diferentes.

**OpenRouter** resuelve estos problemas: una sola API key da acceso a 200+ modelos de todos los providers, con fallback automático y billing unificado.

Esta spec introduce:

- **OpenRouter como provider primario recomendado** (no obligatorio).
- **Rediseño de la UI de Settings → AI** con 3 sub-tabs: "Proveedor Primario", "Otros Proveedores", "Analíticas de Proveedores".
- **Backend**: nuevo `OpenRouterProvider` que implementa `LLMProviderClient`, extensión del enum `LLMProvider`.
- **UX**: OpenRouter se presenta como la opción recomendada en onboarding y settings, pero el usuario siempre puede usar API keys directas.

---

## 2. Arquitectura

### 2.1 OpenRouter como provider

```
Frontend (Settings > AI > Proveedor Primario)
  │
  └─ Usuario ingresa OpenRouter API key
       │
       └─ POST /users/me/llm-keys { provider: 'OPENROUTER', apiKey: 'sk-or-...' }
            │
            └─ Se almacena como cualquier otro LLMCredential
                 │
                 └─ OpenRouterProvider.complete(system, user)
                      │
                      └─ POST https://openrouter.ai/api/v1/chat/completions
                           ├─ model: 'anthropic/claude-sonnet-4' (o el que sea)
                           ├─ messages: [{role: 'system', ...}, {role: 'user', ...}]
                           └─ Headers: Authorization: Bearer sk-or-...
```

### 2.2 Modelo de selección de modelos en OpenRouter

Cuando el provider es OpenRouter, el modelo se expresa con prefijo de vendor:

| Provider directo           | Modelo OpenRouter equivalente        |
| -------------------------- | ------------------------------------ |
| `claude-sonnet-4-20250514` | `anthropic/claude-sonnet-4`          |
| `gpt-4o`                   | `openai/gpt-4o`                      |
| `gemini-2.5-flash`         | `google/gemini-2.5-flash`            |
| `llama-3.3-70b-versatile`  | `meta-llama/llama-3.3-70b-versatile` |

El endpoint de modelos de OpenRouter (`GET https://openrouter.ai/api/v1/models`) retorna la lista completa de modelos disponibles. Se usa el mismo patrón que `LLMModelsService` ya implementa para los otros providers.

### 2.3 Fallback automático (opcional, configurado por usuario)

```typescript
// Si el usuario activa fallback en OpenRouter
{
  model: 'anthropic/claude-sonnet-4',
  route: 'fallback',
  models: [
    'anthropic/claude-sonnet-4',
    'openai/gpt-4o',
    'google/gemini-2.5-flash'
  ]
}
```

Esto se habilita opcionalmente desde la UI. Si el usuario no configura fallback, se usa el modelo seleccionado directo.

### 2.4 Componentes afectados

| Componente                           | Cambio                                    | Tipo                                               |
| ------------------------------------ | ----------------------------------------- | -------------------------------------------------- |
| `OpenRouterProvider`                 | Nuevo                                     | `libs/analysis/src/lib/llm/openrouter.provider.ts` |
| `llm-factory.ts`                     | Agregar case OPENROUTER                   | Modificar                                          |
| `LLMProvider` enum (Prisma + shared) | Agregar `OPENROUTER`                      | Modificar                                          |
| `model-ranking.ts`                   | Agregar modelos OpenRouter                | Modificar                                          |
| `LLMModelsService`                   | Agregar proxy para OpenRouter models API  | Modificar                                          |
| `SettingsPage` (AI tab)              | Rediseño 3 sub-tabs                       | Modificar                                          |
| `OnboardingPage` (StepLLM)           | Recomendar OpenRouter primero             | Modificar                                          |
| `model-pricing.ts`                   | Agregar precios de modelos vía OpenRouter | Modificar                                          |

---

## 3. Modelos de datos

### 3.1 Extensión del enum `LLMProvider`

```prisma
// apps/api/prisma/schema.prisma
enum LLMProvider {
  CLAUDE
  OPENAI
  GROQ
  GEMINI
  MISTRAL
  TOGETHER
  OPENROUTER  // nuevo
}
```

```typescript
// libs/shared/src/types/enums.ts
export enum LLMProvider {
  CLAUDE = 'CLAUDE',
  OPENAI = 'OPENAI',
  GROQ = 'GROQ',
  GEMINI = 'GEMINI',
  MISTRAL = 'MISTRAL',
  TOGETHER = 'TOGETHER',
  OPENROUTER = 'OPENROUTER', // nuevo
}
```

### 3.2 Configuración de fallback (campo opcional en LLMCredential)

```prisma
model LLMCredential {
  // campos existentes...
  fallbackModels  String[]  @default([])  // nuevo: modelos de fallback para OpenRouter
}
```

> **Nota**: `fallbackModels` solo se usa cuando `provider === OPENROUTER`. Almacena los model IDs de OpenRouter (ej: `["openai/gpt-4o", "google/gemini-2.5-flash"]`).

---

## 4. API endpoints

### 4.1 Endpoints existentes que soportan OpenRouter automáticamente

- `POST /users/me/llm-keys` — ya acepta `provider` + `apiKey`, solo necesita aceptar `OPENROUTER`.
- `GET /users/me/llm/:provider/models` — necesita nuevo caso en `LLMModelsService`.
- `POST /users/me/llm-keys/test` — necesita nuevo caso para testear OpenRouter.

### 4.2 Nuevo endpoint: modelos de OpenRouter

```
GET /users/me/llm/OPENROUTER/models
```

Llama a `https://openrouter.ai/api/v1/models` con el API key del usuario y retorna la lista filtrada (solo text generation).

Respuesta:

```json
{
  "models": [
    {
      "id": "anthropic/claude-sonnet-4",
      "name": "Claude Sonnet 4",
      "contextLength": 200000,
      "pricing": { "prompt": "3.0", "completion": "15.0" }
    },
    {
      "id": "openai/gpt-4o",
      "name": "GPT-4o",
      "contextLength": 128000,
      "pricing": { "prompt": "2.5", "completion": "10.0" }
    }
  ]
}
```

---

## 5. Componentes frontend

### 5.1 Rediseño de Settings → AI (3 sub-tabs)

```
Settings → AI Models
├── [Tab 1] Proveedor Primario    ← OpenRouter destacado
├── [Tab 2] Otros Proveedores     ← Los 6 providers actuales
└── [Tab 3] Analíticas            ← Dashboard de uso existente
```

#### Tab 1: Proveedor Primario

```
┌─────────────────────────────────────────────────────────┐
│  ⭐ OpenRouter — Proveedor Recomendado                  │
│                                                         │
│  Una sola API key para acceder a todos los modelos:     │
│  Claude, GPT, Gemini, Llama, Mistral y más.             │
│                                                         │
│  ✅ Fallback automático si un modelo falla               │
│  ✅ Billing unificado                                    │
│  ✅ 200+ modelos disponibles                             │
│  ✅ Sin necesidad de gestionar múltiples cuentas         │
│                                                         │
│  API Key: [sk-or-..._______________]                    │
│  Obtener key en → openrouter.ai/keys                    │
│                                                         │
│  Modelo principal: [anthropic/claude-sonnet-4 ▾]        │
│                                                         │
│  □ Activar fallback automático                          │
│    Modelos de respaldo:                                  │
│    1. [openai/gpt-4o ▾]                                │
│    2. [google/gemini-2.5-flash ▾]                      │
│                                                         │
│  [Guardar] [Probar conexión]                 ● Activo   │
├─────────────────────────────────────────────────────────┤
│  ℹ️ También puedes configurar proveedores individuales  │
│  en la pestaña "Otros Proveedores" si prefieres usar    │
│  API keys directas.                                     │
└─────────────────────────────────────────────────────────┘
```

#### Tab 2: Otros Proveedores

La UI actual de providers (6 cards con API key + model select), sin cambios funcionales. Se mantiene el grid actual con validación y DynamicModelSelect.

Se agrega un banner superior sutil:

```
┌─────────────────────────────────────────────────────────┐
│  💡 ¿Sabías que con OpenRouter puedes acceder a todos   │
│  estos proveedores con una sola API key? →              │
│  [Configurar OpenRouter]                                │
└─────────────────────────────────────────────────────────┘
```

#### Tab 3: Analíticas de Proveedores

El dashboard existente (`AIUsageDashboard` + `ProviderStatusGrid`) se mueve a esta pestaña sin cambios funcionales. OpenRouter aparece como un provider más en las analíticas.

### 5.2 Actualización de Onboarding (StepLLM)

El step de LLM del onboarding muestra OpenRouter como primera opción con badge "Recomendado":

```
┌─────────────────────────────────────────────────────────┐
│  Configura tu proveedor de IA                           │
│                                                         │
│  ⭐ OpenRouter (Recomendado)                [sk-or-...] │
│     Un key para todos los modelos                       │
│                                                         │
│  ── o configura un proveedor directo ──                 │
│                                                         │
│  ○ Claude (Anthropic)                       [sk-ant-..] │
│  ○ OpenAI                                   [sk-...]    │
│  ○ Groq                                    [gsk_...]   │
│  ○ Google Gemini                            [AI...]     │
│  ○ Mistral AI                               [...]       │
│  ○ Together AI                              [...]       │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Fases de implementación

### Fase A — Backend: OpenRouterProvider + enum + migración

1. Extender `LLMProvider` enum en `schema.prisma` y `libs/shared/src/types/enums.ts`.
2. Crear migración Prisma.
3. Crear `openrouter.provider.ts` implementando `LLMProviderClient`.
4. Agregar case `OPENROUTER` en `llm-factory.ts`.
5. Agregar modelos OpenRouter en `model-ranking.ts`.
6. Agregar precios OpenRouter en `model-pricing.ts`.
7. Extender `LLMModelsService` para proxy de modelos OpenRouter.
8. Agregar `fallbackModels` a `LLMCredential` (migración).
9. Ajustar `SubAgentService.getProvider()` para soportar fallback cuando provider es OPENROUTER.
10. Tests unitarios para `OpenRouterProvider`.

### Fase B — Frontend: Rediseño de Settings AI con 3 sub-tabs

1. Refactorizar `SettingsPage` AI tab: extraer el contenido actual de providers a un componente `LLMProvidersGrid`.
2. Crear componente `OpenRouterPrimaryTab` para la Tab 1.
3. Cambiar `aiSubTab` de `'keys' | 'analytics'` a `'primary' | 'providers' | 'analytics'`.
4. Mover los 6 providers actuales a Tab 2 ("Otros Proveedores") con banner de sugerencia OpenRouter.
5. Mover `AIUsageDashboard` + `ProviderStatusGrid` a Tab 3.
6. Actualizar `StepLLM` del onboarding para destacar OpenRouter.
7. Agregar traducciones i18n para las nuevas keys.

### Fase C — Fallback automático + polish

1. Implementar lógica de fallback en `OpenRouterProvider` (enviar `route: 'fallback'` + `models[]`).
2. UI para configurar modelos de fallback en `OpenRouterPrimaryTab`.
3. Mostrar modelo usado en respuesta (OpenRouter retorna `model` en la response).
4. E2E tests para el flujo de OpenRouter en settings.

---

## 7. Out of scope

- Migrar usuarios existentes automáticamente de providers directos a OpenRouter.
- Streaming vía OpenRouter para el chat (se puede agregar en una spec futura).
- Rate limiting específico de OpenRouter (se hereda el rate limiting genérico ya existente).
- Implementar OpenRouter OAuth (solo API key manual).

---

## 8. Decisiones de diseño

| #   | Decisión                                         | Alternativa                       | Razón                                                                                |
| --- | ------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | OpenRouter como provider adicional, no reemplazo | Eliminar providers directos       | El usuario debe poder elegir. Algunos prefieren no depender de un intermediario.     |
| 2   | 3 sub-tabs en AI settings                        | Mantener 2 tabs actuales          | Separar OpenRouter (primario) de providers directos mejora la UX y reduce confusión. |
| 3   | Fallback configurado en UI, no automático        | Fallback siempre activo           | El usuario puede tener restricciones de budget o preferencias de modelo específicas. |
| 4   | Formato OpenAI-compatible para el provider       | Formato custom                    | OpenRouter usa el formato de OpenAI `/v1/chat/completions`, minimiza código nuevo.   |
| 5   | `fallbackModels` en LLMCredential                | Tabla separada de fallback config | Es un array simple, no justifica una tabla nueva. Solo aplica a OpenRouter.          |
| 6   | OpenRouter recomendado en onboarding             | No cambiar onboarding             | Reducir fricción de onboarding es prioritario.                                       |
| 7   | Mostrar precios de OpenRouter dinámicamente      | Hardcodear precios                | OpenRouter retorna precios en `/api/v1/models`, mejor usar datos reales.             |
