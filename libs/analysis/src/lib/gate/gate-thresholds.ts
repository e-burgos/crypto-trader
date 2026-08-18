export interface DeterministicGateThresholds {
  rsiLowerBand: number;
  rsiUpperBand: number;
  rsiMaxDelta: number;
  priceChangePct: number;
  snapshotMaxAgeMs: number;
  previousDecisionMaxAgeMs: number;
}

export const DEFAULT_GATE_THRESHOLDS: DeterministicGateThresholds = {
  rsiLowerBand: 40,
  rsiUpperBand: 60,
  rsiMaxDelta: 5,
  priceChangePct: 0.005,
  snapshotMaxAgeMs: 5 * 60_000,
  previousDecisionMaxAgeMs: 90 * 60_000,
};
