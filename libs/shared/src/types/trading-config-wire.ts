import type { EntryOrderMode } from './interfaces';

export type TradingAssetWire = 'BTC' | 'ETH';
export type TradingQuoteWire = 'USDT' | 'USDC';
export type TradingModeWire = 'LIVE' | 'SANDBOX' | 'TESTNET';
export type TradingIntervalModeWire = 'AGENT' | 'CUSTOM';
export type TradingRiskProfileWire = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';

export type ExactKeys<A, B> = Exclude<keyof A, keyof B> | Exclude<keyof B, keyof A>;
export type AssertNoKeyDrift<T extends never> = T;

export interface TradingConfigWire {
  id: string;
  userId: string;
  name: string;
  asset: TradingAssetWire;
  pair: TradingQuoteWire;
  mode: TradingModeWire;
  buyThreshold: number;
  sellThreshold: number;
  stopLossPct: number;
  takeProfitPct: number;
  minProfitPct: number;
  maxTradePct: number;
  maxConcurrentPositions: number;
  minIntervalMinutes: number;
  intervalMode: TradingIntervalModeWire;
  orderPriceOffsetPct: number;
  riskProfile: TradingRiskProfileWire;
  isRunning: boolean;
  lossCutEnabled: boolean;
  lossCutConfidenceThreshold: number;
  lossCutMinLossPct: number;
  lossCutMinEdgeRatio: number;
  smartSizingEnabled: boolean;
  reduceSizeFactor: number;
  deterministicGateEnabled: boolean;
  gatePriceChangePct: number;
  nativeProtectionEnabled: boolean;
  closeOnProtectionFailure: boolean;
  stopLimitOffsetPct: number;
  trailingStopEnabled: boolean;
  trailingStopPct: number;
  trailingActivationPct: number;
  partialTpEnabled: boolean;
  partialTpTriggerPct: number;
  partialTpSellPct: number;
  moveStopToBreakevenAfterPartial: boolean;
  maxPositionHoldMinutes: number | null;
  reactiveLoopEnabled: boolean;
  maxActionsPerHour: number;
  minActionIntervalSec: number;
  entryOrderMode: EntryOrderMode;
  entryOrderTtlMinutes: number;
  entryTrailingDeltaBips: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTradingConfigInput {
  name?: string;
  asset: TradingAssetWire;
  pair: TradingQuoteWire;
  mode: TradingModeWire;
  buyThreshold?: number;
  sellThreshold?: number;
  stopLossPct?: number;
  takeProfitPct?: number;
  minProfitPct?: number;
  maxTradePct?: number;
  maxConcurrentPositions?: number;
  minIntervalMinutes?: number;
  orderPriceOffsetPct?: number;
  intervalMode?: TradingIntervalModeWire;
  riskProfile?: TradingRiskProfileWire;
  lossCutEnabled?: boolean;
  lossCutConfidenceThreshold?: number;
  lossCutMinLossPct?: number;
  lossCutMinEdgeRatio?: number;
  smartSizingEnabled?: boolean;
  reduceSizeFactor?: number;
  nativeProtectionEnabled?: boolean;
  closeOnProtectionFailure?: boolean;
  stopLimitOffsetPct?: number;
  trailingStopEnabled?: boolean;
  trailingStopPct?: number;
  trailingActivationPct?: number;
  partialTpEnabled?: boolean;
  partialTpTriggerPct?: number;
  partialTpSellPct?: number;
  moveStopToBreakevenAfterPartial?: boolean;
  maxPositionHoldMinutes?: number;
  deterministicGateEnabled?: boolean;
  gatePriceChangePct?: number;
  reactiveLoopEnabled?: boolean;
  maxActionsPerHour?: number;
  minActionIntervalSec?: number;
  entryOrderMode?: EntryOrderMode;
  entryOrderTtlMinutes?: number;
  entryTrailingDeltaBips?: number;
}

export interface UpdateTradingConfigInput {
  name?: string;
  mode?: TradingModeWire;
  buyThreshold?: number;
  sellThreshold?: number;
  stopLossPct?: number;
  takeProfitPct?: number;
  minProfitPct?: number;
  maxTradePct?: number;
  maxConcurrentPositions?: number;
  minIntervalMinutes?: number;
  orderPriceOffsetPct?: number;
  intervalMode?: TradingIntervalModeWire;
  isActive?: boolean;
  riskProfile?: TradingRiskProfileWire;
  lossCutEnabled?: boolean;
  lossCutConfidenceThreshold?: number;
  lossCutMinLossPct?: number;
  lossCutMinEdgeRatio?: number;
  smartSizingEnabled?: boolean;
  reduceSizeFactor?: number;
  nativeProtectionEnabled?: boolean;
  closeOnProtectionFailure?: boolean;
  stopLimitOffsetPct?: number;
  trailingStopEnabled?: boolean;
  trailingStopPct?: number;
  trailingActivationPct?: number;
  partialTpEnabled?: boolean;
  partialTpTriggerPct?: number;
  partialTpSellPct?: number;
  moveStopToBreakevenAfterPartial?: boolean;
  maxPositionHoldMinutes?: number;
  deterministicGateEnabled?: boolean;
  gatePriceChangePct?: number;
  reactiveLoopEnabled?: boolean;
  maxActionsPerHour?: number;
  minActionIntervalSec?: number;
  entryOrderMode?: EntryOrderMode;
  entryOrderTtlMinutes?: number;
  entryTrailingDeltaBips?: number;
}

export type UpdateTradingConfigPayload = Omit<
  UpdateTradingConfigInput,
  'isActive' | 'mode' | 'maxPositionHoldMinutes' | 'entryTrailingDeltaBips'
> & {
  maxPositionHoldMinutes?: number | null;
  entryTrailingDeltaBips?: number | null;
};

export const TRADING_CONFIG_BASE_FIELDS = [
  'name', 'asset', 'pair', 'mode',
  'buyThreshold', 'sellThreshold', 'stopLossPct', 'takeProfitPct', 'minProfitPct',
  'maxTradePct', 'maxConcurrentPositions', 'minIntervalMinutes',
  'intervalMode', 'orderPriceOffsetPct', 'riskProfile',
] as const;

export const TRADING_CONFIG_ADVANCED_FIELDS = [
  'nativeProtectionEnabled', 'stopLimitOffsetPct', 'closeOnProtectionFailure',
  'trailingStopEnabled', 'trailingStopPct', 'trailingActivationPct',
  'partialTpEnabled', 'partialTpTriggerPct', 'partialTpSellPct',
  'moveStopToBreakevenAfterPartial', 'maxPositionHoldMinutes',
  'lossCutEnabled', 'lossCutConfidenceThreshold', 'lossCutMinLossPct', 'lossCutMinEdgeRatio',
  'smartSizingEnabled', 'reduceSizeFactor',
  'deterministicGateEnabled', 'gatePriceChangePct',
  'reactiveLoopEnabled', 'maxActionsPerHour', 'minActionIntervalSec',
  'entryOrderMode', 'entryOrderTtlMinutes', 'entryTrailingDeltaBips',
] as const;

export type TradingConfigBaseField = (typeof TRADING_CONFIG_BASE_FIELDS)[number];
export type TradingConfigAdvancedField = (typeof TRADING_CONFIG_ADVANCED_FIELDS)[number];

export type _AdvancedFieldsPartitionIsExact = AssertNoKeyDrift<
  | Exclude<keyof CreateTradingConfigInput, TradingConfigBaseField | TradingConfigAdvancedField>
  | Exclude<TradingConfigBaseField | TradingConfigAdvancedField, keyof CreateTradingConfigInput>
>;
