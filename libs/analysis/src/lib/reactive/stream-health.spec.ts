import { StreamHealthRecord } from '@crypto-trader/shared';
import { resolveStreamHealth, StreamHealthThresholds } from './stream-health';

const T0 = 1_700_000_000_000;

const thresholds: StreamHealthThresholds = {
  tickMaxAgeMs: 20_000,
  heartbeatMaxAgeMs: 90_000,
};

function baseRecord(overrides: Partial<StreamHealthRecord> = {}): StreamHealthRecord {
  return {
    symbol: 'BTCUSDT',
    ownerId: 'owner-1',
    connectedAt: T0 - 100_000,
    lastTickAtMs: T0,
    lastHeartbeatAtMs: T0,
    publishedAt: T0,
    ...overrides,
  };
}

describe('resolveStreamHealth', () => {
  it('returns UNKNOWN/NO_RECORD when there is no record', () => {
    const result = resolveStreamHealth({ now: T0, record: null, thresholds });

    expect(result).toEqual({ state: 'UNKNOWN', reason: 'NO_RECORD' });
  });

  it('returns DEGRADED/TICK_STALE when the tick age exceeds the threshold', () => {
    const record = baseRecord({ lastTickAtMs: T0 - thresholds.tickMaxAgeMs - 1 });

    const result = resolveStreamHealth({ now: T0, record, thresholds });

    expect(result).toEqual({ state: 'DEGRADED', reason: 'TICK_STALE' });
  });

  it('returns DEGRADED/HEARTBEAT_STALE when the heartbeat age exceeds the threshold', () => {
    const record = baseRecord({
      lastHeartbeatAtMs: T0 - thresholds.heartbeatMaxAgeMs - 1,
    });

    const result = resolveStreamHealth({ now: T0, record, thresholds });

    expect(result).toEqual({ state: 'DEGRADED', reason: 'HEARTBEAT_STALE' });
  });

  it('prioritizes TICK_STALE over HEARTBEAT_STALE when both are stale', () => {
    const record = baseRecord({
      lastTickAtMs: T0 - thresholds.tickMaxAgeMs - 1,
      lastHeartbeatAtMs: T0 - thresholds.heartbeatMaxAgeMs - 1,
    });

    const result = resolveStreamHealth({ now: T0, record, thresholds });

    expect(result).toEqual({ state: 'DEGRADED', reason: 'TICK_STALE' });
  });

  it('returns HEALTHY when both ages are exactly at the threshold boundary', () => {
    const record = baseRecord({
      lastTickAtMs: T0 - thresholds.tickMaxAgeMs,
      lastHeartbeatAtMs: T0 - thresholds.heartbeatMaxAgeMs,
    });

    const result = resolveStreamHealth({ now: T0, record, thresholds });

    expect(result).toEqual({ state: 'HEALTHY', reason: null });
  });

  it('returns HEALTHY when a fresh record is within both windows', () => {
    const record = baseRecord({ lastTickAtMs: T0 - 1_000, lastHeartbeatAtMs: T0 - 1_000 });

    const result = resolveStreamHealth({ now: T0, record, thresholds });

    expect(result).toEqual({ state: 'HEALTHY', reason: null });
  });

  it('never returns a state outside the treat-as-degraded set on missing data', () => {
    const result = resolveStreamHealth({ now: T0, record: null, thresholds });

    expect(result.state).not.toBe('HEALTHY');
  });
});
