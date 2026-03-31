import { BinanceRateLimiter } from './binance-rate-limiter';

describe('BinanceRateLimiter', () => {
  it('should allow requests under the limit', () => {
    const limiter = new BinanceRateLimiter(5, 60000);

    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.remaining).toBe(2);
  });

  it('should reject requests over the limit', () => {
    const limiter = new BinanceRateLimiter(3, 60000);

    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);
    expect(limiter.remaining).toBe(0);
  });

  it('should account for request weight', () => {
    const limiter = new BinanceRateLimiter(10, 60000);

    expect(limiter.tryAcquire(5)).toBe(true);
    expect(limiter.remaining).toBe(5);
    expect(limiter.tryAcquire(6)).toBe(false);
    expect(limiter.tryAcquire(5)).toBe(true);
    expect(limiter.remaining).toBe(0);
  });

  it('should free slots after window expires', async () => {
    const limiter = new BinanceRateLimiter(2, 100); // 100ms window

    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 120));

    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.remaining).toBe(1);
  });

  it('waitForSlot should resolve when slot available', async () => {
    const limiter = new BinanceRateLimiter(1, 100);

    limiter.tryAcquire(); // consume the only slot

    const start = Date.now();
    await limiter.waitForSlot();
    const elapsed = Date.now() - start;

    // Should have waited roughly 100ms for the window to expire
    expect(elapsed).toBeGreaterThanOrEqual(50);
  });
});
