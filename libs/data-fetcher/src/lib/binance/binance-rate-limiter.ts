/**
 * Weight-based rate limiter for Binance API requests.
 * Binance limits: 1200 REQUEST_WEIGHT per minute (IP-based).
 * We use 1100 as our effective ceiling to leave a 100-unit safety buffer.
 * Each entry in `timestamps` represents one unit of weight consumed.
 */
export class BinanceRateLimiter {
  private readonly maxWeight: number;
  private readonly windowMs: number;
  private timestamps: number[] = [];
  /** Absolute timestamp (ms) until which ALL requests should be blocked (set on 429). */
  private blockedUntilMs = 0;

  constructor(maxWeight = 1100, windowMs = 60_000) {
    this.maxWeight = maxWeight;
    this.windowMs = windowMs;
  }

  /**
   * Check if we can make a request, and record it if allowed.
   * @param weight - request weight (default: 1)
   * @returns true if allowed, false if rate limited
   */
  tryAcquire(weight = 1): boolean {
    if (Date.now() < this.blockedUntilMs) return false;
    this.cleanup();
    if (this.timestamps.length + weight > this.maxWeight) {
      return false;
    }
    const now = Date.now();
    for (let i = 0; i < weight; i++) {
      this.timestamps.push(now);
    }
    return true;
  }

  /**
   * Wait until a request slot is available.
   * Respects both the sliding-window weight limit and any hard blockUntil time.
   * @param weight - request weight (default: 1)
   */
  async waitForSlot(weight = 1): Promise<void> {
    while (!this.tryAcquire(weight)) {
      const hardBlock = this.blockedUntilMs - Date.now();
      if (hardBlock > 0) {
        // Blocked by Retry-After: wait until the server says we can retry
        await new Promise((resolve) => setTimeout(resolve, hardBlock + 200));
      } else {
        const oldest = this.timestamps[0];
        const waitTime = oldest + this.windowMs - Date.now() + 50;
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(waitTime, 50)),
        );
      }
    }
  }

  /**
   * Hard-block all future requests until `untilMs`.
   * Called by the error interceptor when Binance returns HTTP 429.
   * Uses the Retry-After header value so the limiter doesn't retry too early.
   * Also flushes the local weight counter so the window starts fresh.
   */
  blockUntil(untilMs: number): void {
    this.blockedUntilMs = Math.max(this.blockedUntilMs, untilMs);
    // Flush the local weight counter — after the 429 ban expires the window resets
    this.timestamps = [];
  }

  /**
   * Sync the local counter with the server-reported used weight.
   * Only increases the counter — never decreases, to avoid races.
   * Called by the response interceptor using X-MBX-USED-WEIGHT-1M header.
   */
  syncUsedWeight(serverUsedWeight: number): void {
    this.cleanup();
    const currentLocal = this.timestamps.length;
    if (serverUsedWeight > currentLocal) {
      const now = Date.now();
      const diff = serverUsedWeight - currentLocal;
      for (let i = 0; i < diff; i++) {
        this.timestamps.push(now);
      }
    }
  }

  /**
   * Get remaining weight capacity.
   */
  get remaining(): number {
    this.cleanup();
    return this.maxWeight - this.timestamps.length;
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
  }
}
