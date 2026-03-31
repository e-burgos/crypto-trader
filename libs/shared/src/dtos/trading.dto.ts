import { Asset, QuoteCurrency, TradingMode } from '../types/enums';

// ── Trading Config DTOs ──────────────────────────────────
export interface CreateTradingConfigDto {
  asset: Asset;
  pair: QuoteCurrency;
  buyThreshold: number;
  sellThreshold: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxTradePct: number;
  maxConcurrentPositions: number;
  minIntervalMinutes: number;
  mode: TradingMode;
}

export interface UpdateTradingConfigDto {
  buyThreshold?: number;
  sellThreshold?: number;
  stopLossPct?: number;
  takeProfitPct?: number;
  maxTradePct?: number;
  maxConcurrentPositions?: number;
  minIntervalMinutes?: number;
  mode?: TradingMode;
}
