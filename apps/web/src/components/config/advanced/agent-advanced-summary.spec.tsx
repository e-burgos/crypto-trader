import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '../../../lib/i18n';
import type { EntryOrderMode, TradingConfigWire } from '@crypto-trader/shared';
import { AgentAdvancedSummary } from './agent-advanced-summary';

vi.mock('../../../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../../lib/api';

function baseWire(overrides: Partial<TradingConfigWire>): TradingConfigWire {
  return {
    id: 'cfg_1',
    userId: 'user_1',
    name: 'BTC agent',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'SANDBOX',
    buyThreshold: 60,
    sellThreshold: 40,
    stopLossPct: 0.05,
    takeProfitPct: 0.1,
    minProfitPct: 0.01,
    maxTradePct: 0.2,
    maxConcurrentPositions: 3,
    minIntervalMinutes: 15,
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
    moveStopToBreakevenAfterPartial: true,
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

const CONFIG_ALL_OFF: TradingConfigWire = baseWire({});

const CONFIG_ALL_ON_EDGES: TradingConfigWire = baseWire({
  mode: 'TESTNET',
  lossCutEnabled: true,
  lossCutConfidenceThreshold: 0.91,
  lossCutMinLossPct: 0.04,
  lossCutMinEdgeRatio: 100,
  smartSizingEnabled: true,
  reduceSizeFactor: 0.45,
  deterministicGateEnabled: true,
  gatePriceChangePct: 0.0005,
  nativeProtectionEnabled: true,
  closeOnProtectionFailure: true,
  stopLimitOffsetPct: 0.05,
  trailingStopEnabled: true,
  trailingStopPct: 1,
  trailingActivationPct: 0.02,
  partialTpEnabled: true,
  partialTpTriggerPct: 0.03,
  partialTpSellPct: 0.6,
  moveStopToBreakevenAfterPartial: true,
  maxPositionHoldMinutes: 43200,
  reactiveLoopEnabled: true,
  maxActionsPerHour: 60,
  minActionIntervalSec: 5,
  entryOrderMode: 'OCO',
  entryOrderTtlMinutes: 1440,
  entryTrailingDeltaBips: 2000,
});

const CONFIG_UNKNOWN_ENTRY_MODE: TradingConfigWire = baseWire({
  entryOrderMode: 'TWAP' as EntryOrderMode,
});

describe('AgentAdvancedSummary', () => {
  it('renders the four section titles from a full fixture of the real wire', () => {
    render(<AgentAdvancedSummary cfg={CONFIG_ALL_ON_EDGES} />);

    expect(screen.getByText('Protection')).toBeInTheDocument();
    expect(screen.getByText('Signal & sizing')).toBeInTheDocument();
    expect(screen.getAllByText('Reactive loop').length).toBeGreaterThan(0);
    expect(screen.getByText('Entry')).toBeInTheDocument();
  });

  it('shows every switch off and no dependent parameter when everything is off', () => {
    render(<AgentAdvancedSummary cfg={CONFIG_ALL_OFF} />);

    expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not applicable').length).toBeGreaterThan(0);
    expect(screen.queryByText('0.2%')).not.toBeInTheDocument();
    expect(screen.queryByText('2%')).not.toBeInTheDocument();
  });

  it('shows the noLimit and fixedLevel texts for the two nullable fields', () => {
    render(<AgentAdvancedSummary cfg={CONFIG_ALL_OFF} />);

    expect(screen.getByText('No limit')).toBeInTheDocument();
    expect(screen.getByText('Fixed level')).toBeInTheDocument();
  });

  it('renders formatted values for every dependent parameter when everything is on', () => {
    render(<AgentAdvancedSummary cfg={CONFIG_ALL_ON_EDGES} />);

    expect(screen.getAllByText('Enabled').length).toBeGreaterThan(0);
    expect(screen.queryByText('Not applicable')).not.toBeInTheDocument();
    expect(screen.getByText('5%')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('100×')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('5 s')).toBeInTheDocument();
    expect(screen.getByText('43200 min')).toBeInTheDocument();
    expect(screen.getByText('1440 min')).toBeInTheDocument();
    expect(screen.getByText('2000 bips')).toBeInTheDocument();
    expect(screen.getByText('Support + breakout (OCO)')).toBeInTheDocument();
  });

  it('degrades an unknown entryOrderMode to a neutral badge without breaking the other rows', () => {
    render(<AgentAdvancedSummary cfg={CONFIG_UNKNOWN_ENTRY_MODE} />);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('Protection')).toBeInTheDocument();
    expect(screen.getByText('Signal & sizing')).toBeInTheDocument();
    expect(screen.getAllByText('Reactive loop').length).toBeGreaterThan(0);
    expect(screen.getByText('Entry')).toBeInTheDocument();
    expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0);
  });

  it('never renders a raw i18n key literal', () => {
    render(<AgentAdvancedSummary cfg={CONFIG_ALL_ON_EDGES} />);

    expect(screen.queryByText(/^config\.advanced\./)).not.toBeInTheDocument();
  });

  it('never triggers a mutation: this view has no interactive controls', () => {
    render(<AgentAdvancedSummary cfg={CONFIG_ALL_ON_EDGES} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(api.put).not.toHaveBeenCalled();
  });
});
