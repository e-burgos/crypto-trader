# Plan 38 — Toggle Global de Proveedores LLM + Hardening LLM Pipeline

**Spec:** docs/specs/branches/38-llm-provider-toggle.md (v3.0)  
**Branch:** feature/llm-provider-toggle  
**Depende de:** Spec 35 (openrouter-integration), Spec 37 (role-based-access-separation)

---

## Estado inicial requerido

```bash
# Verificar que main está actualizado
git checkout main && git pull origin main

# Verificar que Prisma genera correctamente
cd apps/api && npx prisma generate

# Verificar build limpio
pnpm nx build api && pnpm nx build web

# Verificar que el enum LLMProvider incluye OPENROUTER
grep -A 10 "enum LLMProvider" apps/api/prisma/schema.prisma
```

---

## Fase A — Backend: modelo + API admin + seed + fixes P1-P3

### A.1 — Migración Prisma

**Archivo:** `apps/api/prisma/schema.prisma`

1. Añadir `LLM_PROVIDER_DISABLED` al enum `NotificationType`
2. Añadir modelo `PlatformLLMProvider`:

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

3. `updatedBy` es string suelto — NO FK a User (el admin puede ser eliminado y el registro debe persistir).

4. Ejecutar migración:
   ```bash
   cd apps/api && npx prisma migrate dev --name add-platform-llm-providers
   ```

### A.2 — Seed de providers

**Archivo:** `apps/api/prisma/seed.ts` (o script dedicado en la migración)

```typescript
const providers = [
  'CLAUDE',
  'OPENAI',
  'GROQ',
  'GEMINI',
  'MISTRAL',
  'TOGETHER',
  'OPENROUTER',
];
for (const provider of providers) {
  await prisma.platformLLMProvider.upsert({
    where: { provider },
    update: {},
    create: { provider, isActive: true },
  });
}
```

### A.3 — PlatformLLMProviderService

**Archivo nuevo:** `apps/api/src/llm/platform-llm-provider.service.ts`

```typescript
@Injectable()
export class PlatformLLMProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getAll(): Promise<PlatformLLMProvider[]>;
  async getActiveProviders(): Promise<LLMProvider[]>;
  async isProviderActive(provider: LLMProvider): Promise<boolean>;
  async assertProviderActive(provider: LLMProvider): Promise<void>; // throws ConflictException
  async toggle(
    provider: LLMProvider,
    isActive: boolean,
    adminId: string,
  ): Promise<ToggleResult>;
}
```

**Método `toggle`:**

1. `prisma.platformLLMProvider.update({ where: { provider }, data: { isActive, updatedBy: adminId } })`
2. `prisma.adminAction.create(...)` → action = `ENABLE_PROVIDER` | `DISABLE_PROVIDER`
3. Si `isActive === false`:
   a. Buscar `agentConfig` donde `provider === provider` (el desactivado)
   b. Update masivo: `{ provider: null, model: null }`
   c. Agrupar por userId → enviar 1 notificación por usuario afectado (tipo `LLM_PROVIDER_DISABLED`)
   d. Contar affected users y configs
4. Retornar `{ provider, isActive, affectedAgentConfigs, affectedUsers }`

**Método `assertProviderActive`:**

```typescript
async assertProviderActive(provider: LLMProvider): Promise<void> {
  const p = await this.prisma.platformLLMProvider.findUnique({ where: { provider } });
  if (p && !p.isActive) {
    throw new ConflictException({
      statusCode: 409,
      code: 'LLM_PROVIDER_DISABLED',
      message: `The LLM provider ${provider} has been disabled by the administrator`,
      redirect: '/dashboard/settings/llms',
    });
  }
}
```

### A.4 — Controller admin

**Archivo nuevo:** `apps/api/src/llm/platform-llm-provider.controller.ts`

```typescript
@Controller('admin/llm-providers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PlatformLLMProviderController {
  @Get()
  getAll()

  @Put(':provider/toggle')
  toggle(@Param('provider') provider: string, @Body() dto: { isActive: boolean }, @Req() req)
}
```

### A.5 — Endpoint público de status

```typescript
@Controller('llm-providers')
@UseGuards(JwtAuthGuard)
export class LLMProviderStatusController {
  @Get('status')
  getStatus()
}
```

### A.6 — Registrar en LlmModule

**Archivo:** `apps/api/src/llm/llm.module.ts`

Importar `NotificationsModule`, registrar `PlatformLLMProviderService`, `PlatformLLMProviderController`, `LLMProviderStatusController`.

### A.7 — Fix P1: eliminar llmApiKey muerto

**Archivo:** `apps/api/src/trading/trading.processor.ts` (línea ~140)

Eliminar:

```typescript
const llmApiKey = decrypt(llmCred.apiKeyEncrypted, llmCred.apiKeyIv);
```

Esta variable se desencripta pero nunca se usa — el orchestrator resuelve sus propias credentials vía SubAgentService.

### A.8 — Fix P2: check agent-aware en TradingProcessor

**Archivo:** `apps/api/src/trading/trading.processor.ts` (paso 3, línea ~121)

Reemplazar:

```typescript
// ANTES: check genérico
const llmCred = await this.prisma.lLMCredential.findFirst({
  where: { userId, isActive: true },
});
if (!llmCred) { ... pause agent ... }
```

Por:

```typescript
// DESPUÉS: verifica que todos los agentes resueltos tengan credentials válidas
const healthy = await this.agentConfigResolver.checkHealth(userId);
if (!healthy) {
  this.logger.warn(
    `[Bot ${config.id}] Agent config health check failed, pausing`,
  );
  // ... pause agent + notificación AGENT_ERROR ...
}
```

Inyectar `AgentConfigResolverService` en `TradingProcessor`.

### A.9 — Fix P3: eliminar resolveLLMForNews legacy

**Archivo:** `apps/api/src/market/market.service.ts` (línea ~286)

Eliminar el método `resolveLLMForNews()` completo. Ya no se llama activamente — `analyzeSentiment` ya usa `agentConfigResolver.resolveConfig('market', userId)` directamente.

Si aún hay callers, migrarlos a usar `AgentConfigResolver`.

### A.10 — Tests unitarios

**Archivo nuevo:** `apps/api/src/llm/platform-llm-provider.service.spec.ts`

- Test toggle ON → no side effects, solo update
- Test toggle OFF → verifica limpiar agentConfigs, crear notificaciones, crear adminAction
- Test getAll → retorna todos los providers
- Test isProviderActive → true/false
- Test assertProviderActive → throws ConflictException para inactivo

**Verificación Fase A:**

```bash
pnpm nx build api
pnpm nx test api --testPathPattern=platform-llm-provider
```

---

## Fase B — Backend: validaciones + pipeline hardening + persistencia

### B.1 — Fix P4: validar provider activo en SubAgentService.getProvider()

**Archivo:** `apps/api/src/orchestrator/sub-agent.service.ts` → `getProvider()`

Inyectar `PlatformLLMProviderService`. Después de resolver el provider (paso 1, 2 o 3), antes de crear el client:

```typescript
await this.platformLLMProviderService.assertProviderActive(resolvedProvider);
```

### B.2 — Validación en setLLMKey

**Archivo:** `apps/api/src/users/users.service.ts` → `setLLMKey()`

Antes de upsert:

```typescript
await this.platformLLMProviderService.assertProviderActive(dto.provider);
// Si llega aquí, el provider está activo
```

### B.3 — Validación en ChatService

**Archivo:** `apps/api/src/chat/chat.service.ts` → antes de `callLLMStream()`

```typescript
await this.platformLLMProviderService.assertProviderActive(effectiveProvider);
```

### B.4 — Persistencia sentimiento A2→DB

**Archivo:** `apps/api/src/orchestrator/orchestrator.service.ts` → `orchestrateDecision()`

Después de obtener `sentimentRaw` (y si no fue cache), persistir en `NewsAnalysis`:

```typescript
// Después de resolver sentimentRaw en orchestrateDecision
if (sentimentRaw.status === 'fulfilled' && !cachedSentiment) {
  await this.persistSentimentAsAIAnalysis(userId, sentimentRaw.value);
}
```

Nuevo método privado `persistSentimentAsAIAnalysis(userId, sentimentResult)`:

1. Parsear JSON de sentimiento del resultado
2. Buscar el `NewsAnalysis` más reciente del usuario
3. Actualizar con: `aiAnalyzedAt: new Date()`, `aiProvider`, `aiModel`, `aiScore`, `aiOverallSentiment`, `aiSummary`, `aiHeadlines`
4. Si no existe registro → crear uno mínimo

Inyectar `PrismaService` en `OrchestratorService` (o delegar a `MarketService`).

### B.5 — TTL de intervalMinutes en analyzeSentiment (C1)

**Archivo:** `apps/api/src/market/market.service.ts` → `analyzeSentiment()`

Al inicio del método, antes de llamar al LLM:

```typescript
const cfg = await this.getNewsConfig(userId);
const ttlMs = cfg.intervalMinutes * 60_000;
const latest = await this.getLatestAnalysis(userId);

if (latest?.aiAnalyzedAt) {
  const age = Date.now() - new Date(latest.aiAnalyzedAt).getTime();
  if (age < ttlMs) {
    this.logger.log(
      `AI analysis still fresh (${Math.round(age / 1000)}s < ${cfg.intervalMinutes}min TTL). Skipping LLM call.`,
    );
    return latest; // Retornar análisis existente sin nueva llamada LLM
  }
}
```

Esto respeta el intervalo para AMBAS fuentes: A2 trading (via B.4) y botón manual.

### B.6 — Incluir provider/model en evento SSE de routing (B2)

**Archivo:** `apps/api/src/chat/chat.service.ts` → `sendMessage()`

Después de resolver `effectiveProvider` y `effectiveModel`, incluir en el evento SSE de routing:

```typescript
subject.next(
  new MessageEvent('message', {
    data: JSON.stringify({
      type: 'routing',
      agentId: activeAgentId,
      provider: effectiveProvider, // NUEVO
      model: effectiveModel, // NUEVO
      greeting: classification.suggestedGreeting || undefined,
    }),
  }),
);
```

### B.7 — Tests

- Test persistencia A2→DB: mock orchestrateDecision, verificar que NewsAnalysis se actualiza
- Test TTL analyzeSentiment: mock con aiAnalyzedAt reciente → no llama LLM
- Test TTL analyzeSentiment: mock con aiAnalyzedAt vieja → llama LLM
- Test assertProviderActive en getProvider: mock provider inactivo → throws
- Test routing SSE incluye provider/model

**Verificación Fase B:**

```bash
pnpm nx test api
pnpm nx build api
```

---

## Fase C — Frontend: panel admin

### C.1 — Hooks

**Archivo:** `apps/web/src/hooks/use-admin.ts`

```typescript
interface PlatformLLMProviderStatus {
  provider: string;
  isActive: boolean;
  updatedAt: string;
}

interface ToggleLLMProviderResult {
  provider: string;
  isActive: boolean;
  affectedAgentConfigs: number;
  affectedUsers: number;
}

export function useAdminLLMProviderStatus(); // GET /admin/llm-providers
export function useToggleLLMProvider(); // PUT /admin/llm-providers/:provider/toggle
```

### C.2 — Panel en `/admin/llm-providers`

**Archivo:** `apps/web/src/pages/admin/llm-providers.tsx`

Añadir sección ARRIBA del bloque de API keys existente:

- Título: "Estado de Proveedores" con icono Shield
- DataTable con columnas: Proveedor, Estado (Badge), Última actualización, Acción (toggle switch)
- Al hacer toggle OFF → Dialog de confirmación con texto de impacto
- Al confirmar → mutación + invalidar queries + toast

### C.3 — Traducciones

**Archivos:** `apps/web/src/locales/en.ts` y `es.ts`

Claves nuevas:

- `admin.providerStatusTitle` / `admin.providerStatusSubtitle`
- `admin.providerActive` / `admin.providerInactive`
- `admin.providerToggleConfirmTitle` / `admin.providerToggleConfirmDesc`
- `admin.providerToggleSuccess` / `admin.providerAffectedUsers`
- `admin.providerCol*` (columnas de tabla)

**Verificación Fase C:**

```bash
pnpm nx build web
```

---

## Fase D — Frontend: UX usuario + chat B2

### D.1 — Hook de status para usuario

**Archivo:** `apps/web/src/hooks/use-user.ts`

```typescript
export function usePlatformLLMStatus(); // GET /llm-providers/status
```

### D.2 — Cards deshabilitadas en settings/llms

**Archivo:** Componente de settings LLM del usuario (probablemente `apps/web/src/containers/settings/` o similar)

- Consumir `usePlatformLLMStatus()`
- Para cada provider card: si `isActive === false` → overlay + disabled + mensaje

### D.3 — Badge en settings/agents

**Archivo:** Componente de agent config del usuario

- Al cargar agentConfigs, cruzar con `usePlatformLLMStatus()`
- Si un agent tiene provider null o provider inactivo → badge "Requiere atención"

### D.4 — Interceptor HTTP 409

**Archivo:** `apps/web/src/lib/api.ts` (o donde esté el axios/fetch instance)

```typescript
if (
  error.response?.status === 409 &&
  error.response?.data?.code === 'LLM_PROVIDER_DISABLED'
) {
  toast.warning(t('errors.llmProviderDisabled'));
  navigate('/dashboard/settings/llms');
  return;
}
```

### D.5 — Propagar provider/model en routing SSE (B2 frontend)

**Archivo:** `apps/web/src/hooks/use-chat-agent.ts`

Actualizar el tipo `RoutingEvent` para incluir los campos nuevos:

```typescript
interface RoutingEvent {
  agentId: string;
  provider?: string; // NUEVO
  model?: string; // NUEVO
  greeting?: string;
}
```

Propagar `provider` y `model` al estado del hook para que `AgentHeader` los muestre inmediatamente al cambiar de agente (sin esperar a que la sesión se recargue).

**Archivo:** `apps/web/src/pages/dashboard/chat.tsx` y `apps/web/src/containers/chat/chat-widget.tsx`

Verificar que `AgentHeader` recibe `provider` y `model` actualizados desde el routing event vía `useChatAgent`.

### D.6 — Traducciones

Claves nuevas para usuario:

- `errors.llmProviderDisabled`
- `settings.providerDisabledByAdmin`
- `settings.providerDisabledOverlay`
- `agents.providerNeedsAttention`
- `chat.agentSwitched` (para feedback visual del cambio B2)

**Verificación Fase D:**

```bash
pnpm nx build web
```

---

## Fase E — Modelos OpenRouter dinámicos

### E.1 — Crear librería `libs/openrouter`

Usar `nx g @nx/js:library openrouter` para crear la lib. Estructura:

```
libs/openrouter/
  src/
    index.ts              # barrel export
    lib/
      openrouter-models.service.ts  # servicio principal con cache
      openrouter.types.ts           # tipos compartidos
      openrouter.constants.ts       # categorías, defaults
```

**Dependencia:** `@openrouter/sdk` (instalar en workspace root)

**`OpenRouterModelsService`:**

```typescript
export interface OpenRouterModelInfo {
  id: string;
  name: string;
  contextLength: number;
  maxCompletionTokens: number | null;
  pricing: { prompt: number; completion: number };
  isFree: boolean;
  categories: string[];
  supportedParameters: string[];
  description?: string;
}

export interface OpenRouterModelsFilter {
  category?: string;
  freeOnly?: boolean;
  textOnly?: boolean;
  supportedParams?: string[];
}

export class OpenRouterModelsService {
  private cache: { data: OpenRouterModelInfo[]; fetchedAt: number } | null =
    null;
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  async listModels(
    filter?: OpenRouterModelsFilter,
  ): Promise<OpenRouterModelInfo[]>;
  async getFreeModels(): Promise<OpenRouterModelInfo[]>;
  async getModelById(modelId: string): Promise<OpenRouterModelInfo | null>;
  async isModelAvailable(modelId: string): Promise<boolean>;
  invalidateCache(): void;
}
```

### E.2 — Backend: nuevo módulo `OpenRouterModule` + endpoint

**Archivo nuevo:** `apps/api/src/openrouter/openrouter.module.ts`

```typescript
@Module({
  providers: [OpenRouterModelsApiService],
  controllers: [OpenRouterModelsController],
  exports: [OpenRouterModelsApiService],
})
export class OpenRouterModule {}
```

**Archivo nuevo:** `apps/api/src/openrouter/openrouter-models.controller.ts`

```typescript
@Controller('openrouter')
@UseGuards(JwtAuthGuard)
export class OpenRouterModelsController {
  @Get('models')
  async getModels(@Query() query: { category?: string; freeOnly?: string })
}
```

**Archivo nuevo:** `apps/api/src/openrouter/openrouter-models-api.service.ts`

Wrapper NestJS que usa `OpenRouterModelsService` de `libs/openrouter`.

### E.3 — Refactorizar `model-pricing.ts`

- Eliminar TODAS las entradas de OpenRouter (las que tienen IDs con `/` como `anthropic/claude-sonnet-4.6`)
- Mantener entradas de providers nativos (CLAUDE, OPENAI, GROQ, GEMINI, MISTRAL, TOGETHER)
- La info de pricing de OpenRouter viene dinámicamente de la API

### E.4 — Refactorizar `model-ranking.ts`

- Eliminar entradas con `provider: LLMProvider.OPENROUTER` de `MODEL_RANKING[]`
- Crear función `buildDynamicRanking()` que combina:
  - `MODEL_RANKING` estático (providers nativos)
  - Modelos OpenRouter dinámicos convertidos a `ModelRank` con scoring heurístico basado en pricing, context_length, y categoría
- `suggestModel()` y `suggestModels()` usan el ranking combinado

### E.5 — Refactorizar `agent-presets.ts`

- `PRESET_FREE`, `PRESET_OPTIMIZED`, `PRESET_BALANCED` mantienen IDs estáticos como default
- Crear función `validatePreset(preset, availableModels)` que verifica cada modelo del preset contra la API
- Si un modelo no existe → buscar alternativa por categoría/precio similar
- Esta validación se ejecuta cuando el usuario aplica un preset

### E.6 — Frontend: reemplazar listas hardcoded

**Archivos afectados:**

- `apps/web/src/containers/settings/openrouter-primary-tab.tsx` — eliminar `OPENROUTER_MODELS` hardcoded, usar hook
- `apps/web/src/components/config/constants.tsx` — eliminar array hardcoded
- `apps/web/src/components/onboarding/types.ts` — eliminar array hardcoded
- `apps/web/src/pages/dashboard/settings.tsx` — eliminar array hardcoded
- `apps/web/src/pages/dashboard/settings/llms.tsx` — eliminar array hardcoded

**Nuevo hook:** `apps/web/src/hooks/use-openrouter-models.ts`

```typescript
export function useOpenRouterModels(filter?: {
  category?: string;
  freeOnly?: boolean;
}) {
  return useQuery({
    queryKey: ['openrouter-models', filter],
    queryFn: () => api.get('/openrouter/models', { params: filter }),
    staleTime: 15 * 60 * 1000, // match server cache
  });
}
```

### E.7 — Refactorizar `fetchOpenRouter` en `LLMModelsService`

`apps/api/src/llm/llm-models.service.ts` → `fetchOpenRouter()` ya hace fetch directo con axios. Refactorizar para usar `OpenRouterModelsService` de `libs/openrouter` en vez de duplicar lógica.

### E.8 — Tests

- Test `OpenRouterModelsService`: mock de SDK, cache hit/miss, filtros
- Test endpoint `GET /openrouter/models`: response shape
- Test `suggestModel` con ranking dinámico
- Test `validatePreset` con modelos faltantes

**Verificación Fase E:**

```bash
pnpm nx test api
pnpm nx build api
pnpm nx build web
```

---

## Criterios de aceptación

### Toggle Admin (core)

- [x] Modelo `PlatformLLMProvider` creado con migración y seed
- [x] Admin puede ver tabla con estado de todos los providers en `/admin/llm-providers`
- [x] Admin puede toggle on/off cada provider con confirmación
- [x] Al desactivar: AgentConfigs limpiados, notificaciones enviadas, AdminAction registrada
- [x] `setLLMKey` rechaza providers desactivados con 400
- [x] Endpoints LLM-dependientes rechazan providers desactivados con 409
- [x] Frontend intercepta 409 y redirige a settings/llms
- [x] Cards de providers inactivos aparecen disabled en settings/llms del usuario
- [x] Agentes con provider inactivo muestran badge de atención

### Fixes Pipeline LLM (P1-P4)

- [x] P1: `llmApiKey` eliminado de `TradingProcessor` (código muerto removido)
- [x] P2: `TradingProcessor` usa `checkHealth(userId)` en vez de `findFirst({ isActive: true })`
- [x] P3: `resolveLLMForNews()` eliminado de `MarketService`
- [x] P4: `SubAgentService.getProvider()` valida provider activo vía `assertProviderActive()`

### Persistencia sentimiento A2→DB

- [x] `orchestrateDecision` persiste el sentimiento en `NewsAnalysis` cuando no es cache
- [x] `NewsAnalysis.aiAnalyzedAt` refleja la fecha del análisis trading

### TTL análisis noticias C1

- [x] `analyzeSentiment` verifica `aiAnalyzedAt` vs `intervalMinutes` antes de llamar al LLM
- [x] Si el análisis es reciente (trading A2 o manual), retorna el existente sin nueva llamada

### Chat visual B2

- [x] Evento SSE de routing incluye `provider` y `model`
- [x] `useChatAgent` propaga `provider`/`model` del routing event
- [x] `AgentHeader` muestra provider/model inmediatamente al cambio de agente

### Modelos OpenRouter dinámicos (Fase E)

- [x] Lib `libs/openrouter` creada con `OpenRouterModelsService` y tipos
- [x] `@openrouter/sdk` instalado en workspace
- [x] Endpoint `GET /openrouter/models` funcional con cache 15min
- [x] `model-pricing.ts` sin entradas hardcoded de OpenRouter
- [x] `model-ranking.ts` sin entradas estáticas de OpenRouter, usa ranking dinámico
- [x] `agent-presets.ts` tiene validación de disponibilidad de modelos (`buildDynamicPreset` + `resolveFallbackModel`)
- [x] Frontend: `OPENROUTER_MODELS` eliminado de todos los archivos
- [x] Frontend: hook `useOpenRouterModels` consume endpoint dinámico
- [x] `fetchOpenRouter` en `LLMModelsService` usa lib compartida
- [x] Tests unitarios del servicio de modelos

### Mejoras UX adicionales (Fase F — v4.0)

- [x] SIGMA conclusion bug fix (`effectiveSigma` en news-sentiment-panel y analysis-summary-card)
- [x] Agent decision model display (`llmProvider`/`llmModel` en DecisionPayload, trading.processor, analytics.service)
- [x] Vertical tabs layout en settings/agents y admin/agent-models
- [x] Select auto dropdown direction (up/down)
- [x] Model name truncation en Select
- [x] Responsive filters en OpenRouterModelSelect
- [x] Equal height cards + full-width provider selector
- [x] ESLint config fix (package.json ignores)

### General

- [x] Traducciones completas en.ts + es.ts
- [x] Build api + web pasan sin errores
- [x] Tests unitarios del service pasan (16 suites, 135 tests)
- [x] Lint pasa en todos los proyectos (10/10, 0 errores)
- [x] Todos los procesos LLM usan `AgentConfigResolver` (ver tabla normativa en spec)

---

## Cierre de branch

```bash
# 1. Push
git push origin feature/llm-provider-toggle

# 2. PR
gh pr create \
  --base main \
  --head feature/llm-provider-toggle \
  --title "feat: Toggle global de proveedores LLM + hardening pipeline — Spec 38" \
  --body "## Spec 38 — Toggle Global de Proveedores LLM + Hardening LLM Pipeline (v4.0)

### Cambios principales
- Nuevo modelo PlatformLLMProvider con seed
- API admin: GET/PUT /admin/llm-providers
- API user: GET /llm-providers/status
- Validación en setLLMKey + endpoints LLM
- Panel admin con DataTable + toggle + confirmación
- Cards deshabilitadas en settings/llms usuario
- Badge atención en settings/agents
- Interceptor 409 → redirect
- Notificaciones push al desactivar provider

### Fixes Pipeline LLM
- P1: Eliminado llmApiKey muerto en TradingProcessor
- P2: TradingProcessor usa checkHealth agent-aware
- P3: Eliminado resolveLLMForNews legacy en MarketService
- P4: SubAgentService.getProvider valida provider activo

### Mejoras Pipeline
- A2→DB: Sentimiento trading persistido en NewsAnalysis
- C1 TTL: analyzeSentiment respeta intervalMinutes del usuario
- B2 visual: Evento SSE routing incluye provider/model para AgentHeader

### Modelos OpenRouter dinámicos (Fase E)
- Nueva lib libs/openrouter con OpenRouterModelsService + cache 15min
- Endpoint GET /openrouter/models con filtros
- Eliminadas todas las entradas hardcoded de OpenRouter en model-pricing/ranking
- agent-presets con validación dinámica de disponibilidad de modelos
- Frontend: useOpenRouterModels hook, OPENROUTER_MODELS eliminado

### Mejoras UX adicionales (Fase F — v4.0)
- SIGMA conclusion bug fix (effectiveSigma derivado de AI analysis)
- Agent decision model display (llmProvider/llmModel en metadata)
- Vertical tabs layout en settings/agents y admin/agent-models
- Select auto dropdown direction + model name truncation
- Responsive filters en OpenRouterModelSelect
- ESLint config fix (package.json ignores)

### i18n
- Traducciones en/es completas (incluye agents.agentSwitched)

### Testing
- 16 suites, 135 tests — todos pasan
- Lint 10/10 proyectos — 0 errores
- Build api ✅ + Build web ✅

Closes #XX"

# 3. Actualizar branch plan
# Editar docs/plans/crypto-trader-branch-plan.md — marcar Spec 38 como merged
# Actualizar docs/CONSTITUTION.md si hay cambios en stack/modelos/convenciones
```
