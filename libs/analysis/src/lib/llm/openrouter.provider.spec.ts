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

  it('should capture response headers and actualModel', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: '{"decision":"BUY"}' } }],
        usage: { prompt_tokens: 200, completion_tokens: 100 },
        model: 'anthropic/claude-sonnet-4-20250514',
      },
      headers: {
        'x-ratelimit-remaining': '95',
        'x-ratelimit-limit': '100',
      },
    });

    const provider = new OpenRouterProvider({
      apiKey: 'sk-or-test',
      model: 'anthropic/claude-sonnet-4',
    });
    const result = await provider.complete('sys', 'usr');

    expect(result.headers).toEqual({
      'x-ratelimit-remaining': '95',
      'x-ratelimit-limit': '100',
    });
    expect(result.actualModel).toBe('anthropic/claude-sonnet-4-20250514');
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

  it('should mark the system message with cache_control for anthropic/* models above the minimum (CA-047)', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      },
    });

    const provider = new OpenRouterProvider({
      apiKey: 'sk-or-test',
      model: 'anthropic/claude-sonnet-4',
    });
    const longSystemPrompt = 'x'.repeat(1024 * 4);
    await provider.complete(longSystemPrompt, 'usr');

    const body = mockedAxios.post.mock.calls[0][1];
    expect(body.messages[0]).toEqual({
      role: 'system',
      content: [
        {
          type: 'text',
          text: longSystemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
    });
  });

  it('should NOT mark non-anthropic openrouter models even with a long prompt (CA-048)', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      },
    });

    const provider = new OpenRouterProvider({
      apiKey: 'sk-or-test',
      model: 'meta-llama/llama-3.3-70b',
    });
    const longSystemPrompt = 'x'.repeat(1024 * 4);
    await provider.complete(longSystemPrompt, 'usr');

    const body = mockedAxios.post.mock.calls[0][1];
    expect(body.messages[0]).toEqual({
      role: 'system',
      content: longSystemPrompt,
    });
  });

  it('should retry without cache_control when the provider rejects the mark (CE-05)', async () => {
    mockedAxios.post
      .mockRejectedValueOnce({
        response: {
          status: 400,
          data: { error: { message: 'unsupported: cache_control' } },
        },
      })
      .mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        },
      });

    const provider = new OpenRouterProvider({
      apiKey: 'sk-or-test',
      model: 'anthropic/claude-sonnet-4',
    });
    const result = await provider.complete('x'.repeat(1024 * 4), 'usr');

    expect(result.text).toBe('ok');
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    const secondBody = mockedAxios.post.mock.calls[1][1];
    expect(secondBody.messages[0].content).toBe('x'.repeat(1024 * 4));
  });

  it('should use the max_tokens passed via call options over the constructor default', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      },
    });

    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test' });
    await provider.complete('sys', 'usr', { maxTokens: 500 });

    const body = mockedAxios.post.mock.calls[0][1];
    expect(body.max_tokens).toBe(500);
  });

  it('should mark truncated=true when finish_reason is length', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [
          { message: { content: 'partial' }, finish_reason: 'length' },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      },
    });

    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test' });
    const result = await provider.complete('sys', 'usr');

    expect(result.truncated).toBe(true);
  });

  it('should mark truncated=false when finish_reason is stop', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: 'done' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      },
    });

    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test' });
    const result = await provider.complete('sys', 'usr');

    expect(result.truncated).toBe(false);
  });
});

// ── FIX-e-burgos-014 ─────────────────────────────────────────────────────────
describe('OpenRouterProvider — razonamiento apagado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('manda reasoning.enabled=false en el cuerpo', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
    } as never);

    const provider = new OpenRouterProvider({
      apiKey: 'sk-or-test',
      model: 'deepseek/deepseek-v4-pro',
    });
    await provider.complete('sistema', 'usuario', { maxTokens: 350 });

    const body = mockedAxios.post.mock.calls[0][1] as Record<string, unknown>;
    // enabled:false y NO exclude:true — exclude solo oculta el razonamiento: el
    // modelo igual lo genera, igual consume el presupuesto y igual se cobra.
    expect(body['reasoning']).toEqual({ enabled: false });
    expect(body['max_tokens']).toBe(350);
  });

  it('reintenta SIN el flag cuando el endpoint exige razonamiento', async () => {
    // minimax-m2.7 responde 400 "Reasoning is mandatory for this endpoint and
    // cannot be disabled". Sin este reintento, agregar el flag convertia una
    // respuesta truncada en un fallo duro para esos modelos.
    mockedAxios.post
      .mockRejectedValueOnce({
        response: {
          status: 400,
          data: { error: { message: 'Reasoning is mandatory for this endpoint and cannot be disabled.' } },
        },
      })
      .mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      } as never);

    const provider = new OpenRouterProvider({
      apiKey: 'sk-or-test',
      model: 'minimax/minimax-m2.7',
    });
    await provider.complete('sistema', 'usuario', { maxTokens: 600 });

    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    const primero = mockedAxios.post.mock.calls[0][1] as Record<string, unknown>;
    const segundo = mockedAxios.post.mock.calls[1][1] as Record<string, unknown>;
    expect(primero['reasoning']).toEqual({ enabled: false });
    expect(segundo).not.toHaveProperty('reasoning');
  });

  it('NO reintenta ante un 400 que no sea por razonamiento obligatorio', async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 400, data: { error: { message: 'model not found' } } },
    });
    const provider = new OpenRouterProvider({ apiKey: 'k', model: 'x/y' });
    await expect(provider.complete('s', 'u')).rejects.toBeDefined();
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });
});
