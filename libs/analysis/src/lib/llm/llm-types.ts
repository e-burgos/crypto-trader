import { LLMAnalysisInput, LLMDecision } from '@crypto-trader/shared';

/**
 * Interface for LLM provider implementations.
 */
export interface LLMProviderClient {
  /** Unique provider name */
  readonly name: string;
  /** Send prompt and get raw text response */
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}

/**
 * Configuration for LLM analysis.
 */
export interface LLMAnalyzerConfig {
  /** Maximum retries on parse failure (default: 2) */
  maxRetries?: number;
  /** Temperature (0-1, default: 0.3) */
  temperature?: number;
}

/**
 * Build the structured prompt for LLM analysis.
 */
export function buildAnalysisPrompt(input: LLMAnalysisInput): {
  system: string;
  user: string;
} {
  const sandboxNote =
    input.userConfig.mode === 'SANDBOX'
      ? `\nSANDBOX MODE: This is a paper trading simulation with no real funds at risk. Prioritize TAKING POSITIONS to test the system end-to-end. Lean toward BUY when RSI < 60 and no strong bearish divergence. HOLD only when RSI > 70 or there is clear bearish breakdown.`
      : '';

  const newsWeightNote =
    input.newsItems.length > 0
      ? `\nNEWS WEIGHT: NEWS carries ${input.newsWeight}% weight in your decision. Strong NEGATIVE news overrides bullish technicals.`
      : '';

  const system = `You are a professional crypto trading analyst. Analyze the provided market data and return a JSON decision.

RULES:
- Only respond with valid JSON (no markdown, no explanation outside JSON)
- decision must be one of: "BUY", "SELL", "HOLD"
- confidence is a float between 0.0 and 1.0
- reasoning is a brief explanation (max 200 chars)
- suggestedWaitMinutes is how long to wait before next analysis (1-60)
${sandboxNote}${newsWeightNote}
FORMAT:
{
  "decision": "BUY" | "SELL" | "HOLD",
  "confidence": 0.0-1.0,
  "reasoning": "string",
  "suggestedWaitMinutes": number
}`;

  const recentCandles = input.recentCandles.slice(-5).map((c) => ({
    close: c.close,
    volume: c.volume,
    time: new Date(c.closeTime).toISOString(),
  }));

  const indicators = input.indicatorSnapshot;

  const newsSnippets = input.newsItems
    .slice(0, 10)
    .map((n) => {
      const parts = [`[${n.sentiment}][${n.source ?? ''}] ${n.headline}`];
      if ((n as any).summary)
        parts.push(`  → ${String((n as any).summary).slice(0, 200)}`);
      if ((n as any).author) parts.push(`  Autor: ${(n as any).author}`);
      return parts.join('\n');
    })
    .join('\n\n');

  const recentTradesSummary = input.recentTrades
    .slice(0, 3)
    .map((t) => `${t.type} @ ${t.price}`)
    .join(', ');

  const recentDecisionsSummary =
    input.recentDecisions && input.recentDecisions.length > 0
      ? input.recentDecisions
          .slice(0, 5)
          .map(
            (d) =>
              `${new Date(d.createdAt).toISOString().slice(11, 16)} ${d.decision} (${Math.round(d.confidence * 100)}%) — ${d.reasoning.slice(0, 100)}`,
          )
          .join('\n')
      : 'No previous decisions';

  const config = input.userConfig;

  const user = `ASSET: ${input.asset}/${input.pair}
MODE: ${config.mode}

INDICATORS:
- RSI: ${indicators.rsi.value} (${indicators.rsi.signal})
- MACD: ${indicators.macd.macd} / Signal: ${indicators.macd.signal} / Histogram: ${indicators.macd.histogram} (${indicators.macd.crossover})
- Bollinger: Upper ${indicators.bollingerBands.upper} / Middle ${indicators.bollingerBands.middle} / Lower ${indicators.bollingerBands.lower} (${indicators.bollingerBands.position})
- EMA: 9=${indicators.emaCross.ema9} / 21=${indicators.emaCross.ema21} / 50=${indicators.emaCross.ema50} / 200=${indicators.emaCross.ema200} (${indicators.emaCross.trend})
- Volume: ${indicators.volume.current} / Avg: ${indicators.volume.average} / Ratio: ${indicators.volume.ratio} (${indicators.volume.signal})

RECENT CANDLES:
${JSON.stringify(recentCandles)}

NEWS:
${newsSnippets || 'No recent news'}

RECENT TRADES: ${recentTradesSummary || 'None'}

PREVIOUS AGENT DECISIONS (newest first):
${recentDecisionsSummary}

THRESHOLDS:
- Buy confidence >= ${config.buyThreshold}%
- Sell confidence >= ${config.sellThreshold}%
- Stop loss: ${config.stopLossPct * 100}%
- Take profit: ${config.takeProfitPct * 100}%

Analyze and return JSON.`;

  return { system, user };
}

/**
 * Parse the LLM response into a validated LLMDecision.
 */
export function parseLLMResponse(raw: string): LLMDecision {
  // Strip markdown code blocks if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(cleaned);

  // Validate required fields
  const decision = parsed.decision;
  if (!['BUY', 'SELL', 'HOLD'].includes(decision)) {
    throw new Error(`Invalid decision: ${decision}`);
  }

  const confidence = Number(parsed.confidence);
  if (isNaN(confidence) || confidence < 0 || confidence > 1) {
    throw new Error(`Invalid confidence: ${parsed.confidence}`);
  }

  const reasoning = String(parsed.reasoning || '').slice(0, 500);

  const suggestedWaitMinutes = Math.max(
    1,
    Math.min(60, Number(parsed.suggestedWaitMinutes) || 5),
  );

  return { decision, confidence, reasoning, suggestedWaitMinutes };
}
