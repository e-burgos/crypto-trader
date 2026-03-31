import {
  PositionData,
  PositionStatus,
  Asset,
  QuoteCurrency,
  TradingMode,
} from '@crypto-trader/shared';
import { TRADE_FEE_PCT } from '@crypto-trader/shared';

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
