import { simulateTrade } from './risk/trade-simulation';

export type SellPath = 'TAKE_PROFIT' | 'LOSS_CUT' | 'NONE';

export interface SellPolicyConfig {
  minProfitPct: number;
  lossCutEnabled: boolean;
  lossCutConfidenceThreshold: number;
  lossCutMinLossPct: number;
  lossCutMinEdgeRatio: number;
}

export interface SellPolicyInput {
  asset: string;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  stopLossPct: number;
  signalConfidence: number | null | undefined;
  config: SellPolicyConfig;
}

export interface SellPolicyDecision {
  allow: boolean;
  path: SellPath;
  profitPct: number;
  avoidedLossUsd: number;
  exitFrictionUsd: number;
  edgeRatio: number;
  reason: string;
}

function none(
  profitPct: number,
  reason: string,
): SellPolicyDecision {
  return {
    allow: false,
    path: 'NONE',
    profitPct,
    avoidedLossUsd: 0,
    exitFrictionUsd: 0,
    edgeRatio: 0,
    reason,
  };
}

export function evaluateSellPolicy(
  input: SellPolicyInput,
): SellPolicyDecision {
  const { entryPrice, currentPrice, quantity, stopLossPct, config } = input;
  const profitPct = (currentPrice - entryPrice) / entryPrice;

  if (profitPct >= config.minProfitPct) {
    return {
      allow: true,
      path: 'TAKE_PROFIT',
      profitPct,
      avoidedLossUsd: 0,
      exitFrictionUsd: 0,
      edgeRatio: 0,
      reason: `Profit ${(profitPct * 100).toFixed(2)}% reaches the minimum ${(config.minProfitPct * 100).toFixed(2)}%`,
    };
  }

  if (!config.lossCutEnabled) {
    return none(profitPct, 'Loss cut disabled');
  }

  const signalConfidence = input.signalConfidence;
  if (
    signalConfidence == null ||
    !Number.isFinite(signalConfidence) ||
    signalConfidence < 0 ||
    signalConfidence > 1
  ) {
    return none(profitPct, 'Signal confidence missing or out of range');
  }

  if (profitPct >= 0) {
    return none(profitPct, 'Position is not in loss');
  }

  if (Math.abs(profitPct) < config.lossCutMinLossPct) {
    return none(
      profitPct,
      `Loss ${(Math.abs(profitPct) * 100).toFixed(2)}% below minimum ${(config.lossCutMinLossPct * 100).toFixed(2)}%`,
    );
  }

  if (signalConfidence < config.lossCutConfidenceThreshold) {
    return none(
      profitPct,
      `Confidence ${signalConfidence} below threshold ${config.lossCutConfidenceThreshold}`,
    );
  }

  const stopPrice = entryPrice * (1 - stopLossPct);
  const avoidedLossUsd = Math.max(0, (currentPrice - stopPrice) * quantity);
  const exitFrictionUsd = simulateTrade({
    asset: input.asset,
    side: 'SELL',
    price: currentPrice,
    quantity,
    stopLossPct: 0,
    takeProfitPct: 0,
  }).downsideUsd;
  const edgeRatio = exitFrictionUsd > 0 ? avoidedLossUsd / exitFrictionUsd : 0;

  if (edgeRatio < config.lossCutMinEdgeRatio) {
    return {
      allow: false,
      path: 'NONE',
      profitPct,
      avoidedLossUsd,
      exitFrictionUsd,
      edgeRatio,
      reason: `Edge ratio ${edgeRatio.toFixed(2)} below minimum ${config.lossCutMinEdgeRatio}`,
    };
  }

  return {
    allow: true,
    path: 'LOSS_CUT',
    profitPct,
    avoidedLossUsd,
    exitFrictionUsd,
    edgeRatio,
    reason: `Avoided loss ${avoidedLossUsd.toFixed(2)} exceeds ${config.lossCutMinEdgeRatio}x the exit friction ${exitFrictionUsd.toFixed(2)}`,
  };
}
