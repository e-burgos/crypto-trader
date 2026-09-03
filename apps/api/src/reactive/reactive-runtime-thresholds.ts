export interface ReactiveRuntimeThresholds {
  ownerLeaseTtlMs: number;
  ownerRenewIntervalMs: number;
  ownerSweepIntervalMs: number;
  symbolRefreshIntervalMs: number;
  healthPublishIntervalMs: number;
  streamTickMaxAgeMs: number;
  streamHeartbeatMaxAgeMs: number;
  streamHealthTtlMs: number;
  streamWarmupTicks: number;
  wsPingIntervalMs: number;
  wsPongTimeoutMs: number;
  botActionLeaseTtlMs: number;
  degradedNotifyAfterMs: number;
  trailingPersistIntervalMs: number;
  entryFillProbeDebounceMs: number;
  coordinationCommandTimeoutMs: number;
  coordinationBootstrapTimeoutMs: number;
}

export const DEFAULT_REACTIVE_RUNTIME_THRESHOLDS: ReactiveRuntimeThresholds = {
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
};
