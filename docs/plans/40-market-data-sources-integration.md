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
- Sistema de providers modulares en \`libs/data-fetcher\`
- \`DataSourceRegistryService\` con circuit breaker y fallback
- Panel admin para gestionar fuentes (\`/admin/data-sources\`)
- \`EnrichedMarketSnapshot\` con datos de derivados, sentimiento, DeFi, noticias, predictions
- 7 providers implementados: Alternative.me, Coinalyze, DefiLlama, Finnhub, CoinGecko, Polymarket, altFINS

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
