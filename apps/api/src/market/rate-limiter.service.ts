import { Injectable, Logger } from '@nestjs/common';

interface TokenBucket {
  tokens: number;
  maxTokens: number;
  refillRate: number; // tokens per ms
  lastRefill: number;
}

/**
 * Token bucket rate limiter for external API providers.
 * Each provider gets its own bucket sized to `rateLimitPerMin`.
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly buckets = new Map<string, TokenBucket>();

  /**
   * Ensures a bucket exists for this provider, sized to its rate limit.
   */
  private getBucket(name: string, rateLimitPerMin: number): TokenBucket {
    let bucket = this.buckets.get(name);
    if (!bucket || bucket.maxTokens !== rateLimitPerMin) {
      bucket = {
        tokens: rateLimitPerMin,
        maxTokens: rateLimitPerMin,
        refillRate: rateLimitPerMin / 60_000, // tokens per ms
        lastRefill: Date.now(),
      };
      this.buckets.set(name, bucket);
    }
    return bucket;
  }

  /**
   * Refill tokens based on elapsed time since last refill.
   */
  private refill(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    if (elapsed <= 0) return;

    bucket.tokens = Math.min(
      bucket.maxTokens,
      bucket.tokens + elapsed * bucket.refillRate,
    );
    bucket.lastRefill = now;
  }

  /**
   * Try to consume a token. Returns true if allowed, false if rate limited.
   */
  tryAcquire(name: string, rateLimitPerMin: number): boolean {
    const bucket = this.getBucket(name, rateLimitPerMin);
    this.refill(bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    this.logger.warn(
      `${name}: rate limited (${rateLimitPerMin}/min, ${bucket.tokens.toFixed(1)} tokens remaining)`,
    );
    return false;
  }

  /**
   * Get remaining tokens for a provider (for diagnostics).
   */
  getRemaining(name: string): number {
    const bucket = this.buckets.get(name);
    if (!bucket) return -1;
    this.refill(bucket);
    return Math.floor(bucket.tokens);
  }

  /**
   * Get stats for all active buckets.
   */
  getAll(): Record<string, { remaining: number; limit: number }> {
    const result: Record<string, { remaining: number; limit: number }> = {};
    for (const [name, bucket] of this.buckets) {
      this.refill(bucket);
      result[name] = {
        remaining: Math.floor(bucket.tokens),
        limit: bucket.maxTokens,
      };
    }
    return result;
  }
}
