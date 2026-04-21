# Plan 36 — Agent Hub: Configuración Centralizada de Proveedores y Modelos por Agente

**Spec:** docs/specs/branches/36-agent-hub-config.md  
**Branch:** feature/agent-hub-config  
**Depende de:** Spec 28 (multi-agent-chat-rag), Spec 31 (llm-provider-dashboard), Spec 35 (openrouter-integration) mergeadas en main

---

## Estado inicial requerido

```bash
# Verificar que estamos en main y actualizado
git checkout main && git pull origin main

# Verificar que specs 28, 31 y 35 están mergeadas
git log main --oneline -10

# Verificar que AgentDefinition existe con los 6 agentes
grep -A5 'model AgentDefinition' apps/api/prisma/schema.prisma

# Verificar que AgentId enum existe con 6 valores
grep -A8 'enum AgentId' apps/api/prisma/schema.prisma

# Verificar que LLMProvider incluye OPENROUTER
grep -A10 'enum LLMProvider' apps/api/prisma/schema.prisma

# Verificar campos LLM en TradingConfig y NewsConfig (los que vamos a eliminar)
grep -n 'primaryProvider\|primaryModel\|fallbackProvider\|fallbackModel' apps/api/prisma/schema.prisma

# Verificar que la page Admin > AI Agents existe
grep -rn 'admin/agents\|AdminAgents' apps/web/src/ | head -10

# Verificar seed de agentes
cat apps/api/prisma/seed/agents.ts | head -5

# Crear branch
git checkout -b feature/agent-hub-config
```

---

## Fase A — Backend: Modelo de datos + AgentConfigResolver + API

### A.1 — Extender enum `AgentId` con `routing` y `synthesis`

**Archivos:**

- `apps/api/prisma/schema.prisma` — agregar `routing` y `synthesis` al enum `AgentId`
- `libs/shared/src/types/enums.ts` — agregar los mismos valores

```prisma
enum AgentId {
  platform
  operations
  market
  blockchain
  risk
  orchestrator
  routing       // NUEVO: KRYPTO modelo rápido
  synthesis     // NUEVO: KRYPTO modelo principal
}
```

### A.2 — Crear tablas `agent_configs` y `admin_agent_configs`

**Archivo:** `apps/api/prisma/schema.prisma`

```prisma
model AgentConfig {
  id         String      @id @default(cuid())
  userId     String
  agentId    AgentId
  provider   LLMProvider
  model      String
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, agentId])
  @@map("agent_configs")
}

model AdminAgentConfig {
  id         String      @id @default(cuid())
  agentId    AgentId     @unique
  provider   LLMProvider @default(OPENROUTER)
  model      String
  updatedAt  DateTime    @updatedAt
  updatedBy  String

  @@map("admin_agent_configs")
}
```

Agregar relación en `User`:

```prisma
model User {
  // ... existente
  agentConfigs AgentConfig[]
}
```

### A.3 — Migración Prisma (nuevas tablas + enum)

```bash
cd apps/api
pnpm prisma migrate dev --name add-agent-configs
pnpm prisma generate
```

### A.4 — Migración de datos: TradingConfig/NewsConfig → AgentConfig

Crear migración SQL manual para mover datos existentes:

```bash
pnpm prisma migrate dev --name migrate-llm-config-to-agent-configs --create-only
```

Editar el archivo SQL generado e insertar:

```sql
-- Mover config LLM de TradingConfig → AgentConfig (para SIGMA/market)
INSERT INTO agent_configs (id, "userId", "agentId", provider, model, "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  tc."userId",
  'market',
  tc."primaryProvider",
  tc."primaryModel",
  NOW(), NOW()
FROM trading_configs tc
WHERE tc."primaryProvider" IS NOT NULL AND tc."primaryModel" IS NOT NULL
ON CONFLICT ("userId", "agentId") DO NOTHING;

-- Mover config LLM de NewsConfig → AgentConfig (también para SIGMA/market)
INSERT INTO agent_configs (id, "userId", "agentId", provider, model, "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  nc."userId",
  'market',
  nc."primaryProvider",
  nc."primaryModel",
  NOW(), NOW()
FROM news_configs nc
WHERE nc."primaryProvider" IS NOT NULL AND nc."primaryModel" IS NOT NULL
ON CONFLICT ("userId", "agentId") DO NOTHING;
```

Luego aplicar:

```bash
pnpm prisma migrate dev
```

### A.5 — Eliminar columnas LLM de TradingConfig y NewsConfig

**Archivo:** `apps/api/prisma/schema.prisma`

Eliminar de `TradingConfig`:

- `primaryProvider LLMProvider?`
- `primaryModel String?`
- `fallbackProvider LLMProvider?`
- `fallbackModel String?`

Eliminar de `NewsConfig`:

- `primaryProvider LLMProvider?`
- `primaryModel String?`
- `fallbackProvider LLMProvider?`
- `fallbackModel String?`

```bash
pnpm prisma migrate dev --name remove-llm-fields-from-trading-news-configs
pnpm prisma generate
```

### A.6 — Crear `AgentConfigService`

**Archivo nuevo:** `apps/api/src/agents/agent-config.service.ts`

Métodos:

- `getUserAgentConfigs(userId: string): Promise<AgentConfig[]>` — todos los overrides del usuario
- `getUserAgentConfig(userId: string, agentId: AgentId): Promise<AgentConfig | null>` — override individual
- `upsertUserAgentConfig(userId: string, agentId: AgentId, provider: LLMProvider, model: string): Promise<AgentConfig>`
- `deleteUserAgentConfig(userId: string, agentId: AgentId): Promise<void>` — vuelve al default
- `getAdminAgentConfigs(): Promise<AdminAgentConfig[]>` — todos los defaults
- `upsertAdminAgentConfig(agentId: AgentId, model: string, adminUserId: string): Promise<AdminAgentConfig>` — provider siempre OPENROUTER

Validaciones en `upsertUserAgentConfig`:

- Verificar que el usuario tiene `LLMCredential` activa para el `provider` indicado.
- Verificar que `agentId` es válido (no `orchestrator`).

### A.7 — Crear `AgentConfigResolver`

**Archivo nuevo:** `apps/api/src/agents/agent-config.resolver.ts`

```typescript
@Injectable()
export class AgentConfigResolver {
  async resolveConfig(
    agentId: AgentId,
    userId: string,
  ): Promise<ResolvedAgentConfig> {
    // 1. Buscar override del usuario
    const userOverride = await this.agentConfigService.getUserAgentConfig(
      userId,
      agentId,
    );
    if (userOverride) {
      // Verificar que tiene key activa para este provider
      const hasKey = await this.hasActiveKey(userId, userOverride.provider);
      if (hasKey)
        return {
          provider: userOverride.provider,
          model: userOverride.model,
          source: 'user',
        };
    }

    // 2. Buscar default del admin
    const adminDefault =
      await this.agentConfigService.getAdminAgentConfig(agentId);
    if (adminDefault) {
      return {
        provider: adminDefault.provider,
        model: adminDefault.model,
        source: 'admin',
      };
    }

    // 3. Hardcoded fallback
    const fallback = AGENT_FALLBACK_CONFIGS[agentId];
    return {
      provider: fallback.provider,
      model: fallback.model,
      source: 'fallback',
    };
  }

  async checkHealth(userId: string): Promise<AgentHealthReport> {
    // Para cada agente, resolve y verificar que el usuario tiene key del provider resultante
  }
}
```

### A.8 — Implementar endpoints de usuario

**Archivo:** `apps/api/src/agents/agent-config.controller.ts` (nuevo)

- `GET /users/me/agents/config` → `AgentConfigResolver.resolveAllConfigs(userId)`
- `PUT /users/me/agents/:agentId/config` → `AgentConfigService.upsertUserAgentConfig(userId, agentId, body.provider, body.model)`
- `DELETE /users/me/agents/:agentId/config` → `AgentConfigService.deleteUserAgentConfig(userId, agentId)`
- `GET /users/me/agents/health` → `AgentConfigResolver.checkHealth(userId)` (con query param `?simulate=remove&provider=X`)

### A.9 — Implementar endpoints de Admin

**Archivo:** `apps/api/src/admin/admin-agent-config.controller.ts` (nuevo, o extender AdminController existente)

- `GET /admin/agents/config` → `AgentConfigService.getAdminAgentConfigs()`
- `PUT /admin/agents/:agentId/config` → `AgentConfigService.upsertAdminAgentConfig(agentId, body.model, adminUserId)` — provider fijo OPENROUTER

Guards: `JwtAuthGuard` + `RolesGuard(ADMIN)`

### A.10 — Refactorizar servicios que usan LLM para usar AgentConfigResolver

**Archivos a modificar:**

1. `OrchestratorService` — en `classifyIntent()` usar `resolveConfig('routing', userId)`, en `orchestrateDecision()` usar `resolveConfig('synthesis', userId)`
2. `SubAgentService` — en `call(agentId, ...)` usar `resolveConfig(agentId, userId)` en vez de leer `TradingConfig.primaryProvider`
3. `ChatService` — al iniciar stream, resolver modelo vía `resolveConfig(chatSession.agentId, userId)`
4. News analysis pipeline — donde use `NewsConfig.primaryProvider`, reemplazar por `resolveConfig('market', userId)` (SIGMA)

**Buscar todos los usos:**

```bash
grep -rn 'primaryProvider\|primaryModel\|fallbackProvider\|fallbackModel' apps/api/src/ --include='*.ts' | grep -v '\.spec\.'
```

### A.11 — Actualizar DTOs de TradingConfig y NewsConfig

**Archivos:**

- DTO de `CreateTradingConfig` / `UpdateTradingConfig` — eliminar `primaryProvider`, `primaryModel`, `fallbackProvider`, `fallbackModel`
- DTO de `UpdateNewsConfig` — eliminar los mismos campos
- Cualquier otro DTO que refiera estos campos

### A.12 — Tests unitarios

- `apps/api/src/agents/agent-config.service.spec.ts` — CRUD de configs
- `apps/api/src/agents/agent-config.resolver.spec.ts` — resolución con merge, fallback, health check
- Actualizar tests existentes de `OrchestratorService`, `SubAgentService` y `ChatService` que mockeaban `TradingConfig.primaryProvider`

### Verificación Fase A

```bash
pnpm nx test api --testPathPattern="agent-config|orchestrator|sub-agent|chat"
pnpm nx build api
# Verificar que no hay referencias a primaryProvider/primaryModel en servicios (solo en tests y migración)
grep -rn 'primaryProvider\|primaryModel' apps/api/src/ --include='*.ts' | grep -v spec | grep -v migration
```

---

## Fase B — Frontend: Páginas de configuración de agentes

### B.1 — Hook `useAgentConfig`

**Archivo nuevo:** `apps/web/src/hooks/use-agent-config.ts`

```typescript
// Queries
useAgentConfigs(); // GET /users/me/agents/config → lista de 7 configs resueltas
useAgentHealth(); // GET /users/me/agents/health → health report

// Mutations
useUpdateAgentConfig(); // PUT /users/me/agents/:agentId/config
useResetAgentConfig(); // DELETE /users/me/agents/:agentId/config

// Admin queries/mutations
useAdminAgentConfigs(); // GET /admin/agents/config
useUpdateAdminAgentConfig(); // PUT /admin/agents/:agentId/config
```

### B.2 — Componente `ProviderSearchSelect` (libs/ui)

**Archivo nuevo:** `libs/ui/src/components/agent/provider-search-select.tsx`

Props:

```typescript
interface ProviderSearchSelectProps {
  providers: Array<{ id: string; name: string; icon: string; hasKey: boolean }>;
  value: string;
  onChange: (providerId: string) => void;
  t: (key: string) => string;
}
```

- Usa Select con buscador de `@crypto-trader/ui`.
- Solo muestra proveedores con `hasKey: true`.
- OpenRouter con badge ⭐.

### B.3 — Componente `ModelSearchSelect` (libs/ui)

**Archivo nuevo:** `libs/ui/src/components/agent/model-search-select.tsx`

Props:

```typescript
interface ModelSearchSelectProps {
  models: Array<{
    id: string;
    name: string;
    contextLength: number;
    pricing?: { prompt: string; completion: string };
  }>;
  value: string;
  onChange: (modelId: string) => void;
  isLoading: boolean;
  isOpenRouter?: boolean; // mostrar filtros avanzados
  t: (key: string) => string;
}
```

- Cada opción muestra: nombre, context length, precio.
- Cuando `isOpenRouter` → filtros por provider original, sort by price/context/popularity, badge "Free".

### B.4 — Componente `AgentConfigCard` (libs/ui)

**Archivo nuevo:** `libs/ui/src/components/agent/agent-config-card.tsx`

Props:

```typescript
interface AgentConfigCardProps {
  agent: {
    agentId: string;
    displayName: string;
    description: string;
    icon: string;
    color: string;
  };
  config: {
    provider: string;
    model: string;
    source: 'user' | 'admin' | 'fallback';
    isOverridden: boolean;
  };
  providers: ProviderOption[];
  models: ModelOption[];
  isModelsLoading: boolean;
  isLocked?: boolean; // AEGIS
  dualModel?: boolean; // KRYPTO
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onSave: () => void;
  onReset: () => void;
  t: (key: string) => string;
}
```

Variantes:

- **Standard** (NEXUS, FORGE, SIGMA, CIPHER): card media con provider select + model select
- **Dual model** (KRYPTO): card full-width con 2 pares de provider+model (routing + synthesis)
- **Locked** (AEGIS): card full-width con candado 🔒, sin toggle on/off

### B.5 — Container `AgentConfigCardContainer`

**Archivo nuevo:** `apps/web/src/containers/settings/agent-config-card-container.tsx`

Container que conecta `AgentConfigCard` con:

- `useAgentConfig` hooks (datos)
- `useLLMModels` hook (lista de modelos dinámicos por provider)
- `useLLMProviders` hook (lista de providers con key activa)
- i18n `t()` function
- Mutations de save/reset

### B.6 — Página `/settings/agents`

**Archivo nuevo:** `apps/web/src/pages/dashboard/settings-agents.tsx` (o nueva ruta en settings)

Layout:

1. Header con título y descripción.
2. `AgentConfigCardContainer` para KRYPTO (full-width, dualModel=true).
3. Grid 2x2: NEXUS, FORGE, SIGMA, CIPHER.
4. `AgentConfigCardContainer` para AEGIS (full-width, isLocked=true).

Agregar ruta en React Router: `/settings/agents` o como nuevo tab en SettingsPage.

### B.7 — Admin: tab "Modelo" en cada card de agente

**Archivos a modificar:**

- El componente de la card expandible de agente en Admin (`/admin/agents`).
- Agregar tab "Modelo" junto a Identidad/RAG/Diagnóstico.
- Contenido del tab: `ModelSearchSelect` alimentado con modelos de OpenRouter, botón "Guardar".
- Para KRYPTO: dos selectores (routing + synthesis).
- El selector NO muestra provider (es siempre OpenRouter) — solo modelo.

### B.8 — Traducciones i18n

**Archivos:** `apps/web/src/locales/es.ts` y `en.ts`

Nuevas keys (~80):

```
settings.agents.title
settings.agents.description
settings.agents.usingDefault
settings.agents.usingOverride
settings.agents.resetToDefault
settings.agents.save
settings.agents.krypto.title / description / routingLabel / routingHint / synthesisLabel / synthesisHint
settings.agents.nexus.title / description
settings.agents.forge.title / description
settings.agents.sigma.title / description
settings.agents.cipher.title / description
settings.agents.aegis.title / description / lockedHint
settings.agents.providerPlaceholder / modelPlaceholder / noKeyWarning
admin.agents.defaultsTitle / defaultsDescription / modelTab / saveDefaults / openrouterRequired
```

### B.9 — Agregar link en sidebar

Agregar entrada "Agents" o "AI Agents" en el sidebar bajo SETTINGS, que navegue a `/settings/agents`.

### Verificación Fase B

```bash
pnpm nx build web
pnpm nx test web
# Verificar visualmente la página /settings/agents
# Verificar que Admin > AI Agents muestra el tab "Modelo" en cada card
```

---

## Fase C — Eliminación de config LLM redundante + validaciones

### C.1 — Eliminar sección "AI Model for Analysis" de /settings/news

**Archivos a modificar:**

- El componente de configuración de noticias en settings.
- Eliminar los selects de primaryProvider/primaryModel/fallbackProvider/fallbackModel.
- Reemplazar con un `Callout` informativo: "El análisis IA de noticias usa el modelo configurado en SIGMA → [Ir a Agentes]"

### C.2 — Eliminar Primary/Fallback model de formulario de TradingConfig

**Archivos a modificar:**

- El formulario de crear/editar `TradingConfig` en `/dashboard/config`.
- Eliminar los campos de provider + model (primary y fallback).
- Reemplazar con un `Callout`: "Las decisiones de trading usan SIGMA, AEGIS y KRYPTO → [Ir a Agentes]"

### C.3 — Actualizar formularios frontend de TradingConfig

Verificar que los formularios de React Hook Form no envían campos LLM al backend:

```bash
grep -rn 'primaryProvider\|primaryModel\|fallbackProvider\|fallbackModel' apps/web/src/ --include='*.ts*'
```

Eliminar todos los usos.

### C.4 — Hacer obligatorio el step de LLM en onboarding

**Archivo:** componente de onboarding (StepLLM o equivalente)

- Eliminar botón "Skip" / "Más tarde".
- El botón "Siguiente" se habilita SOLO cuando `POST /users/me/llm-keys/test` retorna `{ valid: true }` para al menos un provider.
- Texto claro: "Los agentes de la plataforma necesitan acceso a un modelo de IA."

### C.5 — Banner de alerta en dashboard

**Archivo:** layout principal del dashboard o componente `DashboardHeader`.

- Al montar, llamar `GET /users/me/agents/health`.
- Si `healthy: false`, mostrar banner con agentes afectados y link a `/settings/agents`.
- El banner usa el componente `Callout` existente con variante `warning`.
- Es persistente hasta que el usuario resuelve el problema.

### C.6 — Detección reactiva al eliminar API key

**Archivo:** componente de gestión de API keys en settings.

Antes de ejecutar DELETE de una key:

1. Llamar `GET /users/me/agents/health?simulate=remove&provider=CLAUDE`.
2. Si algún agente queda huérfano, mostrar `Dialog` de confirmación con la lista.
3. Si es la última key, bloquear y redirigir a configurar una nueva.

### C.7 — Bloquear inicio de agente si faltan keys

**Archivo:** donde se ejecuta `startAgent()` o `toggleAgent()`.

Antes de iniciar un agente de trading:

1. Verificar health de SIGMA, AEGIS, routing y synthesis.
2. Si alguno falta → toast de error + no iniciar + sugerir ir a `/settings/agents`.

### C.8 — Tests E2E

**Archivo nuevo:** `e2e/agent-hub-settings.spec.ts`

Tests:

- Navegar a `/settings/agents` → verificar que los 6 agentes se muestran.
- Verificar que KRYPTO tiene dos selectores de modelo.
- Verificar que AEGIS tiene candado y no tiene toggle.
- Cambiar modelo de un agente → verificar que se guarda.
- Resetear un agente → verificar que vuelve al default.
- Como Admin: verificar tab "Modelo" en Admin > AI Agents.
- Verificar que el formulario de TradingConfig NO tiene campos LLM.
- Verificar que /settings/news NO tiene sección de AI Model.

### Verificación Fase C

```bash
pnpm nx build api && pnpm nx build web
pnpm nx test api && pnpm nx test web
pnpm playwright test e2e/agent-hub-settings.spec.ts

# Verificar que no quedan refs a campos LLM eliminados
grep -rn 'primaryProvider\|primaryModel\|fallbackModel\|fallbackProvider' apps/web/src/ --include='*.ts*' | grep -v node_modules
grep -rn 'primaryProvider\|primaryModel\|fallbackModel\|fallbackProvider' apps/api/src/ --include='*.ts' | grep -v spec | grep -v migration
```

---

## Fase D — NEXUS quick actions + FORGE cuestionario interactivo + System Prompts

### D.1 — Extender protocolo SSE del chat

**Archivo:** `apps/api/src/chat/chat.service.ts` (o equivalente)

Después de recibir el stream completo de un sub-agente:

1. Buscar patrón JSON al final del texto: `{"quickActions": [...]}` o `{"inlineOptions": [...]}`.
2. Usar regex: `/\{"quickActions":\s*\[.*?\]\}$/s` y `/\{"inlineOptions":\s*\[.*?\]\}$/s`.
3. Si se encuentra:
   - Extraer del texto visible (el usuario ve solo el texto antes del JSON).
   - Emitir como evento SSE separado: `data: { type: "quick_actions", actions: [...] }` o `data: { type: "inline_options", options: [...] }`.
4. Guardar en `ChatMessage.metadata` (campo JSON existente) para re-render al recargar.

### D.2 — Endpoint de selección de opción inline

**Archivo nuevo o extender:** `apps/api/src/chat/chat.controller.ts`

```
POST /chat/sessions/:id/select
Body: { "optionId": "btc" }
```

1. Guardar como `ChatMessage` del usuario con tipo `option_select` en metadata.
2. Re-invocar al sub-agente con contexto: "El usuario seleccionó: {optionId}" + historial previo.
3. Retornar stream de la siguiente pregunta/acción del cuestionario.

### D.3 — Componente `QuickActionButtons` (libs/ui)

**Archivo nuevo:** `libs/ui/src/components/chat/quick-action-buttons.tsx`

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

Render: fila horizontal de botones ghost compactos con icono + label.

- `navigate` → icono ExternalLink
- `open_docs` → icono BookOpen
- `transfer_agent` → icono ArrowRight + nombre del agente

### D.4 — Componente `ChatInlineOptions` (libs/ui)

**Archivo nuevo:** `libs/ui/src/components/chat/chat-inline-options.tsx`

```typescript
interface ChatInlineOptionsProps {
  options: Array<{
    id: string;
    label: string;
    emoji?: string;
    description?: string;
  }>;
  onSelect: (optionId: string) => void;
  disabled?: boolean;
  selectedId?: string;
  t: (key: string) => string;
}
```

Render: chips/botones horizontales con emoji + label.

- Antes de selección: todos activos, hover effect.
- Después de selección: seleccionado = highlighted + check, otros = opacity 50%.

### D.5 — Containers para quick actions y opciones

**Archivos nuevos:**

- `apps/web/src/containers/chat/quick-action-handler.tsx` — conecta `QuickActionButtons` con React Router (`navigate`), AgentSelector (`transfer_agent`), HelpSystem (`open_docs`).
- `apps/web/src/containers/chat/inline-options-handler.tsx` — conecta `ChatInlineOptions` con mutation `POST /chat/sessions/:id/select`.

### D.6 — Integrar en renderizado de mensajes

**Archivo a modificar:** componente de mensajes de chat (`chat-messages.tsx` o equivalente)

Al renderizar un mensaje del asistente:

1. Si `message.metadata.quickActions` → renderizar `<QuickActionHandler actions={...} />` debajo del texto.
2. Si `message.metadata.inlineOptions` → renderizar `<InlineOptionsHandler options={...} />` debajo del texto.
3. Si `message.metadata.toolCall` → renderizar `<ToolCallCard />` (ya existente, sin cambios).

Las opciones inline se deshabilitan (`disabled=true`) después de que el usuario selecciona una, y se muestra `selectedId`.

### D.7 — Actualizar system prompts en seed

**Archivo:** `apps/api/prisma/seed/agents.ts`

Reemplazar los 6 system prompts con los de la sección 11 de la spec. Cada prompt incluye:

- `═══ RESPONSABILIDADES ═══`
- `═══ RELACIONES CON OTROS AGENTES ═══`
- `═══ RESTRICCIONES ═══`
- NEXUS: `═══ DELEGACIONES ═══` con formato `{"quickActions": [...]}`
- FORGE: `═══ CUESTIONARIO INTERACTIVO ═══` con formato `{"inlineOptions": [...]}`
- AEGIS: `═══ REGLAS DE VEREDICTO ═══` con reglas no negociables

**Nota:** El seed no sobreescribe prompts en re-seed si ya existen (lógica actual). Para aplicar los nuevos prompts en dev, hacer reset del seed o actualizar manualmente vía Admin UI.

### D.8 — Traducciones i18n para Fase D

**Archivos:** `apps/web/src/locales/es.ts` y `en.ts`

Nuevas keys (~30):

```
chat.quickAction.navigate / openDocs / transferAgent
chat.inlineOptions.selectOption / selected / expired
chat.forge.selectAsset / selectQuote / selectMode / selectProfile / reviewConfig / adjustParams
chat.nexus.goToConfig / goToSettings / viewDocs / talkToSigma / talkToForge / talkToCipher / talkToAegis
```

### D.9 — Tests E2E

**Archivos nuevos:**

- `e2e/nexus-quick-actions.spec.ts`:
  - Abrir chat → seleccionar NEXUS → preguntar "¿cómo configuro un agente?" → verificar que aparecen quick action buttons → click en "Ir a Configuración" → verificar navegación.
  - Preguntar algo de mercado → verificar botón "Hablar con SIGMA".

- `e2e/forge-interactive.spec.ts`:
  - Abrir chat → seleccionar FORGE → "quiero crear una config" → verificar que aparecen opciones inline [BTC] [ETH] → click BTC → verificar siguiente pregunta → completar cuestionario → verificar ToolCallCard → confirmar → verificar config creada.

### Verificación Fase D

```bash
pnpm nx build api && pnpm nx build web
pnpm nx test api && pnpm nx test web
pnpm playwright test e2e/nexus-quick-actions.spec.ts e2e/forge-interactive.spec.ts
```

---

## Criterios de aceptación

### Configuración de agentes

- [ ] Tabla `agent_configs` creada con constraint `unique(userId, agentId)`
- [ ] Tabla `admin_agent_configs` creada con `agentId` unique, provider siempre OPENROUTER
- [ ] Enum `AgentId` incluye `routing` y `synthesis`
- [ ] `AgentConfigResolver` resuelve config con merge: usuario > admin > hardcoded
- [ ] Endpoints CRUD de usuario funcionan: GET all, PUT, DELETE, health
- [ ] Endpoints Admin funcionan: GET all, PUT (solo modelo, provider fijo OPENROUTER)

### Páginas frontend

- [ ] `/settings/agents` muestra los 6 agentes con selectores de provider + modelo
- [ ] KRYPTO muestra 2 selectores (routing + synthesis) con explicación
- [ ] AEGIS muestra candado y no tiene toggle de desactivación
- [ ] Admin > AI Agents tiene tab "Modelo" por agente con selector de modelo OpenRouter
- [ ] Provider selector solo muestra proveedores con API key activa del usuario
- [ ] Model selector carga modelos dinámicamente por provider

### Eliminación de config redundante

- [ ] `TradingConfig` ya no tiene campos `primaryProvider/primaryModel/fallbackProvider/fallbackModel`
- [ ] `NewsConfig` ya no tiene campos LLM
- [ ] Formulario de TradingConfig no muestra selectores LLM
- [ ] `/settings/news` no tiene sección "AI Model for Analysis"
- [ ] Ambas secciones muestran info card con link a `/settings/agents`

### Validación de keys

- [ ] Onboarding NO permite skip del step de LLM (obligatorio)
- [ ] Banner de alerta en dashboard si algún agente no tiene provider válido
- [ ] Dialog de confirmación al eliminar API key que afecta agentes
- [ ] Trading pipeline no arranca si SIGMA, AEGIS o KRYPTO no tienen key

### NEXUS y FORGE interactivos

- [ ] NEXUS emite quick actions como metadata en respuestas
- [ ] Quick action buttons se renderizan debajo del mensaje
- [ ] Click en "navigate" navega a la ruta correcta
- [ ] Click en "transfer_agent" abre chat con el agente indicado
- [ ] FORGE emite opciones inline en cuestionarios
- [ ] Opciones clickeables se renderizan como chips/botones
- [ ] Después de seleccionar, opciones se deshabilitan
- [ ] Cuestionario completo produce ToolCallCard con confirmación

### System prompts

- [ ] Los 6 system prompts actualizados en seed con responsabilidades/relaciones/restricciones
- [ ] Build limpio de api y web
- [ ] Traducciones en y es completas (~110 nuevas claves)

### Chat: resolución por agente y eliminación de selectores (Fase E)

- [ ] `ChatSession.provider` y `ChatSession.model` son opcionales en Prisma schema
- [ ] `CreateSessionDto` no requiere `provider` ni `model`
- [ ] `ChatService.runStreamAsync` resuelve LLM via `AgentConfigResolver` según `activeAgentId`
- [ ] Parámetros `providerOverride`/`modelOverride` eliminados del endpoint SSE de stream
- [ ] Modal `NewSessionModal` eliminado — sesión se crea automáticamente al primer mensaje
- [ ] Componente `ChatLLMOverride` eliminado del widget y de la página de chat
- [ ] Header del chat muestra dinámicamente el agente activo (nombre + provider + modelo resuelto)
- [ ] `ChatStore` limpio: sin `sessionProvider`, `sessionModel`, `setSessionLLM`
- [ ] `useChatStream.startStream` sin parámetros `providerOverride`/`modelOverride`
- [ ] Label "Primary Model" renombrado a "Fallback Model" con nota informativa
- [ ] Cambios reflejados tanto en widget como en `/dashboard/chat`
- [ ] Tests E2E del chat adaptados al nuevo flujo (sin modal de nueva sesión)

---

## Fase E — Chat: Resolución de LLM por agente + eliminación de selectores

### E.1 — Migración Prisma: `provider` y `model` opcionales en `ChatSession`

**Archivo:** `apps/api/prisma/schema.prisma`

```prisma
model ChatSession {
  // provider y model pasan a ser opcionales
  provider  LLMProvider?    // era LLMProvider (obligatorio)
  model     String?         // era String (obligatorio)
}
```

```bash
cd apps/api
pnpm prisma migrate dev --name chat-session-optional-llm-fields
pnpm prisma generate
```

### E.2 — Inyectar `AgentConfigResolverService` en `ChatService`

**Archivos:**

- `apps/api/src/chat/chat.module.ts` — importar `AgentConfigModule`
- `apps/api/src/chat/chat.service.ts` — inyectar `AgentConfigResolverService`

### E.3 — Actualizar `CreateSessionDto`

**Archivo:** `apps/api/src/chat/dto/chat.dto.ts`

- `provider` → `@IsOptional()` + `@IsEnum(LLMProvider)`
- `model` → `@IsOptional()` + `@IsString()`

### E.4 — Actualizar `ChatService.createSession()`

**Archivo:** `apps/api/src/chat/chat.service.ts`

- Ya no validar que tenga credencial para el provider — el provider se resuelve dinámicamente
- `provider` y `model` pueden ser null en el `create`

### E.5 — Refactorizar `ChatService.runStreamAsync()` — Resolver LLM por agente

**Archivo:** `apps/api/src/chat/chat.service.ts`

Cambiar la sección "Effective provider / model":

```typescript
// Resolver via AgentConfigResolver según el agente activo
const agentIdForLLM = activeAgentId ?? AgentId.platform;
const resolvedConfig = await this.agentConfigResolver.resolveConfig(
  agentIdForLLM,
  userId,
);
const effectiveProvider = resolvedConfig.provider;
const effectiveModel = resolvedConfig.model;

// Actualizar sesión con provider/model resuelto (para display)
await this.prisma.chatSession.update({
  where: { id: sessionId },
  data: { provider: effectiveProvider, model: effectiveModel },
});
```

Eliminar parámetros `providerOverride` y `modelOverride` de `streamAssistantResponse()` y `runStreamAsync()`.

### E.6 — Actualizar `ChatController.streamResponse()`

**Archivo:** `apps/api/src/chat/chat.controller.ts`

Eliminar query params `providerOverride` y `modelOverride` del endpoint SSE.

### E.7 — Frontend: Auto-creación de sesión al primer mensaje

**Archivos:** `apps/web/src/containers/chat/chat-widget.tsx`, `apps/web/src/pages/dashboard/chat.tsx`

En `handleSend`: si no hay `activeSessionId`, crear sesión automáticamente y continuar.

### E.8 — Frontend: Eliminar `NewSessionModal` y `LLMSelector`

**Archivos:** `chat-widget.tsx`, `chat.tsx` — eliminar imports, estado `showNewSession`, y renderizado del modal.

### E.9 — Frontend: Eliminar `ChatLLMOverride`

**Archivos:** `chat-widget.tsx`, `chat.tsx` — eliminar import y renderizado. Eliminar archivo `chat-llm-override.tsx`.

### E.10 — Frontend: Header dinámico con agente activo

**Archivos:** `chat-widget.tsx`, `chat.tsx` — mostrar nombre del agente activo + provider:model resuelto.

### E.11 — Frontend: Limpiar `ChatStore`

**Archivo:** `apps/web/src/store/chat.store.ts` — eliminar `sessionProvider`, `sessionModel`, `setSessionLLM`.

### E.12 — Frontend: Limpiar `useChatStream`

**Archivo:** `apps/web/src/hooks/use-chat.ts` — eliminar params `providerOverride`/`modelOverride` de `startStream` y del URL del EventSource.

### E.13 — Settings: Renombrar "Primary Model" a "Fallback Model"

**Archivos:** `openrouter-primary-tab.tsx`, `en.ts`, `es.ts` — cambiar label + agregar nota informativa con link a Agent Hub.

### E.14 — Traducciones i18n (~15 claves nuevas/modificadas)

### E.15 — Adaptar tests E2E del chat

**Archivos:** `e2e/multi-agent-chat.spec.ts` — adaptar: sin modal de nueva sesión, verificar auto-creación.

### Verificación Fase E

```bash
pnpm nx build api && pnpm nx build web
pnpm nx test api && pnpm nx test web
pnpm playwright test e2e/multi-agent-chat.spec.ts
# Verificar limpieza
grep -rn 'NewSessionModal\|showNewSession\|ChatLLMOverride\|sessionProvider\|sessionModel' apps/web/src/ --include='*.ts*'
grep -rn 'providerOverride\|modelOverride' apps/api/src/chat/ --include='*.ts' | grep -v spec
```

---

## Cierre de branch

```bash
# Push
git push origin feature/agent-hub-config

# PR
gh pr create \
  --base main \
  --head feature/agent-hub-config \
  --title "feat: Agent Hub — centralized provider/model config per agent (#36)" \
  --body "## Spec 36 — Agent Hub: Configuración Centralizada de Proveedores y Modelos por Agente

### Cambios

**Backend:**
- Nuevas tablas \`agent_configs\` (por usuario) y \`admin_agent_configs\` (defaults globales, solo OpenRouter)
- \`AgentConfigResolver\` con merge: usuario > admin > hardcoded fallback
- Enum \`AgentId\` extendido con \`routing\` y \`synthesis\` para KRYPTO
- Campos LLM eliminados de \`TradingConfig\` y \`NewsConfig\` (migración de datos incluida)
- Endpoints CRUD para usuario y admin
- Endpoint \`/agents/health\` con simulación de eliminación de key
- \`OrchestratorService\`, \`SubAgentService\`, \`ChatService\` refactorizados para usar \`AgentConfigResolver\`
- Protocolo SSE extendido: \`quick_actions\` y \`inline_options\`
- Endpoint \`POST /chat/sessions/:id/select\` para cuestionario interactivo de FORGE
- System prompts mejorados con responsabilidades, relaciones y restricciones explícitas
- Chat: \`ChatService\` usa \`AgentConfigResolver\` para resolver LLM por agente activo
- Chat: \`ChatSession.provider\` y \`ChatSession.model\` opcionales (resueltos dinámicamente)
- Chat: eliminados parámetros \`providerOverride\`/\`modelOverride\` del endpoint SSE

**Frontend:**
- Nueva página \`/settings/agents\` con config de 6 agentes (KRYPTO dual, AEGIS locked)
- Tab 'Modelo' en Admin > AI Agents (solo OpenRouter)
- \`ProviderSearchSelect\` + \`ModelSearchSelect\` + \`AgentConfigCard\` (libs/ui)
- \`QuickActionButtons\` + \`ChatInlineOptions\` (libs/ui)
- Sección LLM eliminada de formulario de TradingConfig y NewsConfig
- Banner de alerta de health en dashboard
- Onboarding: step LLM obligatorio (sin skip)
- Chat: eliminados \`NewSessionModal\`, \`LLMSelector\` y \`ChatLLMOverride\`
- Chat: auto-creación de sesión al primer mensaje (sin modal)
- Chat: header dinámico muestra agente activo con provider/modelo resuelto
- Chat: \`ChatStore\` limpio (sin \`sessionProvider\`/\`sessionModel\`)
- Settings: 'Primary Model' renombrado a 'Fallback Model' con nota informativa
- Traducciones i18n (en/es, ~125 nuevas claves)

### Tests
- Unit tests: AgentConfigService, AgentConfigResolver, ChatService (resolución por agente)
- E2E: agent-hub-settings, nexus-quick-actions, forge-interactive, multi-agent-chat (sin modal)

### Spec
docs/specs/branches/36-agent-hub-config.md"
```

> Actualizar `docs/plans/crypto-trader-branch-plan.md` con estado "Merged" después del merge.
> Revisar si `docs/CONSTITUTION.md` necesita actualización (nuevos modelos Prisma, nueva página, cambios en pipeline de trading).
