# Spec 21 — Market Module (Backend + Frontend)

**Fecha:** 2026-04-12
**Versión:** 1.0
**Estado:** Implementado (retrospec)
**Branch:** `feature/market-module`
**Dependencias:** Spec 15 (backend-completion), Spec 16 (frontend-completion)

---

## 1. Resumen ejecutivo

Se extrae toda la lógica de mercado y noticias en un módulo NestJS independiente (`MarketModule`) y una página de análisis de mercado dedicada en el dashboard. Esta separación limpia la responsabilidad: `TradingModule` orquesta el agente; `MarketModule` sirve datos de mercado y noticias a cualquier consumidor (frontend, agente, chatbot).

---

## 2. Alcance

### Backend — `apps/api/src/market/`

- `market.module.ts` — NestJS module que registra controller, service y scheduler
- `market.controller.ts` — Endpoints REST protegidos con JWT
- `market.service.ts` — Lógica de negocio: OHLCV, noticias, análisis
- `news-analysis.scheduler.ts` — Scheduler per-usuario basado en intervalos

### Frontend — `apps/web/src/pages/dashboard/market.tsx`

- Página completa de análisis de mercado con chart de velas + señales de indicadores
- Hook `useMarketSnapshot` y funciones auxiliares en `use-market.ts`
- Hook `useMarketNews` para noticias en contexto de mercado
- Hook `useOhlcv` con fallback a Binance public API

---

## 3. Arquitectura Backend

### 3.1 Endpoints del MarketController

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/market/ohlcv/:asset/:interval` | Velas OHLCV de Binance (200 por defecto) |
| `GET` | `/market/news` | Últimas noticias filtradas por config del usuario |
| `GET` | `/market/news-sources/status` | Estado de conectividad de todas las fuentes |
| `GET` | `/market/news/config` | Configuración de noticias del usuario |
| `PUT` | `/market/news/config` | Actualizar configuración de noticias |
| `GET` | `/market/news/analysis` | Último análisis de sentimiento guardado |
| `POST` | `/market/news/analysis/run` | Ejecutar análisis keyword-based y persistir |
| `GET` | `/market/snapshot/:asset` | Snapshot completo de indicadores técnicos |
| `POST` | `/market/snapshot/:asset/analyze` | Análisis LLM sobre el snapshot actual |

### 3.2 Fuentes de noticias

#### Fuentes gratuitas (sin API key)

| ID | Label | Descripción |
|----|-------|-------------|
| `coingecko` | CoinGecko News | Endpoint REST público de CoinGecko |
| `rss:coindesk` | CoinDesk RSS | Feed público RSS de CoinDesk |
| `rss:cointelegraph` | CoinTelegraph RSS | Feed público RSS de CoinTelegraph |
| `rss:bitcoinmagazine` | Bitcoin Magazine RSS | Feed público RSS de Bitcoin Magazine |
| `rss:theblock` | The Block RSS | Feed público RSS de The Block |
| `rss:beincrypto` | BeinCrypto RSS | Feed público RSS de BeinCrypto |
| `reddit` | Reddit | r/CryptoCurrency & r/Bitcoin — top posts última hora |

#### Fuentes opcionales (requieren API key del usuario)

| ID | Provider | Free tier | Registro |
|----|----------|-----------|----------|
| `newsdata` | NewsData.io | 200 req/día | newsdata.io |

Las API keys opcionales se gestionan en el módulo `UsersModule` bajo el endpoint `/users/me/news-api-keys`. El usuario puede configurar múltiples providers. El `MarketService` consulta solo los providers que el usuario tiene habilitados en su `NewsConfig`.

### 3.3 Modelo `NewsConfig` (Prisma)

```prisma
model NewsConfig {
  id              String   @id @default(cuid())
  userId          String   @unique
  intervalMinutes Int      @default(30)
  newsCount       Int      @default(40)
  enabledSources  String[] @default(["coingecko", "rss:coindesk", "rss:cointelegraph"])
  onlySummary     Boolean  @default(true)
  botEnabled      Boolean  @default(true)
  newsWeight      Int      @default(15)
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id])
}
```

### 3.4 Modelo `NewsAnalysis` (Prisma)

```prisma
model NewsAnalysis {
  id                 String   @id @default(cuid())
  userId             String
  analyzedAt         DateTime @default(now())
  newsCount          Int
  positiveCount      Int      @default(0)
  negativeCount      Int      @default(0)
  neutralCount       Int      @default(0)
  score              Float    @default(0)
  overallSentiment   String   @default("NEUTRAL")
  summary            String
  headlines          Json     @default("[]")
  -- Campos opcionales (análisis IA sobre las noticias)
  aiAnalyzedAt       DateTime?
  aiProvider         String?
  aiModel            String?
  aiPositiveCount    Int?
  aiNegativeCount    Int?
  aiNeutralCount     Int?
  aiScore            Float?
  aiOverallSentiment String?
  aiSummary          String?
  aiHeadlines        Json?
  user               User     @relation(fields: [userId], references: [id])
}
```

### 3.5 NewsAnalysisScheduler

- Se ejecuta cada **1 minuto** para revisar todos los usuarios con `NewsConfig`.
- Por usuario: compara el `intervalMinutes` configurado con el tiempo desde el último `NewsAnalysis`.
- Si está vencido, llama a `MarketService.runKeywordAnalysis(userId)`.
- Fallos per-usuario son capturados individualmente (no interrumpen otros usuarios).
- Logs con `Logger` de NestJS: `debug` por análisis exitoso, `warn` por fallo, `error` si el tick falla globalmente.

### 3.6 Market Snapshot

El endpoint `GET /market/snapshot/:asset` calcula en tiempo real:
- Fetch 200 velas OHLCV del asset (intervalo 1h por defecto)
- Calcula `calculateIndicatorSnapshot()` de `@crypto-trader/analysis`
- Devuelve: RSI, MACD, Bollinger Bands, EMA (9/21/50/200), volumen, soporte/resistencia
- Señal por indicador: `BUY | SELL | HOLD` + nivel de confianza

El endpoint `POST /market/snapshot/:asset/analyze` ejecuta adicionalmente:
- Llama al LLM del usuario (`createLLMProvider` de `@crypto-trader/analysis`)
- Genera una decisión de trading con `reasoning` completo
- No persiste el resultado (es un análisis bajo demanda, no parte del agente loop)

---

## 4. Frontend — Página Market (`/dashboard/market`)

### 4.1 Estructura de la página

La página tiene tres secciones principales:

**Columna izquierda (principal):**
- Selector de asset (BTC/ETH) y selector de intervalo (1m/5m/15m/1h/4h/1d)
- Chart de velas con `lightweight-charts` — idéntico al de `live-chart.tsx`
- Overlay de precio actual con variación + indicador de conexión WebSocket
- Price lines para soporte/resistencia sobre el chart

**Panel central — Señales de indicadores:**
- Tarjetas de señal por indicador: RSI, MACD, Bollinger, EMA cruzados, Volumen
- Cada tarjeta muestra: nombre, valor actual, señal (`BUY/SELL/HOLD`), descripción
- Señal general (`OverallSignal`) derivada de la mayoría de indicadores individuales
- Badge de confianza global (0-100%)

**Panel derecho — Oportunidad:**
- `OpportunityAnalysis`: resume si hay oportunidad de entrada o salida
- Tipo de oportunidad (breakout, reversión, consolidación, etc.)
- Razones a favor y en contra
- Nivel de urgencia (alta/media/baja)

### 4.2 Tipos de datos frontend

```typescript
export type OverallSignal = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

export interface MarketSnapshot {
  asset: string;
  interval: string;
  rsi: { value: number; signal: 'BUY' | 'SELL' | 'HOLD' };
  macd: { value: number; signal: number; histogram: number; signal: 'BUY' | 'SELL' | 'HOLD' };
  bollingerBands: { upper: number; middle: number; lower: number; signal: 'BUY' | 'SELL' | 'HOLD' };
  ema: { ema9: number; ema21: number; ema50: number; ema200: number; signal: 'BUY' | 'SELL' | 'HOLD' };
  volume: { current: number; average: number; signal: 'BUY' | 'SELL' | 'HOLD' };
  support: number;
  resistance: number;
}

export interface OpportunityAnalysis {
  type: 'ENTRY' | 'EXIT' | 'WAIT';
  subType?: string;
  confidence: number;
  reasonsFor: string[];
  reasonsAgainst: string[];
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
}
```

### 4.3 Hooks

| Hook | Descripción |
|------|-------------|
| `useMarketSnapshot(asset, interval)` | Llama a `GET /market/snapshot/:asset` con polling cada 60s |
| `useOhlcv(asset, interval, limit)` | Velas OHLCV con fallback a Binance public API si el backend no está disponible |
| `useMarketNews(limit)` | Noticias recientes via `GET /market/news` |
| `useNewsAnalysis()` | Último `NewsAnalysis` via `GET /market/news/analysis` |
| `useNewsConfig()` | Config de noticias del usuario |
| `useRunNewsAnalysis()` | Mutation para `POST /market/news/analysis/run` |
| `deriveOverallSignal(snapshot)` | Función pura: calcula señal general pesando todos los indicadores |
| `deriveOpportunity(snapshot, signal)` | Función pura: genera `OpportunityAnalysis` |

### 4.4 Fallback de datos

`useOhlcv` tiene un mecanismo de fallback:
1. Intenta `GET /api/market/ohlcv/:asset/:interval` (autenticado)
2. Si falla (503, CORS, timeout): llama directamente a `https://api.binance.com/api/v3/klines`
3. Muestra un indicador visual de "datos directo de Binance" cuando usa el fallback

### 4.5 Constantes

```typescript
export const MARKET_SYMBOLS: Record<string, { binanceSymbol: string; displayName: string }> = {
  BTC: { binanceSymbol: 'BTCUSDT', displayName: 'Bitcoin' },
  ETH: { binanceSymbol: 'ETHUSDT', displayName: 'Ethereum' },
};

export const CANDLE_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
```

---

## 5. Modelo de datos adicionales (Prisma)

### `NewsApiKey`
```prisma
model NewsApiKey {
  id        String          @id @default(cuid())
  userId    String
  provider  NewsApiProvider
  apiKey    String          -- cifrado AES-256
  isActive  Boolean         @default(true)
  createdAt DateTime        @default(now())
  user      User            @relation(fields: [userId], references: [id])
  @@unique([userId, provider])
}

enum NewsApiProvider {
  NEWSDATA
}
```

---

## 6. Criterios de aceptación

- [ ] `GET /market/ohlcv/BTC/1h` devuelve 200 velas reales de Binance autenticado
- [ ] `GET /market/news` devuelve noticias de las fuentes habilitadas del usuario
- [ ] `GET /market/news/analysis` devuelve el último análisis guardado
- [ ] `PUT /market/news/config` persiste la configuración de noticias del usuario
- [ ] `NewsAnalysisScheduler` ejecuta análisis per-usuario en el intervalo configurado
- [ ] `GET /market/snapshot/BTC` devuelve snapshot con señales de todos los indicadores
- [ ] Fallback a Binance public API funciona cuando el backend no está disponible
- [ ] La página market muestra chart de velas con señales de indicadores en tiempo real
- [ ] `OverallSignal` y `OpportunityAnalysis` se derivan correctamente del snapshot
- [ ] Selector de asset e intervalo funciona y recarga el chart

---

**Depende de:** Spec 15 (trading module, análisis lib), Spec 03 (data-fetcher)
**Consumidores:** Spec 17 (chat usa noticias), Spec 22 (bot-analysis usa snapshot)
