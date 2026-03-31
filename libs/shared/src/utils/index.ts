import { TRADE_FEE_PCT } from '../constants';

/**
 * Calculate P&L for a closed position including fees on both sides.
 */
export function calculatePnl(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  feePct: number = TRADE_FEE_PCT,
): { pnl: number; buyFee: number; sellFee: number; totalFees: number } {
  const buyFee = entryPrice * quantity * feePct;
  const sellFee = exitPrice * quantity * feePct;
  const totalFees = buyFee + sellFee;
  const pnl = (exitPrice - entryPrice) * quantity - totalFees;
  return { pnl, buyFee, sellFee, totalFees };
}

/**
 * Apply a fee percentage to a trade value.
 */
export function applyFee(
  price: number,
  quantity: number,
  feePct: number = TRADE_FEE_PCT,
): number {
  return price * quantity * feePct;
}

/**
 * Format a number as currency (USD).
 */
export function formatCurrency(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a number as a percentage.
 */
export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Build a Binance symbol string from asset and quote.
 */
export function buildSymbol(asset: string, quote: string): string {
  return `${asset}${quote}`;
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
