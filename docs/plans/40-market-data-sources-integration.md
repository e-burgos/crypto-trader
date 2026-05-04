# Plan 40 — Market Data Sources Integration

**Spec:** `docs/specs/branches/40-market-data-sources-integration.md`  
**Branch:** `feature/market-data-sources`  
**Base:** `main`  
**Dependencias:** Spec 21 (market-module) debe estar merged.

---

## Estado inicial requerido

- [ ] Branch `feature/market-data-sources` creada desde `main`
- [ ] `MarketService` existente en `apps/api/src/market/`
- [ ] Panel admin funcional en `apps/web/src/pages/admin/`
- [ ] `libs/data-fetcher` existente con `BinanceRestClient`
- [ ] Sidebar admin con navegación existente

---

## Fase A — Infraestructura base

### A1. Modelo Prisma + migración

**Archivos:**

- `apps/api/prisma/schema.prisma` — agregar `DataSourceConfig` + `DataSourceCategory`
- Nueva migración

**Acciones:**

```bash
# Agregar modelo en schema.prisma
# Ejecutar migración
pnpm nx run api:prisma-migrate --name=add-data-source-config
```

### A2. Tipos compartidos

**Archivos:**

- `libs/shared/src/types/market-data-sources.ts` (nuevo)
- `libs/shared/src/index.ts` — re-export

**Contenido:** Todos los tipos de la sección 3.2 de la spec (EnrichedMarketSnapshot, FearGreedData, DerivativesData, etc.)

### A3. Interfaz IDataSourceProvider

**Archivos:**

- `libs/data-fetcher/src/providers/data-source.interface.ts` (nuevo)
- `libs/data-fetcher/src/index.ts` — re-export

### A4. DataSourceRegistryService

**Archivos:**

- `apps/api/src/market/data-source-registry.service.ts` (nuevo)
- `apps/api/src/market/market.module.ts` — register provider

**Lógica:**

- `getActiveProviders(category?)` — retorna providers activos
- `getBestProvider(category)` — retorna el de mayor prioridad activo
- `toggleSource(id, active)` — activa/desactiva + audit log
- `reportSuccess(name, latencyMs)` — actualiza lastSuccessAt
- `reportError(name, error)` — incrementa consecutiveErrors
- `getHealth()` — retorna estado de todas las fuentes

### A5. Controller admin

**Archivos:**

- `apps/api/src/admin/data-sources.controller.ts` (nuevo)
- `apps/api/src/admin/admin.module.ts` — agregar controller

**Endpoints:** GET list, PATCH toggle, PATCH update, GET health, POST health-all, GET stats.

### A6. Seed de fuentes pre-configuradas

**Archivos:**

- `apps/api/prisma/seed.ts` — agregar seed de 9 `DataSourceConfig`

**Datos del seed:**

```typescript
const sources = [
  {
    name: 'alternative_me',
    displayName: 'Alternative.me — Fear & Greed Index',
    category: 'SENTIMENT',
    targetAgents: ['SIGMA', 'KRYPTO'],
    requiresApiKey: false,
    baseUrl: 'https://api.alternative.me',
    rateLimitPerMin: 100,
    monthlyCostUsd: 0,
  },
  {
    name: 'coinalyze',
    displayName: 'Coinalyze — Derivados Agregados',
    category: 'DERIVATIVES',
    targetAgents: ['AEGIS', 'SIGMA'],
    requiresApiKey: false,
    baseUrl: 'https://api.coinalyze.net',
    rateLimitPerMin: 40,
    monthlyCostUsd: 0,
  },
  {
    name: 'defillama',
    displayName: 'DefiLlama — TVL + Stablecoins + Fees',
    category: 'DEFI_ONCHAIN',
    targetAgents: ['AEGIS', 'SIGMA'],
    requiresApiKey: false,
    baseUrl: 'https://api.llama.fi',
    rateLimitPerMin: 60,
    monthlyCostUsd: 0,
  },
  {
    name: 'finnhub',
    displayName: 'Finnhub — Noticias + Sentimiento NLP',
    category: 'NEWS',
    targetAgents: ['SIGMA', 'CIPHER'],
    requiresApiKey: true,
    baseUrl: 'https://finnhub.io/api/v1',
    rateLimitPerMin: 60,
    monthlyCostUsd: 0,
  },
  {
    name: 'coingecko',
    displayName: 'CoinGecko — Market Data Global',
    category: 'MARKET_DATA',
    targetAgents: ['SIGMA', 'KRYPTO'],
    requiresApiKey: true,
    baseUrl: 'https://api.coingecko.com/api/v3',
    rateLimitPerMin: 30,
    monthlyCostUsd: 0,
  },
  {
    name: 'polymarket',
    displayName: 'Polymarket — Prediction Markets',
    category: 'PREDICTION',
    targetAgents: ['SIGMA', 'CIPHER'],
    requiresApiKey: false,
    baseUrl: 'https://gamma-api.polymarket.com',
    rateLimitPerMin: 60,
    monthlyCostUsd: 0,
  },
  {
    name: 'messari',
    displayName: 'Messari — Token Unlocks',
    category: 'TOKEN_UNLOCKS',
    targetAgents: ['AEGIS', 'CIPHER'],
    requiresApiKey: true,
    baseUrl: 'https://api.messari.io',
    rateLimitPerMin: 20,
    monthlyCostUsd: 0,
  },
  {
    name: 'altfins',
    displayName: 'altFINS — TA Pre-calculado + Señales',
    category: 'TECHNICAL',
    targetAgents: ['SIGMA', 'KRYPTO'],
    requiresApiKey: true,
    baseUrl: 'https://platform.altfins.com/api',
    rateLimitPerMin: 30,
    monthlyCostUsd: 0,
  },
];
```

### A7. Extender MarketService

**Archivos:**

- `apps/api/src/market/market.service.ts` — agregar método `buildEnrichedSnapshot()`

**Lógica:**

- Llama a los providers activos en paralelo (`Promise.allSettled`)
- Construye `EnrichedMarketSnapshot` con los datos disponibles
- Campos no disponibles quedan como `null`
- Mide tiempo total y registra en `snapshotBuildTimeMs`

### A8. Página admin frontend

**Archivos:**

- `apps/web/src/pages/admin/data-sources.tsx` (nuevo)
- `apps/web/src/components/admin/DataSourceCard.tsx` (nuevo)
- `apps/web/src/components/admin/DataSourceHealthBadge.tsx` (nuevo)
- Router admin — agregar ruta `/admin/data-sources`
- Sidebar — agregar item de navegación

### A9. Tests unitarios

**Archivos:**

- `apps/api/src/market/data-source-registry.service.spec.ts`
- `apps/api/src/admin/data-sources.controller.spec.ts`

### A10. Verificación Fase A

```bash
pnpm nx run api:lint
pnpm nx run api:test
pnpm nx run web:lint
pnpm nx run web:build
```

---

## Fase B — Integraciones gratuitas prioritarias

### B1. AlternativeMeProvider

**Archivos:**

- `libs/data-fetcher/src/providers/alternative-me.provider.ts` (nuevo)
- `libs/data-fetcher/src/providers/alternative-me.provider.spec.ts` (nuevo)

**Implementación:**

```typescript
// GET https://api.alternative.me/fng/?limit=2
// Response: { data: [{ value: "47", value_classification: "Neutral", timestamp: "..." }] }
```

**Frecuencia de polling:** Cada 30 min (el índice se actualiza cada hora).

### B2. CoinalyzeProvider

**Archivos:**

- `libs/data-fetcher/src/providers/coinalyze.provider.ts` (nuevo)
- `libs/data-fetcher/src/providers/coinalyze.provider.spec.ts` (nuevo)

**Endpoints a consumir:**

- Open Interest agregado
- Funding Rate promedio
- Liquidaciones 24h
- Long/Short Ratio

**Frecuencia de polling:** Cada 15 min.

### B3. DefiLlamaProvider

**Archivos:**

- `libs/data-fetcher/src/providers/defillama.provider.ts` (nuevo)
- `libs/data-fetcher/src/providers/defillama.provider.spec.ts` (nuevo)

**Endpoints a consumir:**

- `GET /v2/historicalChainTvl` (TVL global)
- `GET /stablecoins` (mcap stablecoins)
- `GET /overview/fees` (fees/revenue)

**SDK opcional:** `@defillama/api` (evaluar si es más limpio que HTTP directo).

**Frecuencia de polling:** Cada 1 hora.

### B4. FinnhubProvider

**Archivos:**

- `libs/data-fetcher/src/providers/finnhub.provider.ts` (nuevo)
- `libs/data-fetcher/src/providers/finnhub.provider.spec.ts` (nuevo)

**Endpoints a consumir:**

- `GET /news?category=crypto&token={key}` (noticias crypto)
- Response incluye `sentiment` field pre-calculado

**Env var:** `FINNHUB_API_KEY`

**Frecuencia de polling:** Cada 10 min.

### B5. Activar por defecto + integrar en snapshot

**Archivos:**

- `apps/api/prisma/seed.ts` — marcar las 4 fuentes como `isActive: true`
- `apps/api/src/market/market.service.ts` — usar `buildEnrichedSnapshot()` en el ciclo de trading

### B6. Tests de integración

**Archivos:**

- `apps/api/src/market/market.service.integration.spec.ts` — test con providers mockeados

### B7. Verificación Fase B

```bash
pnpm nx run-many --target=test --projects=api,data-fetcher
pnpm nx run api:build
# Probar manualmente: activar fuentes en admin y verificar que el snapshot incluye datos
```

---

## Fase C — Integraciones secundarias

### C1. CoinGeckoProvider

**Archivos:**

- `libs/data-fetcher/src/providers/coingecko.provider.ts` (nuevo)
- `libs/data-fetcher/src/providers/coingecko.provider.spec.ts` (nuevo)

**Endpoints:**

- `GET /global` (market cap total, dominancia BTC/ETH)
- `GET /search/trending` (trending coins)
- `GET /coins/markets?order=market_cap_desc` (top gainers/losers)

**Env var:** `COINGECKO_API_KEY` (Demo plan, free)

**Frecuencia:** Cada 30 min.

### C2. PolymarketProvider

**Archivos:**

- `libs/data-fetcher/src/providers/polymarket.provider.ts` (nuevo)
- `libs/data-fetcher/src/providers/polymarket.provider.spec.ts` (nuevo)

**Endpoints:**

- REST API para listar mercados activos filtrados por tag "crypto" y "macro"
- Parsear probability, volume, question

**Frecuencia:** Cada 1 hora.

### C3. MessariProvider (condicional)

**Archivos:**

- `libs/data-fetcher/src/providers/messari.provider.ts` (nuevo)
- `libs/data-fetcher/src/providers/messari.provider.spec.ts` (nuevo)

**Pre-condición:** Verificar manualmente si el endpoint `https://api.messari.io/api/v1/assets/bitcoin/metrics` responde sin API key o con key gratuita.

- SI funciona → implementar provider completo
- NO funciona → implementar stub que retorna null + log warning

**Frecuencia:** Cada 6 horas.

### C4. AltFinsProvider (free tier)

**Archivos:**

- `libs/data-fetcher/src/providers/altfins.provider.ts` (nuevo)
- `libs/data-fetcher/src/providers/altfins.provider.spec.ts` (nuevo)

**Pre-condición:** Verificar endpoints del free tier y qué datos están disponibles.

**Fallback:** Si no está disponible, el snapshot usa `calculateIndicatorSnapshot()` existente.

### C5. Verificación Fase C

```bash
pnpm nx run-many --target=test --projects=api,data-fetcher,shared
pnpm nx run api:build
pnpm nx run web:build
```

---

## Fase D — Circuit breaker + observabilidad

### D1. Circuit breaker

**Archivos:**

- `apps/api/src/market/circuit-breaker.service.ts` (nuevo)

**Lógica:**

- 3 errores consecutivos en 5 min → estado OPEN (fuente degradada)
- En OPEN: no se llama al provider, se usa fallback/null
- Retry cada 5 min con una sola request (HALF_OPEN)
- Si retry exitoso → CLOSED (restaurado)
- Evento: emitir a WebSocket del admin

### D2. Notificaciones al admin

**Archivos:**

- `apps/api/src/admin/data-sources.gateway.ts` (nuevo, WebSocket)
- `apps/web/src/components/admin/DataSourceCard.tsx` — agregar indicador real-time

**Eventos:**

- `data-source:degraded` → { name, error, consecutiveErrors }
- `data-source:recovered` → { name, downDuration }

### D3. Rate limiter interno

**Archivos:**

- `libs/data-fetcher/src/providers/rate-limiter.ts` (nuevo)

**Lógica:** Token bucket por provider. Configurable desde `rateLimitPerMin` del DataSourceConfig.

### D4. Cache con TTL

**Archivos:**

- `apps/api/src/market/data-source-cache.service.ts` (nuevo)

**Lógica:**

- Cada provider cachea su última respuesta válida
- TTL configurable (default: 2x frecuencia de polling)
- Si provider falla y cache no expirado → usar cached data (stale-but-valid)

### D5. Métricas en admin dashboard

**Archivos:**

- `apps/web/src/pages/admin/data-sources.tsx` — agregar sección de métricas
- `apps/api/src/admin/data-sources.controller.ts` — endpoint GET /stats

**Métricas:**

- Calls 24h por provider
- Latencia promedio
- Error rate 24h
- Uptime porcentaje

### D6. Audit log

**Archivos:**

- `apps/api/src/admin/data-sources.controller.ts` — loguear todas las acciones en AdminAction existente

### D7. Verificación Fase D

```bash
pnpm nx run-many --target=test --projects=api,data-fetcher
pnpm nx run-many --target=lint --all
pnpm nx run-many --target=build --projects=api,web
```

---

## Fase E — Market Intelligence page (trader-facing)

### E1. Endpoint para traders

**Archivos:**

- `apps/api/src/market/market.controller.ts` — agregar `GET /market/enriched-snapshot/:symbol`

**Lógica:**

- Llama a `MarketService.buildEnrichedSnapshot(symbol)`
- Accesible por cualquier usuario autenticado (no requiere rol admin)
- Response: `EnrichedMarketSnapshot` serializado como JSON

### E2. Hook de datos

**Archivos:**

- `apps/web/src/hooks/use-enriched-snapshot.ts` (nuevo)

**Contenido:**

```typescript
export function useEnrichedSnapshot(symbol: string) {
  return useQuery<EnrichedMarketSnapshot>({
    queryKey: ['market', 'enriched-snapshot', symbol],
    queryFn: () => api.get(`/market/enriched-snapshot/${symbol}`),
    refetchInterval: 120_000, // 2 min auto-refresh
  });
}
```

### E3. Componentes de la página

**Directorio:** `apps/web/src/components/market-intelligence/`

| Componente              | Archivo                       | Datos que muestra                                        |
| ----------------------- | ----------------------------- | -------------------------------------------------------- |
| `FearGreedGauge`        | `fear-greed-gauge.tsx`        | Valor 0-100, clasificación, delta vs previo              |
| `DerivativesPanel`      | `derivatives-panel.tsx`       | OI, funding rate, L/S ratio, liquidaciones               |
| `DefiHealthPanel`       | `defi-health-panel.tsx`       | TVL global, cambio 24h/7d, stablecoin mcap               |
| `GlobalMarketPanel`     | `global-market-panel.tsx`     | Market cap, dominancia BTC/ETH, trending, gainers/losers |
| `NewsSentimentList`     | `news-sentiment-list.tsx`     | Noticias con sentiment score y label                     |
| `PredictionMarketsList` | `prediction-markets-list.tsx` | Mercados de predicción, probabilidad, volumen            |
| `TokenUnlocksTable`     | `token-unlocks-table.tsx`     | Próximos unlocks: símbolo, fecha, monto, tipo            |
| `AgentVerdictsBanner`   | `agent-verdicts-banner.tsx`   | Último veredicto por agente + consenso                   |
| barrel                  | `index.ts`                    | Re-export de todos los componentes                       |

Todos los componentes usan primitivos de `@crypto-trader/ui` (Card, Badge, Typography, StatCard, Spinner, EmptyState, etc.).

### E4. Página Market Intelligence

**Archivos:**

- `apps/web/src/pages/dashboard/market-intelligence.tsx` (nuevo)

**Layout:**

```
Header: "Market Intelligence" + symbol selector (Tabs) + refresh + timestamp

Row 1: [FearGreedGauge] [DerivativesPanel]
Row 2: [DefiHealthPanel] [GlobalMarketPanel]
Row 3: [NewsSentimentList] (full width)
Row 4: [PredictionMarketsList] [TokenUnlocksTable]
Row 5: [AgentVerdictsBanner] (full width)
```

Secciones ocultas si la fuente correspondiente retorna `null` (fuente desactivada o fallida).

### E5. Routing + navegación

**Archivos:**

- `apps/web/src/app/app.tsx` — agregar `<Route path="market-intelligence" element={<MarketIntelligencePage />} />`
- Sidebar dashboard — agregar item "Market Intelligence" con icono `Globe` después de "Bot Analysis"

### E6. Link desde bot-analysis

**Archivos:**

- `apps/web/src/pages/dashboard/bot-analysis.tsx` — agregar banner link debajo de `AgentInputSummary`

**Texto:** "Los agentes usaron N fuentes externas → Ver Market Intelligence"

### E7. i18n

**Archivos:**

- `apps/web/src/i18n/en.json` — sección `marketIntelligence`
- `apps/web/src/i18n/es.json` — sección `marketIntelligence`

### E8. Verificación Fase E

```bash
pnpm nx run web:lint
pnpm nx run web:build
pnpm nx run api:lint
pnpm nx run api:build
```

### E9. Tests

**Backend — endpoint test (Jest):**

- `apps/api/src/market/market.controller.spec.ts` — test del endpoint `GET /market/enriched-snapshot/:symbol`
  - Retorna 200 con `EnrichedMarketSnapshot` válido
  - Campos `null` cuando fuentes están desactivadas
  - Requiere autenticación (401 sin token)

**Frontend — component tests (Vitest):**

- `apps/web/src/components/market-intelligence/__tests__/fear-greed-gauge.spec.tsx`
- `apps/web/src/components/market-intelligence/__tests__/derivatives-panel.spec.tsx`
- `apps/web/src/components/market-intelligence/__tests__/defi-health-panel.spec.tsx`
- `apps/web/src/components/market-intelligence/__tests__/global-market-panel.spec.tsx`
- `apps/web/src/components/market-intelligence/__tests__/news-sentiment-list.spec.tsx`
- `apps/web/src/components/market-intelligence/__tests__/prediction-markets-list.spec.tsx`
- `apps/web/src/components/market-intelligence/__tests__/token-unlocks-table.spec.tsx`
- `apps/web/src/components/market-intelligence/__tests__/agent-verdicts-banner.spec.tsx`

Cada test verifica:

- Renderiza correctamente con datos válidos
- Muestra `EmptyState` o se oculta cuando data es `null`
- Formatea valores numéricos correctamente

**E2E — Playwright:**

- `e2e/market-intelligence.spec.ts`
  - Navega a `/dashboard/market-intelligence`
  - Verifica que la página carga sin errores
  - Verifica que el selector de símbolo funciona
  - Verifica que las secciones se muestran según fuentes activas
  - Verifica link desde `bot-analysis` → `market-intelligence`

**Verificación:**

```bash
pnpm nx run api:test -- --testPathPattern=market.controller
pnpm nx run web:test -- --testPathPattern=market-intelligence
pnpm nx run web-e2e:e2e -- --grep="market-intelligence"
```

---

## Fase F — Hardening, seguridad y pendientes

### F1. Validación Zod de respuestas externas

**Archivos:**

- `libs/providers/src/lib/schemas/` (nuevo directorio)
  - `fear-greed.schema.ts`
  - `derivatives.schema.ts`
  - `defi-health.schema.ts`
  - `news.schema.ts`
  - `global-market.schema.ts`
  - `predictions.schema.ts`
  - `token-unlocks.schema.ts`
  - `index.ts` (barrel)
- Cada provider (`.provider.ts`) — agregar `schema.parse()` después del `response.json()`

**Lógica:**

- Definir un schema Zod por cada tipo de payload (`FearGreedData`, `DerivativesData`, etc.)
- Parsear TODA respuesta de API externa con `schema.safeParse()` antes de usarla
- Si `safeParse` falla → throw con detalle del error (sin exponer datos sensibles)
- Tests: cada schema tiene test con datos válidos e inválidos

**Ref spec:** Sec 9 — "Todos los payloads de APIs externas se validan con schemas Zod antes de usarse"

### F2. Encriptación AES-256 de API keys

**Archivos:**

- `apps/api/src/common/encryption.service.ts` — reutilizar el servicio existente (usado para Binance keys)
- `apps/api/src/admin/data-sources.controller.ts` — encriptar al guardar, desencriptar al pasar a providers
- `apps/api/src/market/data-source-registry.service.ts` — desencriptar antes de `fetchFromProvider()`

**Lógica:**

- Al hacer `PATCH /admin/data-sources/:id` con `apiKeyEncrypted`, encriptar con AES-256-GCM
- En `fetchFromProvider()`, desencriptar la key del `DataSourceCredential` antes de pasarla al provider
- En `GET /admin/data-sources`, mostrar solo `***...últimos 4 chars` (nunca plaintext)
- Env var: reutilizar `BINANCE_KEY_ENCRYPTION_KEY` (o renombrar a `DATA_ENCRYPTION_KEY`)

**Ref spec:** Sec 9 — "API keys encriptadas con AES-256 en DB, desencriptadas solo en runtime"

### F3. Test de integración `buildEnrichedSnapshot`

**Archivos:**

- `apps/api/src/market/market.service.integration.spec.ts` (nuevo)

**Contenido:**

- Mock de todos los providers (inyectados vía `DataSourceRegistryService`)
- Test 1: todas las fuentes activas → snapshot completo con todos los campos
- Test 2: fuentes mixtas (algunas activas, otras no) → campos `null` para las inactivas
- Test 3: provider falla → campo correspondiente es `null`, los demás OK
- Test 4: todas fallan → snapshot con solo `symbol`, `currentPrice`, todos los external data `null`
- Verificar que `activeSources` y `failedSources` se reportan correctamente

**Ref plan:** B6

### F4. E2E test del flujo admin + snapshot

**Archivos:**

- `e2e/data-sources-admin.spec.ts` (nuevo)

**Escenarios:**

- Admin navega a `/admin/data-sources`
- Admin ve lista de fuentes con estado
- Admin hace toggle OFF de una fuente → confirma que se desactiva
- Admin hace toggle ON → confirma que se reactiva
- Verificar health check (al menos que el botón funcione)
- Verificar que stats/métricas se muestran

**Ref plan:** B6, D7

### F5. Frontend: sección de métricas en admin

**Archivos:**

- `apps/web/src/components/admin/DataSourceMetrics.tsx` (nuevo)
- `apps/web/src/pages/admin/data-sources.tsx` — agregar sección de métricas

**Contenido:**

- Calls 24h por provider (bar chart o tabla)
- Latencia promedio (ms)
- Error rate 24h (%)
- Uptime porcentaje
- Datos vienen del endpoint `GET /admin/data-sources/stats` (ya implementado)

**Ref plan:** D5

### F6. Frontend: indicador real-time WebSocket en DataSourceCard

**Archivos:**

- `apps/web/src/hooks/use-data-source-events.ts` (nuevo)
- `apps/web/src/components/admin/DataSourceCard.tsx` — agregar badge de estado real-time

**Lógica:**

- Hook escucha eventos WebSocket: `data-source:degraded` y `data-source:recovered`
- Cuando llega `degraded` → badge cambia a rojo con animación pulse
- Cuando llega `recovered` → badge vuelve a verde con animación flash
- Toast notification (Sonner) en cada evento

**Ref plan:** D2

### F7. Alinear tipos compartidos con la spec

**Archivos:**

- `libs/shared/src/types/market-data-sources.ts`
- Providers afectados si cambia la interfaz

**Cambios:**

- `NewsWithSentiment`: agregar `relevanceScore: number` (default 0 si el provider no lo provee)
- `GlobalMarketData`: renombrar `trendingCoins` a `trending` (o mantener `trendingCoins` y actualizar spec — decidir consistencia)
- `DefiHealthData`: agregar `dominantChain: string` (DefiLlama provider ya puede derivar esto del endpoint de chains)

**Ref spec:** Sec 3.2

### F8. Verificación Fase F

```bash
# Seguridad
pnpm nx run providers:test   # schemas Zod
pnpm nx run api:test          # encryption + integration

# Frontend
pnpm nx run web:lint
pnpm nx run web:build

# E2E
pnpm nx run web-e2e:e2e -- --grep="data-sources"

# Full
pnpm nx run-many --target=build --projects=api,web
pnpm nx run-many --target=lint --all
```

---

## Criterios de aceptación global

- [ ] 7+ fuentes gratuitas integradas y funcionando en producción
- [ ] Admin puede activar/desactivar cada fuente individualmente
- [ ] Snapshot enriquecido incluye datos de todas las fuentes activas
- [ ] Circuit breaker funciona: degrada automáticamente fuentes que fallan
- [ ] Admin recibe notificación cuando una fuente se degrada
- [ ] Los agentes (SIGMA, AEGIS, CIPHER) reciben el snapshot enriquecido
- [ ] Latencia total de buildSnapshot() < 2 segundos
- [ ] Zero downtime: si una fuente falla, las demás siguen operando
- [ ] Audit log registra todos los toggles y eventos de circuit breaker
- [ ] Trader puede ver datos de mercado en `/dashboard/market-intelligence`
- [ ] Secciones se ocultan si la fuente está desactivada o devuelve null
- [ ] Link desde `bot-analysis` a `market-intelligence` funciona
- [ ] Todas las respuestas de APIs externas se validan con schemas Zod
- [ ] API keys encriptadas con AES-256 en DB, nunca en plaintext
- [ ] Test de integración de `buildEnrichedSnapshot` pasa
- [ ] E2E del flujo admin (toggle + health) pasa
- [ ] Admin ve métricas por provider (calls, latencia, error rate, uptime)
- [ ] DataSourceCard muestra estado real-time vía WebSocket
- [ ] Tipos compartidos alineados con la spec (relevanceScore, dominantChain)

---

## Cierre de branch

```bash
gh pr create \
  --base main \
  --head feature/market-data-sources \
  --title "feat: integrate external market data sources for AI agents" \
  --body "## Spec 40 — Market Data Sources Integration

### Cambios principales
- Nuevo modelo \`DataSourceConfig\` con 9 fuentes pre-configuradas
- Sistema de providers modulares en \`libs/providers\`
- \`DataSourceRegistryService\` con circuit breaker y fallback
- Panel admin para gestionar fuentes (\`/admin/data-sources\`)
- \`EnrichedMarketSnapshot\` con datos de derivados, sentimiento, DeFi, noticias, predictions
- 8 providers implementados: Alternative.me, Coinalyze, DefiLlama, Finnhub, CoinGecko, Polymarket, Messari, altFINS
- Página \`/dashboard/market-intelligence\` para que el trader vea datos de mercado en vivo

### Fuentes integradas (stack gratuito)
| Fuente | Categoría | Costo |
|---|---|---|
| Alternative.me | Sentimiento | \$0 |
| Coinalyze | Derivados | \$0 |
| DefiLlama | DeFi/On-chain | \$0 |
| Finnhub | Noticias + NLP | \$0 |
| CoinGecko | Market Data | \$0 |
| Polymarket | Predictions | \$0 |
| altFINS (free) | TA Signals | \$0 |

### Testing
- Unit tests para todos los providers
- Integration tests para DataSourceRegistry
- E2E: admin toggle + snapshot building

Closes #XX
" \
  --label "feature,backend,frontend"
```
