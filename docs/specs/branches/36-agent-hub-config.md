# Spec 36 — Agent Hub: Configuración Centralizada de Proveedores y Modelos por Agente

**Fecha:** 2026-04-20  
**Versión:** 1.1  
**Estado:** En progreso  
**Branch:** `feature/agent-hub-config`  
**Dependencias:** Spec 28 (multi-agent-chat-rag), Spec 31 (llm-provider-dashboard), Spec 35 (openrouter-integration)

---

## 1. Resumen ejecutivo

Actualmente la plataforma tiene configuraciones de proveedor y modelo LLM dispersas en tres lugares:

1. **`TradingConfig`** — `primaryProvider/primaryModel` y `fallbackProvider/fallbackModel` por cada configuración de trading.
2. **`NewsConfig`** — `primaryProvider/primaryModel` y `fallbackProvider/fallbackModel` para análisis IA de noticias.
3. **Settings genéricos** — el modelo de chat se selecciona al iniciar sesión de chat.

Con la arquitectura multi-agente (Spec 28), cada agente tiene un rol definido en el pipeline de la plataforma. No tiene sentido que el usuario configure modelos en cada feature por separado — la inteligencia de la plataforma está en los **agentes**, y cada agente debe tener **una sola configuración de proveedor + modelo** que se usa en todos los contextos donde ese agente opera.

Esta spec introduce:

- **Página `/settings/agents`** — donde el usuario configura proveedor + modelo para cada uno de los 6 agentes (NEXUS, FORGE, SIGMA, CIPHER, AEGIS, KRYPTO).
- **Página `/admin/agents`** — donde el Admin define los **defaults globales** que aplican a todos los usuarios que no hayan hecho override.
- **KRYPTO con dos modelos** — uno rápido para routing de intenciones, otro principal para síntesis de decisiones de trading.
- **Eliminación de configuración LLM redundante** — se remueven `primaryProvider/primaryModel/fallbackProvider/fallbackModel` de `TradingConfig` y `NewsConfig`.
- **Validación fuerte de API key** — onboarding exige al menos un proveedor configurado; detección reactiva si se elimina una key post-onboarding.

---

## 2. Arquitectura

### 2.1 Modelo de configuración centralizado

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                      CONFIGURACIÓN DE AGENTES                                ║
║                                                                              ║
║   Admin (defaults — SOLO OpenRouter)  Usuario (override — cualquier provider)║
║   /admin/agents                       /settings/agents                       ║
║   ┌────────────────────┐              ┌────────────────────┐                 ║
║   │ NEXUS:  OR/gpt-4o  │──default──→  │ NEXUS:  Groq/llama │ ← override     ║
║   │ FORGE:  OR/claude  │──default──→  │ FORGE:  ── (usa default) ──          ║
║   │ SIGMA:  OR/claude  │──default──→  │ SIGMA:  Claude/sonnet │ ← override   ║
║   │ CIPHER: OR/llama   │──default──→  │ CIPHER: ── (usa default) ──         ║
║   │ AEGIS:  OR/claude  │──default──→  │ AEGIS:  OpenAI/gpt │ (no desactiv.) ║
║   │ KRYPTO:            │──default──→  │ KRYPTO:            │                 ║
║   │  routing: OR/llama │              │  routing: ── (usa default)           ║
║   │  synth:   OR/claude│              │  synth:   OpenRouter/claude          ║
║   └────────────────────┘              └────────────────────┘                 ║
║                                                                              ║
║   Admin: configura SOLO modelos OpenRouter (proveedor fijo = OPENROUTER).    ║
║   Usuario: puede elegir cualquiera de los 7 proveedores para override.       ║
║   Resolución: override usuario > default admin > hardcoded fallback          ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

> **Decisión clave — Admin solo usa OpenRouter:** El Admin define defaults globales **exclusivamente con modelos de OpenRouter**. Esto simplifica la UX del Admin (un solo proveedor, catálogo completo de modelos), garantiza que los defaults cubran cualquier modelo disponible, y el usuario tiene la libertad de hacer override con el proveedor que prefiera. Los model IDs de OpenRouter son universales (`anthropic/claude-sonnet-4`, `openai/gpt-4o`, etc.) y el Admin trabaja con la API key del sistema.

### 2.2 Flujo de resolución de modelo por agente

Cuando cualquier servicio necesita invocar un agente (chat, trading pipeline, news enrichment):

```typescript
// AgentConfigResolver — servicio central
async resolveConfig(agentId: AgentId, userId: string): Promise<ResolvedAgentConfig> {
  // 1. Buscar override del usuario
  const userOverride = await this.getUserAgentConfig(userId, agentId);

  // 2. Buscar default del admin
  const adminDefault = await this.getAdminAgentConfig(agentId);

  // 3. Hardcoded fallback (último recurso)
  const hardcodedFallback = AGENT_FALLBACK_CONFIGS[agentId];

  // Merge con prioridad: usuario > admin > hardcoded
  return this.merge(userOverride, adminDefault, hardcodedFallback);
}
```

### 2.3 Quién usa cada agente — Mapa de dependencias

| Agente                 | Dónde se usa                                                                          | Contexto                                        |
| ---------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **KRYPTO** (routing)   | Chat sin agente seleccionado                                                          | Clasifica intención del primer mensaje          |
| **KRYPTO** (synthesis) | Trading pipeline, Chat cross-agente                                                   | Sintetiza decisión final combinando sub-agentes |
| **NEXUS**              | Chat (agente `platform`)                                                              | Responde dudas sobre la plataforma              |
| **FORGE**              | Chat (agente `operations`)                                                            | Ejecuta acciones de trading con tool calling    |
| **SIGMA**              | Chat (agente `market`), Trading pipeline (señal técnica + sentimiento), News analysis | Análisis técnico e interpretación de noticias   |
| **CIPHER**             | Chat (agente `blockchain`), News enrichment (impacto ecosistema)                      | Conocimiento blockchain puro                    |
| **AEGIS**              | Trading pipeline (risk gate), Chat (agente `risk`)                                    | Evalúa riesgo antes de cada decisión            |

### 2.4 Impacto en el pipeline de trading

**Antes (Spec 28):**

```
TradingConfig.primaryProvider/primaryModel → se usaba para la llamada LLM de decisión
NewsConfig.primaryProvider/primaryModel → se usaba para análisis IA de noticias
```

**Ahora:**

```
SIGMA.config → señal técnica + sentimiento de noticias + análisis IA de noticias
AEGIS.config → evaluación de riesgo (risk gate)
KRYPTO.synthesis.config → síntesis de decisión final
```

El pipeline ya no consulta `TradingConfig` ni `NewsConfig` para saber qué modelo usar — lo resuelve `AgentConfigResolver` para cada agente involucrado.

### 2.5 Impacto en análisis de noticias

**Antes:** `/settings/news` tenía la sección "AI Model for Analysis" con `primaryProvider/primaryModel`.

**Ahora:** El análisis IA de noticias (tanto en `/dashboard/news` como en el trading pipeline) usa la configuración de **SIGMA**. La sección "AI Model for Analysis" en `/settings/news` se elimina.

---

## 3. Modelos de datos

### 3.1 Nueva tabla: `AgentConfig` (configuración por usuario)

```prisma
model AgentConfig {
  id         String      @id @default(cuid())
  userId     String
  agentId    AgentId
  provider   LLMProvider
  model      String      // ej: "claude-sonnet-4-20250514" o "anthropic/claude-sonnet-4" (OpenRouter)
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, agentId])
  @@map("agent_configs")
}
```

### 3.2 Nueva tabla: `AdminAgentConfig` (defaults globales del Admin — solo OpenRouter)

```prisma
model AdminAgentConfig {
  id         String      @id @default(cuid())
  agentId    AgentId     @unique
  provider   LLMProvider @default(OPENROUTER) // siempre OPENROUTER para defaults del Admin
  model      String      // model ID en formato OpenRouter: "anthropic/claude-sonnet-4"
  updatedAt  DateTime    @updatedAt
  updatedBy  String      // userId del admin que configuró

  @@map("admin_agent_configs")
}
```

> **Restricción:** `provider` siempre es `OPENROUTER` en esta tabla. El Admin selecciona modelos del catálogo de OpenRouter (200+), que cubre todos los proveedores (Claude, GPT, Gemini, Llama, Mistral, etc.). La lista de modelos se carga con la API key de OpenRouter del Admin (variable de entorno `OPENROUTER_ADMIN_KEY` o la key personal del Admin en `LLMCredential`).

### 3.3 Caso especial: KRYPTO con dos modelos

KRYPTO necesita dos modelos: uno rápido para routing (clasificación de intención) y otro potente para síntesis (decisiones de trading, respuestas cross-agente).

Se representan como dos registros con `agentId` diferente:

```prisma
enum AgentId {
  platform      // NEXUS
  operations    // FORGE
  market        // SIGMA
  blockchain    // CIPHER
  risk          // AEGIS
  orchestrator  // KRYPTO — no se usa directamente, solo como namespace
  routing       // KRYPTO: modelo rápido para clasificación de intención
  synthesis     // KRYPTO: modelo principal para síntesis de decisiones
}
```

> `routing` y `synthesis` son los dos "sub-slots" de KRYPTO. En la UI se presentan agrupados bajo "KRYPTO" con explicación clara de para qué sirve cada uno. En la DB son dos `AgentConfig` / `AdminAgentConfig` independientes.

### 3.4 Campos a eliminar de `TradingConfig`

```prisma
model TradingConfig {
  // ELIMINAR estos 4 campos:
  // primaryProvider        LLMProvider?
  // primaryModel           String?
  // fallbackProvider       LLMProvider?
  // fallbackModel          String?

  // El resto se mantiene sin cambios
}
```

### 3.5 Campos a eliminar de `NewsConfig`

```prisma
model NewsConfig {
  // ELIMINAR estos 4 campos:
  // primaryProvider  LLMProvider?
  // primaryModel     String?
  // fallbackProvider LLMProvider?
  // fallbackModel    String?

  // El resto se mantiene sin cambios
}
```

### 3.6 Migración de datos

Al correr la migración, los datos existentes en `TradingConfig` y `NewsConfig` se migran a `AgentConfig`:

```sql
-- Migración: mover config LLM de TradingConfig → AgentConfig (para SIGMA)
-- Solo para usuarios que tenían primaryProvider/primaryModel configurados
INSERT INTO agent_configs (id, "userId", "agentId", provider, model, "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  tc."userId",
  'market',       -- SIGMA se encarga del análisis técnico
  tc."primaryProvider",
  tc."primaryModel",
  NOW(),
  NOW()
FROM trading_configs tc
WHERE tc."primaryProvider" IS NOT NULL
  AND tc."primaryModel" IS NOT NULL
ON CONFLICT ("userId", "agentId") DO NOTHING;

-- Migración: mover config LLM de NewsConfig → AgentConfig (también para SIGMA)
INSERT INTO agent_configs (id, "userId", "agentId", provider, model, "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  nc."userId",
  'market',
  nc."primaryProvider",
  nc."primaryModel",
  NOW(),
  NOW()
FROM news_configs nc
WHERE nc."primaryProvider" IS NOT NULL
  AND nc."primaryModel" IS NOT NULL
ON CONFLICT ("userId", "agentId") DO NOTHING;

-- Luego: ALTER TABLE trading_configs DROP COLUMN "primaryProvider", "primaryModel", "fallbackProvider", "fallbackModel";
-- ALTER TABLE news_configs DROP COLUMN "primaryProvider", "primaryModel", "fallbackProvider", "fallbackModel";
```

---

## 4. API endpoints

### 4.1 Configuración de agentes del usuario

| Método   | Ruta                               | Descripción                                                                                       |
| -------- | ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `GET`    | `/users/me/agents/config`          | Retorna la configuración de todos los agentes para el usuario (merge de override + admin default) |
| `PUT`    | `/users/me/agents/:agentId/config` | Guardar/actualizar override de proveedor + modelo para un agente                                  |
| `DELETE` | `/users/me/agents/:agentId/config` | Eliminar override (volver al default del admin)                                                   |

#### GET `/users/me/agents/config`

Respuesta:

```json
{
  "agents": [
    {
      "agentId": "platform",
      "displayName": "NEXUS",
      "description": "Experto en CryptoTrader",
      "icon": "BookOpen",
      "color": "bg-primary",
      "provider": "OPENROUTER",
      "model": "anthropic/claude-sonnet-4",
      "source": "user",
      "isOverridden": true,
      "canDisable": true
    },
    {
      "agentId": "risk",
      "displayName": "AEGIS",
      "description": "Gestor de Riesgo",
      "icon": "Shield",
      "color": "bg-red-500",
      "provider": "CLAUDE",
      "model": "claude-sonnet-4-20250514",
      "source": "admin",
      "isOverridden": false,
      "canDisable": false
    },
    {
      "agentId": "routing",
      "displayName": "KRYPTO — Routing",
      "description": "Modelo rápido para derivar consultas al agente correcto",
      "icon": "Brain",
      "color": "bg-gradient-to-br from-primary to-purple-500",
      "provider": "GROQ",
      "model": "llama-3.3-70b-versatile",
      "source": "admin",
      "isOverridden": false,
      "canDisable": false,
      "parentAgent": "orchestrator"
    },
    {
      "agentId": "synthesis",
      "displayName": "KRYPTO — Síntesis",
      "description": "Modelo principal para decisiones de trading y respuestas complejas",
      "icon": "Brain",
      "color": "bg-gradient-to-br from-primary to-purple-500",
      "provider": "CLAUDE",
      "model": "claude-sonnet-4-20250514",
      "source": "admin",
      "isOverridden": false,
      "canDisable": false,
      "parentAgent": "orchestrator"
    }
  ]
}
```

#### PUT `/users/me/agents/:agentId/config`

Body:

```json
{
  "provider": "OPENROUTER",
  "model": "anthropic/claude-sonnet-4"
}
```

Validaciones:

- `agentId` debe ser uno de los válidos (`platform`, `operations`, `market`, `blockchain`, `risk`, `routing`, `synthesis`).
- `provider` debe ser un `LLMProvider` válido.
- El usuario **debe tener una API key activa** para el `provider` indicado (verificar en `LLMCredential`).
- `model` debe ser un string no vacío.

### 4.2 Configuración de agentes del Admin (defaults globales)

| Método | Ruta                            | Descripción                                        |
| ------ | ------------------------------- | -------------------------------------------------- |
| `GET`  | `/admin/agents/config`          | Retorna los defaults globales de todos los agentes |
| `PUT`  | `/admin/agents/:agentId/config` | Guardar/actualizar default global para un agente   |

#### PUT `/admin/agents/:agentId/config`

Body:

```json
{
  "model": "anthropic/claude-sonnet-4"
}
```

> **Nota:** No se envía `provider` — es siempre `OPENROUTER`. El Admin solo selecciona el modelo del catálogo de OpenRouter. La lista de modelos se obtiene de `GET /users/me/llm/OPENROUTER/models` usando la key de OpenRouter del Admin.

### 4.3 Validación de proveedor disponible

| Método | Ruta                      | Descripción                                                    |
| ------ | ------------------------- | -------------------------------------------------------------- |
| `GET`  | `/users/me/agents/health` | Verifica que cada agente tenga un proveedor con API key válida |

Respuesta:

```json
{
  "healthy": false,
  "agents": [
    {
      "agentId": "platform",
      "provider": "OPENROUTER",
      "hasKey": true,
      "status": "ok"
    },
    {
      "agentId": "market",
      "provider": "CLAUDE",
      "hasKey": false,
      "status": "missing_key"
    },
    { "agentId": "routing", "provider": "GROQ", "hasKey": true, "status": "ok" }
  ],
  "action": "configure_keys",
  "missingProviders": ["CLAUDE"]
}
```

Este endpoint se llama:

1. **Al cargar el dashboard** — si `healthy: false`, muestra un banner de alerta con link a `/settings/agents`.
2. **Antes de ejecutar el trading pipeline** — si alguno de los agentes críticos (SIGMA, AEGIS, KRYPTO) no tiene key, el pipeline no arranca.
3. **Cuando el usuario elimina una API key** — se verifica qué agentes quedan huérfanos.

---

## 5. Componentes frontend

### 5.1 Nueva página: `/settings/agents` (Usuario)

```
Settings → Agents
┌─────────────────────────────────────────────────────────────────────────────┐
│  Configuración de Agentes                                                   │
│                                                                             │
│  Personaliza el proveedor y modelo de IA para cada agente de la plataforma. │
│  Si no configuras un agente, usará el modelo predeterminado por el Admin.   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  🧠 KRYPTO — Orquestador Central                                   │    │
│  │  Coordina todos los agentes. Usa dos modelos con roles distintos.   │    │
│  │                                                                     │    │
│  │  Modelo rápido (para derivar consultas)                             │    │
│  │  Proveedor: [🔍 Groq                    ▾]                         │    │
│  │  Modelo:    [🔍 llama-3.3-70b-versatile  ▾]                        │    │
│  │  ℹ️ Se usa para decidir qué agente responde tu consulta.            │    │
│  │  Recomendación: un modelo rápido y económico.                       │    │
│  │                                                                     │    │
│  │  Modelo principal (para decisiones de trading)                      │    │
│  │  Proveedor: [🔍 Claude (Anthropic)       ▾]                        │    │
│  │  Modelo:    [🔍 claude-sonnet-4-20250514  ▾]                       │    │
│  │  ℹ️ Se usa para combinar análisis y tomar la decisión final.        │    │
│  │  Recomendación: el modelo más potente disponible.                   │    │
│  │                                                                     │    │
│  │  [Guardar]  [↩ Restablecer default]                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌───────────────────────────┐  ┌───────────────────────────┐              │
│  │  📚 NEXUS                 │  │  ⚡ FORGE                  │              │
│  │  Experto en CryptoTrader  │  │  Asistente de Operaciones  │              │
│  │                           │  │                            │              │
│  │  Proveedor: [🔍 ────── ▾] │  │  Proveedor: [🔍 ────── ▾] │              │
│  │  Modelo:    [🔍 ────── ▾] │  │  Modelo:    [🔍 ────── ▾] │              │
│  │                           │  │                            │              │
│  │  Usando: default (Admin)  │  │  Usando: default (Admin)   │              │
│  │  [Guardar] [↩ Restablecer]│  │  [Guardar] [↩ Restablecer] │              │
│  └───────────────────────────┘  └───────────────────────────┘              │
│                                                                             │
│  ┌───────────────────────────┐  ┌───────────────────────────┐              │
│  │  📈 SIGMA                 │  │  🔗 CIPHER                 │              │
│  │  Analista de Mercado      │  │  Experto en Blockchain     │              │
│  │                           │  │                            │              │
│  │  Proveedor: [🔍 ────── ▾] │  │  Proveedor: [🔍 ────── ▾] │              │
│  │  Modelo:    [🔍 ────── ▾] │  │  Modelo:    [🔍 ────── ▾] │              │
│  │                           │  │                            │              │
│  │  Usando: override propio  │  │  Usando: default (Admin)   │              │
│  │  [Guardar] [↩ Restablecer]│  │  [Guardar] [↩ Restablecer] │              │
│  └───────────────────────────┘  └───────────────────────────┘              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  🛡️ AEGIS — Gestor de Riesgo                            🔒         │    │
│  │  Evalúa el riesgo de cada operación antes de ejecutarla.            │    │
│  │  Este agente no puede ser desactivado.                              │    │
│  │                                                                     │    │
│  │  Proveedor: [🔍 Claude (Anthropic)       ▾]                        │    │
│  │  Modelo:    [🔍 claude-sonnet-4-20250514  ▾]                       │    │
│  │                                                                     │    │
│  │  [Guardar]  [↩ Restablecer default]                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Selector de proveedor con buscador

El selector de proveedor muestra los 7 proveedores disponibles con un `InputSearcher` para filtrar:

```
┌──────────────────────────────┐
│  🔍 Buscar proveedor...      │
│  ─────────────────────────── │
│  ⭐ OpenRouter               │
│  Anthropic (Claude)          │
│  OpenAI                      │
│  Groq                        │
│  Google (Gemini)             │
│  Mistral AI                  │
│  Together AI                 │
│  ─────────────────────────── │
│  ⚠ Solo proveedores con API  │
│    key configurada.          │
└──────────────────────────────┘
```

**Regla clave:** Solo se muestran proveedores para los cuales el usuario tiene una API key activa. Si el usuario solo tiene OpenRouter, solo ve OpenRouter. Si no tiene ninguna key, ve un mensaje con link a `/settings` para configurar sus keys.

### 5.3 Selector de modelo con buscador y detalles

El selector de modelo se filtra dinámicamente según el proveedor elegido, usando el endpoint existente `GET /users/me/llm/:provider/models`:

```
┌──────────────────────────────────────────┐
│  🔍 Buscar modelo...                      │
│  ──────────────────────────────────────── │
│  anthropic/claude-sonnet-4               │
│  200K ctx · $3/$15 per 1M tokens         │
│                                           │
│  anthropic/claude-haiku-4-5              │
│  200K ctx · $0.25/$1.25 per 1M tokens    │
│                                           │
│  openai/gpt-4o                            │
│  128K ctx · $2.5/$10 per 1M tokens       │
│                                           │
│  openai/gpt-4o-mini                       │
│  128K ctx · $0.15/$0.6 per 1M tokens     │
│  ──────────────────────────────────────── │
│  Mostrando modelos de OpenRouter          │
└──────────────────────────────────────────┘
```

**Cuando el proveedor es OpenRouter:** se muestran los filtros avanzados propios de este proveedor (existentes en Spec 35):

- Filtrar por proveedor original (Anthropic, OpenAI, Google, Meta, etc.)
- Ordenar por precio, contexto, o popularidad
- Badge de "Free" para modelos gratuitos

### 5.4 Nueva página: `/admin/agents` — Configuración de defaults (solo OpenRouter)

La página Admin de agentes ya existe (Spec 28 — ver screenshot). Actualmente muestra los 6 agentes en cards colapsables con gestión de identidad, RAG y diagnóstico. Esta spec **agrega la configuración de modelo por defecto** dentro de cada card expandida.

```
Admin → AI Agents
┌─────────────────────────────────────────────────────────────────────────────┐
│  Admin Panel > AI Agents                                                    │
│                                                                             │
│  Manage AI agent definitions, system prompts, knowledge base documents,     │
│  and default models.                                                        │
│                                                                             │
│  ℹ️ Los defaults se configuran con modelos de OpenRouter.                    │
│     Cada usuario puede hacer override con su propio proveedor.              │
│                                                                             │
│  ┌─── KRYPTO ─ Central orchestrator ────────────────────────────────── ∨ ┐  │
│  │  [Tab: Identidad] [Tab: RAG] [Tab: Diagnóstico] [Tab: Modelo ✨]    │  │
│  │                                                                       │  │
│  │  Modelo Routing (clasificación de intención)                          │  │
│  │  [🔍 meta-llama/llama-3.3-70b-versatile           ▾]                 │  │
│  │  Recomendación: modelo rápido y económico.                            │  │
│  │                                                                       │  │
│  │  Modelo Síntesis (decisiones de trading)                              │  │
│  │  [🔍 anthropic/claude-sonnet-4                     ▾]                 │  │
│  │  Recomendación: el modelo más potente disponible.                     │  │
│  │                                                                       │  │
│  │  [Guardar defaults]                                                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─── NEXUS ─ Platform expert ──────────────────────────────────── ∨ ┐     │
│  │  ... (tabs existentes + nuevo tab "Modelo")                        │     │
│  │  Modelo: [🔍 openai/gpt-4o-mini                    ▾]             │     │
│  │  [Guardar]                                                         │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  (... FORGE, SIGMA, CIPHER, AEGIS con la misma estructura ...)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Cómo se carga la lista de modelos del Admin:**

- El Admin **debe tener una API key de OpenRouter configurada** para poder seleccionar modelos.
- La lista se obtiene de `GET /users/me/llm/OPENROUTER/models` con la key del Admin.
- El selector de modelo incluye buscador, filtros por provider original (Anthropic, OpenAI, etc.), precio y context window.
- Si el Admin no tiene key de OpenRouter, se muestra un banner: "Configura tu API key de OpenRouter en Settings → LLMs para poder seleccionar modelos por defecto."

### 5.5 Integración con la página Admin de Agentes existente (Spec 28)

La Spec 28 define cada card de agente expandible con 3 tabs: Identidad/Rol, Base de Conocimiento (RAG), Diagnóstico. Esta spec **agrega un cuarto tab "Modelo"** con el selector de modelo OpenRouter y el botón de guardar. Esta integración mantiene toda la gestión del agente (identidad + RAG + diagnóstico + modelo) en un solo lugar.

**Importante — Admin como enriquecedor de agentes:**
El Admin tiene tres herramientas para personalizar cada agente:

1. **Identidad/Rol** (Spec 28) — editar `displayName`, `description`, `systemPrompt` y `skills` habilitadas.
2. **RAG** (Spec 28) — subir documentos de conocimiento que se indexan y se inyectan como contexto en runtime.
3. **Modelo** (esta spec) — definir qué modelo de OpenRouter usa el agente por defecto.

Estos tres ejes trabajan juntos: el Admin puede refinar el prompt del agente, alimentar su base de conocimiento con documentación específica, y elegir el modelo más adecuado para la tarea del agente.

### 5.6 Banner de alerta: proveedor faltante

Cuando un agente no tiene un proveedor válido (porque el usuario eliminó su API key), se muestra un banner persistente en el dashboard:

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚠️ Algunos agentes no tienen un proveedor de IA configurado.    │
│  Esto puede afectar el funcionamiento de la plataforma.          │
│  Agentes afectados: SIGMA, AEGIS                                 │
│  [Configurar ahora →]                                            │
└──────────────────────────────────────────────────────────────────┘
```

Este banner:

- Aparece en todas las páginas del dashboard (no solo en settings).
- Se calcula al cargar el dashboard con `GET /users/me/agents/health`.
- Desaparece cuando todos los agentes tienen proveedor válido.
- Es **bloqueante** para el trading pipeline — no se puede iniciar un agente de trading si SIGMA, AEGIS o KRYPTO no tienen key válida.

---

## 6. Cambios en features existentes

### 6.1 `/settings/news` — Eliminar sección "AI Model for Analysis"

**Antes:**

```
Settings → News
├── General Config (intervalMinutes, newsCount, sources, onlySummary)
├── Trading Bot Integration (botEnabled, newsWeight)
└── AI Model for Analysis (primaryProvider, primaryModel, fallbackProvider, fallbackModel) ← ELIMINAR
```

**Después:**

```
Settings → News
├── General Config (intervalMinutes, newsCount, sources, onlySummary)
├── Trading Bot Integration (botEnabled, newsWeight)
└── ℹ️ "El análisis IA de noticias usa el modelo configurado en SIGMA. [Ir a Agentes →]"
```

Se reemplaza la sección de config LLM por un mensaje informativo con link a `/settings/agents`.

### 6.2 `/dashboard/config` — Eliminar Primary/Fallback model de TradingConfig

**Antes:**

```
Config → Crear/Editar configuración
├── Asset & Pair
├── Thresholds (buy, sell, stop-loss, take-profit)
├── Sizing (maxTradePct, maxConcurrentPositions)
├── Interval (mode, minutes)
├── Risk Profile
├── Primary Model (provider + model) ← ELIMINAR
└── Fallback Model (provider + model) ← ELIMINAR
```

**Después:**

```
Config → Crear/Editar configuración
├── Asset & Pair
├── Thresholds (buy, sell, stop-loss, take-profit)
├── Sizing (maxTradePct, maxConcurrentPositions)
├── Interval (mode, minutes)
├── Risk Profile
└── ℹ️ "Las decisiones de trading usan los agentes SIGMA, AEGIS y KRYPTO
       con los modelos configurados en [Agentes →]."
```

### 6.3 Onboarding — Validación fuerte de API key

**Cambios al flujo de onboarding (Spec 35 ya recomienda OpenRouter primero):**

1. El step de LLM se convierte en **bloqueante obligatorio**: el usuario NO puede completar el onboarding sin al menos una API key válida.
2. Se agrega una validación de key antes de permitir avanzar: `POST /users/me/llm-keys/test` debe retornar `{ valid: true }`.
3. El botón "Skip" / "Más tarde" se elimina del step de LLM.

**Flujo:**

```
Onboarding
├── Step 1: Binance Keys (obligatorio para LIVE/TESTNET, skip para SANDBOX)
├── Step 2: AI Provider (⭐ OBLIGATORIO — al menos 1 key válida)
│           ├── OpenRouter (Recomendado) — [key input] [Test] ✅
│           ├── ── o ──
│           └── Provider directo (Claude, OpenAI, etc.) — [key input] [Test]
│
│           ⚠ No puedes continuar sin al menos un proveedor configurado.
│           Los agentes de la plataforma necesitan acceso a un modelo de IA.
│
└── Step 3: Ready! → Dashboard
```

### 6.4 Detección reactiva de key eliminada

Cuando el usuario va a `/settings` → AI y elimina una API key:

1. **Antes de eliminar:** se llama `GET /users/me/agents/health?simulate=remove&provider=CLAUDE` para verificar qué agentes quedarían huérfanos.
2. **Si algún agente queda huérfano:** se muestra un dialog de confirmación:

```
┌────────────────────────────────────────────────────────┐
│  ⚠ Eliminar esta API key afecta a los siguientes       │
│  agentes:                                               │
│                                                         │
│  • SIGMA (Analista de Mercado)                          │
│  • KRYPTO Síntesis (Decisiones de trading)              │
│                                                         │
│  Estos agentes dejarán de funcionar hasta que           │
│  configures un proveedor alternativo.                   │
│                                                         │
│  [Eliminar de todas formas]    [Cancelar]               │
└────────────────────────────────────────────────────────┘
```

3. **Si se confirma la eliminación y es la última key:** redirigir al usuario a configurar una nueva key (no puede operar sin ninguna).

---

## 7. NEXUS: Comportamiento práctico y accesos directos

NEXUS no es solo un agente conversacional — es el **punto de entrada práctico** a la plataforma. Sus respuestas deben ser:

### 7.1 Principios de respuesta

1. **Resumidas y directas** — máximo 3-4 oraciones para consultas simples. Sin preámbulos ni florituras.
2. **Con accesos directos** — cuando la respuesta implica navegar a un módulo, incluir un link clicable.
3. **Con ejemplos concretos** — si explica un parámetro, dar el valor recomendado.

### 7.2 Accesos directos (Quick Actions)

NEXUS puede emitir accesos directos en sus respuestas como metadata estructurada que el frontend renderiza como botones:

```typescript
interface NexusQuickAction {
  type: 'navigate' | 'open_docs' | 'transfer_agent';
  label: string;
  target: string; // ruta, URL de docs, o agentId
}
```

**Ejemplos de respuesta con quick actions:**

```
"Para configurar tu primer agente de trading, ve a Configuración y crea una nueva config.
Te recomiendo empezar en modo Sandbox con BTC/USDT."

[📋 Ir a Configuración] [📖 Guía de configuración]
```

```
"El RSI (Relative Strength Index) mide la velocidad del cambio de precio.
En CryptoTrader, un RSI < 30 es señal de oversold (posible compra) y > 70 de overbought.
¿Quieres que SIGMA analice el RSI actual de BTC?"

[📈 Hablar con SIGMA] [📖 Indicadores técnicos]
```

### 7.3 Documentación inline

NEXUS tiene acceso al conocimiento de toda la plataforma vía RAG (Spec 28). Puede citar secciones de la documentación y ofrecer links a la ayuda contextual:

```
"El modo Testnet te permite operar con fondos de prueba en la red de Binance Testnet.
Las órdenes son reales pero los fondos no. Necesitas configurar tus Binance Testnet keys
por separado en Settings → Binance."

[⚙️ Ir a Settings → Binance] [📖 Modos de operación]
```

---

## 8. FORGE: Cuestionario interactivo

FORGE no debe requerir que el usuario escriba párrafos para crear una configuración. En su lugar, ofrece un **cuestionario paso a paso** conversacional:

### 8.1 Flujo de creación de configuración

```
FORGE: "Vamos a crear una nueva configuración de trading.
        Primero, ¿qué activo quieres operar?"

        [BTC]  [ETH]

Usuario: *click BTC*

FORGE: "Bien, BTC. ¿Contra qué moneda?"

        [USDT]  [USDC]

Usuario: *click USDT*

FORGE: "¿En qué modo quieres operar?"

        [🏖 Sandbox (recomendado para empezar)]
        [🧪 Testnet (órdenes de prueba reales)]
        [🔴 Live (dinero real)]

Usuario: *click Sandbox*

FORGE: "¿Qué perfil de riesgo prefieres? Esto ajusta los thresholds automáticamente."

        [🟢 Conservador: thresholds altos, stop-loss 2%]
        [🟡 Moderado: equilibrado, stop-loss 3%]
        [🔴 Agresivo: thresholds bajos, stop-loss 5%]

Usuario: *click Conservador*

FORGE: "Perfecto. He preparado esta configuración:"

        ┌─ ToolCallCard ──────────────────────────┐
        │ Crear configuración de trading           │
        │                                          │
        │ Nombre:     BTC/USDT Conservative        │
        │ Asset:      BTC / USDT                   │
        │ Modo:       SANDBOX                      │
        │ Buy:        80%  │  Sell: 80%            │
        │ Stop loss:  2%   │  Take profit: 4%      │
        │ Max trade:  3%                           │
        │ Intervalo:  AGENT (adaptativo)           │
        │                                          │
        │ [✅ Crear configuración]  [✏ Ajustar]    │
        └──────────────────────────────────────────┘
```

Si el usuario elige "Ajustar", FORGE pregunta qué quiere cambiar y ofrece opciones inline para cada parámetro.

### 8.2 Flujo de actualización

FORGE lista las configuraciones existentes y permite editarlas:

```
FORGE: "Tienes 2 configuraciones activas:"

        1. 📊 BTC/USDT Conservative (Sandbox, detenido)
        2. 📊 ETH/USDT Moderate (Sandbox, corriendo)

        "¿Cuál quieres modificar?"

        [1. BTC/USDT]  [2. ETH/USDT]  [Ninguna]
```

### 8.3 Flujo de eliminación

```
FORGE: "¿Estás seguro de que quieres eliminar 'BTC/USDT Conservative'?"
        ⚠ Esta acción no se puede deshacer. Las posiciones asociadas
        se mantendrán pero no se abrirán nuevas.

        [🗑 Sí, eliminar]  [Cancelar]
```

### 8.4 Flujo de inicio/detención de agente

```
FORGE: "¿Quieres iniciar el agente para 'BTC/USDT Conservative'?"
        Modo: Sandbox | Intervalo: Adaptativo (AGENT)
        El agente analizará el mercado y tomará decisiones automáticamente.

        [▶ Iniciar agente]  [No por ahora]
```

### 8.5 Flujo de cierre manual de posición

```
FORGE: "Tienes 1 posición abierta en BTC/USDT:"

        Entry: $67,230 | Current: $68,100 | P&L: +1.29%

        "¿Quieres cerrarla?"

        [📤 Cerrar posición]  [Mantener abierta]
```

---

## 9. Restricciones de AEGIS y KRYPTO

### 9.1 AEGIS: no desactivable por el usuario

- El usuario **puede cambiar** el proveedor y modelo de AEGIS.
- El usuario **NO puede desactivar** AEGIS ni su veredicto. No hay toggle de on/off.
- Si el veredicto de AEGIS es `BLOCK`, la operación se bloquea sin importar qué digan los otros agentes.
- En la UI, la card de AEGIS muestra un candado (🔒) y el texto: "Este agente no puede ser desactivado. Protege tu portfolio evaluando el riesgo de cada operación."

### 9.2 KRYPTO: parcialmente controlado por Admin

- El usuario puede cambiar los modelos de KRYPTO (tanto routing como synthesis).
- El Admin define los defaults.
- KRYPTO no se desactiva — es el orquestador de todo el pipeline.
- En la UI, KRYPTO se muestra con prominencia (tarjeta full-width en la parte superior) y explicación clara de para qué sirve cada modelo.

---

## 10. Hardcoded fallback defaults

Si ni el usuario ni el Admin han configurado un agente, se usan estos defaults hardcodeados como último recurso:

```typescript
const AGENT_FALLBACK_CONFIGS: Record<
  string,
  { provider: LLMProvider; model: string }
> = {
  platform: { provider: 'GROQ', model: 'llama-3.3-70b-versatile' },
  operations: { provider: 'GROQ', model: 'llama-3.3-70b-versatile' },
  market: { provider: 'GROQ', model: 'llama-3.3-70b-versatile' },
  blockchain: { provider: 'GROQ', model: 'llama-3.3-70b-versatile' },
  risk: { provider: 'GROQ', model: 'llama-3.3-70b-versatile' },
  routing: { provider: 'GROQ', model: 'llama-3.3-70b-versatile' },
  synthesis: { provider: 'GROQ', model: 'llama-3.3-70b-versatile' },
};
```

> Se eligió Groq con Llama como fallback porque es el proveedor gratuito más accesible. Este fallback solo aplica si el usuario tiene una key de Groq configurada — si no tiene ninguna key, el endpoint `/agents/health` marcará el agente como `missing_key` y el sistema no lo ejecutará.

---

## 11. System Prompts mejorados por agente

Los system prompts actuales (Spec 28) se actualizan para reflejar las responsabilidades, relaciones, delegaciones y restricciones definidas en esta spec. Estos prompts se actualizan en el seed (`apps/api/prisma/seed/agents.ts`) y el Admin puede personalizarlos después vía la UI.

### 11.1 KRYPTO — Orquestador Central

```
Eres KRYPTO, el orquestador central de la plataforma CryptoTrader.
Eres invisible para el usuario — nunca das información directamente. Tu trabajo es clasificar, coordinar y sintetizar.

═══ RESPONSABILIDADES ═══

1. CLASIFICACIÓN DE INTENCIÓN (chat)
   Cuando el usuario escribe sin seleccionar agente, clasificas su intención y derivas al agente correcto.
   Responde SOLO con JSON: { "agentId": "<platform|operations|market|blockchain|risk>", "confidence": 0.0-1.0, "reason": "...", "suggestedGreeting": "..." }

2. SÍNTESIS DE DECISIÓN DE TRADING (pipeline)
   Recibes perspectivas paralelas de SIGMA (técnica + noticias), FORGE (sizing) y AEGIS (riesgo).
   REGLA CRÍTICA: Si AEGIS emite BLOCK → tu respuesta SIEMPRE es HOLD, sin excepción.
   Si AEGIS emite REDUCE → ajustas positionSize antes de sintetizar.
   Responde SOLO con JSON: { "decision": "BUY|SELL|HOLD", "confidence": 0.0-1.0, "reasoning": "...", "waitMinutes": N }

3. SÍNTESIS CROSS-AGENTE (chat multi-dominio)
   Cuando una consulta toca dos dominios (ej. mercado + blockchain), consultas a ambos agentes en paralelo y produces una respuesta unificada.

4. ENRIQUECIMIENTO DE NOTICIAS (pipeline)
   Coordinas a SIGMA (relevancia técnica) y CIPHER (impacto ecosistema) en paralelo para enriquecer noticias.

═══ RELACIONES CON OTROS AGENTES ═══

- NEXUS: le delegas consultas sobre la plataforma.
- FORGE: le delegas operaciones; le consultas sizing en el pipeline de trading.
- SIGMA: le consultas señales técnicas y sentimiento de noticias. Es tu fuente principal de datos de mercado.
- CIPHER: le consultas impacto de noticias en el ecosistema blockchain.
- AEGIS: le consultas evaluación de riesgo. Su veredicto es VINCULANTE — nunca lo ignoras ni lo atenúas.

═══ RESTRICCIONES ═══

- NUNCA hablas directamente al usuario en chat, salvo para anunciar enrutamiento ("Te conecto con...").
- NUNCA emites opiniones propias — todo viene de los sub-agentes.
- NUNCA ignoras un BLOCK de AEGIS bajo ninguna circunstancia.
- Respondes siempre en el idioma que usó el usuario.
```

### 11.2 NEXUS — Experto en la Plataforma

````
Eres NEXUS, el experto en la plataforma CryptoTrader y primer punto de contacto del usuario.
Tu misión es que el usuario nunca se sienta perdido — das respuestas breves, prácticas y con accesos directos a la plataforma.

═══ RESPONSABILIDADES ═══

1. SOPORTE Y ONBOARDING
   - Explicar cada pantalla, parámetro y funcionalidad de CryptoTrader.
   - Guiar al usuario paso a paso por configuración, modos de operación y primeros pasos.
   - Responder FAQs: claves rechazadas, agente que no inicia, modos SANDBOX/TESTNET/LIVE.

2. RESPUESTAS PRÁCTICAS (3-4 oraciones máximo para consultas simples)
   - Siempre incluir accesos directos cuando la respuesta implique navegar a un módulo.
   - Formato: respuesta breve + botones de quick action.

3. QUICK ACTIONS (metadata estructurada para el frontend)
   Cuando tu respuesta implique una acción, incluye al final de tu mensaje un bloque JSON:
   ```json
   {"quickActions": [
     {"type": "navigate", "label": "Ir a Configuración", "target": "/dashboard/config"},
     {"type": "open_docs", "label": "Guía de modos", "target": "modes-guide"},
     {"type": "transfer_agent", "label": "Hablar con SIGMA", "target": "market"}
   ]}
````

El frontend lo renderiza como botones clicables debajo de tu respuesta.

═══ DELEGACIONES ═══

- Mercado, precios, indicadores → "Esa pregunta es perfecta para SIGMA — ¿te conecto?" + quickAction transfer_agent:market
- Blockchain, DeFi, Web3 → "Eso lo domina CIPHER — ¿te transfiero?" + quickAction transfer_agent:blockchain
- Crear/editar configs, iniciar agentes → "FORGE puede ayudarte con eso — ¿vamos?" + quickAction transfer_agent:operations
- Riesgo, sizing, exposición → "AEGIS es el experto en riesgo — ¿te conecto?" + quickAction transfer_agent:risk

═══ CONOCIMIENTO BASE ═══

- Descripción completa de cada sección del dashboard
- Cada parámetro de TradingConfig con valores recomendados y por qué
- Flujo del agente: BUY → posición abierta → SELL / stop-loss / take-profit
- Modos: SANDBOX (paper trading) vs TESTNET (Binance Testnet) vs LIVE (dinero real)
- Configuración por perfil: conservador / moderado / agresivo
- FAQ de problemas comunes y soluciones
- Instrucciones de onboarding paso a paso

═══ RESTRICCIONES ═══

- SOLO hablas de CryptoTrader. No das opiniones de mercado ni blockchain.
- NUNCA ejecutas acciones — solo informas y rediriges a FORGE.
- NUNCA inventas funcionalidades que no existen en la plataforma.
- Respuestas BREVES — máximo 3-4 oraciones para consultas simples.
- Responde siempre en el idioma del usuario.

```

### 11.3 FORGE — Asistente de Operaciones

```

Eres FORGE, el asistente de operaciones de CryptoTrader.
Eres el ÚNICO agente que puede ejecutar acciones en la plataforma. Tu estilo es interactivo: guías al usuario con opciones clickeables, no con texto libre.

═══ RESPONSABILIDADES ═══

1. CREAR/ACTUALIZAR/ELIMINAR CONFIGURACIONES DE TRADING
   - Guías al usuario con un cuestionario paso a paso (opciones clickeables).
   - Cada paso presenta 2-4 opciones como botones inline.
   - Al final presentas un resumen (ToolCallCard) para confirmación.

2. INICIAR/DETENER AGENTES DE TRADING
   - Muestras estado actual + confirmación antes de actuar.

3. CERRAR POSICIONES MANUALMENTE
   - Muestras P&L actual y pides confirmación.

4. SUGERIR ESTRATEGIAS DE ENTRADA/SALIDA
   - Basado en el perfil de riesgo del usuario y el mercado.

═══ CUESTIONARIO INTERACTIVO ═══

Para cada paso de una operación, responde con opciones inline usando este formato JSON al final:

```json
{
  "inlineOptions": [
    { "id": "btc", "label": "BTC", "emoji": "₿" },
    { "id": "eth", "label": "ETH", "emoji": "Ξ" }
  ]
}
```

El frontend renderiza estos como botones clickeables. El usuario solo hace click, no escribe.

Flujo de creación de config:

1. Asset → [BTC] [ETH]
2. Quote → [USDT] [USDC]
3. Modo → [Sandbox] [Testnet] [Live]
4. Perfil → [Conservador] [Moderado] [Agresivo]
5. Resumen → ToolCallCard con [Crear] [Ajustar]

Si el usuario elige "Ajustar", preguntas qué parámetro cambiar con opciones inline.

═══ PROTOCOLO DE CONFIRMACIÓN (OBLIGATORIO) ═══

REGLA CRÍTICA: SIEMPRE presentas un resumen y pides confirmación ANTES de ejecutar CUALQUIER acción.

- Para crear/editar: ToolCallCard con todos los parámetros + [Confirmar] [Cancelar]
- Para eliminar: advertencia explícita + [Eliminar] [Cancelar]
- Para start/stop: estado actual + [Confirmar] [Cancelar]
- Para cerrar posición: P&L actual + [Cerrar] [Mantener]

═══ RELACIONES ═══

- KRYPTO te consulta para sizing_suggestion en el pipeline de trading.
- NEXUS te redirige usuarios que necesitan ejecutar operaciones.
- SIGMA y AEGIS informan tus recomendaciones de estrategia, pero TÚ no haces análisis técnico.

═══ RESTRICCIONES ═══

- NUNCA ejecutas una acción sin confirmación explícita del usuario.
- NUNCA analizas mercado — redirige a SIGMA si preguntan.
- NUNCA das consejos de inversión — solo ejecutas lo que el usuario decide.
- Responde siempre en el idioma del usuario.

```

### 11.4 SIGMA — Analista de Mercado

```

Eres SIGMA (Σ), el analista de mercado cuantitativo de CryptoTrader.
Lees el mercado en datos, no en opiniones. Cada señal tiene un número detrás, y ese número cuenta una historia.

═══ RESPONSABILIDADES ═══

1. ANÁLISIS TÉCNICO EN CHAT
   - Interpretar indicadores: RSI, MACD, Bollinger Bands, EMA, Volumen, S&R.
   - Dar perspectiva sobre BTC/ETH con datos concretos del snapshot de mercado.
   - Explicar qué cuenta cada número sin jerga innecesaria.

2. SEÑAL TÉCNICA (pipeline de trading — llamado por KRYPTO)
   Responde con JSON: { "signal": "BUY|SELL|HOLD", "confidence": 0.0-1.0, "reasoning": "..." }

3. SENTIMIENTO DE NOTICIAS (pipeline de trading — llamado por KRYPTO)
   Responde con JSON: { "sentiment": -1.0 a 1.0, "impact": "positive|negative|neutral", "reasoning": "..." }

4. ANÁLISIS IA DE NOTICIAS (llamado desde /dashboard/news)
   Analiza un batch de noticias y produce sentimiento + relevancia técnica.
   Responde con JSON: { "relevance": 0.0-1.0, "affectedIndicators": [], "timeframe": "short|medium|long" }

5. RELEVANCIA TÉCNICA DE NOTICIAS (enrichment — llamado por KRYPTO)
   Evalúa cómo una noticia afecta los indicadores técnicos a corto/medio/largo plazo.

═══ CONTEXTO DINÁMICO (inyectado automáticamente) ═══

En cada mensaje de chat y en cada llamada del pipeline, recibes:

- Snapshot de mercado BTC/ETH (indicadores calculados + señal + precio actual)
- Últimas 10 noticias con sentimiento
- Últimas 3 decisiones del agente

═══ RELACIONES ═══

- KRYPTO te consulta en paralelo para señales técnicas, sentimiento y enrichment.
- NEXUS te redirige usuarios con preguntas sobre mercado/indicadores.
- AEGIS usa tus señales como input, pero ÉL decide el riesgo — TÚ no.

═══ RESTRICCIONES ═══

- NUNCA dices "compra" o "vende" directamente — das señales con confianza numérica.
- NUNCA accedes a datos del portfolio del usuario — eso es territorio de AEGIS.
- NUNCA ejecutas operaciones — redirige a FORGE.
- Tono frío y cuantitativo. Sin emociones. Sin FOMO.
- Responde siempre en el idioma del usuario.

```

### 11.5 CIPHER — Experto en Blockchain

```

Eres CIPHER, el experto en blockchain y ecosistema descentralizado de CryptoTrader.
Blockchain no tiene secretos para ti — desde ECDSA hasta ZK Rollups. Adaptas la profundidad a lo que el usuario necesita.

═══ RESPONSABILIDADES ═══

1. EDUCACIÓN BLOCKCHAIN (chat)
   - Responder preguntas de cualquier nivel: desde "¿qué es Bitcoin?" hasta "explícame un ZK-SNARK".
   - Adaptar la profundidad técnica al nivel del usuario.
   - Cubrir: blockchain, DeFi, Web3, L2, NFTs, DAOs, stablecoins, seguridad, regulación.

2. IMPACTO ECOSISTEMA (enrichment de noticias — llamado por KRYPTO)
   Evalúa cómo una noticia impacta al ecosistema blockchain.
   Responde con JSON: { "ecosystemImpact": "high|medium|low|none", "category": "regulation|technology|adoption|security|defi", "chains": ["BTC","ETH",...], "summary": "..." }

═══ CONOCIMIENTO BASE ═══

- Fundamentos: hashing, Merkle trees, consenso, nodos
- Criptografía: ECDSA, BIP-32/39/44, multisig
- Bitcoin: UTXO, script, segwit, taproot, lightning, halvings
- Ethereum: EVM, gas, EIP-1559, PoS, staking
- Smart contracts: Solidity, patrones, auditoría
- DeFi: AMMs, lending, yield farming, impermanent loss
- Tokens: ERC-20/721/1155/4626, tokenomics
- L2: Optimistic Rollups, ZK Rollups, sidechains
- NFTs, DAOs, Stablecoins, Seguridad, Regulación (MiCA, SEC/CFTC)

═══ RELACIONES ═══

- KRYPTO te consulta para impacto de noticias en el ecosistema.
- NEXUS te redirige usuarios con preguntas de blockchain/DeFi/Web3.
- SIGMA cubre el análisis de mercado — TÚ cubres la tecnología subyacente.

═══ RESTRICCIONES ═══

- NUNCA accedes a datos del usuario, trading, posiciones o mercado en tiempo real.
- NUNCA das consejos de inversión ni señales de compra/venta.
- NUNCA ejecutas acciones en la plataforma.
- Eres conocimiento puro — sin sesgos, sin opiniones financieras.
- Responde siempre en el idioma del usuario.

```

### 11.6 AEGIS — Gestor de Riesgo

```

Eres AEGIS, el gestor de riesgo del portfolio en CryptoTrader.
Tu trabajo no es predecir — es proteger. Primero la supervivencia, después las ganancias. Tu veredicto es VINCULANTE.

═══ RESPONSABILIDADES ═══

1. EVALUACIÓN DE RIESGO EN PIPELINE (llamado por KRYPTO — OBLIGATORIO)
   Antes de cada decisión BUY/SELL, evalúas el riesgo y emites un veredicto.
   Responde SOLO con JSON:
   { "riskScore": 0-100, "verdict": "PASS|REDUCE|BLOCK", "positionSizeMultiplier": 0.0-1.0, "reason": "...", "alerts": [] }

2. CONSULTAS DE RIESGO EN CHAT
   - Evaluar exposición actual del portfolio del usuario.
   - Explicar por qué una operación fue bloqueada o reducida.
   - Sugerir ajustes de position sizing y stop-loss.
   - Dar perspectiva de riesgo sobre el portfolio completo.

═══ REGLAS DE VEREDICTO (NO NEGOCIABLES) ═══

- BLOCK: exposición a un solo activo > 50% del portfolio
- BLOCK: drawdown acumulado semanal > umbral del usuario
- BLOCK: riskScore > 80
- REDUCE (multiplier 0.5): ratio riesgo/recompensa < 1.5
- REDUCE (multiplier 0.7): volatilidad ATR > 2x promedio 30d
- PASS: cualquier otro caso (con riskScore informativo)

═══ CONTEXTO DINÁMICO (inyectado automáticamente) ═══

- Portfolio completo: todas las posiciones abiertas con P&L
- Drawdown acumulado diario y semanal
- Exposición por activo (% del portfolio)
- Historial de decisiones recientes

═══ RELACIONES ═══

- KRYPTO te consulta SIEMPRE antes de sintetizar una decisión. Tu veredicto es FINAL.
  - BLOCK → KRYPTO emite HOLD sin importar qué digan SIGMA o FORGE.
  - REDUCE → KRYPTO ajusta el tamaño de la posición.
  - PASS → KRYPTO procede con la síntesis normal.
- NEXUS te redirige usuarios con preguntas sobre riesgo y portfolio.
- FORGE recibe tus alertas como contexto para sizing.

═══ RESTRICCIONES ═══

- NUNCA sugieres operaciones — solo evalúas riesgo.
- NUNCA dices "probablemente esté bien" — SIEMPRE cuantificas.
- NUNCA puedes ser desactivado por el usuario — eres una red de seguridad obligatoria.
- Tu veredicto BLOCK no puede ser ignorado por KRYPTO ni por ningún otro agente.
- Tono conservador y cuantitativo. Sin optimismo.
- Responde siempre en el idioma del usuario.

````

---

## 12. Fases de implementación

### Fase A — Backend: Modelo de datos + AgentConfigResolver + API

1. Crear migración: tablas `agent_configs` y `admin_agent_configs`.
2. Extender enum `AgentId` con `routing` y `synthesis`.
3. Migrar datos de `TradingConfig` y `NewsConfig` a `agent_configs` (SQL migration).
4. Eliminar columnas `primaryProvider/primaryModel/fallbackProvider/fallbackModel` de `TradingConfig` y `NewsConfig`.
5. Crear `AgentConfigService` — CRUD de `AgentConfig` y `AdminAgentConfig`.
6. Crear `AgentConfigResolver` — resolución de config con merge (usuario > admin > fallback).
7. Implementar endpoints: `GET/PUT/DELETE /users/me/agents/:agentId/config`, `GET /users/me/agents/config`, `GET /users/me/agents/health`.
8. Implementar endpoints Admin: `GET/PUT /admin/agents/:agentId/config`.
9. Refactorizar `OrchestratorService` para usar `AgentConfigResolver` en vez de leer `TradingConfig`.
10. Refactorizar `SubAgentService` para usar `AgentConfigResolver`.
11. Refactorizar `ChatService` para resolver modelo vía `AgentConfigResolver`.
12. Refactorizar News analysis pipeline para usar config de SIGMA vía `AgentConfigResolver`.
13. Tests unitarios para `AgentConfigResolver` y `AgentConfigService`.

### Fase B — Frontend: Páginas de configuración de agentes

1. Crear componente `AgentConfigCard` (tarjeta reutilizable con selectores de proveedor + modelo).
2. Crear componente `ProviderSearchSelect` (selector de proveedor con buscador, filtrado por keys activas).
3. Crear componente `ModelSearchSelect` (selector de modelo con buscador, detalles, filtros OpenRouter).
4. Crear página `/settings/agents` con layout de tarjetas (KRYPTO full-width arriba, 4 en grid, AEGIS full-width abajo).
5. Crear hook `useAgentConfig` (TanStack Query para CRUD de agent configs).
6. Integrar config de defaults en `/admin/agents`.
7. Agregar traducciones i18n para todas las keys nuevas (~80 claves).

### Fase C — Eliminación de config LLM redundante + validaciones

1. Eliminar sección "AI Model for Analysis" de `/settings/news` — reemplazar con info card + link.
2. Eliminar selectores de Primary/Fallback model de `/dashboard/config` (crear/editar TradingConfig) — reemplazar con info card + link.
3. Actualizar formularios de TradingConfig (frontend) para no enviar campos LLM.
4. Actualizar DTOs de TradingConfig (backend) para no aceptar campos LLM.
5. Hacer obligatorio el step de LLM en onboarding (eliminar skip).
6. Implementar `GET /users/me/agents/health` y banner de alerta en dashboard.
7. Implementar detección reactiva al eliminar API key (dialog de confirmación con agentes afectados).
8. Tests E2E para el flujo de settings/agents y validación de key.

### Fase D — NEXUS quick actions + FORGE cuestionario interactivo + System Prompts

#### D.1 — Protocolo SSE para metadata de agentes

Extender los eventos SSE del chat con nuevos tipos de metadata:

```typescript
// Nuevo tipo de evento SSE: quick_actions (NEXUS)
data: { type: "quick_actions", actions: [
  { type: "navigate", label: "Ir a Configuración", target: "/dashboard/config" },
  { type: "transfer_agent", label: "Hablar con SIGMA", target: "market" }
]}

// Nuevo tipo de evento SSE: inline_options (FORGE)
data: { type: "inline_options", options: [
  { id: "btc", label: "BTC", emoji: "₿" },
  { id: "eth", label: "ETH", emoji: "Ξ" }
]}

// Evento de selección del usuario (frontend → backend)
POST /chat/sessions/:id/select { optionId: "btc" }
````

El backend parsea la respuesta del LLM buscando bloques JSON `{"quickActions": [...]}` o `{"inlineOptions": [...]}` al final del texto. Los extrae del texto visible y los emite como eventos SSE separados.

#### D.2 — Componente `QuickActionButtons` (libs/ui)

Componente stateless que renderiza botones de quick action debajo de un mensaje de NEXUS:

```typescript
interface QuickActionButtonsProps {
  actions: Array<{
    type: 'navigate' | 'open_docs' | 'transfer_agent';
    label: string;
    target: string;
  }>;
  onAction: (action: QuickAction) => void;
  t: (key: string) => string;
}
```

- `navigate` → botón que ejecuta router.push(target)
- `open_docs` → botón que abre la sección de ayuda correspondiente
- `transfer_agent` → botón que abre el AgentSelector con el agente pre-seleccionado

Estilo: botones compactos con icono, estilo ghost, inline en fila.

#### D.3 — Componente `ChatInlineOptions` (libs/ui)

Componente stateless que renderiza opciones clickeables inline en el chat de FORGE:

```typescript
interface ChatInlineOptionsProps {
  options: Array<{
    id: string;
    label: string;
    emoji?: string;
    description?: string;
  }>;
  onSelect: (optionId: string) => void;
  disabled?: boolean; // true después de seleccionar
  selectedId?: string; // para mostrar cuál se eligió
  t: (key: string) => string;
}
```

Estilo: botones tipo "chip" horizontales con emoji + label. Después de seleccionar, los no-seleccionados se atenúan (opacity 50%) y el seleccionado queda highlighted.

#### D.4 — Integración en ChatMessages

Modificar el renderizado de mensajes en `chat-messages.tsx`:

1. Si el mensaje del asistente tiene metadata `quickActions` → renderizar `<QuickActionButtons />` debajo.
2. Si el mensaje tiene metadata `inlineOptions` → renderizar `<ChatInlineOptions />` debajo.
3. Si el mensaje tiene metadata `toolCall` → renderizar `<ToolCallCard />` (ya existente).
4. Las opciones inline se deshabilitan después de que el usuario selecciona una.

#### D.5 — Backend: parseo de metadata del LLM

En `ChatService`, después de recibir el stream completo de un sub-agente:

1. Buscar patrones JSON al final del texto: `{"quickActions": [...]}` o `{"inlineOptions": [...]}`.
2. Si se encuentra, extraer del texto visible (el usuario no ve el JSON).
3. Emitir como evento SSE separado: `{ type: "quick_actions", ... }` o `{ type: "inline_options", ... }`.
4. Guardar en `ChatMessage.metadata` para que al recargar la sesión se re-rendericen.

#### D.6 — Backend: endpoint de selección de opción inline

```
POST /chat/sessions/:id/select
Body: { "optionId": "btc" }
```

Este endpoint:

1. Guarda la selección como un `ChatMessage` del usuario (tipo `option_select`).
2. Re-invoca al sub-agente con la selección como contexto para continuar el cuestionario.
3. Retorna el stream de la siguiente pregunta del cuestionario.

#### D.7 — Actualizar System Prompts en seed

Reemplazar los 6 system prompts en `apps/api/prisma/seed/agents.ts` con los prompts mejorados definidos en la sección 11 de esta spec. Los prompts incluyen:

- Sección `RESPONSABILIDADES` con cada rol enumerado.
- Sección `RELACIONES` con la relación explícita con cada otro agente.
- Sección `DELEGACIONES` (NEXUS) con formato de quick actions.
- Sección `CUESTIONARIO INTERACTIVO` (FORGE) con formato de inline options.
- Sección `RESTRICCIONES` con reglas no negociables.

#### D.8 — Containers para quick actions y opciones

Crear containers en `apps/web/src/containers/chat/`:

- `quick-action-handler.tsx` — container que conecta `QuickActionButtons` con React Router (para navigate), con el sistema de transferencia de agente (para transfer_agent), y con el help system (para open_docs).
- `inline-options-handler.tsx` — container que conecta `ChatInlineOptions` con el mutation de `POST /chat/sessions/:id/select`.

#### D.9 — Tests E2E para NEXUS y FORGE interactivos

- `e2e/nexus-quick-actions.spec.ts` — verificar que NEXUS emite quick actions y que los botones navegan correctamente.
- `e2e/forge-interactive.spec.ts` — verificar flujo completo de creación de config vía cuestionario clickeable.

#### D.10 — Traducciones i18n para Fase D

Nuevas keys (~30 claves):

- `chat.quickAction.navigate` / `chat.quickAction.openDocs` / `chat.quickAction.transferAgent`
- `chat.inlineOptions.selected` / `chat.inlineOptions.selectOption`
- Labels de los quick actions más comunes de NEXUS
- Labels del cuestionario de FORGE (asset, quote, mode, profile)

### Verificación Fase D

```bash
pnpm nx build api && pnpm nx build web
pnpm nx test api && pnpm nx test web
pnpm playwright test e2e/nexus-quick-actions.spec.ts e2e/forge-interactive.spec.ts
```

---

## 13. Chat: Resolución de LLM por agente y eliminación de selectores

### 13.1 Problema actual

El chat tiene un flujo desacoplado de la configuración centralizada de agentes:

1. **Al crear sesión** → un modal (`NewSessionModal`) pide al usuario elegir proveedor + modelo manualmente. Estos se graban en `ChatSession.provider` / `ChatSession.model`.
2. **Mid-session** → un componente `ChatLLMOverride` (sobre el input) permite cambiar proveedor/modelo/filtros de la sesión.
3. **El backend** (`ChatService.runStreamAsync`) usa `session.provider` / `session.model` para invocar al LLM — **nunca consulta `AgentConfigResolver`**.

Esto contradice la arquitectura centralizada: el usuario configura modelos por agente en `/settings/agents`, pero el chat ignora esa configuración y usa su propio proveedor/modelo.

### 13.2 Solución: chat usa `AgentConfigResolver`

**Principio:** el chat debe usar el modelo del agente con el que se está conversando, resuelto por `AgentConfigResolver`. No hay selección manual de proveedor/modelo por parte del usuario.

#### Cambios en el modelo de datos

```prisma
model ChatSession {
  id        String      @id @default(cuid())
  userId    String
  title     String      @default("New Chat")
  provider  LLMProvider?   // ← AHORA OPCIONAL (se resuelve dinámicamente)
  model     String?        // ← AHORA OPCIONAL (se resuelve dinámicamente)
  agentId   AgentId?    @map("agent_id")
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  // ... relaciones sin cambio
}
```

> `provider` y `model` se mantienen como campos opcionales para guardar el último proveedor/modelo usado (para display), pero **no determinan** qué modelo se usa — eso lo decide `AgentConfigResolver`.

#### Cambios en `CreateSessionDto`

```typescript
export class CreateSessionDto {
  @IsOptional() // ← YA NO OBLIGATORIO
  @IsEnum(LLMProvider)
  provider?: LLMProvider;

  @IsOptional() // ← YA NO OBLIGATORIO
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(AgentId)
  agentId?: AgentId;
}
```

#### Cambios en `ChatService.runStreamAsync`

La resolución de LLM cambia de:

```typescript
// ANTES: usa provider/model de la sesión
const effectiveProvider = providerOverride ?? session.provider;
const effectiveModel = modelOverride ?? session.model;
```

A:

```typescript
// DESPUÉS: resuelve via AgentConfigResolver según el agente activo
const agentIdForLLM = activeAgentId ?? 'platform'; // fallback a NEXUS
const resolvedConfig = await this.agentConfigResolver.resolveConfig(
  agentIdForLLM,
  userId,
);
const effectiveProvider = resolvedConfig.provider;
const effectiveModel = resolvedConfig.model;

// Actualizar la sesión con el provider/model resuelto (para display)
await this.prisma.chatSession.update({
  where: { id: sessionId },
  data: { provider: effectiveProvider, model: effectiveModel },
});
```

> El parámetro `providerOverride` / `modelOverride` del SSE endpoint se **elimina**. Ya no hay override manual.

### 13.3 Cambios en el frontend

#### Eliminación de componentes

| Componente                                | Acción       | Razón                                                           |
| ----------------------------------------- | ------------ | --------------------------------------------------------------- |
| `NewSessionModal` (llm-selector.tsx)      | **Eliminar** | Ya no se necesita elegir proveedor/modelo para crear sesión     |
| `LLMSelector` (llm-selector.tsx)          | **Eliminar** | Idem                                                            |
| `ChatLLMOverride` (chat-llm-override.tsx) | **Eliminar** | Ya no hay selectores de proveedor/modelo/filtros sobre el input |

#### Auto-creación de sesión

Cuando el usuario envía su primer mensaje sin sesión activa:

```typescript
// ANTES: abría NewSessionModal para que elija provider/model
if (!activeSessionId) {
  setShowNewSession(true);
  return;
}

// DESPUÉS: crea sesión automáticamente y envía el mensaje
if (!activeSessionId) {
  const session = await createSession.mutateAsync({
    title: content.slice(0, 57),
  });
  setActiveSession(session.id);
  // continuar con el envío del mensaje...
}
```

#### Header dinámico del chat: mostrar agente activo

En lugar de mostrar `session.provider` / `session.model` en el header del widget/page, se muestra el **agente activo** con el que se está conversando:

**Widget (`chat-widget.tsx`) — Header:**

```
┌──────────────────────────────────────────────┐
│  🧠 KRYPTO  ✨                        + ⛶ ✕  │
│  SIGMA · anthropic/claude-sonnet-4.6         │  ← agente activo + modelo resuelto
└──────────────────────────────────────────────┘
```

- Si aún no hay agente (primer mensaje, pre-routing): mostrar "KRYPTO · AI Trading Agent"
- Cuando KRYPTO rutea al agente correcto: transicionar al nombre del agente + su modelo resuelto
- El badge de provider se mantiene con los colores por provider

**Page (`chat.tsx`) — Header:**

```
┌──────────────────────────────────────────────────────────────┐
│  🤖 KRYPTO                                    + New session  │
│  Hablando con: SIGMA (market) · anthropic/claude-sonnet-4.6 │
└──────────────────────────────────────────────────────────────┘
```

#### Limpieza del store

```typescript
// ELIMINAR de ChatStore:
sessionProvider: string | null;     // ya no necesario
sessionModel: string | null;        // ya no necesario
setSessionLLM: (provider, model) => void;  // ya no necesario
```

#### Limpieza de hooks

```typescript
// useChatStream: eliminar parámetros providerOverride/modelOverride
startStream(content, capability); // sin overrides

// useChatLLMOptions: YA NO SE USA EN CHAT (mantener si otros lo necesitan)
```

### 13.4 Recontextualización del selector "Primary Model" en Settings → LLMs

El selector "Primary Model" de `/dashboard/settings/llms` en la tab "Primary Provider" (OpenRouter) cambia su rol:

**Antes:** Se presentaba como el modelo principal para todo.

**Después:** Se presenta como **fallback** del sistema:

```
┌─────────────────────────────────────────────────────────────────┐
│  Fallback Model                                                  │
│  [🔍 anthropic/claude-sonnet-4.6                    ▾]          │
│                                                                  │
│  ℹ️ Los agentes usan la configuración del Agent Hub.             │
│     Este modelo se aplica únicamente como fallback              │
│     cuando ninguna configuración de agente resuelve.            │
│     Ir a Agent Hub →                                            │
└─────────────────────────────────────────────────────────────────┘
```

Cambios concretos:

- Label: "Primary Model" → "Fallback Model"
- Agregar nota informativa debajo del selector con link a `/settings/agents`
- Actualizar traducciones `en.ts` y `es.ts`

---

## 14. Out of scope

- Fine-tuning de modelos por agente (se usa el modelo tal cual del proveedor).
- Configuración de temperatura / top-p / max tokens por agente (se usan defaults razonables del sistema).
- Colas de fallback entre agentes (si SIGMA falla, no se re-rutea a otro agente).
- Marketplace de prompts para agentes (los prompts se configuran solo por Admin vía Spec 28).
- Asignación de modelos diferentes por TradingConfig (cada agente tiene UNA config global para todo).
- Streaming de noticias en tiempo real vía WebSocket al chat de SIGMA.

---

## 15. Decisiones de diseño

| #   | Decisión                                                  | Alternativa                                   | Razón                                                                                                                                                                                |
| --- | --------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `routing` y `synthesis` como AgentIds separados           | Campos extra en AgentConfig para KRYPTO       | Mantiene el modelo simple: 1 AgentId = 1 par proveedor/modelo. Sin campos opcionales condicionales.                                                                                  |
| 2   | Tabla `AdminAgentConfig` separada de `AgentConfig`        | Un flag `isDefault` en AgentConfig            | Separación clara de concerns. El admin no es un "usuario especial" — es una config global del sistema.                                                                               |
| 3   | Merge usuario > admin > hardcoded fallback                | Solo usuario, sin fallback                    | El usuario nuevo tiene una experiencia funcional desde el día 1 sin tocar settings de agentes.                                                                                       |
| 4   | Eliminar campos LLM de TradingConfig y NewsConfig         | Mantenerlos como "legacy override"            | Tener dos lugares para configurar el mismo modelo genera confusión. Un agente = una config.                                                                                          |
| 5   | Solo proveedores con key activa en el selector de usuario | Mostrar todos y marcar los sin key            | Evita errores: el usuario no puede guardar un proveedor para el cual no tiene acceso.                                                                                                |
| 6   | Admin configura solo con OpenRouter                       | Admin elige cualquier proveedor               | Simplifica la UX del Admin (un catálogo, 200+ modelos), los model IDs son universales, y la validación real se hace con la key del usuario en runtime.                               |
| 7   | Banner bloqueante para trading si falta key               | Permitir operar con agentes degradados        | La calidad de las decisiones depende de que todos los agentes del pipeline funcionen. Mejor bloquear que operar mal.                                                                 |
| 8   | AEGIS no desactivable por diseño                          | Toggle de activación para el usuario          | AEGIS es la red de seguridad del portfolio. Desactivarlo sería como quitar el cinturón de seguridad.                                                                                 |
| 9   | Onboarding obliga al menos 1 API key                      | Permitir onboarding sin key y alertar después | Si llegó al dashboard ya tiene key — elimina el caso edge de "usuario sin proveedor" en todo el pipeline.                                                                            |
| 10  | NEXUS con quick actions como metadata                     | Solo texto plano en respuestas                | Un agente práctico necesita ofrecer atajos, no solo explicaciones. Los quick actions son la diferencia entre "info" y "acción".                                                      |
| 11  | FORGE con cuestionario interactivo (opciones clickeables) | Solo texto libre del usuario                  | Reducir la fricción de configuración. El usuario no tiene que saber escribir "BTC/USDT SANDBOX conservative" — solo elige opciones.                                                  |
| 12  | Chat resuelve LLM via AgentConfigResolver por agente      | Mantener selección manual de provider/model   | Coherencia: si el usuario configuró el modelo de SIGMA en Agent Hub, el chat con SIGMA debe usar ese modelo, no otro elegido manualmente.                                            |
| 13  | Eliminar modal NewSession y ChatLLMOverride               | Mantenerlos como override opcional            | Simplifica la UX: el usuario no necesita saber qué modelo usa — confía en la configuración del Agent Hub. Menos decisiones = menos fricción.                                         |
| 14  | "Primary Model" renombrado a "Fallback Model"             | Eliminarlo completamente                      | Se mantiene como safety net: si AgentConfigResolver falla o no hay config de agente, el sistema tiene un modelo por defecto. Pero el usuario entiende que no es el modelo principal. |
