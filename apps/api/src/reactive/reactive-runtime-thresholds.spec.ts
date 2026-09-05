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
      userStreamOwnerLeaseTtlMs: 30_000,
      userStreamOwnerRenewIntervalMs: 10_000,
      userStreamSweepIntervalMs: 10_000,
      userStreamSubscriptionRefreshIntervalMs: 30_000,
      userStreamKeyExpiryMs: 3_600_000,
      userStreamKeepaliveIntervalMs: 900_000,
      userStreamKeepaliveGraceMs: 600_000,
      userStreamHeartbeatMaxAgeMs: 240_000,
      userStreamKeepaliveMaxAgeMs: 2_400_000,
      userStreamHealthPublishIntervalMs: 5_000,
      userStreamHealthTtlMs: 25_000,
      userStreamReconnectBaseDelayMs: 1_000,
      userStreamReconnectMaxDelayMs: 30_000,
      userStreamReconnectAttemptsBeforeRenegotiate: 3,
      userStreamSeenEventTtlMs: 600_000,
      userStreamSeenEventCacheSize: 500,
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

  it('renegotiates the listenKey before its 60-minute expiry, even after the last keepalive attempt lands right at the grace window', () => {
    expect(
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamKeepaliveIntervalMs +
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamKeepaliveGraceMs,
    ).toBeLessThan(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamKeyExpiryMs);
  });

  it('declares the keepalive channel stale strictly before the listenKey itself would expire', () => {
    expect(
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamKeepaliveMaxAgeMs,
    ).toBeLessThan(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamKeyExpiryMs);
  });

  it('gives the keepalive timer room for multiple ticks before its own staleness threshold trips', () => {
    expect(
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamKeepaliveIntervalMs,
    ).toBeLessThan(
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamKeepaliveMaxAgeMs,
    );
  });

  it('lets the user stream owner renew its lease well before that lease would lapse', () => {
    expect(
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamOwnerRenewIntervalMs,
    ).toBeLessThan(
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamOwnerLeaseTtlMs,
    );
  });

  it('sizes the user stream health record TTL to outlive its own publish cadence', () => {
    expect(
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamHealthTtlMs,
    ).toBeGreaterThan(
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamHealthPublishIntervalMs,
    );
  });

  it('keeps every threshold a positive, finite number', () => {
    Object.values(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS).forEach((value) => {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    });
  });
});
