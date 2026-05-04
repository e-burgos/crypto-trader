# Spec 41 — Orchestrator: Distribución de Inputs Enriquecidos a Sub-agentes

**Fecha:** 2026-05-03  
**Versión:** 1.0  
**Estado:** Propuesto  
**Branch:** `feature/orchestrator-enriched-inputs`  
**Dependencias:** Spec 40 (market-data-sources-integration), Spec 28 (multi-agent-chat-rag)

---

## 1. Resumen ejecutivo

La Spec 40 introdujo 7+ fuentes de datos externas (Fear & Greed, Derivatives, DeFi Health, Global Market, Predictions, Token Unlocks, Technical Signals). Actualmente estos datos se pasan **crudos** (JSON sin procesar) directamente al prompt de síntesis, mientras los 4 sub-agentes solo reciben inputs internos.

Esto genera:

1. **Sobrecarga del sintetizador** — debe interpretar JSON crudo + sintetizar 4 outputs limpios.
2. **Redundancia** — altfins (Technical Signals) duplica nuestro IndicatorSnapshot interno.
3. **Subutilización de agentes** — AEGIS no ve derivatives (riesgo sistémico), CIPHER no participa en decisiones de trading.
4. **Inconsistencia** — 4 inputs procesados + 6 crudos = trato desigual de la información.

Esta spec redistribuye **todos** los inputs (internos + externos) a los sub-agentes según su rol, y agrega un nuevo task para CIPHER (`macro_context`), de modo que el sintetizador reciba **solo outputs limpios**.

### Principio de degradación graceful

Todas las fuentes externas son **opcionales**. El administrador puede desactivar cualquier source o todos. Los sub-agentes deben funcionar con lo que tengan disponible:

| Escenario                       | Comportamiento                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| Todas las fuentes activas       | 5 sub-agents → 5 outputs limpios → synthesis                                            |
| Sin fuentes externas            | 4 sub-agents (como hoy) → 4 outputs limpios → synthesis                                 |
| Parcial (ej: solo Fear & Greed) | Los agentes que reciben datos enriquecidos los usan; los demás operan solo con internos |
| CIPHER sin datos macro          | Se omite la llamada a CIPHER `macro_context` → synthesis recibe 4 outputs               |

---

## 2. Arquitectura

### 2.1 Categorías de inputs

| Categoría                   | ID          | Inputs internos (siempre disponibles)                      | Inputs externos (opcionales, Spec 40)                                          |
| --------------------------- | ----------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Técnico (TA)**            | `technical` | IndicatorSnapshot (RSI, MACD, EMA, Bollinger, Volume, S/R) | altfins Technical Signals                                                      |
| **Fundamental (Sentiment)** | `sentiment` | News DB (keyword/AI/SIGMA cached)                          | News externas (finnhub, messari, rss), Fear & Greed, Predictions               |
| **Macro (Context)**         | `macro`     | —                                                          | Global Market (mcap, dominance), DeFi Health (TVL, stablecoins), Token Unlocks |
| **Riesgo (Risk)**           | `risk`      | Open positions, Wallet balances, Config (SL/TP/maxPos)     | Derivatives (OI, funding rate, liquidations, L/S ratio)                        |
| **Operativo (Execution)**   | `execution` | Config thresholds, Recent trades, Recent decisions         | —                                                                              |

### 2.2 Asignación input → sub-agente

| Sub-agente | Task                      | Inputs internos               | Inputs externos (si disponibles)             | Output                                                   |
| ---------- | ------------------------- | ----------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| **SIGMA**  | `technical_signal`        | IndicatorSnapshot             | altfins signals (confirmación/contradicción) | `{ signal, confidence, confluenceFactors[], reasoning }` |
| **SIGMA**  | `news_sentiment`          | News DB headlines             | News externas + Fear & Greed + Predictions   | `{ sentiment, impact, confidence, reasoning }`           |
| **CIPHER** | `macro_context` _(nuevo)_ | —                             | Global Market + DeFi Health + Token Unlocks  | `{ regime, bias, keyFactors[], reasoning }`              |
| **AEGIS**  | `risk_gate`               | Positions + Balances + Config | Derivatives (funding, OI, liquidations)      | `{ verdict, riskScore, alerts[], reasoning }`            |
| **FORGE**  | `sizing_suggestion`       | Config + Open positions count | —                                            | `{ recommendation, maxTradeSize, reasoning }`            |

### 2.3 Flujo de decisión

```
Trading Processor
├── Recolecta inputs internos (siempre)
├── Recolecta inputs externos (si disponibles, via buildEnrichedSnapshot)
└── Pasa TODO al Orchestrator
         │
         ├── Clasifica inputs por categoría
         ├── Determina qué sub-agentes llamar (basado en datos disponibles)
         │
         ├── Parallel calls:
         │   ├── SIGMA(technical) ← IndicatorSnapshot + altfins?
         │   ├── SIGMA(sentiment) ← News DB + News ext? + F&G? + Predictions?
         │   ├── CIPHER(macro)    ← Global? + DeFi? + Unlocks? (SKIP si no hay datos)
         │   ├── AEGIS(risk)      ← Positions + Balances + Derivatives?
         │   └── FORGE(sizing)    ← Config + Positions
         │
         └── Synthesis ← N outputs limpios (4 o 5 según disponibilidad)
              └── BUY/SELL/HOLD + confidence + reasoning
```

### 2.4 Lógica de degradación

```typescript
// Pseudo-código del orchestrator
const calls = [
  // Siempre se ejecutan (inputs internos garantizados)
  sigma.technical(indicators, enriched?.technicalSignals),
  sigma.sentiment(
    newsDB,
    enriched?.news,
    enriched?.fearGreed,
    enriched?.predictions,
  ),
  forge.sizing(config, openPositions),
  aegis.risk(positions, balances, config, enriched?.derivatives),
];

// Solo si hay datos macro disponibles
const hasMacroData =
  enriched?.globalMarket || enriched?.defiHealth || enriched?.tokenUnlocks;
if (hasMacroData) {
  calls.push(
    cipher.macro(
      enriched.globalMarket,
      enriched.defiHealth,
      enriched.tokenUnlocks,
    ),
  );
}

const results = await Promise.allSettled(calls);
// → Synthesis recibe solo los outputs que resolvieron OK
```

### 2.5 Manejo de redundancia TA (altfins vs interno)

altfins provee señales técnicas externas que pueden **confirmar o contradecir** nuestro IndicatorSnapshot interno. SIGMA debe tratarlas como segunda opinión:

- **Confluencia** (ambos dicen lo mismo): aumentar `confidence` del signal
- **Divergencia** (opiniones opuestas): reducir `confidence`, mencionar en `reasoning`
- **Sin altfins** (source desactivado): SIGMA opera solo con IndicatorSnapshot (comportamiento actual)

---

## 3. Cambios en prompts de sub-agentes

### 3.1 SIGMA — `technical_signal` (modificar)

Agregar al prompt:

```
Si se proporcionan señales técnicas externas (altfins), úsalas como CONFIRMACIÓN o CONTRADICCIÓN:
- Si las señales externas coinciden con tu análisis interno → aumenta tu confianza
- Si divergen → reduce tu confianza y explica la divergencia en tu reasoning
- Si no hay señales externas → analiza solo con los indicadores internos (comportamiento normal)
```

### 3.2 SIGMA — `news_sentiment` (modificar)

Agregar al prompt:

```
Puedes recibir datos adicionales de sentimiento:
- Fear & Greed Index (0-100, clasificación): indicador agregado de sentimiento del mercado
- Prediction Markets: predicciones con dinero real sobre eventos crypto
- Noticias externas adicionales: de fuentes como finnhub, messari, rss

Si estos datos están disponibles, intégralos en tu análisis de sentimiento.
Si no están disponibles, analiza solo con las noticias proporcionadas (comportamiento normal).
```

### 3.3 CIPHER — `macro_context` (nuevo task)

```
Analiza el contexto macroeconómico del mercado crypto y determina el RÉGIMEN de mercado actual.

Datos disponibles:
- Global Market: market cap total, volumen 24h, dominancia BTC/ETH, trending coins
- DeFi Health: TVL total, cambio TVL, market cap de stablecoins, flujos
- Token Unlocks: desbloqueos de tokens próximos que pueden generar presión de venta

Emite tu análisis en JSON:
{
  "regime": "RISK_ON | RISK_OFF | NEUTRAL",
  "bias": "BULLISH | BEARISH | NEUTRAL",
  "confidence": 0.0-1.0,
  "keyFactors": ["factor1", "factor2"],
  "reasoning": "..."
}

Si los datos son insuficientes para determinar el régimen, indica confidence baja y reasoning explicando qué falta.
```

### 3.4 AEGIS — `risk_gate` (modificar)

Agregar al prompt:

```
Si se proporcionan datos de DERIVADOS (open interest, funding rate, liquidaciones, long/short ratio):
- Funding rate > 0.05% → señal de sobrecalentamiento del mercado (longs apalancados)
- Funding rate < -0.02% → señal de pánico/shorts excesivos
- Liquidaciones 24h > $500M → riesgo sistémico elevado (cascada de liquidaciones)
- Long/Short ratio > 2.0 → mercado muy sesgado (posible corrección)
- Long/Short ratio < 0.5 → pánico extremo (posible rebote)

Incorpora estos factores en tu riskScore y alerts[].
Si no hay datos de derivados, evalúa solo con portfolio, balances y config (comportamiento normal).
```

### 3.5 FORGE — `sizing_suggestion` (sin cambios)

No recibe inputs externos. Opera igual que hoy.

---

## 4. Cambios en el Orchestrator

### 4.1 `orchestrateDecision()` — Firma actualizada

```typescript
async orchestrateDecision(
  userId: string,
  configId: string,
  indicators: IndicatorSnapshot,
  news: NewsItemInput[],
  llmOverride?: { provider: string; model: string },
  enrichedData?: {  // ya existe, ahora se distribuye
    fearGreed?: FearGreedData;
    derivatives?: DerivativesData;
    defiHealth?: DefiHealthData;
    globalMarket?: GlobalMarketData;
    predictions?: PredictionData[];
    tokenUnlocks?: TokenUnlockData[];
    technicalSignals?: TechnicalSignalData[];
  },
): Promise<DecisionPayload>
```

### 4.2 Distribución de datos (nuevo)

En vez de pasar `enrichedData` crudo a la síntesis, se distribuye:

```typescript
// SIGMA technical: indicadores + altfins (si disponible)
const techContext = {
  indicators,
  ...(enrichedData?.technicalSignals?.length
    ? { externalSignals: enrichedData.technicalSignals }
    : {}),
};

// SIGMA sentiment: news DB + externals
const sentimentContext = {
  news: news.slice(0, 10),
  ...(enrichedData?.fearGreed ? { fearGreed: enrichedData.fearGreed } : {}),
  ...(enrichedData?.predictions?.length
    ? { predictions: enrichedData.predictions }
    : {}),
  // News externas del enriched se podrían mergear con las de DB
};

// CIPHER macro: global + defi + unlocks (solo si hay datos)
const macroContext = {
  ...(enrichedData?.globalMarket
    ? { globalMarket: enrichedData.globalMarket }
    : {}),
  ...(enrichedData?.defiHealth ? { defiHealth: enrichedData.defiHealth } : {}),
  ...(enrichedData?.tokenUnlocks?.length
    ? { tokenUnlocks: enrichedData.tokenUnlocks }
    : {}),
};
const hasMacroData = Object.keys(macroContext).length > 0;

// AEGIS risk: portfolio + derivatives (si disponible)
const riskContext = {
  portfolio: openPositions,
  availableBalances,
  indicators: {
    rsi: indicators.rsi,
    price: indicators.close,
    asset: config.asset,
  },
  config,
  ...(enrichedData?.derivatives
    ? { derivatives: enrichedData.derivatives }
    : {}),
};
```

### 4.3 Llamadas paralelas (modificar)

```typescript
const parallelCalls = [
  this.subAgent.call(
    'market',
    'technical_signal',
    techContext,
    userId,
    false,
    override,
  ),
  cachedSentiment ??
    this.subAgent.call(
      'market',
      'news_sentiment',
      sentimentContext,
      userId,
      false,
      override,
    ),
  this.subAgent.call(
    'operations',
    'sizing_suggestion',
    sizingContext,
    userId,
    false,
    override,
  ),
  this.subAgent.call('risk', 'risk_gate', riskContext, userId, false, override),
];

// Condicional: solo si hay datos macro
if (hasMacroData) {
  parallelCalls.push(
    this.subAgent.call(
      'blockchain',
      'macro_context',
      macroContext,
      userId,
      false,
      override,
    ),
  );
}

const results = await Promise.allSettled(parallelCalls);
```

### 4.4 Síntesis (modificar)

Eliminar `externalDataSources` del prompt de síntesis. Solo recibe outputs limpios:

```typescript
const synthesisContext = {
  technicalSignal: techOutput,
  newsSentiment: sentimentOutput,
  sizingSuggestion: forgeOutput,
  aegisVerdict: aegisOutput,
  ...(macroOutput ? { macroContext: macroOutput } : {}),
  buyThreshold: config.buyThreshold,
  sellThreshold: config.sellThreshold,
};
// Ya NO se pasa externalDataSources crudo
```

---

## 5. Cambios en `buildTaskUserPrompt()`

### 5.1 `technical_signal` (modificar)

```typescript
case 'technical_signal': {
  let prompt = `Analiza este snapshot de indicadores y emite tu señal de trading:
${JSON.stringify(context.indicators, null, 2)}`;
  if (context.externalSignals) {
    prompt += `\n\nSeñales técnicas externas (altfins) para CONFIRMAR/CONTRADECIR tu análisis:
${JSON.stringify(context.externalSignals, null, 2)}`;
  }
  return prompt;
}
```

### 5.2 `news_sentiment` (modificar)

```typescript
case 'news_sentiment': {
  let prompt = `Analiza estas noticias y emite tu análisis de sentimiento del mercado:
${JSON.stringify(context.news, null, 2)}`;
  if (context.fearGreed) {
    prompt += `\n\nFear & Greed Index: ${JSON.stringify(context.fearGreed)}`;
  }
  if (context.predictions) {
    prompt += `\n\nPrediction Markets (dinero real): ${JSON.stringify(context.predictions)}`;
  }
  return prompt;
}
```

### 5.3 `macro_context` (nuevo)

```typescript
case 'macro_context': {
  const sections: string[] = [];
  if (context.globalMarket)
    sections.push(`Global Market: ${JSON.stringify(context.globalMarket, null, 2)}`);
  if (context.defiHealth)
    sections.push(`DeFi Health: ${JSON.stringify(context.defiHealth, null, 2)}`);
  if (context.tokenUnlocks)
    sections.push(`Token Unlocks próximos: ${JSON.stringify(context.tokenUnlocks, null, 2)}`);
  return `Analiza el contexto macroeconómico del mercado crypto:\n\n${sections.join('\n\n')}\n\nEmite tu análisis de régimen de mercado en JSON.`;
}
```

### 5.4 `risk_gate` (modificar)

Agregar al prompt existente:

```typescript
if (context.derivatives) {
  prompt += `\n\nDatos de derivados del mercado:
${JSON.stringify(context.derivatives, null, 2)}
Incorpora estos datos en tu evaluación de riesgo sistémico.`;
}
```

### 5.5 `decision_synthesis` (simplificar)

```typescript
case 'decision_synthesis': {
  let prompt = `Sintetiza estas perspectivas de los sub-agentes y emite la decisión final:

SIGMA (Señal técnica): ${context.technicalSignal}
SIGMA (Sentimiento): ${context.newsSentiment}
FORGE (Sizing): ${context.sizingSuggestion}
AEGIS (Riesgo): ${context.aegisVerdict}`;

  if (context.macroContext) {
    prompt += `\nCIPHER (Contexto macro): ${context.macroContext}`;
  }

  prompt += `\n\nConfig: buyThreshold=${context.buyThreshold}%, sellThreshold=${context.sellThreshold}%
Emite el JSON de decisión final.`;
  return prompt;
}
```

---

## 6. Tipos y DTOs

### 6.1 Nuevo tipo `MacroContextOutput`

```typescript
// orchestrator/dto/macro-context.dto.ts
export interface MacroContextOutput {
  regime: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  keyFactors: string[];
  reasoning: string;
}
```

### 6.2 Actualizar `AgentTask`

```typescript
export type AgentTask =
  | 'technical_signal'
  | 'news_sentiment'
  | 'sizing_suggestion'
  | 'risk_gate'
  | 'macro_context' // ← nuevo
  | 'news_technical_relevance'
  | 'ecosystem_impact'
  | 'intent_classification'
  | 'decision_synthesis'
  | 'cross_agent_synthesis';
```

### 6.3 Actualizar `SubAgentResult`

Agregar `agentId: 'CIPHER'` como posibilidad en los results del orchestrator.

---

## 7. Frontend — Actualización de AgentInputSummary

La card "Entradas del Agente" en `/dashboard/bot-analysis` debe reflejar la nueva distribución. Cada grupo de la card corresponde a un sub-agente:

| Grupo card                | Sub-agente        | Datos mostrados                                         |
| ------------------------- | ----------------- | ------------------------------------------------------- |
| Precio & Mercado          | SIGMA (technical) | Precio, cambio 24h, señal técnica + confluencia altfins |
| Indicadores               | SIGMA (technical) | RSI, MACD, EMA, Bollinger, Volume, S/R                  |
| Noticias & Sentimiento    | SIGMA (sentiment) | Método, sentiment, distribución + F&G, predictions      |
| Contexto Macro            | CIPHER (macro)    | Régimen, DeFi TVL, Global MCap, Unlocks                 |
| Fuentes Externas (footer) | Meta              | N sources activas, N fallidas                           |
| Historial                 | Meta              | Últimas 5 decisiones                                    |

> Nota: El grupo "Contexto Macro" solo se muestra si CIPHER recibió datos. Si no hay fuentes macro activas, el grupo se omite.

---

## 8. Fases de implementación

### Fase A — Backend: Distribución de inputs + CIPHER macro_context

1. Agregar `macro_context` a `AgentTask`
2. Crear prompt de CIPHER para `macro_context` en `AGENT_SYSTEM_PROMPTS`
3. Agregar `buildTaskUserPrompt` para `macro_context`
4. Modificar `orchestrateDecision()` para distribuir enrichedData a los sub-agentes
5. Modificar prompts de `technical_signal`, `news_sentiment`, `risk_gate` para aceptar datos enriquecidos opcionales
6. Simplificar `decision_synthesis` — eliminar `externalDataSources` crudo
7. Agregar lógica condicional para CIPHER (solo si hay datos macro)
8. Tests unitarios del orchestrator con y sin datos externos

### Fase B — Frontend: AgentInputSummary restructurado

1. Actualizar grupos de la card para reflejar la nueva distribución
2. Agregar grupo "Contexto Macro" condicional
3. Verificar degradación graceful en UI (sin sources → sin grupo macro)

### Fase C — E2E y verificación

1. Test E2E: decisión con todas las fuentes activas (5 sub-agents)
2. Test E2E: decisión sin fuentes externas (4 sub-agents, como antes)
3. Test E2E: decisión con fuentes parciales (ej: solo Fear & Greed)
4. Verificar que los tokens del prompt de síntesis se redujeron

---

## 9. Out of scope

- Fine-tuning de sub-agentes con resultados de trading
- Nuevos sub-agentes más allá de CIPHER macro_context
- Cambios en el modelo de datos (AgentDecision schema)
- Cambios en la lógica de ejecución de trades (post-decision)
- UI de market-intelligence (ya implementada en Spec 40)

---

## 10. Decisiones de diseño

| #   | Decisión                                                                              | Alternativa                                         | Razón                                                                                                             |
| --- | ------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Distribuir datos a sub-agentes existentes en vez de crear un nuevo "enrichment agent" | Un solo agente que pre-procese todo el enrichedData | Reutiliza la expertise de cada agente (AEGIS ya sabe de riesgo, SIGMA de TA) en vez de crear un generalista nuevo |
| 2   | CIPHER para macro_context en vez de un agente nuevo                                   | Crear agente MACRO dedicado                         | CIPHER ya tiene expertise blockchain/DeFi en su system prompt; macro_context es extensión natural de su dominio   |
| 3   | Llamada a CIPHER condicional (solo si hay datos)                                      | Llamar siempre y que responda "sin datos"           | Ahorra una llamada LLM innecesaria cuando no hay sources macro activos                                            |
| 4   | altfins como confirmación de SIGMA, no reemplazo                                      | Priorizar altfins sobre indicadores internos        | Nuestros indicadores son determinísticos y confiables; altfins es una segunda opinión probabilística              |
| 5   | Fear & Greed va a SIGMA(sentiment), no a CIPHER(macro)                                | Ponerlo en macro context                            | F&G es un indicador de sentimiento de mercado, no de condiciones macro. SIGMA ya analiza sentimiento              |
| 6   | Derivatives va a AEGIS, no a SIGMA                                                    | Ponerlo en análisis técnico                         | Funding rate y liquidaciones son indicadores de RIESGO sistémico, no señales de trading directas                  |
