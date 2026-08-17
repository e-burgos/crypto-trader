import {
  PositionData,
  PositionStatus,
  Asset,
  QuoteCurrency,
  TradingMode,
} from '@crypto-trader/shared';
import { TRADE_FEE_PCT } from '@crypto-trader/shared';

export interface TrailingConfig {
  trailingStopEnabled: boolean;
  trailingStopPct: number;
  trailingActivationPct: number;
}

export interface TrailingState {
  entryPrice: number;
  stopPrice: number | null;
  highWaterPrice: number | null;
  trailingActive: boolean;
}

export interface PartialTakeProfitConfig {
  partialTpEnabled: boolean;
  partialTpTriggerPct: number;
  partialTpSellPct: number;
  moveStopToBreakevenAfterPartial: boolean;
}

export interface ResolvePartialTakeProfitInput {
  entryPrice: number;
  quantity: number;
  currentPrice: number;
  partialExitCount: number;
  cfg: PartialTakeProfitConfig;
  lotStep: number;
  minNotional: number;
}

export interface PartialTakeProfitResult {
  sellQuantity: number;
  newStopPrice: number | null;
}

export interface ApplyPartialExitResult {
  quantity: number;
  realizedPnlDelta: number;
  fees: number;
}

function floorToStep(value: number, step: number): number {
  if (!(step > 0)) return Math.floor(value * 1e8) / 1e8;
  const units = Math.floor((value + 1e-9) / step);
  return Math.round(units * step * 1e8) / 1e8;
}

export function updateTrailingStop(
  state: TrailingState,
  currentPrice: number,
  cfg: TrailingConfig,
  baseStopLossPct: number,
): TrailingState {
  const highWaterPrice = Math.max(
    state.highWaterPrice ?? state.entryPrice,
    currentPrice,
  );

  if (!cfg.trailingStopEnabled) {
    return { ...state, highWaterPrice };
  }

  const activationReached =
    (highWaterPrice - state.entryPrice) / state.entryPrice >=
    cfg.trailingActivationPct;
  const trailingActive = state.trailingActive || activationReached;

  if (!trailingActive) {
    return { ...state, highWaterPrice, trailingActive };
  }

  const candidate = highWaterPrice * (1 - cfg.trailingStopPct);
  const baseStop = state.stopPrice ?? state.entryPrice * (1 - baseStopLossPct);
  const stopPrice = Math.max(baseStop, candidate);

  return {
    entryPrice: state.entryPrice,
    stopPrice,
    highWaterPrice,
    trailingActive,
  };
}

export function shouldExitByTime(
  entryAt: Date,
  now: Date,
  maxHoldMinutes: number | null,
): boolean {
  if (maxHoldMinutes == null) return false;
  const ageMinutes = (now.getTime() - entryAt.getTime()) / 60_000;
  return ageMinutes >= maxHoldMinutes;
}

export function resolvePartialTakeProfit(
  input: ResolvePartialTakeProfitInput,
): PartialTakeProfitResult | null {
  const { entryPrice, quantity, currentPrice, partialExitCount, cfg, lotStep, minNotional } =
    input;

  if (!cfg.partialTpEnabled) return null;
  if (partialExitCount > 0) return null;
  if (currentPrice < entryPrice * (1 + cfg.partialTpTriggerPct)) return null;

  const sellQuantity = floorToStep(quantity * cfg.partialTpSellPct, lotStep);
  if (sellQuantity <= 0) return null;
  if (sellQuantity * currentPrice < minNotional) return null;

  const remainder = quantity - sellQuantity;
  if (remainder * currentPrice < minNotional) return null;

  const newStopPrice = cfg.moveStopToBreakevenAfterPartial
    ? entryPrice * (1 + 2 * TRADE_FEE_PCT)
    : null;

  return { sellQuantity, newStopPrice };
}

export function applyPartialExit(
  position: PositionData,
  exitPrice: number,
  sellQuantity: number,
): ApplyPartialExitResult {
  const fee = exitPrice * sellQuantity * TRADE_FEE_PCT;
  const grossPnl = (exitPrice - position.entryPrice) * sellQuantity;
  const realizedPnlDelta = grossPnl - fee;

  return {
    quantity: Math.round((position.quantity - sellQuantity) * 1e8) / 1e8,
    realizedPnlDelta: Math.round(realizedPnlDelta * 100) / 100,
    fees: Math.round(fee * 100) / 100,
  };
}

export interface OpenPositionParams {
  userId: string;
  configId: string;
  asset: Asset;
  pair: QuoteCurrency;
  mode: TradingMode;
  entryPrice: number;
  quantity: number;
}

export interface ClosePositionResult {
  position: PositionData;
  pnl: number;
  pnlPct: number;
}

/**
 * Manages position lifecycle — open, close, check stop-loss/take-profit.
 */
export class PositionManager {
  /**
   * Create a new open position.
   */
  openPosition(params: OpenPositionParams): Omit<PositionData, 'id'> {
    const fee = params.entryPrice * params.quantity * TRADE_FEE_PCT;
    return {
      userId: params.userId,
      configId: params.configId,
      asset: params.asset,
      pair: params.pair,
      mode: params.mode,
      entryPrice: params.entryPrice,
      quantity: params.quantity,
      entryAt: new Date(),
      status: PositionStatus.OPEN,
      fees: fee,
    };
  }

  /**
   * Close a position and calculate P&L.
   */
  closePosition(
    position: PositionData,
    exitPrice: number,
  ): ClosePositionResult {
    const exitFee = exitPrice * position.quantity * TRADE_FEE_PCT;
    const totalFees = position.fees + exitFee;
    const grossPnl = (exitPrice - position.entryPrice) * position.quantity;
    const pnl = grossPnl - totalFees;
    const pnlPct = position.entryPrice > 0
      ? (pnl / (position.entryPrice * position.quantity)) * 100
      : 0;

    return {
      position: {
        ...position,
        exitPrice,
        exitAt: new Date(),
        status: PositionStatus.CLOSED,
        pnl: Math.round(pnl * 100) / 100,
        fees: Math.round(totalFees * 100) / 100,
      },
      pnl: Math.round(pnl * 100) / 100,
      pnlPct: Math.round(pnlPct * 100) / 100,
    };
  }

  /**
   * Check if stop-loss should trigger.
   */
  shouldStopLoss(position: PositionData, currentPrice: number, stopLossPct: number): boolean {
    const lossRatio = (position.entryPrice - currentPrice) / position.entryPrice;
    return lossRatio >= stopLossPct;
  }

  /**
   * Check if take-profit should trigger.
   */
  shouldTakeProfit(position: PositionData, currentPrice: number, takeProfitPct: number): boolean {
    const gainRatio = (currentPrice - position.entryPrice) / position.entryPrice;
    return gainRatio >= takeProfitPct;
  }

  /**
   * Calculate unrealized P&L for an open position.
   */
  calculateUnrealizedPnl(
    position: PositionData,
    currentPrice: number,
  ): { pnl: number; pnlPct: number } {
    const exitFee = currentPrice * position.quantity * TRADE_FEE_PCT;
    const grossPnl = (currentPrice - position.entryPrice) * position.quantity;
    const pnl = grossPnl - position.fees - exitFee;
    const pnlPct = position.entryPrice > 0
      ? (pnl / (position.entryPrice * position.quantity)) * 100
      : 0;

    return {
      pnl: Math.round(pnl * 100) / 100,
      pnlPct: Math.round(pnlPct * 100) / 100,
    };
  }
}
