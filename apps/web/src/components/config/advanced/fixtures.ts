import type { EntryOrderMode, TradingConfigWire, TradingIntervalModeWire } from '@crypto-trader/shared';

export function baseWire(overrides: Partial<TradingConfigWire> = {}): TradingConfigWire {
  return {
    id: 'cfg_fixture',
    userId: 'user_fixture',
    name: 'Fixture bot',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'SANDBOX',
    buyThreshold: 72,
    sellThreshold: 68,
    stopLossPct: 0.03,
    takeProfitPct: 0.05,
    minProfitPct: 0.003,
    maxTradePct: 0.1,
    maxConcurrentPositions: 3,
    minIntervalMinutes: 60,
    intervalMode: 'AGENT',
    orderPriceOffsetPct: 0,
    riskProfile: 'MODERATE',
    isRunning: false,
    lossCutEnabled: false,
    lossCutConfidenceThreshold: 0.85,
    lossCutMinLossPct: 0.005,
    lossCutMinEdgeRatio: 2,
    smartSizingEnabled: false,
    reduceSizeFactor: 0.5,
    deterministicGateEnabled: false,
    gatePriceChangePct: 0.005,
    nativeProtectionEnabled: false,
    closeOnProtectionFailure: false,
    stopLimitOffsetPct: 0.002,
    trailingStopEnabled: false,
    trailingStopPct: 0.02,
    trailingActivationPct: 0.01,
    partialTpEnabled: false,
    partialTpTriggerPct: 0.02,
    partialTpSellPct: 0.5,
    moveStopToBreakevenAfterPartial: false,
    maxPositionHoldMinutes: null,
    reactiveLoopEnabled: false,
    maxActionsPerHour: 6,
    minActionIntervalSec: 60,
    entryOrderMode: 'MARKET',
    entryOrderTtlMinutes: 120,
    entryTrailingDeltaBips: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export const configAllOff: TradingConfigWire = baseWire();

export const configAllOn: TradingConfigWire = baseWire({
  mode: 'TESTNET',
  nativeProtectionEnabled: true,
  stopLimitOffsetPct: 0.05,
  closeOnProtectionFailure: true,
  trailingStopEnabled: true,
  trailingStopPct: 1,
  trailingActivationPct: 0.5,
  partialTpEnabled: true,
  partialTpTriggerPct: 0.03,
  partialTpSellPct: 0.6,
  moveStopToBreakevenAfterPartial: true,
  maxPositionHoldMinutes: 43200,
  lossCutEnabled: true,
  lossCutConfidenceThreshold: 0.91,
  lossCutMinLossPct: 0.04,
  lossCutMinEdgeRatio: 100,
  smartSizingEnabled: true,
  reduceSizeFactor: 0.45,
  deterministicGateEnabled: true,
  gatePriceChangePct: 0.0005,
  reactiveLoopEnabled: true,
  maxActionsPerHour: 60,
  minActionIntervalSec: 5,
  entryOrderMode: 'OCO',
  entryOrderTtlMinutes: 1440,
  entryTrailingDeltaBips: 2000,
});

export const configProtectionOnly: TradingConfigWire = baseWire({
  nativeProtectionEnabled: true,
  stopLimitOffsetPct: 0.05,
  closeOnProtectionFailure: true,
  trailingStopEnabled: true,
  trailingStopPct: 1,
  trailingActivationPct: 0.5,
  partialTpEnabled: true,
  partialTpTriggerPct: 0.03,
  partialTpSellPct: 0.6,
  moveStopToBreakevenAfterPartial: true,
  maxPositionHoldMinutes: 43200,
});

export const configSignalOnly: TradingConfigWire = baseWire({
  lossCutEnabled: true,
  lossCutConfidenceThreshold: 0.91,
  lossCutMinLossPct: 0.04,
  lossCutMinEdgeRatio: 100,
  smartSizingEnabled: true,
  reduceSizeFactor: 0.45,
  deterministicGateEnabled: true,
  gatePriceChangePct: 0.0005,
});

export const configReactiveOnly: TradingConfigWire = baseWire({
  reactiveLoopEnabled: true,
  maxActionsPerHour: 60,
  minActionIntervalSec: 5,
});

export const configEntryOnly: TradingConfigWire = baseWire({
  mode: 'TESTNET',
  entryOrderMode: 'OCO',
  entryOrderTtlMinutes: 1440,
  entryTrailingDeltaBips: 2000,
});

export const configWithUnknownValues: TradingConfigWire = baseWire({
  entryOrderMode: 'TWAP' as EntryOrderMode,
  intervalMode: 'UNKNOWN' as TradingIntervalModeWire,
});
