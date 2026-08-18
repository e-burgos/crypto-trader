import { parseLLMResponse, buildAnalysisPrompt } from './llm-types';
import { createLLMProvider } from './llm-factory';
import {
  LLMProvider,
  Asset,
  QuoteCurrency,
  TradingMode,
} from '@crypto-trader/shared';
import type { LLMAnalysisInput } from '@crypto-trader/shared';

describe('parseLLMResponse', () => {
  it('should parse valid JSON response', () => {
    const raw = JSON.stringify({
      decision: 'BUY',
      confidence: 0.85,
      reasoning: 'Strong bullish momentum',
      suggestedWaitMinutes: 15,
    });

    const result = parseLLMResponse(raw);

    expect(result.decision).toBe('BUY');
    expect(result.confidence).toBe(0.85);
    expect(result.reasoning).toBe('Strong bullish momentum');
    expect(result.suggestedWaitMinutes).toBe(15);
  });

  it('should handle markdown-wrapped JSON', () => {
    const raw =
      '```json\n{"decision":"HOLD","confidence":0.5,"reasoning":"Neutral","suggestedWaitMinutes":10}\n```';
    const result = parseLLMResponse(raw);
    expect(result.decision).toBe('HOLD');
  });

  it('should clamp suggestedWaitMinutes between 1 and 60', () => {
    const result = parseLLMResponse(
      JSON.stringify({
        decision: 'SELL',
        confidence: 0.7,
        reasoning: 'test',
        suggestedWaitMinutes: 120,
      }),
    );
    expect(result.suggestedWaitMinutes).toBe(60);
  });

  it('should reject invalid decision', () => {
    expect(() =>
      parseLLMResponse(
        JSON.stringify({ decision: 'MAYBE', confidence: 0.5, reasoning: '' }),
      ),
    ).toThrow('Invalid decision');
  });

  it('should reject invalid confidence', () => {
    expect(() =>
      parseLLMResponse(
        JSON.stringify({ decision: 'BUY', confidence: 2.0, reasoning: '' }),
      ),
    ).toThrow('Invalid confidence');
  });

  it('should reject non-JSON', () => {
    expect(() => parseLLMResponse('not json at all')).toThrow();
  });

  it('should truncate long reasoning', () => {
    const result = parseLLMResponse(
      JSON.stringify({
        decision: 'HOLD',
        confidence: 0.5,
        reasoning: 'A'.repeat(600),
        suggestedWaitMinutes: 5,
      }),
    );
    expect(result.reasoning.length).toBeLessThanOrEqual(500);
  });
});

describe('buildAnalysisPrompt', () => {
  it('should produce system and user prompts', () => {
    const input: LLMAnalysisInput = {
      asset: Asset.BTC,
      pair: QuoteCurrency.USDT,
      indicatorSnapshot: {
        rsi: { value: 55, signal: 'NEUTRAL' as const },
        macd: {
          macd: 10,
          signal: 8,
          histogram: 2,
          crossover: 'BULLISH' as const,
        },
        bollingerBands: {
          upper: 70000,
          middle: 65000,
          lower: 60000,
          bandwidth: 10000,
          position: 'INSIDE' as const,
        },
        emaCross: {
          ema9: 65500,
          ema21: 65000,
          ema50: 64000,
          ema200: 60000,
          trend: 'BULLISH' as const,
        },
        volume: {
          current: 100,
          average: 80,
          ratio: 1.25,
          signal: 'NORMAL' as const,
        },
        supportResistance: { support: [60000], resistance: [70000] },
        timestamp: Date.now(),
      },
      recentCandles: [
        {
          openTime: 1,
          open: 65000,
          high: 65500,
          low: 64500,
          close: 65200,
          volume: 100,
          closeTime: 2,
        },
      ],
      newsItems: [],
      recentTrades: [],
      userConfig: {
        id: 'cfg-1',
        userId: 'u-1',
        asset: Asset.BTC,
        pair: QuoteCurrency.USDT,
        buyThreshold: 70,
        sellThreshold: 70,
        stopLossPct: 0.03,
        takeProfitPct: 0.05,
        maxTradePct: 0.05,
        maxConcurrentPositions: 2,
        minIntervalMinutes: 5,
        mode: TradingMode.SANDBOX,
        isRunning: true,
      },
    };

    const { system, user } = buildAnalysisPrompt(input);

    expect(system).toContain('JSON');
    expect(system).toContain('BUY');
    expect(user).toContain('BTC/USDT');
    expect(user).toContain('RSI');
    expect(user).toContain('MACD');
  });
});

describe('createLLMProvider', () => {
  it('should create Claude provider', () => {
    const provider = createLLMProvider(LLMProvider.CLAUDE, 'key');
    expect(provider.name).toBe('claude');
  });

  it('should create OpenAI provider', () => {
    const provider = createLLMProvider(LLMProvider.OPENAI, 'key');
    expect(provider.name).toBe('openai');
  });

  it('should create Groq provider', () => {
    const provider = createLLMProvider(LLMProvider.GROQ, 'key');
    expect(provider.name).toBe('groq');
  });

  it('should create Gemini provider', () => {
    const provider = createLLMProvider(LLMProvider.GEMINI, 'key');
    expect(provider.name).toBe('gemini');
  });

  it('should create Mistral provider', () => {
    const provider = createLLMProvider(LLMProvider.MISTRAL, 'key');
    expect(provider.name).toBe('mistral');
  });

  it('should throw for unknown provider', () => {
    expect(() => createLLMProvider('UNKNOWN' as LLMProvider, 'key')).toThrow(
      'Unsupported LLM provider',
    );
  });
});
