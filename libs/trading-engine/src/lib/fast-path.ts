import {
  PartialTakeProfitConfig,
  PartialTakeProfitResult,
  TrailingConfig,
  TrailingState,
  resolvePartialTakeProfit,
  resolveProtectionRearm,
  updateTrailingStop,
} from './position-manager';

export type FastPathActionKind =
  | 'HARD_STOP_EXIT'
  | 'TRAILING_EXIT'
  | 'PARTIAL_TAKE_PROFIT'
  | 'PROTECTION_REARM';

export interface FastPathPositionSnapshot {
  id: string;
  entryPrice: number;
  quantity: number;
  stopPrice: number | null;
  highWaterPrice: number | null;
  trailingActive: boolean;
  partialExitCount: number;
  protectionStatus: string;
}

export interface FastPathConfigSnapshot {
  stopLossPct: number;
  trailingStopEnabled: boolean;
  trailingStopPct: number;
  trailingActivationPct: number;
  partialTpEnabled: boolean;
  partialTpTriggerPct: number;
  partialTpSellPct: number;
  moveStopToBreakevenAfterPartial: boolean;
  nativeProtectionEnabled: boolean;
  takeProfitPct: number;
}

export interface PlanFastPathInput {
  now: number;
  currentPrice: number;
  position: FastPathPositionSnapshot;
  config: FastPathConfigSnapshot;
  isSandbox: boolean;
  lotStep: number;
  minNotional: number;
}

export type FastPathPlan =
  | { action: 'NONE'; trailing: TrailingState; reason: string }
  | { action: 'HARD_STOP_EXIT'; trailing: TrailingState; effectiveStop: number }
  | { action: 'TRAILING_EXIT'; trailing: TrailingState; effectiveStop: number }
  | { action: 'PARTIAL_TAKE_PROFIT'; trailing: TrailingState; partial: PartialTakeProfitResult }
  | { action: 'PROTECTION_REARM'; trailing: TrailingState; desiredStopPrice: number };

function toTrailingState(position: FastPathPositionSnapshot): TrailingState {
  return {
    entryPrice: position.entryPrice,
    stopPrice: position.stopPrice,
    highWaterPrice: position.highWaterPrice,
    trailingActive: position.trailingActive,
  };
}

function toTrailingConfig(config: FastPathConfigSnapshot): TrailingConfig {
  return {
    trailingStopEnabled: config.trailingStopEnabled,
    trailingStopPct: config.trailingStopPct,
    trailingActivationPct: config.trailingActivationPct,
  };
}

function toPartialTakeProfitConfig(config: FastPathConfigSnapshot): PartialTakeProfitConfig {
  return {
    partialTpEnabled: config.partialTpEnabled,
    partialTpTriggerPct: config.partialTpTriggerPct,
    partialTpSellPct: config.partialTpSellPct,
    moveStopToBreakevenAfterPartial: config.moveStopToBreakevenAfterPartial,
  };
}

export function planFastPath(input: PlanFastPathInput): FastPathPlan {
  const { position, config, currentPrice, lotStep, minNotional, isSandbox } = input;

  const trailing = updateTrailingStop(
    toTrailingState(position),
    currentPrice,
    toTrailingConfig(config),
    config.stopLossPct,
  );

  const effectiveStop = trailing.stopPrice ?? position.entryPrice * (1 - config.stopLossPct);
  if (currentPrice <= effectiveStop) {
    return trailing.trailingActive
      ? { action: 'TRAILING_EXIT', trailing, effectiveStop }
      : { action: 'HARD_STOP_EXIT', trailing, effectiveStop };
  }

  const partial = resolvePartialTakeProfit({
    entryPrice: position.entryPrice,
    quantity: position.quantity,
    currentPrice,
    partialExitCount: position.partialExitCount,
    cfg: toPartialTakeProfitConfig(config),
    lotStep,
    minNotional,
  });
  if (partial != null) {
    return { action: 'PARTIAL_TAKE_PROFIT', trailing, partial };
  }

  if (trailing.stopPrice !== position.stopPrice) {
    const rearm = resolveProtectionRearm({
      protectionStatus: position.protectionStatus,
      activeStopPrice: position.stopPrice,
      desiredStopPrice: trailing.stopPrice,
      remainingQuantity: position.quantity,
      nativeProtectionEnabled: config.nativeProtectionEnabled,
      isSandbox,
    });
    if (rearm.action === 'REARM' && trailing.stopPrice != null) {
      return { action: 'PROTECTION_REARM', trailing, desiredStopPrice: trailing.stopPrice };
    }
  }

  return { action: 'NONE', trailing, reason: 'NO_ACTION_MATCHED' };
}
