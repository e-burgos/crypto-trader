import {
  resolvePromptCacheCapability,
  estimatePromptTokens,
  shouldMarkPromptForCache,
  isCacheControlRejection,
  postWithCacheControlRetry,
} from './prompt-cache';

describe('resolvePromptCacheCapability', () => {
  it('marks claude non-haiku models with the 1024 token minimum', () => {
    expect(
      resolvePromptCacheCapability('claude', 'claude-sonnet-4-20250514'),
    ).toEqual({ style: 'anthropic-blocks', minPrefixTokens: 1024 });
  });

  it('marks claude haiku models with the 2048 token minimum', () => {
    expect(
      resolvePromptCacheCapability('claude', 'claude-3-5-haiku-20241022'),
    ).toEqual({ style: 'anthropic-blocks', minPrefixTokens: 2048 });
  });

  it('marks openrouter anthropic/* models like claude direct', () => {
    expect(
      resolvePromptCacheCapability('openrouter', 'anthropic/claude-sonnet-4'),
    ).toEqual({ style: 'anthropic-blocks', minPrefixTokens: 1024 });
  });

  it('marks openrouter anthropic/*haiku* models with the 2048 minimum', () => {
    expect(
      resolvePromptCacheCapability(
        'openrouter',
        'anthropic/claude-3-5-haiku',
      ),
    ).toEqual({ style: 'anthropic-blocks', minPrefixTokens: 2048 });
  });

  it.each(['openai/gpt-4o', 'deepseek/deepseek-chat', 'google/gemini-2.5-flash', 'x-ai/grok-4'])(
    'treats openrouter %s as implicit cache with no body marking',
    (model) => {
      expect(resolvePromptCacheCapability('openrouter', model)).toEqual({
        style: 'implicit',
        minPrefixTokens: 1024,
      });
    },
  );

  it('treats other openrouter models as unsupported', () => {
    expect(
      resolvePromptCacheCapability('openrouter', 'meta-llama/llama-3.3-70b'),
    ).toEqual({ style: 'none', minPrefixTokens: Infinity });
  });

  it.each(['openai', 'gemini'])(
    'treats direct %s as implicit cache with no body marking',
    (providerName) => {
      expect(resolvePromptCacheCapability(providerName, 'any-model')).toEqual(
        { style: 'implicit', minPrefixTokens: 1024 },
      );
    },
  );

  it.each(['groq', 'mistral', 'together'])(
    'treats %s as unsupported',
    (providerName) => {
      expect(resolvePromptCacheCapability(providerName, 'any-model')).toEqual(
        { style: 'none', minPrefixTokens: Infinity },
      );
    },
  );
});

describe('estimatePromptTokens', () => {
  it('estimates roughly 4 characters per token', () => {
    expect(estimatePromptTokens('a'.repeat(4000))).toBe(1000);
  });
});

describe('shouldMarkPromptForCache', () => {
  it('does not mark a prompt below the mininum for the model (CA-047 negative case)', () => {
    const capability = resolvePromptCacheCapability(
      'claude',
      'claude-sonnet-4-20250514',
    );
    const prompt = 'x'.repeat(800 * 4);
    expect(shouldMarkPromptForCache(capability, prompt)).toBe(false);
  });

  it('marks a prompt at or above the minimum for the model (CA-047 positive case)', () => {
    const capability = resolvePromptCacheCapability(
      'claude',
      'claude-sonnet-4-20250514',
    );
    const prompt = 'x'.repeat(1024 * 4);
    expect(shouldMarkPromptForCache(capability, prompt)).toBe(true);
  });

  it('never marks a prompt when the provider has no cacheable style', () => {
    const capability = resolvePromptCacheCapability('groq', 'any-model');
    const prompt = 'x'.repeat(10_000);
    expect(shouldMarkPromptForCache(capability, prompt)).toBe(false);
  });
});

describe('isCacheControlRejection', () => {
  it('recognizes a 400 whose body mentions cache_control', () => {
    const err = {
      response: { status: 400, data: { error: { message: 'unknown field: cache_control' } } },
    };
    expect(isCacheControlRejection(err)).toBe(true);
  });

  it('does not match a 400 unrelated to cache_control', () => {
    const err = { response: { status: 400, data: { error: { message: 'invalid api key' } } } };
    expect(isCacheControlRejection(err)).toBe(false);
  });

  it('does not match a non-400 error', () => {
    const err = { response: { status: 500, data: { error: 'cache_control' } } };
    expect(isCacheControlRejection(err)).toBe(false);
  });

  it('does not match an error without a response', () => {
    expect(isCacheControlRejection(new Error('network error'))).toBe(false);
  });
});

describe('postWithCacheControlRetry', () => {
  it('calls post once with the mark when not asked to mark', async () => {
    const post = vi.fn().mockResolvedValue('ok');
    const result = await postWithCacheControlRetry(post, false);
    expect(result).toBe('ok');
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(false);
  });

  it('retries once without the mark when the provider rejects cache_control', async () => {
    const rejection = {
      response: { status: 400, data: { error: 'cache_control not supported' } },
    };
    const post = vi
      .fn()
      .mockRejectedValueOnce(rejection)
      .mockResolvedValueOnce('ok-without-cache');

    const result = await postWithCacheControlRetry(post, true);

    expect(result).toBe('ok-without-cache');
    expect(post).toHaveBeenNthCalledWith(1, true);
    expect(post).toHaveBeenNthCalledWith(2, false);
  });

  it('propagates an unrelated failure without retrying', async () => {
    const failure = new Error('network down');
    const post = vi.fn().mockRejectedValue(failure);

    await expect(postWithCacheControlRetry(post, true)).rejects.toThrow(
      'network down',
    );
    expect(post).toHaveBeenCalledTimes(1);
  });
});
