import { UserDataStreamHealthRecord } from '@crypto-trader/shared';
import {
  resolveUserDataStreamHealth,
  UserDataStreamHealthThresholds,
} from './user-data-stream-health';

const T0 = 1_700_000_000_000;

const thresholds: UserDataStreamHealthThresholds = {
  heartbeatMaxAgeMs: 60_000,
  keepaliveMaxAgeMs: 1_800_000,
};

function baseRecord(
  overrides: Partial<UserDataStreamHealthRecord> = {},
): UserDataStreamHealthRecord {
  return {
    credentialKey: 'user-1:LIVE',
    ownerId: 'owner-1',
    connectedAt: T0 - 100_000,
    lastHeartbeatAtMs: T0,
    lastKeepaliveAtMs: T0,
    lastEventAtMs: T0,
    publishedAt: T0,
    ...overrides,
  };
}

describe('resolveUserDataStreamHealth', () => {
  it('returns UNKNOWN/NO_RECORD when there is no record', () => {
    const result = resolveUserDataStreamHealth({ now: T0, record: null, thresholds });

    expect(result).toEqual({ state: 'UNKNOWN', reason: 'NO_RECORD' });
  });

  it('returns DEGRADED/HEARTBEAT_STALE when the heartbeat age exceeds the threshold', () => {
    const record = baseRecord({
      lastHeartbeatAtMs: T0 - thresholds.heartbeatMaxAgeMs - 1,
    });

    const result = resolveUserDataStreamHealth({ now: T0, record, thresholds });

    expect(result).toEqual({ state: 'DEGRADED', reason: 'HEARTBEAT_STALE' });
  });

  it('returns DEGRADED/KEEPALIVE_STALE when the keepalive age exceeds the threshold', () => {
    const record = baseRecord({
      lastKeepaliveAtMs: T0 - thresholds.keepaliveMaxAgeMs - 1,
    });

    const result = resolveUserDataStreamHealth({ now: T0, record, thresholds });

    expect(result).toEqual({ state: 'DEGRADED', reason: 'KEEPALIVE_STALE' });
  });

  it('prioritizes HEARTBEAT_STALE over KEEPALIVE_STALE when both are stale', () => {
    const record = baseRecord({
      lastHeartbeatAtMs: T0 - thresholds.heartbeatMaxAgeMs - 1,
      lastKeepaliveAtMs: T0 - thresholds.keepaliveMaxAgeMs - 1,
    });

    const result = resolveUserDataStreamHealth({ now: T0, record, thresholds });

    expect(result).toEqual({ state: 'DEGRADED', reason: 'HEARTBEAT_STALE' });
  });

  it('returns HEALTHY when a fresh record is within both windows', () => {
    const record = baseRecord({ lastHeartbeatAtMs: T0 - 1_000, lastKeepaliveAtMs: T0 - 1_000 });

    const result = resolveUserDataStreamHealth({ now: T0, record, thresholds });

    expect(result).toEqual({ state: 'HEALTHY', reason: null });
  });

  it('never returns a state outside the treat-as-degraded set on missing data', () => {
    const result = resolveUserDataStreamHealth({ now: T0, record: null, thresholds });

    expect(result.state).not.toBe('HEALTHY');
  });

  describe('boundary: exactly at the threshold is not stale', () => {
    it('treats heartbeat age exactly at the threshold as HEALTHY', () => {
      const record = baseRecord({ lastHeartbeatAtMs: T0 - thresholds.heartbeatMaxAgeMs });

      const result = resolveUserDataStreamHealth({ now: T0, record, thresholds });

      expect(result).toEqual({ state: 'HEALTHY', reason: null });
    });

    it('treats keepalive age exactly at the threshold as HEALTHY', () => {
      const record = baseRecord({ lastKeepaliveAtMs: T0 - thresholds.keepaliveMaxAgeMs });

      const result = resolveUserDataStreamHealth({ now: T0, record, thresholds });

      expect(result).toEqual({ state: 'HEALTHY', reason: null });
    });
  });

  describe('RN-03: silence is never health — lastEventAtMs never drives the verdict', () => {
    const lastEventAtMsVariants: Array<number | null> = [null, T0, T0 - 24 * 60 * 60 * 1000];

    it.each(lastEventAtMsVariants)(
      'keeps HEALTHY when only lastEventAtMs varies (lastEventAtMs=%s)',
      (lastEventAtMs) => {
        const record = baseRecord({ lastEventAtMs });

        const result = resolveUserDataStreamHealth({ now: T0, record, thresholds });

        expect(result).toEqual({ state: 'HEALTHY', reason: null });
      },
    );

    it.each(lastEventAtMsVariants)(
      'keeps DEGRADED/HEARTBEAT_STALE when only lastEventAtMs varies (lastEventAtMs=%s)',
      (lastEventAtMs) => {
        const record = baseRecord({
          lastHeartbeatAtMs: T0 - thresholds.heartbeatMaxAgeMs - 1,
          lastEventAtMs,
        });

        const result = resolveUserDataStreamHealth({ now: T0, record, thresholds });

        expect(result).toEqual({ state: 'DEGRADED', reason: 'HEARTBEAT_STALE' });
      },
    );

    it('flips HEALTHY to DEGRADED/HEARTBEAT_STALE when lastHeartbeatAtMs crosses its threshold, independent of lastEventAtMs', () => {
      const healthy = resolveUserDataStreamHealth({
        now: T0,
        record: baseRecord({ lastEventAtMs: null }),
        thresholds,
      });
      const degraded = resolveUserDataStreamHealth({
        now: T0,
        record: baseRecord({
          lastHeartbeatAtMs: T0 - thresholds.heartbeatMaxAgeMs - 1,
          lastEventAtMs: null,
        }),
        thresholds,
      });

      expect(healthy).toEqual({ state: 'HEALTHY', reason: null });
      expect(degraded).toEqual({ state: 'DEGRADED', reason: 'HEARTBEAT_STALE' });
    });

    it('flips HEALTHY to DEGRADED/KEEPALIVE_STALE when lastKeepaliveAtMs crosses its threshold, independent of lastEventAtMs', () => {
      const healthy = resolveUserDataStreamHealth({
        now: T0,
        record: baseRecord({ lastEventAtMs: T0 - 24 * 60 * 60 * 1000 }),
        thresholds,
      });
      const degraded = resolveUserDataStreamHealth({
        now: T0,
        record: baseRecord({
          lastKeepaliveAtMs: T0 - thresholds.keepaliveMaxAgeMs - 1,
          lastEventAtMs: T0 - 24 * 60 * 60 * 1000,
        }),
        thresholds,
      });

      expect(healthy).toEqual({ state: 'HEALTHY', reason: null });
      expect(degraded).toEqual({ state: 'DEGRADED', reason: 'KEEPALIVE_STALE' });
    });
  });
});
