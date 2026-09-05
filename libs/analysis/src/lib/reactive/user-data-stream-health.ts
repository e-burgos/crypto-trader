import { StreamHealthState, UserDataStreamHealthRecord } from '@crypto-trader/shared';

export type UserDataStreamHealthReason =
  | 'NO_RECORD'
  | 'HEARTBEAT_STALE'
  | 'KEEPALIVE_STALE'
  | null;

export interface UserDataStreamHealthThresholds {
  heartbeatMaxAgeMs: number;
  keepaliveMaxAgeMs: number;
}

export interface ResolveUserDataStreamHealthInput {
  now: number;
  record: UserDataStreamHealthRecord | null;
  thresholds: UserDataStreamHealthThresholds;
}

export interface ResolveUserDataStreamHealthResult {
  state: StreamHealthState;
  reason: UserDataStreamHealthReason;
}

export function resolveUserDataStreamHealth(
  input: ResolveUserDataStreamHealthInput,
): ResolveUserDataStreamHealthResult {
  const { now, record, thresholds } = input;

  if (!record) {
    return { state: 'UNKNOWN', reason: 'NO_RECORD' };
  }
  if (now - record.lastHeartbeatAtMs > thresholds.heartbeatMaxAgeMs) {
    return { state: 'DEGRADED', reason: 'HEARTBEAT_STALE' };
  }
  if (now - record.lastKeepaliveAtMs > thresholds.keepaliveMaxAgeMs) {
    return { state: 'DEGRADED', reason: 'KEEPALIVE_STALE' };
  }

  return { state: 'HEALTHY', reason: null };
}
