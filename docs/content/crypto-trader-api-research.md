# Crypto Trader — Investigación de APIs de Datos de Mercado

**Fecha:** Abril 2026  
**Proyecto:** Crypto Trader (monorepo NX — NestJS + React 19)  
**Objetivo:** Enriquecer el input de los agentes de IA con fuentes de datos externas de calidad, manteniendo control total desde el panel de administración.

---

## 1. Contexto del proyecto

### Arquitectura relevante

El sistema ya tiene un flujo de datos centralizado. Los agentes **no hacen llamadas propias** a fuentes externas — reciben snapshots ya preparados por `MarketService.ts`.

```
Binance API (OHLCV)
  → BinanceRestClient.getKlines()         [libs/data-fetcher]
  → calculateIndicatorSnapshot()          (RSI, MACD, BB, EMA, S/R)

NewsAggregator                            [libs/data-fetcher]
  → CoinGecko, RSS feeds, Reddit
  → Opcional: NewsData.io, CryptoPanic

MarketService.ts                          ← PUNTO DE AGREGACIÓN CENTRAL
  ↓
TradingProcessor.runCycle()               (job Bull/Redis)
  ↓
OrchestratorService.orchestrateDecision()
  → SIGMA (market)    — análisis técnico
  → SIGMA (sentiment) — sentimiento de noticias
  → FORGE (operations)— sizing de órdenes
  → AEGIS (risk)      — gate de riesgo
  ↓
BUY / SELL / HOLD → DB + WebSocket → Dashboard
```

### Panel de administración (ya implementado)

El panel admin en `apps/web/src/pages/admin/` ya incluye:

- Toggle de providers LLM (`llm-providers.tsx`)
- Configuración de modelo por agente (`agent-models.tsx`)
- Kill switch global (`admin.service.ts`)
- Audit log de acciones (`audit-log.tsx`)

El patrón de toggle de LLM providers es el **modelo a replicar** para las integraciones de datos.

### Agentes disponibles

| Agente | Rol | Fuentes de datos relevantes |
|---|---|---|
| SIGMA | Análisis técnico + sentimiento | TA, noticias, sentimiento social, market data |
| AEGIS | Gestión de riesgo | Derivados, TVL, token unlocks, on-chain macro |
| CIPHER | Análisis blockchain/DeFi (futuro) | Fundamentals, prediction markets, narrativa |
| KRYPTO | Orquestador central | Todas |
| FORGE | Sizing de órdenes | Market data, liquidez |
| SYNTHESIS | Decisión final | Síntesis de todos los agentes |

---

## 2. Metodología de investigación

Se realizaron **tres rondas de búsqueda exhaustiva** sobre plataformas de datos crypto para trading algorítmico, cubriendo:

- APIs de análisis técnico pre-calculado
- APIs de sentimiento y noticias
- Plataformas on-chain (derivados, TVL, métricas macro)
- Plataformas científicas/académicas de acceso gratuito
- Prediction markets como señal de consenso
- Comparativas de pricing verificadas a abril 2026

---

## 3. Inventario completo — 16 plataformas evaluadas

### Criterios de evaluación

- **Free tier real:** ¿Es útil en producción o solo para probar?
- **Dato único:** ¿Qué da esta plataforma que ninguna otra da gratis?
- **Solapamiento:** ¿Puede ser reemplazada por otra ya en el stack?
- **MCP nativo:** ¿Tiene integración directa con agentes LLM?
- **Nivel de integración:** Complejidad para integrar al `MarketService`

---

### 3.1 Plataformas INCLUIR — Core del stack

#### Binance API
- **Tipo:** Exchange + ejecución
- **Costo:** $0
- **Rate limit:** 1.200 req/min
- **Agentes:** Todos
- **Dato único:** Precio real + ejecución de órdenes. WebSocket nativo con latencia mínima. Spot + futuros + order book en una sola API.
- **Pros:** Fuente de verdad para precio y liquidez. Ya integrado.
- **Contras:** No da indicadores técnicos calculados. No cubre sentimiento ni on-chain.
- **Veredicto:** Irremplazable — es la base de ejecución de todo el sistema.

---

#### altFINS API ⭐
- **Tipo:** TA pre-calculado + señales de trading
- **Costo:** Free tier (limitado) / $20/mes Basic
- **Cobertura:** 2.000 activos, 5 timeframes (15m, 1h, 4h, 12h, 1d), 7 años de histórico
- **Agentes:** SIGMA, KRYPTO
- **Dato único:** 150 indicadores técnicos pre-calculados + 130 señales de trading listas para consumir + 35 patrones de velas detectados automáticamente. MCP Server nativo para agentes LLM.
- **Pros:**
  - Señales ya interpretadas — SIGMA razona directamente sin procesar datos crudos
  - Reemplaza `libs/analysis` + TAAPI en un solo endpoint
  - MCP nativo: los agentes pueden consultar en lenguaje natural
  - Fundamental metrics incluidas (TVL, revenue, P/S ratios)
  - Backtesting con 7 años de histórico
- **Contras:**
  - Free tier insuficiente para producción real
  - Solo 2.000 activos (no cubre long-tail de altcoins)
  - Plan pagado necesario para uso continuo ($20/mes)
- **Veredicto:** La elección central para SIGMA. Reemplaza el cálculo manual de indicadores y TAAPI. El upgrade más impactante del stack.

---

#### Coinalyze ⭐
- **Tipo:** Derivados crypto agregados
- **Costo:** $0 — 40 req/min
- **Agentes:** AEGIS, SIGMA
- **Dato único:** Open interest + funding rate + liquidaciones + ratio long/short + CVD (Cumulative Volume Delta) — todo agregado de múltiples exchanges en un solo endpoint, completamente gratuito.
- **Pros:**
  - La única API gratuita que da derivados completos y agregados
  - Agrega Binance, Bybit, OKX, BitMEX automáticamente
  - Funding rate es la señal más limpia de posicionamiento sobrecargado
  - CVD permite detectar si una subida es spot genuina o short squeeze
- **Contras:**
  - Historial intraday limitado (1.500–2.000 datapoints por intervalo)
  - Menos métricas macro profundas que Glassnode
- **Cómo leer las señales:**
  - Funding alto + OI en expansión + momentum spot frenándose = mercado recalentado, riesgo de corrección
  - Funding negativo + OI cayendo = exceso de shorts, potencial short squeeze
  - Liquidaciones masivas = el movimiento fue acelerado por cascada, no por demanda real
- **Veredicto:** Irremplazable para AEGIS. Ninguna otra API gratuita da derivados completos agregados.

---

#### DefiLlama
- **Tipo:** DeFi TVL + stablecoins + DEX volume
- **Costo:** $0 sin límite
- **Cobertura:** 7.000+ protocolos, 500+ blockchains
- **Agentes:** AEGIS, SIGMA
- **Dato único:** TVL sistémico del ecosistema DeFi como señal de riesgo macro. Open source con metodología pública.
- **Pros:**
  - API completamente gratuita sin registro obligatorio
  - TVL como indicador de salud sistémica (caída de TVL 30% → señal de riesgo)
  - Cubre stablecoins, DEX volume, hacks históricos
  - Actualización en tiempo real
- **Contras:**
  - No da indicadores técnicos ni sentimiento
  - Enfocado en DeFi — no cubre CeFi ni CEX
- **Veredicto:** Gratis total. La mejor señal de riesgo sistémico para AEGIS.

---

#### Alternative.me — Fear & Greed Index
- **Tipo:** Índice de sentimiento macro
- **Costo:** $0 ilimitado
- **Agentes:** SIGMA, KRYPTO
- **Dato único:** Índice 0–100 del estado emocional del mercado crypto, calculado diariamente y por hora. Historial completo desde 2018.
- **Pros:**
  - Un número que resume el sentimiento macro del mercado
  - Sin autenticación, integración en minutos
  - Extremos históricos correlacionan con puntos de reversión
- **Contras:**
  - Solo BTC como referencia subyacente
  - No distingue sentimiento entre activos individuales
- **Veredicto:** Integración inmediata, valor alto, cero costo. Incluir siempre.

---

#### CoinGecko API (Demo)
- **Tipo:** Market data agregado global
- **Costo:** $0 — 10.000 créditos/mes, 30 req/min
- **Cobertura:** 18.000 CEX tokens + 30 millones DEX tokens, 250+ networks
- **Agentes:** SIGMA, KRYPTO
- **Dato único:** Dominancia BTC, trending global, DEX data vía GeckoTerminal, metadata de 30M+ tokens.
- **Pros:**
  - La API más usada por devs en la industria (5x más actividad GitHub que la siguiente)
  - DEX data incluida en plan gratuito
  - Usada por MetaMask, Coinbase, Etherscan, Kraken
  - 1 año de histórico en plan Demo
- **Contras:**
  - No da indicadores técnicos calculados
  - Rate limit bajo en free (30 req/min)
  - Delay en actualizaciones de precio vs Binance directa
- **Veredicto:** Complementa Binance para contexto global de mercado. Free tier suficiente para arrancar.

---

#### Finnhub
- **Tipo:** Noticias financieras + sentimiento NLP
- **Costo:** $0 — 60 calls/min
- **Agentes:** SIGMA, CIPHER
- **Dato único:** Noticias de 500+ medios financieros con score de sentimiento positivo/negativo ya calculado por NLP. El free tier más generoso del mercado para noticias.
- **Pros:**
  - Reemplaza CryptoPanic y el RSS fetcher actual directamente
  - Score NLP pre-calculado — no requiere llamada LLM adicional para clasificar
  - 60 calls/min gratis es más que suficiente para el ciclo de trading
- **Contras:**
  - Cobertura más débil en altcoins de baja capitalización
  - No cubre redes sociales (X, Reddit)
- **Veredicto:** Reemplaza el fetcher de noticias actual con score de sentimiento incluido.

---

#### Messari (Free API)
- **Tipo:** Research crypto + token unlocks
- **Costo:** $0 — 20 req/min
- **Cobertura:** 40.000 activos
- **Agentes:** AEGIS, CIPHER
- **Dato único:** Calendarios de desbloqueo de tokens (token unlock schedules). Cuando un proyecto va a liberar millones de tokens, eso genera presión vendedora predecible que AEGIS puede anticipar.
- **Pros:**
  - Única API gratuita con calendarios de unlocks
  - Noticias agregadas de 500+ fuentes
- **Contras:**
  - Research profundo solo en plan pago ($500/mes)
  - Rate limit de 20 req/min limita frecuencia de consulta
- **Veredicto:** Los token unlocks son una señal de riesgo única que ninguna otra API gratuita da.

---

#### Polymarket API
- **Tipo:** Prediction market — probabilidades consensuadas
- **Costo:** $0
- **Volumen:** $10.600 millones en notional mensual (marzo 2026)
- **Agentes:** SIGMA, CIPHER
- **Dato único:** Probabilidades implícitas de eventos crypto y macro con dinero real en juego. Es el consenso más honesto disponible — los traders ponen capital, no opiniones.
- **Pros:**
  - Señal adelantada para eventos macro (Fed, regulación, halvings)
  - SDK oficial con REST + WebSocket
  - Volumen institucional creciente — ICE ya distribuye sus datos
  - Gratuito para lectura de datos de mercado
- **Contras:**
  - No todos los activos tienen mercados activos en Polymarket
  - Requiere wallet Polygon para operar (solo lectura es libre)
- **Veredicto:** Señal única de consenso con dinero real. Nadie más da esto gratis.

---

### 3.2 Plataformas OPCIONALES — Valor real, integración más compleja

#### Token Terminal
- **Tipo:** Fundamentals de protocolos crypto
- **Costo:** $0 dashboard web / API REST pagada
- **Agentes:** SIGMA, CIPHER
- **Dato único:** Revenue, fees, P/S ratio, usuarios activos por protocolo. Aplica lógica de análisis fundamental de equity al cripto.
- **Pros:** Fundamentals tipo equity para cripto — único en su tipo. Revenue real vs. emisión de tokens.
- **Contras:** API REST requiere plan pago. Dashboard web gratuito pero integración programática directa no es gratuita.
- **Veredicto:** Valioso para research de CIPHER, pero la integración API directa tiene costo.

---

#### Dune Analytics
- **Tipo:** On-chain queries SQL — cualquier dato de blockchain
- **Costo:** Queries públicos gratis / API propia $390/mes
- **Cobertura:** 100+ blockchains, 3+ petabytes de datos indexados
- **Agentes:** AEGIS, SIGMA
- **Dato único:** Flexibilidad total — cualquier métrica on-chain custom. MCP nativo para consultas en lenguaje natural.
- **Pros:** Potencia máxima para on-chain. MCP nativo. Miles de dashboards públicos ya disponibles.
- **Contras:** API programática propia cuesta $390/mes. Requiere SQL para queries custom. Curva alta.
- **Veredicto:** Potente pero costoso. La opción viable es consumir dashboards públicos existentes vía MCP.

---

#### CryptoQuant
- **Tipo:** On-chain macro + derivados
- **Costo:** Free con delay / planes pagados
- **Agentes:** AEGIS
- **Dato único:** Exchange inflows/outflows y miner flows para BTC — señales de acumulación institucional.
- **Pros:** Miner flows es una señal de largo plazo única para BTC.
- **Contras:** Lo más valioso requiere plan pago. OI y funding rate ya los cubre Coinalyze mejor y gratis. Delay en free tier lo hace poco útil para trading activo.
- **Veredicto:** Parcialmente reemplazado por Coinalyze. Solo sumar si se necesitan miner flows específicamente.

---

#### LunarCrush ⭐ (stack balanceado)
- **Tipo:** Social intelligence crypto
- **Costo:** ~$15–50/mes (free tier muy limitado para API)
- **Cobertura:** 4.000+ activos, fuentes: X, Reddit, YouTube, TikTok
- **Agentes:** SIGMA, CIPHER
- **Dato único:** Galaxy Score™ (precio + social + spam detection) y AltRank™ (fuerza relativa entre activos). El mejor en inteligencia social del mercado. MCP nativo.
- **Pros:** La herramienta más completa de social intelligence. MCP nativo para agentes. Cubre fuentes que Finnhub no toca.
- **Contras:** Free tier inútil para producción. Requiere inversión mensual.
- **Veredicto:** La mejor herramienta social del mercado. Incorporar cuando el sistema genere retorno real.

---

#### Glassnode ⭐ (stack balanceado)
- **Tipo:** On-chain macro institucional
- **Costo:** Free básico (muy limitado) / $29/mes Advanced
- **Cobertura:** 7.500+ métricas, 1.200 activos. MCP nativo lanzado en 2025.
- **Agentes:** AEGIS, SIGMA
- **Dato único:** MVRV, SOPR, NUPL — las señales de ciclo de mercado de referencia institucional. Determina si BTC está en zona de distribución o acumulación.
- **Pros:** El estándar institucional para on-chain BTC/ETH. MVRV y SOPR son irremplazables para análisis de ciclo. MCP nativo.
- **Contras:** Free tier muy limitado para API en producción. Plan útil empieza en $29/mes.
- **Veredicto:** El upgrade natural de AEGIS. Incorporar cuando el sistema esté en LIVE generando retorno.

---

### 3.3 Plataformas DESCARTAR — Reemplazadas o inviables actualmente

#### Sentora (IntoTheBlock)
- **Problema:** API legacy discontinuada. Solo plataforma web gratuita. Integración programática no disponible actualmente.
- **Alternativa:** DefiLlama para TVL sistémico.

#### Augmento
- **Problema:** Solo 25+ activos. Estado del servicio en 2026 incierto. Menor cobertura que Finnhub.
- **Alternativa:** Finnhub para noticias + sentimiento.

#### Santiment
- **Problema:** Free tier con delay significativo. Plan útil ~$49/mes. Relación costo/beneficio baja dado el stack gratuito disponible.
- **Alternativa:** Coinalyze + Alternative.me cubren lo mismo gratis.

#### TAAPI.IO
- **Problema:** Reemplazado completamente por altFINS, que da más indicadores, más señales, historial de 7 años y MCP nativo al mismo precio (~$2/mes vs $20/mes altFINS Basic).
- **Alternativa:** altFINS API.

#### TradingView
- **Problema:** No tiene API pública de datos de mercado. Solo webhooks vía Pine Script alerts. No apto para integración programática en el ciclo de trading.

#### The TIE
- **Problema:** Sin precio público. B2B institucional. Fuera del alcance para la fase actual.

---

## 4. Stack gratuito — $0/mes

Cubre las **5 dimensiones esenciales** del sistema: ejecución, análisis técnico, derivados/riesgo, sentimiento y narrativa.

| Categoría | Plataforma | Costo | Agentes destino |
|---|---|---|---|
| Ejecución | Binance API | $0 | Todos |
| TA + señales | altFINS (free tier) | $0 | SIGMA |
| Derivados | Coinalyze | $0 | AEGIS |
| DeFi / riesgo sistémico | DefiLlama | $0 | AEGIS |
| Sentimiento macro | Alternative.me | $0 | SIGMA |
| Noticias + NLP | Finnhub | $0 | CIPHER |
| Market data global | CoinGecko Demo | $0 | SIGMA |
| Token unlocks | Messari (free tier) | $0 | AEGIS |
| Prediction market | Polymarket API | $0 | CIPHER |
| **Total** | **9 fuentes** | **$0/mes** | |

---

## 5. Stack balanceado — $64/mes

Mantiene el stack gratuito como base y agrega **3 upgrades** que cambian el nivel real del sistema cuando ya genera retorno.

| Categoría | Plataforma | Costo | Cambio vs. free |
|---|---|---|---|
| Ejecución | Binance API | $0 | Sin cambio |
| TA + señales ⭐ | **altFINS API (Basic)** | $20/mes | Free tier → producción real con backtesting |
| On-chain macro ⭐ | **Glassnode (Advanced)** | $29/mes | Agrega MVRV, SOPR, NUPL para AEGIS |
| Derivados | Coinalyze | $0 | Sin cambio |
| DeFi / riesgo | DefiLlama | $0 | Sin cambio |
| Social intelligence ⭐ | **LunarCrush** | $15/mes | Agrega Galaxy Score + AltRank para SIGMA/CIPHER |
| Noticias + NLP | Finnhub | $0 | Sin cambio |
| Sentimiento macro | Alternative.me | $0 | Sin cambio |
| Market data global | CoinGecko Demo | $0 | Sin cambio |
| Token unlocks | Messari (free) | $0 | Sin cambio |
| Prediction market | Polymarket API | $0 | Sin cambio |
| **Total** | **11 fuentes** | **$64/mes** | |

---

## 6. Arquitectura de integración propuesta

### Principio de diseño

Cada integración es un **módulo independiente** que se puede activar o desactivar desde el panel admin. Cuando hay solapamiento entre fuentes, el sistema usa la de mayor prioridad y cae al fallback si no está disponible.

```
DataSourceRegistry
  ├── AltFinsProvider      (activo, prioridad 1)  →  SIGMA: indicadores TA
  │     └── fallback: calculateIndicatorSnapshot() actual (libs/analysis)
  ├── CoinalyzeProvider    (activo, prioridad 1)  →  AEGIS: derivados
  ├── DefiLlamaProvider    (activo, prioridad 1)  →  AEGIS: TVL sistémico
  ├── FinnhubProvider      (activo, prioridad 1)  →  CIPHER: noticias + NLP
  │     └── fallback: NewsAggregator + RSS actual (libs/data-fetcher)
  ├── AlternativeMeProvider(activo, prioridad 1)  →  SIGMA: F&G index
  ├── CoinGeckoProvider    (activo, prioridad 1)  →  SIGMA: market data
  ├── MessariProvider      (activo, prioridad 1)  →  AEGIS: token unlocks
  └── PolymarketProvider   (activo, prioridad 1)  →  CIPHER: prediction odds
                    ↓
         MarketService.ts (enriquecido)
                    ↓
         Agentes: SIGMA, AEGIS, CIPHER
```

### Piezas a construir

**1. Modelo Prisma — `DataSourceConfig`**

Nueva tabla en schema.prisma:

```prisma
model DataSourceConfig {
  id              String   @id @default(cuid())
  name            String   @unique  // "altfins", "coinalyze", etc.
  displayName     String
  isActive        Boolean  @default(false)
  priority        Int      @default(1)
  targetAgents    String[] // ["SIGMA", "AEGIS"]
  category        String   // "technical", "derivatives", "sentiment", "news", "onchain"
  apiKey          String?  // encriptada, null si es pública
  lastSuccessAt   DateTime?
  consecutiveErrors Int    @default(0)
  metadata        Json?    // config específica del provider
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**2. Interfaz común `IDataSourceProvider`**

```typescript
// libs/data-fetcher/src/providers/base.provider.ts
export interface IDataSourceProvider {
  readonly name: string;
  readonly category: DataSourceCategory;
  readonly targetAgents: AgentId[];
  
  isAvailable(): Promise<boolean>;
  fetch(symbol: string, config?: any): Promise<DataSourcePayload>;
}
```

**3. `DataSourceRegistry` — servicio NestJS**

```typescript
// apps/api/src/market/data-source.registry.ts
@Injectable()
export class DataSourceRegistry {
  getBestSource(category: string): IDataSourceProvider | null
  getActiveSources(agent: AgentId): IDataSourceProvider[]
  toggle(name: string, active: boolean): Promise<void>
  getHealth(): DataSourceHealth[]
}
```

**4. Lógica de prioridad + fallback en `MarketService`**

```typescript
// Pseudocódigo de la lógica de prioridad
async buildSnapshot(symbol: string): Promise<MarketSnapshot> {
  const taSource = this.registry.getBestSource('technical');
  
  let indicators: IndicatorSnapshot;
  if (taSource) {
    try {
      indicators = await taSource.fetch(symbol);
    } catch {
      // fallback al cálculo manual existente
      indicators = await this.calculateIndicatorSnapshot(symbol);
    }
  } else {
    indicators = await this.calculateIndicatorSnapshot(symbol);
  }
  
  // ... mismo patrón para cada categoría
}
```

**5. Panel admin — nueva página**

Nueva página en `apps/web/src/pages/admin/data-sources.tsx` siguiendo el patrón de `llm-providers.tsx`:

- Lista de todas las fuentes con estado activo/inactivo
- Toggle por fuente
- Indicadores de salud (última respuesta exitosa, errores consecutivos)
- Agentes destino de cada fuente
- Costo mensual estimado del stack activo

### Reglas de fallback por categoría

| Categoría | Fuente primaria | Fallback |
|---|---|---|
| Análisis técnico | altFINS API | `calculateIndicatorSnapshot()` actual |
| Noticias + sentimiento | Finnhub | NewsAggregator + RSS actual |
| Market data | CoinGecko | Binance (precio básico) |
| Derivados | Coinalyze | Sin fallback (dato nuevo) |
| DeFi / TVL | DefiLlama | Sin fallback (dato nuevo) |
| Token unlocks | Messari | Sin fallback (dato nuevo) |
| Sentimiento macro | Alternative.me | Sin fallback (dato nuevo) |
| Prediction market | Polymarket | Sin fallback (dato nuevo) |

### Control del administrador

El admin puede desde el panel:

1. **Activar/desactivar** cada fuente individualmente
2. **Ver el estado de salud** — última respuesta exitosa, errores consecutivos, latencia
3. **Ver qué agentes** consume cada fuente
4. **Ver el costo mensual estimado** del stack actual activo
5. Todas las acciones se **loguean en `AdminAction`** (audit log existente)

Cuando una fuente falla más de N veces consecutivas, el sistema:
- La marca como degradada en el registry
- Cae automáticamente al fallback
- Loguea el evento en el audit log
- Crea notificación para el admin

---

## 7. Orden de implementación sugerido

### Fase 1 — Infraestructura base (sin integraciones aún)
1. Crear `DataSourceConfig` en Prisma + migración
2. Crear interfaz `IDataSourceProvider` en `libs/data-fetcher`
3. Crear `DataSourceRegistry` service en NestJS
4. Crear página admin `data-sources.tsx` con el toggle (sin providers reales todavía)
5. Conectar la lógica de fallback en `MarketService`

### Fase 2 — Integraciones gratuitas prioritarias (mayor impacto primero)
1. `FinnhubProvider` — reemplaza RSS + CryptoPanic (impacto inmediato en CIPHER)
2. `AlternativeMeProvider` — Fear & Greed Index (integración trivial, impacto alto)
3. `CoinalyzeProvider` — derivados para AEGIS (dato completamente nuevo)
4. `DefiLlamaProvider` — TVL sistémico para AEGIS (dato completamente nuevo)

### Fase 3 — Integraciones gratuitas secundarias
5. `MessariProvider` — token unlocks para AEGIS
6. `PolymarketProvider` — prediction market para CIPHER
7. `AltFinsProvider` — free tier primero, luego upgrade a Basic

### Fase 4 — Upgrades cuando el sistema genere retorno real
8. altFINS Basic ($20/mes) — activar plan pago para producción completa
9. LunarCrush ($15/mes) — social intelligence para SIGMA/CIPHER
10. Glassnode Advanced ($29/mes) — on-chain macro para AEGIS

---

## 8. Decisiones de diseño pendientes de confirmar

1. **Fallback silencioso vs. ruidoso:** ¿Cuando una fuente falla, solo se loguea internamente o también se notifica al admin en tiempo real?

2. **API keys — plataforma vs. usuario:** ¿Las keys de las integraciones son plataforma (una sola, maneja el admin) o cada usuario puede poner la suya como pasa con los LLM providers?

3. **Granularidad del snapshot:** Cada provider nuevo agrega campos al `MarketSnapshot`. ¿Se modela como campos opcionales en el tipo existente o se crea un tipo extendido `EnrichedMarketSnapshot`?

4. **Circuit breaker:** ¿Cuántos errores consecutivos antes de marcar una fuente como degradada y caer al fallback? (sugerido: 3 errores en 5 minutos)

---

## 9. Referencias

- **Transcript de investigación:** Sesión del 25–27 de abril 2026
- **Archivo HTML con análisis visual:** `crypto_trader_api_analysis.html`
- **Arquitectura del proyecto:** `docs/CONSTITUTION.md`
- **Punto de agregación central:** `apps/api/src/market/market.service.ts`
- **Modelo a replicar (toggle LLM):** `apps/api/src/llm/platform-llm-provider.service.ts`
- **Panel admin existente:** `apps/web/src/pages/admin/`
