import { DeterministicGateSnapshot } from './deterministic-gate';
import { DeterministicGateThresholds } from './gate-thresholds';

export function buildGateHoldReasoning(
  current: DeterministicGateSnapshot,
  previous: DeterministicGateSnapshot,
  thresholds: DeterministicGateThresholds,
): string {
  const priceChangePct = ((current.close - previous.close) / previous.close) * 100;
  const priceSign = priceChangePct >= 0 ? '+' : '';
  const priceLimitPct = thresholds.priceChangePct * 100;

  return (
    `HOLD determinista: sin cruce de EMA, RSI ${current.rsi.toFixed(1)} en banda ` +
    `${thresholds.rsiLowerBand}-${thresholds.rsiUpperBand}, precio ${priceSign}${priceChangePct.toFixed(2)}% ` +
    `(< ${priceLimitPct.toFixed(2)}%), posiciones y noticias sin cambios desde la decisión anterior. ` +
    `Sin llamada a LLM.`
  );
}
