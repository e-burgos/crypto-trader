# Spec 38 — Toggle Global de Proveedores LLM + Hardening LLM Pipeline

**Fecha:** 2026-04-23  
**Versión:** 4.0  
**Estado:** Implementado  
**Branch:** `feature/llm-provider-toggle`  
**Dependencias:** Spec 35 (openrouter-integration), Spec 31 (llm-provider-dashboard), Spec 36 (agent-hub-config)

| Versión | Fecha      | Cambios                                                                                                                                                                                  |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-04-22 | Versión inicial: toggle admin, validaciones, UI admin/user                                                                                                                               |
| 2.0     | 2026-04-22 | Amplía scope: fixes P1-P4, persistencia de sentimiento A2, chat agent/model header, TTL C1, tabla normativa agente→proceso                                                               |
| 3.0     | 2026-04-22 | Sección F: modelos OpenRouter dinámicos via SDK, eliminación de hardcodeo, nueva lib `libs/openrouter`                                                                                   |
| 4.0     | 2026-04-23 | Estado → Implementado. Agrega sección G: mejoras UX adicionales (SIGMA bug, agent model display, vertical tabs, Select auto-direction, responsive filters). Correcciones de lint ESLint. |

---

## 1. Resumen ejecutivo

Actualmente todos los proveedores LLM están siempre habilitados para todos los usuarios. El administrador no tiene forma de desactivar un proveedor a nivel plataforma (e.g. si Groq deja de funcionar, si se negocia un contrato exclusivo con OpenRouter, o si se quiere simplificar la oferta).

Además, la auditoría del pipeline LLM reveló **4 problemas técnicos**, **un gap de persistencia de datos** y **una mejora de UX** que se resuelven en esta misma spec.

Esta spec introduce:

### A. Toggle global por proveedor (Admin)

- **Toggle global por proveedor** en `/admin/llm-providers`: tabla con switch on/off por cada proveedor LLM.
- **Propagación a toda la plataforma**: al desactivar un proveedor, todos los usuarios pierden acceso a ese proveedor — no pueden configurar API keys, los agentes que lo usaban quedan sin LLM asignado.
- **Fallback a OpenRouter**: si un usuario tenía un proveedor/modelo que se desactiva, se le sugiere migrar a OpenRouter como proveedor principal.
- **Redirect forzado**: si el LLM activo del usuario pasa a inactivo, se valida en cada request y se redirige a `/dashboard/settings/llms` (mismo flujo que cuando no hay LLM configurado).
- **Cards de API key deshabilitadas**: en `/dashboard/settings/llms`, las cards de proveedores inactivos se muestran grayed-out sin permitir configuración.
- **Agentes impactados**: en `/dashboard/settings/agents`, si un agente tiene un LLM inactivo se limpia su configuración y se envía una notificación push llevando a `/dashboard/settings/agents`.
- **Auditoría**: cada cambio de estado queda registrado en AdminAction.

### B. Hardening del pipeline LLM

- **Regla normativa**: TODO proceso LLM DEBE resolver vía `AgentConfigResolver` usando la config del agente correspondiente definida por el usuario en `/dashboard/settings/agents`.
- **Fix P1**: Eliminar `llmApiKey` muerto en `TradingProcessor`.
- **Fix P2**: Reemplazar check genérico de credential en `TradingProcessor` por `agentConfigResolver.checkHealth(userId)`.
- **Fix P3**: Eliminar método legacy `resolveLLMForNews()` que no usa `AgentConfigResolver`.
- **Fix P4**: Validar provider activo globalmente en `SubAgentService.getProvider()`.

### C. Persistencia de sentimiento del trading (A2→DB)

- Cuando el proceso de trading (A2) genera un análisis de sentimiento via SIGMA, el resultado DEBE persistirse en `NewsAnalysis.aiAnalyzedAt/aiHeadlines` para ser reutilizable por otros procesos y evitar llamadas LLM redundantes.

### D. TTL unificado de análisis de noticias por IA (C1)

- El análisis AI de sentimiento (`analyzeSentiment`) DEBE respetar el intervalo configurado por el usuario (`NewsConfig.intervalMinutes`). Si el último análisis AI (ya sea generado por A2 trading o por el botón manual) está dentro del TTL → no se ejecuta nueva llamada LLM.

### E. Chat: indicador visual de agente/modelo activo (B2)

- En la UI de chat, al cambiar de agente vía routing de KRYPTO, mostrar visualmente el cambio incluyendo el provider/modelo que está respondiendo.

### F. Modelos OpenRouter dinámicos — eliminación de hardcodeo

**Problema:** Los modelos OpenRouter están hardcoded en `model-pricing.ts`, `model-ranking.ts`, `agent-presets.ts` y múltiples archivos frontend. Cuando un modelo se depreca o se revela (ej: `openrouter/elephant-alpha`), todo el sistema rompe con 404.

**Solución:** Reemplazar todas las listas hardcoded de OpenRouter con fetching dinámico via `@openrouter/sdk`:

- **Nueva lib `libs/openrouter`:** Encapsula el SDK de OpenRouter (`@openrouter/sdk`), expone un servicio con cache (TTL 15min) que lista modelos, filtra por categoría/precio, y provee tipos compartidos.
- **Backend:** Nuevo endpoint `GET /openrouter/models` que proxy-a la API con cache server-side. `model-pricing.ts` y `model-ranking.ts` mantienen datos estáticos solo para providers non-OpenRouter; las entradas de OpenRouter se resuelven dinámicamente.
- **`agent-presets.ts`:** Los presets validan que los modelos existan contra la API en runtime (fallback a modelo similar si el preset queda obsoleto).
- **Frontend:** Los selectores de modelo OpenRouter consumen el endpoint dinámico en vez de arrays hardcoded.

---

## 2. Arquitectura

### 2.1 Modelo de datos

```prisma
model PlatformLLMProvider {
  id        String      @id @default(cuid())
  provider  LLMProvider @unique
  isActive  Boolean     @default(true)
  updatedAt DateTime    @updatedAt
  updatedBy String?     // adminId que hizo el cambio

  @@map("platform_llm_providers")
}
```

> Se usa un modelo dedicado en vez de un enum o config JSON para permitir queries eficientes, auditoría por registro y extensibilidad futura (e.g. añadir `reason`, `disabledAt`).

### 2.2 Seed: inicialización

Al migrar, se crea un registro por cada valor del enum `LLMProvider` con `isActive: true`. Esto garantiza que la tabla está poblada antes de que el admin interactúe.

### 2.3 Flujo de desactivación

```
Admin toggle OFF "GROQ" en /admin/llm-providers
  │
  ├─ PUT /admin/llm-providers/:provider/toggle  { isActive: false }
  │    └─ PlatformLLMProviderService.toggle(provider, isActive, adminId)
  │         ├─ Actualizar PlatformLLMProvider.isActive = false
  │         ├─ Registrar AdminAction (DISABLE_PROVIDER)
  │         ├─ Buscar AgentConfigs que usan GROQ como provider
  │         │    └─ Para cada uno: limpiar provider/model → null
  │         │         └─ Crear Notification (LLM_PROVIDER_DISABLED) al userId
  │         └─ Return { provider, isActive, affectedUsers: number }
  │
  └─ Frontend recibe respuesta → actualizar tabla + mostrar toast
```

### 2.4 Flujo de validación en runtime

```
Cualquier request autenticada del usuario
  │
  └─ Guard / Middleware verifica:
       ├─ ¿El usuario tiene LLM credential activa?
       │    └─ Si el provider de esa credential está desactivado globalmente
       │         └─ Responder con 409 { code: 'LLM_PROVIDER_DISABLED', redirect: '/dashboard/settings/llms' }
       │
       └─ Frontend interceptor detecta 409 LLM_PROVIDER_DISABLED
            └─ Redirect a /dashboard/settings/llms + toast informativo
```

> **Decisión**: la validación NO se hace como Guard global (sería demasiado agresivo, bloquearía incluso GET de settings). Se hace **solo en endpoints que ejecutan LLM** (trading, chat, analysis) y en el frontend se valida al montar páginas críticas.

### 2.5 Frontend: cards deshabilitadas

```
/dashboard/settings/llms
  │
  └─ GET /llm-providers/status (público autenticado)
       └─ Retorna [{ provider: 'GROQ', isActive: false }, ...]
            │
            └─ Frontend: si isActive=false → card con overlay "Proveedor desactivado por el administrador"
                 └─ Input y botones disabled, opacity reducida
```

---

## 3. Modelos de datos (Prisma)

### 3.1 Nuevo modelo

```prisma
model PlatformLLMProvider {
  id        String      @id @default(cuid())
  provider  LLMProvider @unique
  isActive  Boolean     @default(true)
  updatedAt DateTime    @updatedAt
  updatedBy String?

  @@map("platform_llm_providers")
}
```

### 3.2 Nuevo enum value para NotificationType

```prisma
enum NotificationType {
  // ... existentes ...
  LLM_PROVIDER_DISABLED   // nuevo
}
```

### 3.3 Sin cambios en modelos existentes

`LLMCredential`, `AgentConfig`, `User` no cambian de schema. La lógica de "proveedor activo" se resuelve con JOINs/queries al nuevo modelo.

---

## 4. API Endpoints

### 4.1 Admin endpoints

| Método | Ruta                                    | Auth  | Descripción                             |
| ------ | --------------------------------------- | ----- | --------------------------------------- |
| `GET`  | `/admin/llm-providers`                  | ADMIN | Lista todos los providers con su estado |
| `PUT`  | `/admin/llm-providers/:provider/toggle` | ADMIN | Cambia isActive de un provider          |

#### GET /admin/llm-providers

**Response 200:**

```json
[
  { "provider": "CLAUDE", "isActive": true, "updatedAt": "2026-04-22T..." },
  { "provider": "GROQ", "isActive": false, "updatedAt": "2026-04-22T..." },
  ...
]
```

#### PUT /admin/llm-providers/:provider/toggle

**Body:**

```json
{ "isActive": false }
```

**Response 200:**

```json
{
  "provider": "GROQ",
  "isActive": false,
  "affectedAgentConfigs": 3,
  "affectedUsers": 2
}
```

**Side effects:**

- Registra AdminAction con action `DISABLE_PROVIDER` o `ENABLE_PROVIDER`
- Si `isActive: false`: limpia AgentConfigs que usaban ese provider, envía notificaciones

### 4.2 User endpoint

| Método | Ruta                    | Auth | Descripción                          |
| ------ | ----------------------- | ---- | ------------------------------------ |
| `GET`  | `/llm-providers/status` | USER | Lista providers con su estado global |

Retorna el mismo formato que el admin endpoint. Se usa para que el frontend sepa qué cards deshabilitar.

### 4.3 Validación en endpoints LLM-dependientes

Los endpoints que ejecutan llamadas LLM (`/trading/start`, `/chat/message`, `/agents/analyze`) deben verificar que el provider del usuario esté activo globalmente antes de proceder. Si no → `409 Conflict` con body:

```json
{
  "statusCode": 409,
  "code": "LLM_PROVIDER_DISABLED",
  "message": "The LLM provider GROQ has been disabled by the administrator",
  "redirect": "/dashboard/settings/llms"
}
```

### 4.4 Validación en setLLMKey

`POST /users/me/llm-keys` debe rechazar con `400 Bad Request` si el provider está desactivado globalmente:

```json
{
  "statusCode": 400,
  "code": "LLM_PROVIDER_DISABLED",
  "message": "Cannot configure API key for disabled provider GROQ"
}
```

---

## 5. Componentes Frontend

### 5.1 Admin: `/admin/llm-providers`

Nuevo panel **"Estado de Proveedores"** (DataTable) ARRIBA de las secciones existentes de API keys:

| Columna              | Contenido                              |
| -------------------- | -------------------------------------- |
| Proveedor            | Nombre + icono                         |
| Estado               | Badge verde "Activo" / rojo "Inactivo" |
| Última actualización | Fecha relativa                         |
| Acción               | Toggle switch                          |

Al hacer toggle OFF → Dialog de confirmación: "¿Desactivar {provider}? Los usuarios que lo usen perderán acceso y sus agentes serán reconfigurados."

### 5.2 User: `/dashboard/settings/llms`

- Obtener estado de providers via `GET /llm-providers/status`
- Cards de providers inactivos: overlay semitransparente + mensaje "Desactivado por el administrador" + todos los inputs disabled

### 5.3 User: `/dashboard/settings/agents`

- Al cargar, verificar si algún agente tiene provider inactivo
- Si sí: mostrar badge "Requiere atención" en ese agente
- La notificación push (WebSocket) lleva directamente a esta página

### 5.4 Interceptor HTTP global

- Detectar respuestas `409` con `code: 'LLM_PROVIDER_DISABLED'`
- Redirect automático a `/dashboard/settings/llms`
- Toast: "El proveedor LLM {provider} ha sido desactivado. Configura un nuevo proveedor."

---

## 6. Regla normativa: mapeo agente → proceso LLM

> **TODO proceso que consuma un LLM DEBE resolver provider/modelo vía `AgentConfigResolver` usando la configuración que el usuario estableció en `/dashboard/settings/agents`.** No se permite usar `findFirst({ isActive: true })` ni credentials genéricas.

### 6.1 Tabla normativa

| #      | Proceso                           | Servicio → Método                                                                                     | Agente que resuelve | Config ID    | Usa AgentConfigResolver? | Estado                                            |
| ------ | --------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------- | ------------ | ------------------------ | ------------------------------------------------- |
| **A1** | Señal técnica (indicadores)       | `OrchestratorService.orchestrateDecision` → `subAgent.call('market', 'technical_signal')`             | SIGMA               | `market`     | ✅                       | OK                                                |
| **A2** | Sentimiento de noticias (trading) | `OrchestratorService.orchestrateDecision` → `subAgent.call('market', 'news_sentiment')`               | SIGMA               | `market`     | ✅                       | **Fix: persistir resultado en DB**                |
| **A3** | Sizing de posición                | `OrchestratorService.orchestrateDecision` → `subAgent.call('operations', 'sizing_suggestion')`        | FORGE               | `operations` | ✅                       | OK                                                |
| **A4** | Gate de riesgo                    | `OrchestratorService.orchestrateDecision` → `subAgent.call('risk', 'risk_gate')`                      | AEGIS               | `risk`       | ✅                       | OK                                                |
| **A5** | Síntesis de decisión trading      | `OrchestratorService.orchestrateDecision` → `subAgent.call('orchestrator', 'decision_synthesis')`     | KRYPTO              | `synthesis`  | ✅                       | OK                                                |
| **A6** | Check existencia credential       | `TradingProcessor` paso 3 → `findFirst({ isActive: true })`                                           | **Ninguno**         | —            | ❌                       | **Fix P2: reemplazar por checkHealth**            |
| **A7** | Decrypt API key legacy            | `TradingProcessor` línea 140                                                                          | **N/A**             | —            | ❌                       | **Fix P1: eliminar código muerto**                |
| **B1** | Clasificación de intención        | `OrchestratorService.classifyIntent` → `subAgent.call('orchestrator', ..., preferCheap=true)`         | KRYPTO              | `routing`    | ✅                       | OK                                                |
| **B2** | Streaming de respuesta chat       | `ChatService.sendMessage` → `agentConfigResolver.resolveConfig(activeAgentId)` → `callLLMStream()`    | **Agente activo**   | variable     | ✅                       | **Mejora: mostrar cambio de agente/modelo en UI** |
| **B3** | Síntesis cross-agent chat         | `OrchestratorService.synthesizeCrossAgent` → `subAgent.call('orchestrator', 'cross_agent_synthesis')` | KRYPTO              | `synthesis`  | ✅                       | OK                                                |
| **C1** | Análisis AI sentimiento noticias  | `MarketService.analyzeSentiment` → `createLLMProvider()`                                              | SIGMA               | `market`     | ✅                       | **Fix: respetar TTL de intervalMinutes**          |
| **C2** | Relevancia técnica de noticia     | `OrchestratorService.enrichNews` → `subAgent.call('market', 'news_technical_relevance')`              | SIGMA               | `market`     | ✅                       | OK                                                |
| **C3** | Impacto ecosistema de noticia     | `OrchestratorService.enrichNews` → `subAgent.call('blockchain', 'ecosystem_impact')`                  | CIPHER              | `blockchain` | ✅                       | OK                                                |
| **C4** | `resolveLLMForNews()` fallback    | `MarketService.resolveLLMForNews` → `findMany()[0]`                                                   | **Ninguno**         | —            | ❌                       | **Fix P3: eliminar método legacy**                |

### 6.2 Procesos utilitarios (no generan contenido AI)

| #      | Proceso                  | Servicio                          | Usa credentials?                | Necesita AgentConfigResolver?  |
| ------ | ------------------------ | --------------------------------- | ------------------------------- | ------------------------------ |
| **D1** | Test de API key          | `UsersService.testLLMKey`         | Sí (credential específica)      | No — solo valida conectividad  |
| **D2** | Validar todas las keys   | `UsersService.validateAllLLMKeys` | Sí                              | No                             |
| **D3** | Listar modelos dinámicos | `LLMModelsService.getModels`      | Sí (credential del provider)    | No — lista modelos disponibles |
| **D4** | Health check providers   | `ProviderHealthService`           | No directamente                 | No                             |
| **D5** | Embeddings (RAG)         | `EmbeddingService.embed`          | No — usa env vars de plataforma | No                             |
| **D6** | Analytics (display)      | `AnalyticsService`                | Solo lectura                    | No                             |

### 6.3 Resumen de agente → procesos

| Agente               | Config ID    | Procesos                                                                                                           |
| -------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| **KRYPTO routing**   | `routing`    | B1 (clasificación intención chat)                                                                                  |
| **KRYPTO synthesis** | `synthesis`  | A5 (síntesis decisión trading), B3 (síntesis cross-agent chat)                                                     |
| **SIGMA**            | `market`     | A1 (señal técnica), A2 (sentimiento noticias trading), C1 (análisis AI noticias), C2 (relevancia técnica noticias) |
| **FORGE**            | `operations` | A3 (sizing de posición)                                                                                            |
| **AEGIS**            | `risk`       | A4 (gate de riesgo)                                                                                                |
| **CIPHER**           | `blockchain` | C3 (impacto ecosistema noticias)                                                                                   |
| **NEXUS**            | `platform`   | B2 (streaming chat cuando agente activo = platform)                                                                |
| **Agente activo**    | variable     | B2 (streaming chat — usa el agente clasificado por B1)                                                             |

---

## 7. Fixes técnicos del pipeline LLM

### 7.1 Fix P1 — Eliminar `llmApiKey` muerto en TradingProcessor

**Archivo:** `apps/api/src/trading/trading.processor.ts` línea 140  
**Problema:** `const llmApiKey = decrypt(llmCred.apiKeyEncrypted, llmCred.apiKeyIv)` — se desencripta pero nunca se usa. El orchestrator resuelve sus propias credentials internamente.  
**Fix:** Eliminar la línea.

### 7.2 Fix P2 — Check agent-aware en TradingProcessor

**Archivo:** `apps/api/src/trading/trading.processor.ts` paso 3  
**Problema:** `lLMCredential.findFirst({ userId, isActive: true })` verifica que exista _alguna_ credential, pero no verifica que los agentes resueltos tengan credentials. Si el usuario solo tiene GROQ pero los agentes apuntan a OPENROUTER → este check pasa pero el orchestrator falla.  
**Fix:** Reemplazar por `agentConfigResolver.checkHealth(userId)`. Si `!healthy` → pausar agente con notificación `AGENT_ERROR`.

### 7.3 Fix P3 — Eliminar `resolveLLMForNews()` legacy

**Archivo:** `apps/api/src/market/market.service.ts` línea 286  
**Problema:** Toma la primera credential activa sin usar `AgentConfigResolver`. Ya no se llama activamente — `analyzeSentiment` ya usa el resolver.  
**Fix:** Eliminar el método.

### 7.4 Fix P4 — Validar provider activo en SubAgentService.getProvider()

**Archivo:** `apps/api/src/orchestrator/sub-agent.service.ts` → `getProvider()`  
**Problema:** No verifica que el provider resuelto esté activo a nivel plataforma (tabla `PlatformLLMProvider`).  
**Fix:** Inyectar `PlatformLLMProviderService` en `SubAgentService`. Antes de crear el client, llamar `assertProviderActive(provider)`.

---

## 8. Persistencia de sentimiento del trading (A2→DB)

### 8.1 Problema

Cuando `OrchestratorService.orchestrateDecision` ejecuta el sub-agent call `('market', 'news_sentiment')`, el resultado se usa para la síntesis de decisión y se guarda en `agentDecision.metadata.subAgentResults`. Pero **NO se persiste en `NewsAnalysis`** como análisis AI. Esto significa que:

1. El resultado no es visible en la UI de News Feed como "último análisis AI".
2. Otros procesos que consultan `getLatestAnalysis().aiAnalyzedAt` no lo ven como reciente.
3. Se pierde la oportunidad de reusar el sentimiento AI entre bots del mismo usuario.

### 8.2 Fix

Después de que `sentimentRaw` resuelve (y no es cache), persistir el resultado en `NewsAnalysis`:

```typescript
// En OrchestratorService.orchestrateDecision, después de obtener sentimentRaw:
if (sentimentRaw.status === 'fulfilled' && !cachedSentiment) {
  // Persistir como análisis AI en NewsAnalysis para reuso cross-proceso
  await this.persistSentimentAsAIAnalysis(userId, sentimentRaw.value);
}
```

El método `persistSentimentAsAIAnalysis` actualiza el `NewsAnalysis` más reciente del usuario con:

- `aiAnalyzedAt: new Date()`
- `aiProvider: provider resuelto del agente market`
- `aiModel: model resuelto`
- Parse del JSON de sentimiento → `aiPositiveCount`, `aiNegativeCount`, `aiNeutralCount`, `aiScore`, `aiOverallSentiment`, `aiSummary`, `aiHeadlines`

---

## 9. TTL unificado de análisis de noticias (C1)

### 9.1 Problema

`MarketService.analyzeSentiment()` no verifica si ya existe un análisis AI reciente. Cada vez que se llama (botón manual o trigger automático), ejecuta una llamada LLM nueva. Esto:

1. Genera costos innecesarios si el usuario presiona el botón repetidamente.
2. No respeta el intervalo configurado (`NewsConfig.intervalMinutes`, default 10 min).
3. No considera que A2 (trading) ya pudo haber generado un análisis AI reciente.

### 9.2 Fix

Al inicio de `analyzeSentiment`, verificar:

```typescript
const cfg = await this.getNewsConfig(userId);
const ttlMs = cfg.intervalMinutes * 60_000;
const latest = await this.getLatestAnalysis(userId);

if (latest?.aiAnalyzedAt) {
  const age = Date.now() - new Date(latest.aiAnalyzedAt).getTime();
  if (age < ttlMs) {
    this.logger.log(
      `AI analysis still fresh (${Math.round(age / 1000)}s < ${cfg.intervalMinutes}min TTL). Skipping.`,
    );
    return latest; // Retornar el análisis existente
  }
}
```

Esto respeta el campo `intervalMinutes` como TTL tanto para análisis generados por A2 (trading) como por el botón manual en C1.

---

## 10. Chat: indicador visual de agente/modelo (B2)

### 10.1 Estado actual

El chat ya muestra el agente activo y el modelo en `AgentHeader` (componente de `@crypto-trader/ui`) con `provider` y `model` de la sesión. También emite un evento SSE `type: 'routing'` cuando KRYPTO clasifica la intención.

### 10.2 Mejora

El backend ya envía un evento SSE `type: 'routing'` con `agentId`. Falta incluir `provider` y `model` en ese evento para que el frontend pueda mostrar el cambio completo:

**Backend:** En `ChatService.sendMessage()`, después de resolver `effectiveProvider` y `effectiveModel`, incluirlos en el evento SSE de routing:

```typescript
subject.next(
  new MessageEvent('message', {
    data: JSON.stringify({
      type: 'routing',
      agentId: activeAgentId,
      provider: effectiveProvider, // nuevo
      model: effectiveModel, // nuevo
      greeting: classification.suggestedGreeting || undefined,
    }),
  }),
);
```

**Frontend:** `AgentHeader` ya recibe `provider` y `model` como props. Solo necesita que el hook `useChatAgent` propague los nuevos campos del evento de routing para que se muestren inmediatamente (sin esperar la recarga de la sesión).

---

## 11. Fases de implementación

### Fase A — Backend: modelo + API admin + seed + fixes P1-P3

1. Migración Prisma: crear modelo `PlatformLLMProvider` + nuevo enum value `LLM_PROVIDER_DISABLED` en `NotificationType`
2. Seed: poblar tabla con todos los providers del enum `LLMProvider` con `isActive: true`
3. Crear `PlatformLLMProviderService` en módulo `llm/`
4. Crear `AdminLLMProviderController` con `GET /admin/llm-providers` y `PUT /admin/llm-providers/:provider/toggle`
5. Lógica de toggle: actualizar estado, registrar AdminAction, limpiar AgentConfigs afectados, enviar notificaciones
6. Crear `GET /llm-providers/status` (endpoint público autenticado)
7. **Fix P1:** Eliminar `llmApiKey` muerto en `TradingProcessor`
8. **Fix P2:** Reemplazar check genérico por `checkHealth` en `TradingProcessor`
9. **Fix P3:** Eliminar `resolveLLMForNews()` de `MarketService`
10. Tests unitarios del service

### Fase B — Backend: validaciones + pipeline hardening

1. **Fix P4:** Validar provider activo en `SubAgentService.getProvider()` via `PlatformLLMProviderService.assertProviderActive()`
2. Validación en `setLLMKey`: rechazar si provider está desactivado
3. Validación en endpoints LLM-dependientes (trading, chat, analysis): verificar provider activo
4. **A2→DB:** Persistir sentimiento de noticias del trading en `NewsAnalysis`
5. **C1 TTL:** Verificar TTL de `intervalMinutes` antes de ejecutar `analyzeSentiment`
6. **B2 SSE:** Incluir `provider` y `model` en evento SSE de routing del chat
7. Tests de validaciones y persistencia

### Fase C — Frontend: panel admin

1. Panel "Estado de Proveedores" con DataTable en `/admin/llm-providers`
2. Hook `useAdminLLMProviderStatus` + `useToggleLLMProvider`
3. Dialog de confirmación con impacto (affected users/agents)
4. Traducciones en.ts / es.ts

### Fase D — Frontend: UX usuario

1. Hook `usePlatformLLMStatus` (GET /llm-providers/status)
2. Cards deshabilitadas en `/dashboard/settings/llms`
3. Badge "Requiere atención" en `/dashboard/settings/agents`
4. Interceptor HTTP 409 → redirect + toast
5. **B2 UI:** Propagar `provider`/`model` del evento routing en `useChatAgent` → `AgentHeader`
6. Traducciones en.ts / es.ts

### Fase E — Modelos OpenRouter dinámicos

1. Crear `libs/openrouter` con servicio de fetching + cache + tipos
2. Backend: endpoint `GET /openrouter/models` con filtros (category, free, text-only)
3. Backend: refactorizar `model-pricing.ts` — eliminar entradas hardcoded de OpenRouter
4. Backend: refactorizar `model-ranking.ts` — entradas OpenRouter se resuelven dinámicamente
5. Backend: `agent-presets.ts` — validación en runtime de disponibilidad de modelos
6. Frontend: reemplazar `OPENROUTER_MODELS` hardcoded por fetch dinámico
7. Frontend: reemplazar listas en `settings.tsx`, `llms.tsx`, `constants.tsx`, `types.ts`

### Fase F — Mejoras UX adicionales (v4.0)

1. **SIGMA conclusion bug fix:** `news-sentiment-panel.tsx` y `analysis-summary-card.tsx` — derivar `effectiveSigma` desde AI analysis (`useNewsAnalysis()`) cuando `hasAi` es true, en vez de leer de metadata de decisiones del agente (que tenía score 0.00).
2. **Agent decision model display:** Nuevos campos `llmProvider`/`llmModel` en `DecisionPayload`, `trading.processor.ts`, y `analytics.service.ts` — persiste el modelo usado en síntesis para mostrarlo en detalle del agente (en vez de mostrar el modelo fallback).
3. **Vertical tabs layout:** `/dashboard/settings/agents` y `/admin/agent-models` — reemplazar grid de cards por sidebar vertical con navegación tipo tabs (desktop: sidebar w-48, mobile: Select dropdown).
4. **Select auto dropdown direction:** `libs/ui/src/lib/composites/select.tsx` — detección automática del espacio disponible para abrir el dropdown hacia arriba o abajo (umbral 280px).
5. **Model name truncation:** `Select` component — clase CSS `truncate` en label para nombres largos de modelos OpenRouter.
6. **Responsive filters:** `openrouter-model-select.tsx` — filtros pasan de `grid-cols-3` a `grid-cols-1 sm:grid-cols-3`.
7. **Equal height cards:** `items-stretch` + `h-full` en contenedores de AgentConfigCard y AdminAgentConfigCard.
8. **Full-width provider selector:** Eliminado `max-w-[240px]` para que el selector de provider use ancho completo.
9. **Badge "Requiere atención"** en `/dashboard/settings/agents` — sidebar y mobile Select muestran alerta amber cuando un agente tiene provider desactivado por admin.
10. **ESLint fix:** `eslint.config.mjs` — ignorar `**/package.json` para evitar parsing error en libs.

---

## 12. Out of scope

- Desactivación con fecha programada (scheduled toggle)
- Toggle por modelo individual (solo por provider completo)
- Migración automática de credentials a OpenRouter
- Notificación por email (solo in-app push via WebSocket)
- Rate limiting por provider a nivel admin
- Refactor del streaming del chat a usar `SubAgentService` (actualmente usa axios directo — es funcional y está fuera de scope)

---

## 13. Decisiones de diseño

| #   | Decisión                                                               | Alternativa                                 | Razón                                                                                 |
| --- | ---------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Modelo `PlatformLLMProvider` dedicado vs JSON config                   | JSON en tabla de settings                   | Queries eficientes, auditable, extensible                                             |
| 2   | Validación en endpoints específicos vs Guard global                    | Guard global en todos los endpoints         | Guard global bloquearía settings/profile; solo endpoints LLM necesitan validación     |
| 3   | Limpiar AgentConfig.provider/model al desactivar vs bloquear ejecución | Solo bloquear sin limpiar                   | Limpiar + notificar es más claro para el usuario; evita estado zombie                 |
| 4   | 409 Conflict para provider disabled vs 403 Forbidden                   | 403                                         | 409 semánticamente correcto (conflicto de estado), 403 implicaría falta de permisos   |
| 5   | Seed automático en migración vs creación on-demand                     | On-demand (crear registro al primer toggle) | Seed garantiza consistencia; todos los providers existen siempre                      |
| 6   | Notificación tipo `LLM_PROVIDER_DISABLED` vs reusar `AGENT_ERROR`      | Reusar tipo existente                       | Tipo dedicado permite filtrar y personalizar el mensaje/link en frontend              |
| 7   | Persistir sentimiento A2 en `NewsAnalysis` vs tabla separada           | Tabla dedicada de sentiment cache           | Reusar modelo existente, misma estructura AI ya definida                              |
| 8   | TTL de análisis AI basado en `intervalMinutes` vs TTL fijo             | TTL hardcoded de 10 min                     | Respetar configuración del usuario; flexibilidad                                      |
| 9   | Incluir provider/model en evento SSE routing vs solo agentId           | Frontend lo consulta después                | Evita roundtrip extra; dato ya disponible en backend al momento del routing           |
| 10  | Eliminar `resolveLLMForNews` vs marcar deprecated                      | Solo deprecar                               | Código muerto que puede confundir; eliminarlo es más seguro                           |
| 11  | Lib `libs/openrouter` dedicada vs integrar en `libs/analysis`          | Añadir al módulo analysis existente         | Separación de responsabilidades; openrouter tiene SDK propio, tipos, cache propia     |
| 12  | SDK `@openrouter/sdk` vs REST directo con axios                        | axios a `/api/v1/models`                    | SDK provee tipos TypeScript, validación Zod, mantiene paridad con API automáticamente |
| 13  | Cache server-side 15min vs cache frontend-only                         | Solo cache en React Query                   | Backend como proxy permite compartir cache entre usuarios, reduce calls a OpenRouter  |
