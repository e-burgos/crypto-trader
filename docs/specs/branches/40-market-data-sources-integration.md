# Spec 40 — Market Data Sources Integration

**Fecha:** 2026-04-27  
**Versión:** 1.0  
**Estado:** Propuesto  
**Branch:** `feature/market-data-sources`  
**Dependencias:** Spec 21 (market-module), Spec 36 (agent-hub-config)  
**Research:** `docs/content/crypto-trader-api-research.md`

---

## 1. Resumen ejecutivo

Los agentes de IA del sistema actualmente reciben datos de una sola fuente (Binance OHLCV + cálculos internos de indicadores). Esto limita la calidad de las decisiones porque los agentes carecen de:

1. **Derivados:** Open interest, funding rate, liquidaciones, long/short ratio.
2. **Sentimiento:** Fear & Greed Index, social intelligence, noticias con NLP scoring.
3. **On-chain:** TVL sistémico, stablecoin flows, token unlocks.
4. **Narrativa:** Prediction markets, consensus con dinero real.

Esta spec introduce un **sistema modular de data sources** que:

- Agrega 7+ fuentes de datos externas gratuitas al pipeline de los agentes.
- Permite al admin activar/desactivar cada fuente individualmente desde el panel.
- Implementa fallback automático cuando una fuente falla.
- Enriquece el `MarketSnapshot` que reciben los agentes sin cambiar la interfaz de los agentes.

### Impacto esperado

| Antes                                              | Después                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| SIGMA: solo indicadores TA calculados internamente | SIGMA: TA + Fear & Greed + noticias NLP + market data global          |
| AEGIS: sin datos de derivados ni on-chain          | AEGIS: OI + funding + liquidaciones + TVL sistémico + (token unlocks) |
| CIPHER: RSS básico sin scoring                     | CIPHER: noticias con sentiment score + prediction markets             |

---

## 2. Arquitectura

### 2.1 Flujo de datos

```
┌─────────────────────────────────────────────────────────────────┐
│                    DataSourceRegistry                             │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐      │
│  │ Alternative │  │  Coinalyze   │  │    DefiLlama       │      │
│  │ .me F&G     │  │  Derivatives │  │    TVL/Stables     │      │
│  └──────┬──────┘  └──────┬───────┘  └─────────┬──────────┘      │
│         │                 │                     │                  │
│  ┌──────┴──────┐  ┌──────┴───────┐  ┌─────────┴──────────┐      │
│  │  Finnhub    │  │  CoinGecko   │  │    Polymarket       │      │
│  │  News+NLP   │  │  Market Data │  │    Predictions      │      │
│  └──────┬──────┘  └──────┬───────┘  └─────────┬──────────┘      │
│         │                 │                     │                  │
│  ┌──────┴──────┐  ┌──────┴───────┐                               │
│  │  altFINS    │  │   Messari    │  (condicional)                │
│  │  TA Signals │  │   Unlocks    │                               │
│  └──────┬──────┘  └──────┬───────┘                               │
└─────────┼────────────────┼──────────────────────────────────────┘
          │                │
          ▼                ▼
┌──────────────────────────────────────────┐
│        MarketService.buildSnapshot()      │
│                                           │
│  MarketSnapshot {                         │
│    indicators: IndicatorSnapshot          │ ← altFINS || internal calc
│    fearGreed: FearGreedData               │ ← Alternative.me
│    derivatives: DerivativesData           │ ← Coinalyze
│    defiHealth: DefiHealthData             │ ← DefiLlama
│    news: NewsWithSentiment[]              │ ← Finnhub
│    globalMarket: GlobalMarketData         │ ← CoinGecko
│    predictions: PredictionData[]          │ ← Polymarket
│    tokenUnlocks?: TokenUnlockData[]       │ ← Messari (si disponible)
│  }                                        │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│    OrchestratorService.orchestrate()      │
│                                           │
│    SIGMA ← indicators + fearGreed +       │
│            news + globalMarket            │
│    AEGIS ← derivatives + defiHealth +     │
│            tokenUnlocks                   │
│    CIPHER ← news + predictions +          │
│             globalMarket                  │
└──────────────────────────────────────────┘
```

### 2.2 Principio de independencia

Cada provider es un módulo independiente. Si falla o se desactiva:

- Los demás siguen funcionando.
- El snapshot se construye con los datos disponibles.
- Los agentes reciben campos `null` para las fuentes faltantes y adaptan su razonamiento.

### 2.3 Ubicación de código

| Componente                     | Ubicación                                                  |
| ------------------------------ | ---------------------------------------------------------- |
| Interfaz `IDataSourceProvider` | `libs/data-fetcher/src/providers/data-source.interface.ts` |
| Providers individuales         | `libs/data-fetcher/src/providers/{name}.provider.ts`       |
| `DataSourceRegistry` (service) | `apps/api/src/market/data-source-registry.service.ts`      |
| `DataSourceConfig` (Prisma)    | `apps/api/prisma/schema.prisma`                            |
| Controller admin               | `apps/api/src/admin/data-sources.controller.ts`            |
| Página admin                   | `apps/web/src/pages/admin/data-sources.tsx`                |
| Tipos compartidos              | `libs/shared/src/types/market-data-sources.ts`             |

---

## 3. Modelos de datos

### 3.1 Nuevo modelo Prisma — `DataSourceConfig`

```prisma
model DataSourceConfig {
  id                String   @id @default(cuid())
  name              String   @unique  // "alternative_me", "coinalyze", etc.
  displayName       String
  isActive          Boolean  @default(false)
  priority          Int      @default(1)
  targetAgents      String[] // ["SIGMA", "AEGIS"]
  category          DataSourceCategory
  apiKey            String?  // encriptada vía AES-256, null si es API pública
  baseUrl           String   // URL base del provider
  rateLimitPerMin   Int      @default(60)
  lastSuccessAt     DateTime?
  lastErrorAt       DateTime?
  lastErrorMessage  String?
  consecutiveErrors Int      @default(0)
  totalCalls24h     Int      @default(0)
  avgLatencyMs      Int      @default(0)
  monthlyCostUsd    Float    @default(0)  // para mostrar costo estimado en admin
  metadata          Json?    // config específica del provider
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

enum DataSourceCategory {
  TECHNICAL       // altFINS
  DERIVATIVES     // Coinalyze
  DEFI_ONCHAIN    // DefiLlama
  SENTIMENT       // Alternative.me
  NEWS            // Finnhub
  MARKET_DATA     // CoinGecko
  PREDICTION      // Polymarket
  TOKEN_UNLOCKS   // Messari
}
```

### 3.2 Tipo `EnrichedMarketSnapshot`

```typescript
// libs/shared/src/types/market-data-sources.ts

export interface EnrichedMarketSnapshot {
  // Existente (ya en MarketSnapshot)
  symbol: string;
  timestamp: Date;
  price: number;
  indicators: IndicatorSnapshot;

  // Nuevos — todos opcionales (null si la fuente no está activa)
  fearGreed: FearGreedData | null;
  derivatives: DerivativesData | null;
  defiHealth: DefiHealthData | null;
  newsWithSentiment: NewsWithSentiment[] | null;
  globalMarket: GlobalMarketData | null;
  predictions: PredictionData[] | null;
  tokenUnlocks: TokenUnlockData[] | null;

  // Metadata
  sourcesUsed: string[]; // ["alternative_me", "coinalyze", ...]
  sourcesFailed: string[]; // fuentes que fallaron en este snapshot
  snapshotBuildTimeMs: number; // latencia total de construcción
}

export interface FearGreedData {
  value: number; // 0-100
  classification: string; // "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed"
  timestamp: number;
  previousClose: number; // valor del día anterior para detectar tendencia
}

export interface DerivativesData {
  openInterest: number; // USD
  openInterestChange24h: number; // porcentaje
  fundingRate: number; // promedio ponderado
  longShortRatio: number; // >1 = más longs
  liquidations24h: {
    long: number;
    short: number;
    total: number;
  };
  cvd: number; // Cumulative Volume Delta
}

export interface DefiHealthData {
  totalTvl: number; // TVL global DeFi en USD
  tvlChange24h: number; // porcentaje
  tvlChange7d: number;
  dominantChain: string; // "Ethereum"
  stablecoinMcap: number;
  stablecoinChange7d: number;
}

export interface NewsWithSentiment {
  headline: string;
  source: string;
  url: string;
  publishedAt: Date;
  sentiment: number; // -1 a 1 (negativo a positivo)
  relevanceScore: number; // 0-1
  relatedSymbols: string[]; // ["BTC", "ETH"]
}

export interface GlobalMarketData {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  ethDominance: number;
  trending: string[]; // top 5 trending coins
  topGainers24h: string[];
  topLosers24h: string[];
}

export interface PredictionData {
  question: string; // "Will BTC reach $100k by June?"
  probability: number; // 0-1
  volume: number; // USD traded
  category: string; // "crypto" | "macro" | "regulation"
  endDate: Date;
}

export interface TokenUnlockData {
  symbol: string;
  unlockDate: Date;
  amountUsd: number;
  percentOfCirculating: number;
  type: string; // "cliff" | "linear" | "team" | "investor"
}
```

### 3.3 Interfaz del provider

```typescript
// libs/data-fetcher/src/providers/data-source.interface.ts

export interface IDataSourceProvider {
  readonly name: string;
  readonly category: DataSourceCategory;
  readonly targetAgents: AgentId[];
  readonly requiresApiKey: boolean;

  /**
   * Verifica si el provider está configurado y accesible.
   */
  isAvailable(config: DataSourceConfig): Promise<boolean>;

  /**
   * Obtiene datos para un símbolo específico.
   * @throws DataSourceError si falla la llamada.
   */
  fetch(symbol: string, config: DataSourceConfig): Promise<DataSourcePayload>;

  /**
   * Retorna un health check simple (ping/status).
   */
  healthCheck(config: DataSourceConfig): Promise<HealthCheckResult>;
}

export type DataSourcePayload =
  | { type: 'fear_greed'; data: FearGreedData }
  | { type: 'derivatives'; data: DerivativesData }
  | { type: 'defi_health'; data: DefiHealthData }
  | { type: 'news'; data: NewsWithSentiment[] }
  | { type: 'global_market'; data: GlobalMarketData }
  | { type: 'predictions'; data: PredictionData[] }
  | { type: 'token_unlocks'; data: TokenUnlockData[] }
  | { type: 'indicators'; data: IndicatorSnapshot };

export interface HealthCheckResult {
  available: boolean;
  latencyMs: number;
  error?: string;
}
```

---

## 4. API endpoints

### 4.1 Admin — gestión de data sources

```
GET    /admin/data-sources              → Lista todas las fuentes con estado
PATCH  /admin/data-sources/:id/toggle   → Activa/desactiva una fuente
PATCH  /admin/data-sources/:id          → Actualiza config (apiKey, priority, etc.)
GET    /admin/data-sources/:id/health   → Health check de una fuente específica
POST   /admin/data-sources/health-all   → Health check de todas las fuentes activas
GET    /admin/data-sources/stats        → Estadísticas: calls 24h, latencias, errores
```

### 4.2 Respuesta de `GET /admin/data-sources`

```json
{
  "sources": [
    {
      "id": "cls123",
      "name": "alternative_me",
      "displayName": "Alternative.me — Fear & Greed Index",
      "isActive": true,
      "category": "SENTIMENT",
      "targetAgents": ["SIGMA", "KRYPTO"],
      "requiresApiKey": false,
      "health": {
        "status": "healthy",
        "lastSuccessAt": "2026-04-27T10:30:00Z",
        "consecutiveErrors": 0,
        "avgLatencyMs": 120,
        "totalCalls24h": 48
      },
      "monthlyCostUsd": 0
    },
    {
      "id": "cls456",
      "name": "coinalyze",
      "displayName": "Coinalyze — Derivados Agregados",
      "isActive": true,
      "category": "DERIVATIVES",
      "targetAgents": ["AEGIS", "SIGMA"],
      "requiresApiKey": false,
      "health": {
        "status": "healthy",
        "lastSuccessAt": "2026-04-27T10:29:00Z",
        "consecutiveErrors": 0,
        "avgLatencyMs": 340,
        "totalCalls24h": 96
      },
      "monthlyCostUsd": 0
    }
  ],
  "summary": {
    "totalActive": 7,
    "totalInactive": 2,
    "estimatedMonthlyCost": 0,
    "healthyCount": 7,
    "degradedCount": 0
  }
}
```

### 4.3 Respuesta de `PATCH /admin/data-sources/:id/toggle`

```json
{
  "id": "cls123",
  "name": "alternative_me",
  "isActive": true,
  "toggledAt": "2026-04-27T10:35:00Z",
  "toggledBy": "admin@crypto-trader.com"
}
```

---

## 5. Componentes frontend

### 5.1 Página Admin — Data Sources (`/admin/data-sources`)

Sigue el patrón visual de `llm-providers.tsx`:

```
┌─────────────────────────────────────────────────────────────────┐
│  Fuentes de Datos de Mercado                                     │
│                                                                   │
│  Stack activo: 7/9 fuentes  │  Costo: $0/mes  │  Health: ✅ All OK │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──── SENTIMIENTO ────────────────────────────────────────────┐ │
│  │ [ON] Alternative.me — Fear & Greed Index        $0    ✅ 120ms │ │
│  │      Agentes: SIGMA, KRYPTO                                  │ │
│  │      Última lectura: Neutral (47) — hace 23min               │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──── DERIVADOS ──────────────────────────────────────────────┐ │
│  │ [ON] Coinalyze — OI + Funding + Liquidaciones   $0    ✅ 340ms │ │
│  │      Agentes: AEGIS, SIGMA                                   │ │
│  │      OI: $24.3B | Funding: 0.012% | Liq 24h: $156M          │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──── DEFI/ON-CHAIN ─────────────────────────────────────────┐ │
│  │ [ON] DefiLlama — TVL Sistémico                  $0    ✅ 250ms │ │
│  │      Agentes: AEGIS, SIGMA                                   │ │
│  │      TVL Global: $98.2B | Δ7d: +3.1%                        │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──── NOTICIAS ───────────────────────────────────────────────┐ │
│  │ [ON] Finnhub — Noticias + Sentimiento NLP       $0    ✅ 180ms │ │
│  │      Agentes: SIGMA, CIPHER                                  │ │
│  │      12 noticias cargadas | Sent. promedio: +0.3             │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──── MARKET DATA ───────────────────────────────────────────┐ │
│  │ [ON] CoinGecko — Dominancia + Trending          $0    ✅ 200ms │ │
│  │      Agentes: SIGMA, KRYPTO                                  │ │
│  │      BTC Dom: 58.1% | ETH: 10.4%                            │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──── PREDICTION ────────────────────────────────────────────┐ │
│  │ [ON] Polymarket — Consensus con Capital          $0    ✅ 300ms │ │
│  │      Agentes: SIGMA, CIPHER                                  │ │
│  │      3 mercados activos relevantes                           │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──── TOKEN UNLOCKS ─────────────────────────────────────────┐ │
│  │ [OFF] Messari — Token Unlock Schedules   ⚠️ Verificar  $0?   │ │
│  │       Agentes: AEGIS, CIPHER                                 │ │
│  │       Estado: No verificado — requiere testing manual        │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──── TÉCNICO ───────────────────────────────────────────────┐ │
│  │ [OFF] altFINS — TA Pre-calculado + Señales      $0 (free)   │ │
│  │       Agentes: SIGMA, KRYPTO                                 │ │
│  │       Fallback: cálculo interno (libs/analysis)              │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Componentes de UI a crear

| Componente              | Ubicación                                                 | Responsabilidad                         |
| ----------------------- | --------------------------------------------------------- | --------------------------------------- |
| `DataSourcesPage`       | `apps/web/src/pages/admin/data-sources.tsx`               | Página principal con lista de fuentes   |
| `DataSourceCard`        | `apps/web/src/components/admin/DataSourceCard.tsx`        | Card individual de cada fuente          |
| `DataSourceHealthBadge` | `apps/web/src/components/admin/DataSourceHealthBadge.tsx` | Badge de estado (healthy/degraded/down) |
| `DataSourceToggle`      | Reutilizar `Switch` de `libs/ui`                          | Toggle on/off por fuente                |

---

## 6. Fases de implementación

### Fase A — Infraestructura base (backend + admin UI)

**Objetivo:** Crear el framework de providers sin implementar ninguna integración real todavía.

1. Crear modelo `DataSourceConfig` + enum `DataSourceCategory` en Prisma.
2. Ejecutar migración + seed con las 9 fuentes pre-configuradas (todas `isActive: false`).
3. Crear interfaz `IDataSourceProvider` en `libs/data-fetcher`.
4. Crear `DataSourceRegistryService` en `apps/api/src/market/`.
5. Crear `DataSourcesController` con endpoints admin (GET, PATCH toggle, health).
6. Crear tipo `EnrichedMarketSnapshot` en `libs/shared`.
7. Extender `MarketService.buildSnapshot()` para usar el registry (con fallback a cálculo interno).
8. Crear página admin `data-sources.tsx` con cards + toggles (conectada a API real).
9. Agregar navegación en sidebar admin.
10. Tests unitarios para `DataSourceRegistryService`.

**Criterio de aceptación:** Admin puede ver todas las fuentes, hacer toggle, y ver health status (todo OFF inicialmente).

### Fase B — Integraciones gratuitas prioritarias

**Objetivo:** Las 4 integraciones de mayor impacto inmediato.

1. **`AlternativeMeProvider`** — Fear & Greed Index.
   - Endpoint: `GET https://api.alternative.me/fng/?limit=2`
   - Sin API key. Sin autenticación.
   - Frecuencia: 1 call cada 30 min (el índice se actualiza cada hora).

2. **`CoinalyzeProvider`** — Derivados agregados.
   - Endpoints: OI, funding rate, liquidations, long/short ratio.
   - Rate limit: 40 req/min.
   - Sin API key (verificar).
   - Frecuencia: 1 call cada 15 min.

3. **`DefiLlamaProvider`** — TVL sistémico + stablecoins.
   - Endpoints: `/v2/historicalChainTvl`, `/stablecoins`, `/overview/fees`.
   - Sin API key para endpoints básicos.
   - SDK: `@defillama/api`.
   - Frecuencia: 1 call cada 1 hora (TVL cambia lentamente).

4. **`FinnhubProvider`** — Noticias con sentiment score.
   - Endpoint: `GET https://finnhub.io/api/v1/news?category=crypto&token={key}`
   - Requiere API key (free registration).
   - Rate limit: 60 calls/min.
   - Frecuencia: 1 call cada 10 min.

5. Activar las 4 fuentes por defecto (seed update).
6. Actualizar `MarketService` para incluir datos en snapshot.
7. Tests de integración para cada provider (mocked HTTP).
8. E2E: verificar que el admin puede toggle y que los datos aparecen en el snapshot.

**Criterio de aceptación:** Con las 4 fuentes activas, el snapshot incluye fear_greed + derivatives + defi_health + news con datos reales.

### Fase C — Integraciones gratuitas secundarias + CoinGecko

**Objetivo:** Completar el stack gratuito.

1. **`CoinGeckoProvider`** — Global market data.
   - Endpoint: `GET https://api.coingecko.com/api/v3/global` + `/search/trending`.
   - API key: Demo plan (free registration).
   - Rate limit: 30 req/min.
   - Frecuencia: 1 call cada 30 min.

2. **`PolymarketProvider`** — Prediction markets.
   - Endpoints: REST API para mercados activos de crypto/macro.
   - Sin API key para lectura.
   - Frecuencia: 1 call cada 1 hora.

3. **`MessariProvider`** (condicional) — Token unlocks.
   - Endpoint: `GET https://api.messari.io/api/v1/assets/{asset}/metrics`
   - ⚠️ Verificar si free tier funciona. Si no → desactivar y documentar.
   - API key si está disponible.
   - Frecuencia: 1 call cada 6 horas (unlocks no cambian frecuentemente).

4. **`AltFinsProvider`** (free tier) — TA pre-calculado.
   - Si free tier permite al menos lookups básicos → implementar como alternativa a cálculo interno.
   - Fallback: `calculateIndicatorSnapshot()` existente.

5. Tests de integración + actualización de snapshot types.

**Criterio de aceptación:** Stack completo gratuito funcionando. Admin puede ver 7-9 fuentes activas con datos reales.

### Fase D — Circuit breaker + observabilidad + polish

**Objetivo:** Robustez en producción.

1. Implementar circuit breaker: 3 errores consecutivos en 5 min → marcar como degradada → fallback automático.
2. Auto-recovery: retry cada 5 min. Si vuelve a funcionar → restaurar automáticamente.
3. Notificación WebSocket al admin cuando una fuente se degrada/recupera.
4. Dashboard de métricas en la página admin: calls/24h, latencia promedio, error rate.
5. Audit log: todas las acciones de toggle + eventos de circuit breaker van al `AdminAction`.
6. Rate limiter interno por provider para no exceder sus límites.
7. Caching: cada provider cachea su última respuesta válida (TTL configurable).
8. E2E test completo del flujo de degradación y recuperación.

**Criterio de aceptación:** Si Coinalyze cae 3 veces seguidas, el admin recibe notificación, la fuente se marca degradada, y el snapshot sigue construyéndose sin ella.

---

## 7. Out of scope

- Implementar providers pagados (Glassnode Professional, LunarCrush Individual).
- MCP Server para agentes (DefiLlama MCP, LunarCrush MCP) — futura spec.
- Configuración de API keys por usuario (este sistema es plataforma-level, admin-only).
- Historial de datos de providers (solo se almacena el último snapshot, no series temporales de cada fuente).
- UI para usuarios no-admin (los datos fluyen a los agentes transparentemente).
- Streaming/WebSocket desde los providers externos (se usa polling con frecuencia configurable).

---

## 8. Decisiones de diseño

| #   | Decisión                                               | Alternativa                               | Razón                                                                                                                     |
| --- | ------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | Campos opcionales (`null`) en `EnrichedMarketSnapshot` | Tipo separado por combinación de fuentes  | Los agentes manejan nulls naturalmente en su prompt. Mantiene un solo tipo.                                               |
| 2   | API keys plataforma-level (admin-only)                 | Keys por usuario como LLM providers       | Las data sources son infraestructura del sistema, no del usuario. Un admin las gestiona para todos.                       |
| 3   | Polling con frecuencia configurable                    | WebSocket permanente                      | La mayoría de APIs no ofrecen WS. Polling con TTL/cache es más robusto y simple.                                          |
| 4   | Fallback ruidoso (notificación al admin)               | Fallback silencioso (solo log)            | El admin necesita saber cuándo una fuente falla para tomar acción (rotar key, verificar status).                          |
| 5   | Circuit breaker: 3 errores / 5 min                     | Desactivación manual por admin            | Automatizar la respuesta evita que un provider caído genere timeouts en cascada.                                          |
| 6   | Providers en `libs/data-fetcher`                       | Providers en `apps/api/src/`              | Las implementaciones HTTP son reutilizables y testeables independientemente del framework NestJS.                         |
| 7   | Seed con todas las fuentes pre-configuradas            | Admin crea fuentes manualmente            | Reduce fricción. El admin solo tiene que activar toggles, no crear entries.                                               |
| 8   | Cache de última respuesta válida con TTL               | Re-fetch en cada snapshot                 | Reduce calls a APIs externas, respeta rate limits, y provee datos stale-but-valid si una fuente está temporalmente caída. |
| 9   | `EnrichedMarketSnapshot` extiende el tipo existente    | Reemplazar `MarketSnapshot` completamente | Backwards compatible. El código existente sigue funcionando sin cambios.                                                  |

---

## 9. Seguridad

- **API keys encriptadas:** Almacenadas con AES-256 en DB, desencriptadas solo en runtime.
- **No exponer keys en frontend:** El admin solo ve `***...últimos 4 chars` en la UI.
- **Rate limiting interno:** Cada provider respeta su propio rate limit para evitar bans.
- **Validación de respuestas:** Todos los payloads de APIs externas se validan con schemas Zod antes de usarse.
- **No logging de keys:** Las API keys nunca se loguean en plaintext.
- **CORS:** Los endpoints de admin solo accesibles con role ADMIN (guard existente).

---

## 10. Métricas de éxito

| Métrica                             | Objetivo                                          |
| ----------------------------------- | ------------------------------------------------- |
| Fuentes activas sin degradación     | ≥6/9 durante 7 días                               |
| Latencia total de `buildSnapshot()` | <2 segundos (parallelized)                        |
| Uptime de fuentes gratuitas         | >99% (con circuit breaker)                        |
| Adopción por agentes                | 100% de snapshots incluyen ≥3 fuentes adicionales |
| Errores de integración <            | <5 por día por provider                           |
