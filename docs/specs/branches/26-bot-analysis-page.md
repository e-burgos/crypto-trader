# Spec 26 — Bot Analysis Page (Agente AI — Vista detallada de decisiones)

**Fecha:** 2026-04-12
**Versión:** 1.0
**Estado:** Implementado (retrospec)
**Branch:** `feature/bot-analysis-page`
**Dependencias:** Spec 15 (agent decisions endpoint), Spec 21 (market module)

---

## 1. Resumen ejecutivo

El spec original planeaba un "Agent Log" simple (Spec 09, 10) como tabla de decisiones con reasoning y noticias. La implementación construyó una página completamente diferente: el **Bot Analysis** (`/dashboard/bot-analysis`) que combina:

- Análisis en tiempo real del estado actual del mercado
- Historial de decisiones del agente con contexto completo
- Indicadores técnicos con señales al momento de cada decisión
- Noticias que influyeron en cada decisión
- Panel de estadísticas del agente

Esta página es la "mente del agente" — el usuario puede ver exactamente qué datos, indicadores y noticias llevaron a cada decisión.

---

## 2. Diferencia con Agent Log

| Agent Log (spec original) | Bot Analysis (implementado) |
|--------------------------|----------------------------|
| Tabla simple de decisiones | Panel completo multi-sección |
| Solo reasoning + noticias | Indicadores técnicos + noticias + market snapshot |
| Sin estado de mercado actual | Estado actual del mercado en tiempo real (top de página) |
| Sin estadísticas | Panel de estadísticas (win rate, total decisiones, etc.) |
| Sin filtros | Filtros por asset, modo, tipo de decisión |
| Sin details expandibles | Modal de detalle completo por decisión |

---

## 3. Estructura de la página

### 3.1 Panel superior — Estado actual del mercado

Muestra el snapshot de mercado en tiempo real (del hook `useMarketSnapshot`):

- **Selector de asset**: BTC / ETH
- **Señal general**: badge grande `STRONG_BUY | BUY | NEUTRAL | SELL | STRONG_SELL`
- **Precio actual** (via `useBinanceTicker`)
- **Indicadores con señales**: RSI, MACD, Bollinger, EMA, Volumen — cada uno con su señal actual
- **Oportunidad**: `OpportunityAnalysis` derivada del snapshot

Este panel se actualiza en tiempo real con polling cada 60s.

### 3.2 Panel central — Historial de decisiones

Lista paginada de `AgentDecision` con filtros:

**Filtros disponibles:**
- Asset (BTC / ETH / Todos)
- Modo (SANDBOX / TESTNET / LIVE / Todos)
- Tipo de decisión (BUY / SELL / HOLD / CLOSE / Todos)
- Rango de fecha (date picker)

**Card por decisión:**

| Elemento | Descripción |
|----------|-------------|
| Badge de decisión | BUY (verde) / SELL (rojo) / HOLD (azul) / CLOSE (naranja) |
| Asset + Par + Modo | Badge compacto |
| Confianza | Barra de progreso + % |
| Nombre de config | Si `configName` está disponible |
| Proveedor LLM | `llmProvider` + `llmModel` usados |
| Reasoning | Texto resumido (primeros 150 chars, expandible) |
| Noticias usadas | Chips con headline + badge de sentimiento |
| Indicadores | Mini-chips de RSI, MACD, etc. con señal |
| Timestamp | Fecha y hora relativa |
| Botón "Ver detalle" | Abre modal con información completa |

### 3.3 Panel lateral — Estadísticas del agente

Panel colapsable (derecha o bottom en mobile) con:

- **Total decisiones**: conteo por tipo (BUY/SELL/HOLD/CLOSE)
- **Agentes activos**: lista de configs con estado running/stopped
- **Última decisión**: timestamp y tipo
- **Win rate**: solo contando BUYs seguidos de SELL con P&L positivo

---

## 4. Modal de Detalle de Decisión

Al hacer clic en "Ver detalle", se abre un modal portal completo con:

### Sección: Decisión

- Badge decisión grande
- Confianza (número + barra visual)
- Asset, Par, Modo
- LLM Provider + Modelo
- Config name + ID
- Timestamp completo

### Sección: Reasoning del LLM

- Texto completo del reasoning del LLM (sin truncar)
- Formatted markdown si aplica
- `waitMinutes` sugerido

### Sección: Indicadores técnicos en la decisión

Cada indicador que estaba disponible al momento de la decisión (`decision.indicators`):

| Indicador | Datos mostrados |
|-----------|-----------------|
| RSI | Valor + señal (oversold/overbought/neutral) |
| MACD | MACD value, signal line, histogram, crossover |
| Bollinger Bands | Upper/middle/lower, bandwidth, posición del precio |
| EMA Cross | EMA9, EMA21, EMA200, tendencia (bullish/bearish) |
| Volume | Volumen actual vs promedio, ratio, señal |
| Support/Resistance | Arrays de niveles de soporte y resistencia |

### Sección: Config en el momento de la decisión

Si `decision.configDetails` está disponible:
- Todos los parámetros de la config al momento de la decisión
- Útil para auditar: "¿con qué thresholds se tomó esta decisión?"

### Sección: Noticias que influyeron

Lista de `AgentDecisionHeadline`:
- Headline completo
- Fuente
- Autor (si disponible)
- Summary (si disponible)
- Badge de sentimiento (POSITIVE=verde/NEGATIVE=rojo/NEUTRAL=gris)

---

## 5. Tipos de datos propios

### `AgentDecision` (extendido)

```typescript
interface AgentDecision {
  id: string;
  asset: string;              // "BTC" | "ETH"
  pair: string;               // "USDT" | "USDC"
  decision: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
  confidence: number;         // 0-100
  reasoning: string;          // texto del LLM
  waitMinutes?: number;       // sugerido por el LLM
  configId?: string;
  configName?: string;
  mode?: string;              // TradingMode
  createdAt: string;
  // Campos enriquecidos (pueden ser null si no se guardaron)
  indicators?: AgentDecisionIndicators;
  newsHeadlines?: AgentDecisionHeadline[];
  configDetails?: AgentDecisionConfigDetails | null;
  llmProvider?: string | null;
  llmModel?: string | null;
}

interface AgentDecisionIndicators {
  rsi?: { value: number; signal: string };
  macd?: { macd: number; signal: number; histogram: number; crossover: string };
  bollingerBands?: { upper: number; middle: number; lower: number; bandwidth: number; position: string };
  emaCross?: { ema9: number; ema21: number; ema200: number; trend: string };
  volume?: { current: number; average: number; ratio: number; signal: string };
  supportResistance?: { support: number[]; resistance: number[] };
}

interface AgentDecisionHeadline {
  headline: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  summary?: string | null;
  author?: string | null;
  source: string;
}

interface AgentDecisionConfigDetails {
  buyThreshold: number;
  sellThreshold: number;
  stopLossPct: number;
  takeProfitPct: number;
  minProfitPct: number;
  maxTradePct: number;
  maxConcurrentPositions: number;
  minIntervalMinutes: number;
  intervalMode: string;
  orderPriceOffsetPct: number;
  isRunning: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## 6. Hooks usados

| Hook | Fuente | Descripción |
|------|--------|-------------|
| `useAgentDecisions(page, limit, filters)` | `use-analytics.ts` | `GET /analytics/decisions` con filtros |
| `useMarketSnapshot(asset, interval)` | `use-market.ts` | Snapshot actual del mercado |
| `useMarketNews(limit)` | `use-market.ts` | Noticias recientes |
| `useNewsAnalysis()` | `use-market.ts` | Último análisis de sentimiento |
| `useTradingConfigs()` | `use-trading.ts` | Lista de configs (para el panel lateral) |
| `useAgentStatus()` | `use-trading.ts` | Estado running/stopped por agente |
| `useBinanceTicker(symbols)` | `use-binance-ticker.ts` | Precio actual en tiempo real |

---

## 7. Endpoints usados

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/analytics/decisions` | Historial de decisiones del agente (paginado) |
| `GET` | `/market/snapshot/:asset` | Snapshot de indicadores en tiempo real |
| `GET` | `/market/news` | Noticias recientes |
| `GET` | `/trading/config` | Configs del usuario |
| `GET` | `/trading/status` | Estado de agentes |

### Parámetros de `/analytics/decisions`

| Query param | Tipo | Descripción |
|-------------|------|-------------|
| `page` | number | Página |
| `limit` | number | Items por página (default: 20) |
| `asset` | string | Filtro por asset |
| `mode` | string | Filtro por modo |
| `decision` | string | Filtro por tipo de decisión |
| `from` | ISO date | Desde fecha |
| `to` | ISO date | Hasta fecha |

---

## 8. Backend — Enriquecimiento de decisiones

### Persistencia enriquecida en `AgentDecision`

Al momento de tomar una decisión, el `TradingProcessor` guarda en DB:

```prisma
model AgentDecision {
  id             String   @id
  configId       String
  asset          String
  pair           String
  decision       String   -- BUY | SELL | HOLD | CLOSE
  confidence     Float
  reasoning      String   @db.Text
  waitMinutes    Int?
  -- Campos enriquecidos
  indicators     Json?    -- AgentDecisionIndicators serializado
  newsHeadlines  Json?    -- AgentDecisionHeadline[] serializado
  configDetails  Json?    -- snapshot de TradingConfig al momento de la decisión
  llmProvider    String?
  llmModel       String?
  mode           String?
  createdAt      DateTime @default(now())
}
```

La query de `GET /analytics/decisions` devuelve estos campos enriquecidos cuando disponibles.

---

## 9. Criterios de aceptación

- [ ] El panel superior muestra el snapshot de mercado actual con indicadores y señal general
- [ ] La lista de decisiones muestra las últimas 20 decisiones con paginación
- [ ] Los filtros por asset, modo y tipo de decisión funcionan correctamente
- [ ] La card de decisión muestra: decisión, confianza, reasoning truncado, chips de indicadores, chips de noticias
- [ ] El modal de detalle muestra el reasoning completo del LLM
- [ ] Los indicadores técnicos en el modal muestran los valores **al momento de la decisión** (no los actuales)
- [ ] Las noticias en el modal muestran las headlines con su sentimiento
- [ ] `configDetails` en el modal muestra la config activa al momento de la decisión
- [ ] El panel de estadísticas muestra agentes activos y total de decisiones por tipo
- [ ] La página funciona si no hay `indicators` o `newsHeadlines` (son opcionales)

---

**Depende de:** Spec 04 (analysis engine), Spec 15 (trading processor), Spec 21 (market module)
**Consumidores:** Dashboard overview (decisiones recientes), Chat (contexto de decisiones)
