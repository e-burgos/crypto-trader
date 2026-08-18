export type PromptCacheStyle = 'anthropic-blocks' | 'implicit' | 'none';

export interface PromptCacheCapability {
  style: PromptCacheStyle;
  minPrefixTokens: number;
}

const HAIKU_MIN_PREFIX_TOKENS = 2048;
const DEFAULT_MIN_PREFIX_TOKENS = 1024;
const CHARS_PER_TOKEN = 4;

const OPENROUTER_IMPLICIT_PREFIXES = [
  'openai/',
  'deepseek/',
  'google/',
  'x-ai/',
];

function anthropicCapability(modelId: string): PromptCacheCapability {
  return {
    style: 'anthropic-blocks',
    minPrefixTokens: modelId.includes('haiku')
      ? HAIKU_MIN_PREFIX_TOKENS
      : DEFAULT_MIN_PREFIX_TOKENS,
  };
}

export function resolvePromptCacheCapability(
  providerName: string,
  model: string,
): PromptCacheCapability {
  const modelId = model.toLowerCase();

  if (providerName === 'claude') return anthropicCapability(modelId);

  if (providerName === 'openrouter') {
    if (modelId.startsWith('anthropic/')) return anthropicCapability(modelId);
    if (
      OPENROUTER_IMPLICIT_PREFIXES.some((prefix) => modelId.startsWith(prefix))
    ) {
      return { style: 'implicit', minPrefixTokens: DEFAULT_MIN_PREFIX_TOKENS };
    }
    return { style: 'none', minPrefixTokens: Infinity };
  }

  if (providerName === 'openai' || providerName === 'gemini') {
    return { style: 'implicit', minPrefixTokens: DEFAULT_MIN_PREFIX_TOKENS };
  }

  return { style: 'none', minPrefixTokens: Infinity };
}

export function estimatePromptTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function shouldMarkPromptForCache(
  capability: PromptCacheCapability,
  systemPrompt: string,
): boolean {
  return (
    capability.style === 'anthropic-blocks' &&
    estimatePromptTokens(systemPrompt) >= capability.minPrefixTokens
  );
}

interface CacheControlRejectionCandidate {
  response?: { status?: number; data?: unknown };
}

export function isCacheControlRejection(err: unknown): boolean {
  const candidate = err as CacheControlRejectionCandidate;
  if (candidate?.response?.status !== 400) return false;
  const body = JSON.stringify(candidate.response.data ?? '').toLowerCase();
  return body.includes('cache_control');
}

export async function postWithCacheControlRetry<T>(
  post: (withCacheControl: boolean) => Promise<T>,
  shouldMark: boolean,
): Promise<T> {
  try {
    return await post(shouldMark);
  } catch (err) {
    if (shouldMark && isCacheControlRejection(err)) {
      return await post(false);
    }
    throw err;
  }
}
