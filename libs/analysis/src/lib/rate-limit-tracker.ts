// ── Rate Limit Tracker ─────────────────────────────────────────────────────
// In-memory store for rate-limit headers captured passively from LLM responses.

export interface ProviderRateLimits {
  tokensRemaining: number | null;
  tokensLimit: number | null;
  requestsRemaining: number | null;
  requestsLimit: number | null;
  resetAt: Date | null;
  capturedAt: Date;
}

/** In-memory store — one entry per userId+provider, updated on every LLM response */
const rateLimitCache = new Map<string, ProviderRateLimits>();

export function captureRateLimits(
  userId: string,
  provider: string,
  headers: Record<string, string>,
): void {
  const key = `${userId}:${provider}`;
  const parsed = parseRateLimitHeaders(provider, headers);
  if (parsed) rateLimitCache.set(key, { ...parsed, capturedAt: new Date() });
}

export function getRateLimits(
  userId: string,
  provider: string,
): ProviderRateLimits | null {
  const entry = rateLimitCache.get(`${userId}:${provider}`);
  if (!entry) return null;
  // Stale after 10 min
  if (Date.now() - entry.capturedAt.getTime() > 600_000) return null;
  return entry;
}

/** Exposed for testing */
export function clearRateLimitCache(): void {
  rateLimitCache.clear();
}

export function parseRateLimitHeaders(
  provider: string,
  headers: Record<string, string>,
): Omit<ProviderRateLimits, 'capturedAt'> | null {
  switch (provider) {
    case 'CLAUDE':
      return {
        tokensRemaining: num(headers['anthropic-ratelimit-tokens-remaining']),
        tokensLimit: num(headers['anthropic-ratelimit-tokens-limit']),
        requestsRemaining: num(
          headers['anthropic-ratelimit-requests-remaining'],
        ),
        requestsLimit: num(headers['anthropic-ratelimit-requests-limit']),
        resetAt: headers['anthropic-ratelimit-tokens-reset']
          ? new Date(headers['anthropic-ratelimit-tokens-reset'])
          : null,
      };
    case 'OPENAI':
    case 'GROQ':
    case 'TOGETHER':
      return {
        tokensRemaining: num(headers['x-ratelimit-remaining-tokens']),
        tokensLimit: num(headers['x-ratelimit-limit-tokens']),
        requestsRemaining: num(headers['x-ratelimit-remaining-requests']),
        requestsLimit: num(headers['x-ratelimit-limit-requests']),
        resetAt: headers['x-ratelimit-reset-tokens']
          ? new Date(headers['x-ratelimit-reset-tokens'])
          : null,
      };
    default: // GEMINI, MISTRAL — no rate limit headers available
      return null;
  }
}

function num(val: string | undefined): number | null {
  if (!val) return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}
