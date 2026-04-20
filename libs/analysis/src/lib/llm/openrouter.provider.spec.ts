import { vi, describe, it, expect, beforeEach } from 'vitest';
import axios from 'axios';
import { OpenRouterProvider } from './openrouter.provider';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('OpenRouterProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should have name "openrouter"', () => {
    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test' });
    expect(provider.name).toBe('openrouter');
  });

  it('should call OpenRouter API with correct format', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: '{"decision":"HOLD"}' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      },
    });

    const provider = new OpenRouterProvider({
      apiKey: 'sk-or-test',
      model: 'anthropic/claude-sonnet-4',
    });
    const result = await provider.complete('system prompt', 'user prompt');

    expect(result.text).toBe('{"decision":"HOLD"}');
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        model: 'anthropic/claude-sonnet-4',
        messages: [
          { role: 'system', content: 'system prompt' },
          { role: 'user', content: 'user prompt' },
        ],
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-or-test',
          'HTTP-Referer': 'https://cryptotrader.app',
        }),
      }),
    );
  });

  it('should include fallback routing when fallbackModels are provided', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: 'response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      },
    });

    const provider = new OpenRouterProvider({
      apiKey: 'sk-or-test',
      model: 'anthropic/claude-sonnet-4',
      fallbackModels: ['openai/gpt-4o', 'google/gemini-2.5-flash'],
    });
    await provider.complete('sys', 'usr');

    const body = mockedAxios.post.mock.calls[0][1];
    expect(body.route).toBe('fallback');
    expect(body.models).toEqual([
      'anthropic/claude-sonnet-4',
      'openai/gpt-4o',
      'google/gemini-2.5-flash',
    ]);
  });

  it('should NOT include fallback fields when no fallback models', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      },
    });

    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test' });
    await provider.complete('sys', 'usr');

    const body = mockedAxios.post.mock.calls[0][1];
    expect(body.route).toBeUndefined();
    expect(body.models).toBeUndefined();
  });

  it('should handle empty response gracefully', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { choices: [], usage: {} },
    });

    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test' });
    const result = await provider.complete('sys', 'usr');

    expect(result.text).toBe('');
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it('should use default model when none specified', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      },
    });

    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test' });
    await provider.complete('sys', 'usr');

    const body = mockedAxios.post.mock.calls[0][1];
    expect(body.model).toBe('anthropic/claude-sonnet-4.6');
  });
});
