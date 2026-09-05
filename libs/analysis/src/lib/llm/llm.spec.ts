import { parseLLMResponse } from './llm-types';
import { createLLMProvider } from './llm-factory';
import { LLMProvider } from '@crypto-trader/shared';

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
