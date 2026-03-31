/**
 * Simple rate limiter for Binance API requests.
 * Binance allows 1200 requests per minute (weight-based).
 */
export class BinanceRateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private timestamps: number[] = [];

  constructor(maxRequests = 1200, windowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if we can make a request, and record it if allowed.
   * @param weight - request weight (default: 1)
   * @returns true if allowed, false if rate limited
   */
  tryAcquire(weight = 1): boolean {
    this.cleanup();
    if (this.timestamps.length + weight > this.maxRequests) {
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
   * @param weight - request weight (default: 1)
   */
  async waitForSlot(weight = 1): Promise<void> {
    while (!this.tryAcquire(weight)) {
      const oldest = this.timestamps[0];
      const waitTime = oldest + this.windowMs - Date.now() + 10;
      await new Promise((resolve) => setTimeout(resolve, Math.max(waitTime, 50)));
    }
  }

  /**
   * Get remaining capacity.
   */
  get remaining(): number {
    this.cleanup();
    return this.maxRequests - this.timestamps.length;
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
  }
}
