import { StreamHealthRecord, StreamHealthState } from '@crypto-trader/shared';

export type StreamHealthReason =
  | 'NO_RECORD'
  | 'TICK_STALE'
  | 'HEARTBEAT_STALE'
  | null;

export interface StreamHealthThresholds {
  tickMaxAgeMs: number;
  heartbeatMaxAgeMs: number;
}

export interface ResolveStreamHealthInput {
  now: number;
  record: StreamHealthRecord | null;
  thresholds: StreamHealthThresholds;
}

export interface ResolveStreamHealthResult {
  state: StreamHealthState;
  reason: StreamHealthReason;
}

export function resolveStreamHealth(
  input: ResolveStreamHealthInput,
): ResolveStreamHealthResult {
  const { now, record, thresholds } = input;

  if (!record) {
    return { state: 'UNKNOWN', reason: 'NO_RECORD' };
  }
  if (now - record.lastTickAtMs > thresholds.tickMaxAgeMs) {
    return { state: 'DEGRADED', reason: 'TICK_STALE' };
  }
  if (now - record.lastHeartbeatAtMs > thresholds.heartbeatMaxAgeMs) {
    return { state: 'DEGRADED', reason: 'HEARTBEAT_STALE' };
  }

  return { state: 'HEALTHY', reason: null };
}
