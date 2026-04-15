# Plan 33 — Bugfix Batch: UX & Data Integrity

**Spec:** `docs/specs/branches/33-bugfix-batch-ux-data.md` (v1.0)  
**Branch:** `feature/33-bugfix-batch-ux-data`  
**Estado:** Pendiente  
**Depende de:** Spec 31, 32, 28  
**Fecha:** 2026-04-15

---

## Estado inicial requerido

- Branch `feature/llm-provider-dashboard` actualizada (base de trabajo)
- PostgreSQL + Redis corriendo (`docker compose up -d`)
- `pnpm install` sin errores
- Prisma client generado (`pnpm nx run api:prisma-generate`)

---

## Fase A — Backend fixes (B4, B3-backend, B9-backend)

### A.1 — B4: Agregar campos LLM al `createConfig`

**Contexto:** `trading.service.ts` método `createConfig()` líneas ~166-183 crea un `tradingConfig` pero omite `primaryProvider`, `primaryModel`, `fallbackProvider`, `fallbackModel`. El DTO `CreateTradingConfigDto` ya los tiene (líneas 215-235). El `updateConfig()` usa `...dto` as any y sí los pasa.

**Cambios:**

1. **`apps/api/src/trading/trading.service.ts`** — método `createConfig`, dentro del `prisma.tradingConfig.create({ data: {...} })`:
   ```typescript
   // Agregar después de `orderPriceOffsetPct`:
   primaryProvider: dto.primaryProvider ?? null,
   primaryModel: dto.primaryModel ?? null,
   fallbackProvider: dto.fallbackProvider ?? null,
   fallbackModel: dto.fallbackModel ?? null,
   riskProfile: dto.riskProfile ?? ('MODERATE' as any),
   ```

**Verificación:**

```bash
pnpm nx run api:build
# Test manual: POST /trading/config con primaryProvider + primaryModel → confirmar que respuesta los incluye
```

---

### A.2 — B3-backend: Endpoint para inicializar sandbox wallet con capital custom

**Contexto:** `trading.processor.ts` línea ~628 hace `upsert` con `create: { balance: 10_000 }` hardcodeado. El onboarding no tiene forma de enviar capital customizado.

**Cambios:**

1. **`apps/api/src/trading/trading.service.ts`** — nuevo método:

   ```typescript
   async initSandboxWallets(
     userId: string,
     capitalUsdt: number = 10_000,
     capitalUsdc: number = 10_000,
   ) {
     await this.prisma.sandboxWallet.upsert({
       where: { userId_currency: { userId, currency: 'USDT' } },
       create: { userId, currency: 'USDT', balance: capitalUsdt },
       update: { balance: capitalUsdt },
     });
     await this.prisma.sandboxWallet.upsert({
       where: { userId_currency: { userId, currency: 'USDC' } },
       create: { userId, currency: 'USDC', balance: capitalUsdc },
       update: { balance: capitalUsdc },
     });
   }
   ```

2. **`apps/api/src/trading/trading.controller.ts`** — nuevo endpoint:

   ```typescript
   @Post('sandbox-wallet/init')
   @UseGuards(JwtAuthGuard)
   async initSandboxWallet(
     @GetUser() user: JwtPayload,
     @Body() body: { capitalUsdt?: number; capitalUsdc?: number },
   ) {
     return this.tradingService.initSandboxWallets(
       user.userId,
       body.capitalUsdt ?? 10_000,
       body.capitalUsdc ?? 10_000,
     );
   }
   ```

3. **`apps/api/src/trading/trading.processor.ts`** — línea ~628: Cambiar el `create` del upsert para que use un valor configurable. **Nota:** los wallets creados vía onboarding ya tendrán el valor correcto. El hardcode 10_000 queda como fallback para wallets que se crean automáticamente cuando un agente arranca sin wallet previo (comportamiento legacy aceptable).

**Verificación:**

```bash
pnpm nx run api:build
# Test manual: POST /trading/sandbox-wallet/init con { capitalUsdt: 5000, capitalUsdc: 8000 }
# → verificar en DB que las wallets tengan los balances correctos
```

---

### A.3 — B9-backend: Verificar persistencia LLM en news config

**Contexto:** `market.service.ts` método `updateNewsConfig()` ya acepta `primaryProvider`, `primaryModel`, `fallbackProvider`, `fallbackModel` en el tipo de `data`. El modelo Prisma `NewsConfig` ya tiene estos campos (schema líneas 330-335). **El backend parece correcto.**

**Cambios:**

1. **Verificar** que `market.controller.ts` no filtra los campos LLM del body antes de pasarlos al service. Leer el controlador.

2. **Si el problema es frontend** (Fase C), el fix principal será el sync de `useState` con el `config` asíncrono en `NewsConfigPanel`.

**Verificación:**

```bash
# Test manual: PUT /market/news/config con { primaryProvider: "OPENAI", primaryModel: "gpt-4o" }
# → GET /market/news/config → confirmar que devuelve los campos
```

---

## Fase B — Frontend fixes críticos (B1, B7, B3-frontend)

### B.1 — B1: Condicionar ChatWidget a autenticación

**Contexto:** `app.tsx` línea 63 monta `<ChatWidget />` globalmente, antes de las rutas. No hay check de auth.

**Cambios:**

1. **`apps/web/src/app/app.tsx`** — envolver `ChatWidget` en condición de auth:

   ```tsx
   // Opción: crear wrapper inline
   function AuthenticatedChatWidget() {
     const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
     if (!isAuthenticated) return null;
     return <ChatWidget />;
   }

   // En App():
   <AuthenticatedChatWidget />; // en lugar de <ChatWidget />
   ```

**Alternativa más simple:** Mover el check dentro de `ChatWidget` al inicio:

```tsx
// chat-widget.tsx — al inicio de ChatWidget():
const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
if (!isAuthenticated) return null;
```

**Preferir la alternativa simple** (menos cambios, self-contained en el widget).

**Verificación:**

```bash
pnpm nx run web:build
# Manual: ir a / → NO debe aparecer FAB
# Manual: login → ir a /dashboard → SÍ debe aparecer FAB
```

---

### B.2 — B7: Guards en queries de chat + welcome screen

**Contexto:** `useChatSession` ya tiene `enabled: isAuthenticated && !!sessionId`. Pero `chat.store.ts` persiste `activeSessionId` en localStorage. Si la sesión fue eliminada, el ID es stale y genera 404.

**Cambios:**

1. **`apps/web/src/hooks/use-chat.ts`** — `useChatSession`: agregar manejo de error 404 para limpiar el sessionId stale:

   ```typescript
   export function useChatSession(sessionId: string | null) {
     const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
     const { setActiveSession } = useChatStore.getState();
     return useQuery<ChatSessionWithMessages>({
       queryKey: chatKeys.session(sessionId ?? ''),
       queryFn: () => api.get(`/chat/sessions/${sessionId}`),
       staleTime: 0,
       enabled: isAuthenticated && !!sessionId,
       retry: (failureCount, error) => {
         // Don't retry on 404 — session was deleted
         if (
           (error as any)?.statusCode === 404 ||
           (error as any)?.status === 404
         ) {
           setActiveSession(null);
           return false;
         }
         return failureCount < 2;
       },
     });
   }
   ```

2. **`apps/web/src/components/chat/chat-widget.tsx`** — agregar welcome screen cuando no hay `activeSessionId` o no hay LLM keys:

   ```tsx
   // Dentro del overlay, si !activeSessionId:
   // Mostrar un mini welcome con:
   // - Logo KRYPTO + "¡Hola! Soy KRYPTO, tu asistente de trading."
   // - Botón "Nueva conversación" que abre el modal NewSessionModal
   // - Si no hay llmKeys activas: mensaje "Configura un proveedor LLM en Ajustes"
   ```

3. **`apps/web/src/components/chat/chat-widget.tsx`** — importar `useLLMKeys` y verificar si hay keys activas para mostrar mensaje apropiado.

**Verificación:**

```bash
pnpm nx run web:build
# Manual: borrar localStorage 'chat:activeSessionId' → abrir chat → NO 404s en Network
# Manual: sin LLM keys → abrir chat → ver welcome con link a settings
```

---

### B.3 — B3-frontend: Input USDC + envío de capital inicial

**Contexto:** `onboarding.tsx` — `StepMode` muestra solo un input de capital con label `initialCapitalSandbox`. `handleFinish()` no envía el valor. El state tiene `initialCapital: '1000'`.

**Cambios:**

1. **`apps/web/src/pages/onboarding.tsx`** — `OnboardingState`: agregar campo:

   ```typescript
   initialCapitalUsdc: string; // default '10000'
   ```

2. **`apps/web/src/pages/onboarding.tsx`** — `StepMode`: dentro del bloque `state.mode === 'SANDBOX'`, agregar segundo input para USDC:

   ```tsx
   {state.mode === 'SANDBOX' && (
     <div className="space-y-3">
       <div>
         <label>Capital inicial USDT</label>
         <input value={state.initialCapital} onChange={...} />
       </div>
       <div>
         <label>Capital inicial USDC</label>
         <input value={state.initialCapitalUsdc} onChange={...} />
       </div>
     </div>
   )}
   ```

3. **`apps/web/src/pages/onboarding.tsx`** — `handleFinish()`: después de crear config, si modo es SANDBOX, llamar al nuevo endpoint:
   ```typescript
   if (state.mode === 'SANDBOX') {
     await api
       .post('/trading/sandbox-wallet/init', {
         capitalUsdt: Number(state.initialCapital) || 10_000,
         capitalUsdc: Number(state.initialCapitalUsdc) || 10_000,
       })
       .catch(() => null); // Non-blocking
   }
   ```

**Verificación:**

```bash
pnpm nx run web:build
# Manual: ir a onboarding → paso 3 modo SANDBOX → ver 2 inputs (USDT, USDC)
# Manual: cambiar a TESTNET → inputs desaparecen
# Manual: completar onboarding → verificar en DB que wallets tienen los valores elegidos
```

---

## Fase C — Frontend fixes UX (B2, B5, B8, B9-frontend)

### C.1 — B2: Refactorizar state de API keys en onboarding

**Contexto:** `onboarding.tsx` — `OnboardingState` tiene `llmApiKey: string` y `llmModel: string` compartidos. `StepLLM` usa un solo input.

**Cambios:**

1. **`apps/web/src/pages/onboarding.tsx`** — tipo `OnboardingState`:

   ```typescript
   // Reemplazar:
   llmApiKey: string;
   llmModel: string;
   // Por:
   llmApiKeys: Record<string, string>; // { CLAUDE: 'sk-...', OPENAI: 'sk-...', ... }
   llmModels: Record<string, string>; // { CLAUDE: 'claude-3-5-sonnet-...', ... }
   ```

2. **Estado inicial** en `OnboardingPage`:

   ```typescript
   llmApiKeys: {},
   llmModels: {},
   ```

3. **`StepLLM`** — cambiar input para leer/escribir del Record:

   ```tsx
   <PasswordInput
     value={state.llmApiKeys[state.llmProvider] ?? ''}
     onChange={(e) =>
       onChange({
         llmApiKeys: {
           ...state.llmApiKeys,
           [state.llmProvider]: e.target.value,
         },
       })
     }
   />
   ```

4. **Al click de proveedor**, setear también el modelo default:

   ```tsx
   onClick={() =>
     onChange({
       llmProvider: p.value,
       llmModels: {
         ...state.llmModels,
         [p.value]: state.llmModels[p.value] || p.models[0],
       },
     })
   }
   ```

5. **`canNext()`** — paso 1: verificar que al menos una key tiene valor:

   ```typescript
   if (step === 1)
     return Object.values(state.llmApiKeys).some((k) => k.length > 0);
   ```

6. **`handleFinish()`** — iterar sobre las keys:
   ```typescript
   // Reemplazar: await api.post('/users/me/llm-keys', { provider, apiKey, selectedModel })
   // Por:
   const keysToSave = Object.entries(state.llmApiKeys).filter(
     ([, key]) => key.length > 0,
   );
   for (const [provider, apiKey] of keysToSave) {
     await api.post('/users/me/llm-keys', {
       provider,
       apiKey,
       selectedModel: state.llmModels[provider] || undefined,
     });
   }
   ```

**Verificación:**

```bash
pnpm nx run web:build
# Manual: onboarding paso 2 → escribir key Claude → cambiar a OpenAI → escribir key OpenAI
# → cambiar de vuelta a Claude → key de Claude sigue ahí
# → completar onboarding → verificar en DB que ambas keys se guardaron
```

---

### C.2 — B5: Filtrar selector de modelo por proveedores activos

**Contexto:** `settings.tsx` línea ~825 renderiza `<DynamicModelSelect>` para cada proveedor. Línea ~872 ya tiene un check de `status?.isActive` para mostrar un bloque de provider status.

**Cambios:**

1. **`apps/web/src/pages/dashboard/settings.tsx`** — envolver el bloque del `<DynamicModelSelect>` con el guard `isActive`:
   ```tsx
   {/* Solo mostrar selector de modelo si el proveedor está activo */}
   {status?.isActive ? (
     <div>
       <label className="mb-1 block text-xs font-medium">
         {t('settings.model')}
       </label>
       <DynamicModelSelect ... />
     </div>
   ) : (
     <div className="text-xs text-muted-foreground italic mt-2">
       {t('settings.activateProviderFirst', {
         defaultValue: 'Configura y guarda tu API key para seleccionar un modelo',
       })}
     </div>
   )}
   ```

**Verificación:**

```bash
pnpm nx run web:build
# Manual: settings → Modelos IA → proveedor sin key → NO se muestra selector de modelo
# → proveedor con key activa → SÍ se muestra selector
```

---

### C.3 — B8: Indicador visual de análisis IA en bot-analysis

**Contexto:** `bot-analysis.tsx` usa `useNewsConfig()` (línea 1946) y `useNewsAnalysis()`. Ya tiene la variable `pageHasAi` que indica si hay análisis IA reciente.

**Cambios:**

1. **`apps/web/src/pages/dashboard/bot-analysis.tsx`** — en la sección "SENTIMIENTO DE NOTICIAS", agregar badge condicional:

   ```tsx
   {
     /* Junto al título de la sección */
   }
   {
     pageNewsConfig?.botEnabled && (
       <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
         <Sparkles className="h-3 w-3" />
         {t('botAnalysis.aiAnalysisActive', {
           defaultValue: 'Análisis IA activo',
         })}
       </span>
     );
   }
   ```

2. En la sección "ENTRADAS DEL AGENTE" → card "NOTICIAS", agregar línea:
   ```tsx
   {
     /* Mostrar si usó IA */
   }
   <div className="flex items-center gap-1.5">
     <span className="text-[11px] text-muted-foreground">
       {t('botAnalysis.inputNewsBot', { defaultValue: 'Bot usa noticias' })}
     </span>
     {pageNewsConfig?.botEnabled ? (
       <span className="text-[11px] font-semibold text-emerald-400">
         ✓ {t('botAnalysis.inputNewsAiActive', { defaultValue: 'Activo' })}
         {pageNewsConfig?.newsWeight
           ? ` (peso ${pageNewsConfig.newsWeight}%)`
           : ''}
       </span>
     ) : (
       <span className="text-[11px] text-muted-foreground">
         ✗ {t('botAnalysis.inputNewsAiInactive', { defaultValue: 'Inactivo' })}
       </span>
     )}
   </div>;
   ```

**Verificación:**

```bash
pnpm nx run web:build
# Manual: activar botEnabled en settings → ir a bot-analysis → ver badge "Análisis IA activo"
# Manual: desactivar botEnabled → badge no aparece
```

---

### C.4 — B9-frontend: Sync de selectores LLM en news config

**Contexto:** `news-config-panel.tsx` inicializa `useState` con `config?.primaryProvider ?? ''`. Pero como `config` viene de una query asíncrona, en el primer render es `undefined` → se inicializa como `''` y nunca se actualiza.

**Cambios:**

1. **`apps/web/src/components/settings/news-config-panel.tsx`** — agregar `useEffect` para sincronizar cuando `config` carga:
   ```typescript
   useEffect(() => {
     if (config) {
       setInterval(config.intervalMinutes ?? 30);
       setCount(config.newsCount ?? 40);
       setSources(config.enabledSources ?? []);
       setOnlySummary(config.onlySummary ?? true);
       setBotEnabled(config.botEnabled ?? true);
       setNewsWeight(config.newsWeight ?? 15);
       setPrimaryProvider(config.primaryProvider ?? '');
       setPrimaryModel(config.primaryModel ?? '');
       setFallbackProvider(config.fallbackProvider ?? '');
       setFallbackModel(config.fallbackModel ?? '');
     }
   }, [config]);
   ```

**Verificación:**

```bash
pnpm nx run web:build
# Manual: guardar news config con proveedor → recargar página → selectores muestran el valor guardado
```

---

## Fase D — Feature menor (B6)

### D.1 — B6: Switch modelos recomendados vs todos

**Cambios:**

1. **`apps/web/src/components/settings/dynamic-model-select.tsx`** — agregar prop `showRecommendedToggle?: boolean` y estado local:

   ```typescript
   const RECOMMENDED_MODELS: Record<string, string[]> = {
     CLAUDE: [
       'claude-sonnet-4-20250514',
       'claude-3-5-sonnet-20241022',
       'claude-opus-4-5',
     ],
     OPENAI: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
     GROQ: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
     GEMINI: ['gemini-2.5-flash', 'gemini-2.5-pro'],
     MISTRAL: [
       'mistral-small-latest',
       'mistral-medium-latest',
       'mistral-large-latest',
     ],
     TOGETHER: [
       'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
       'meta-llama/Llama-3.3-70B-Instruct-Turbo',
     ],
   };
   ```

2. **Agregar state local:**

   ```typescript
   const [showAll, setShowAll] = useState(false);
   ```

3. **UI del toggle:** al lado del label "Modelo":

   ```tsx
   <div className="flex items-center gap-2">
     <label className="text-xs font-medium">Modelo</label>
     <button
       onClick={() => setShowAll(!showAll)}
       className={cn(
         'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
         showAll
           ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
           : 'bg-primary/10 border-primary/30 text-primary',
       )}
     >
       {showAll ? 'Todos' : 'Recomendados'}
     </button>
   </div>
   ```

4. **Filtrar modelos:** en la lista del select, filtrar si `!showAll`:

   ```typescript
   const filteredModels = showAll
     ? allModels
     : allModels.filter((m) =>
         (RECOMMENDED_MODELS[provider] ?? []).includes(m.id),
       );
   ```

5. **Advertencia** cuando `showAll`:
   ```tsx
   {
     showAll && (
       <p className="text-[10px] text-amber-400 mt-1">
         ⚠️ Algunos modelos no están optimizados para análisis financiero
       </p>
     );
   }
   ```

**Verificación:**

```bash
pnpm nx run web:build
# Manual: settings → Modelos IA → toggle "Recomendados" → lista corta
# → toggle "Todos" → lista completa con advertencia
```

---

## Verificación final

```bash
# Build completo
pnpm nx run api:build
pnpm nx run web:build

# Lint
pnpm nx run api:lint
pnpm nx run web:lint

# Tests existentes no rotos
pnpm nx run api:test
pnpm nx run web:test
```

---

## Criterios de aceptación globales

- [ ] **B1:** Chat FAB invisible en rutas públicas, visible en `/dashboard/*`
- [ ] **B2:** API keys independientes por proveedor en onboarding, se guardan todas al finalizar
- [ ] **B3:** Capital USDT/USDC customizable en sandbox desde onboarding, inputs ocultos en otros modos
- [ ] **B4:** `createConfig` persiste los 4 campos LLM en igualdad con `updateConfig`
- [ ] **B5:** Selector de modelo solo para proveedores activos
- [ ] **B6:** Switch recomendados/todos con advertencia visual
- [ ] **B7:** Chat sin 404s, welcome screen sin sesiones, mensaje si no hay LLM keys
- [ ] **B8:** Badge "Análisis IA activo" visible cuando botEnabled está activado
- [ ] **B9:** Selectores de proveedor/modelo LLM en news config persisten y se sincronizan al cargar

---

## Cierre de branch

```bash
git add -A && git commit -m "fix: batch UX & data integrity fixes — Spec 33 Phases A-D"
git push origin feature/33-bugfix-batch-ux-data

gh pr create \
  --base feature/llm-provider-dashboard \
  --head feature/33-bugfix-batch-ux-data \
  --title "fix: Bugfix Batch UX & Data Integrity (Spec 33)" \
  --body "## Spec 33 — Bugfix Batch: UX & Data Integrity

### Bugs fixed
- **B1:** Chat widget solo visible para usuarios autenticados
- **B2:** API keys independientes por proveedor en onboarding
- **B3:** Capital inicial USDT/USDC configurable en sandbox onboarding
- **B4:** createConfig persiste primaryProvider/Model + fallback
- **B5:** Selector de modelo solo para proveedores activos
- **B6:** Switch modelos recomendados vs todos
- **B7:** Chat sin 404s + welcome screen
- **B8:** Indicador de análisis IA en bot-analysis
- **B9:** Sync de LLM provider en news config

### Spec & Plan
- Spec: docs/specs/branches/33-bugfix-batch-ux-data.md
- Plan: docs/plans/33-bugfix-batch-ux-data.md

### Testing
- [x] pnpm nx run api:build ✅
- [x] pnpm nx run web:build ✅
- [x] Manual verification of all 9 bugs"
```

Actualizar `docs/plans/crypto-trader-branch-plan.md` con estado completado.
