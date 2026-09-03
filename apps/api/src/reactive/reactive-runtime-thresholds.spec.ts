import { DEFAULT_REACTIVE_RUNTIME_THRESHOLDS } from './reactive-runtime-thresholds';

describe('DEFAULT_REACTIVE_RUNTIME_THRESHOLDS', () => {
  it('matches the architect contract literals', () => {
    expect(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS).toEqual({
      ownerLeaseTtlMs: 30_000,
      ownerRenewIntervalMs: 10_000,
      ownerSweepIntervalMs: 10_000,
      symbolRefreshIntervalMs: 30_000,
      healthPublishIntervalMs: 5_000,
      streamTickMaxAgeMs: 20_000,
      streamHeartbeatMaxAgeMs: 90_000,
      streamHealthTtlMs: 25_000,
      streamWarmupTicks: 2,
      wsPingIntervalMs: 30_000,
      wsPongTimeoutMs: 10_000,
      botActionLeaseTtlMs: 30_000,
      degradedNotifyAfterMs: 60_000,
      trailingPersistIntervalMs: 30_000,
      entryFillProbeDebounceMs: 15_000,
      coordinationCommandTimeoutMs: 2_000,
      coordinationBootstrapTimeoutMs: 5_000,
    });
  });

  it('gives the owner lease exactly three renewal periods, tolerating two missed renewals before ceding ownership', () => {
    expect(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.ownerLeaseTtlMs).toBe(
      3 * DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.ownerRenewIntervalMs,
    );
  });

  it('sizes the stream health record TTL so its expiry alone implies degradation, with no ambiguous window', () => {
    expect(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.streamHealthTtlMs).toBe(
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.streamTickMaxAgeMs +
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.healthPublishIntervalMs,
    );
  });

  it('lets a coordination command give up before the bootstrap cycle waiting on it does', () => {
    expect(
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.coordinationCommandTimeoutMs,
    ).toBeLessThan(
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.coordinationBootstrapTimeoutMs,
    );
  });

  it('keeps the bootstrap timeout short enough for a container start probe to still get an answer', () => {
    expect(
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.coordinationBootstrapTimeoutMs,
    ).toBeLessThanOrEqual(10_000);
  });

  it('keeps every threshold a positive, finite number', () => {
    Object.values(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS).forEach((value) => {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    });
  });
});
