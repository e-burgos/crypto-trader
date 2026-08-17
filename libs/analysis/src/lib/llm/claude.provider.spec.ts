import axios from 'axios';
import { ClaudeProvider } from './claude.provider';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('ClaudeProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should have name "claude"', () => {
    const provider = new ClaudeProvider({ apiKey: 'sk-ant-test' });
    expect(provider.name).toBe('claude');
  });

  it('should call Anthropic API with correct format', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        content: [{ text: '{"decision":"HOLD"}' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      },
      headers: {},
    });

    const provider = new ClaudeProvider({ apiKey: 'sk-ant-test' });
    const result = await provider.complete('system prompt', 'user prompt');

    expect(result.text).toBe('{"decision":"HOLD"}');
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        system: 'system prompt',
        messages: [{ role: 'user', content: 'user prompt' }],
      }),
      expect.any(Object),
    );
  });

  it('should mark the system prompt with cache_control when it meets the minimum (CA-047)', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { content: [{ text: 'ok' }], usage: {} },
      headers: {},
    });

    const provider = new ClaudeProvider({
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-20250514',
    });
    const longSystemPrompt = 'x'.repeat(1024 * 4);
    await provider.complete(longSystemPrompt, 'user prompt');

    const body = mockedAxios.post.mock.calls[0][1] as Record<string, unknown>;
    expect(body.system).toEqual([
      {
        type: 'text',
        text: longSystemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ]);
  });

  it('should NOT mark a system prompt below the cacheable minimum (CA-048, spec CA-047 negative case)', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { content: [{ text: 'ok' }], usage: {} },
      headers: {},
    });

    const provider = new ClaudeProvider({
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-20250514',
    });
    const shortSystemPrompt = 'x'.repeat(800 * 4);
    await provider.complete(shortSystemPrompt, 'user prompt');

    const body = mockedAxios.post.mock.calls[0][1] as Record<string, unknown>;
    expect(body.system).toBe(shortSystemPrompt);
  });

  it('should use the same decision result whether or not the cache mark is applied (CA-049)', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        content: [{ text: '{"decision":"BUY"}' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      },
      headers: {},
    });

    const provider = new ClaudeProvider({
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-20250514',
    });

    const shortResult = await provider.complete(
      'x'.repeat(800 * 4),
      'user prompt',
    );
    const longResult = await provider.complete(
      'x'.repeat(1024 * 4),
      'user prompt',
    );

    expect(shortResult.text).toBe(longResult.text);
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
        data: { content: [{ text: 'ok' }], usage: {} },
        headers: {},
      });

    const provider = new ClaudeProvider({
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-20250514',
    });
    const result = await provider.complete('x'.repeat(1024 * 4), 'user prompt');

    expect(result.text).toBe('ok');
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    const secondBody = mockedAxios.post.mock.calls[1][1] as Record<
      string,
      unknown
    >;
    expect(typeof secondBody.system).toBe('string');
  });

  it('should propagate an unrelated failure without retrying', async () => {
    mockedAxios.post.mockRejectedValue(new Error('network down'));

    const provider = new ClaudeProvider({
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-20250514',
    });

    await expect(
      provider.complete('x'.repeat(1024 * 4), 'user prompt'),
    ).rejects.toThrow('network down');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('should use the max_tokens passed via call options over the constructor default', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { content: [{ text: 'ok' }], usage: {} },
      headers: {},
    });

    const provider = new ClaudeProvider({ apiKey: 'sk-ant-test' });
    await provider.complete('sys', 'usr', { maxTokens: 350 });

    const body = mockedAxios.post.mock.calls[0][1] as Record<string, unknown>;
    expect(body.max_tokens).toBe(350);
  });

  it('should fall back to the constructor max_tokens when no options are given', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { content: [{ text: 'ok' }], usage: {} },
      headers: {},
    });

    const provider = new ClaudeProvider({
      apiKey: 'sk-ant-test',
      maxTokens: 2000,
    });
    await provider.complete('sys', 'usr');

    const body = mockedAxios.post.mock.calls[0][1] as Record<string, unknown>;
    expect(body.max_tokens).toBe(2000);
  });

  it('should mark truncated=true when stop_reason is max_tokens', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        content: [{ text: 'partial...' }],
        usage: {},
        stop_reason: 'max_tokens',
      },
      headers: {},
    });

    const provider = new ClaudeProvider({ apiKey: 'sk-ant-test' });
    const result = await provider.complete('sys', 'usr');

    expect(result.truncated).toBe(true);
  });

  it('should mark truncated=false when stop_reason is not max_tokens', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        content: [{ text: 'complete' }],
        usage: {},
        stop_reason: 'end_turn',
      },
      headers: {},
    });

    const provider = new ClaudeProvider({ apiKey: 'sk-ant-test' });
    const result = await provider.complete('sys', 'usr');

    expect(result.truncated).toBe(false);
  });
});
