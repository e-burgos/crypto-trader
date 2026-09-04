import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TradingConfigWire } from '@crypto-trader/shared';
import '../../lib/i18n';
import { AgentCurrentStateModal } from './agent-state-modal';

const FULL_ON_CONFIG: TradingConfigWire = {
  id: 'cfg-full',
  userId: 'user-1',
  name: 'Full Agent',
  asset: 'BTC',
  pair: 'USDT',
  mode: 'TESTNET',
  buyThreshold: 70,
  sellThreshold: 30,
  stopLossPct: 0.05,
  takeProfitPct: 0.1,
  minProfitPct: 0.005,
  maxTradePct: 0.2,
  maxConcurrentPositions: 3,
  minIntervalMinutes: 15,
  intervalMode: 'CUSTOM',
  orderPriceOffsetPct: 0.01,
  riskProfile: 'MODERATE',
  isRunning: true,
  lossCutEnabled: true,
  lossCutConfidenceThreshold: 0.75,
  lossCutMinLossPct: 0.02,
  lossCutMinEdgeRatio: 3,
  smartSizingEnabled: true,
  reduceSizeFactor: 0.6,
  deterministicGateEnabled: true,
  gatePriceChangePct: 0.01,
  nativeProtectionEnabled: true,
  closeOnProtectionFailure: true,
  stopLimitOffsetPct: 0.015,
  trailingStopEnabled: true,
  trailingStopPct: 0.05,
  trailingActivationPct: 0.02,
  partialTpEnabled: true,
  partialTpTriggerPct: 0.03,
  partialTpSellPct: 0.4,
  moveStopToBreakevenAfterPartial: true,
  maxPositionHoldMinutes: 720,
  reactiveLoopEnabled: true,
  maxActionsPerHour: 12,
  minActionIntervalSec: 90,
  entryOrderMode: 'OCO',
  entryOrderTtlMinutes: 180,
  entryTrailingDeltaBips: 150,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('AgentCurrentStateModal — refleja el estado real del agente (FIX-e-burgos-030)', () => {
  it('shows the active label when the agent is running', () => {
    render(
      <AgentCurrentStateModal
        config={{ ...FULL_ON_CONFIG, isRunning: true }}
        lastDecision={null}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('Stopped')).not.toBeInTheDocument();
  });

  it('shows the stopped label when the agent is not running', () => {
    render(
      <AgentCurrentStateModal
        config={{ ...FULL_ON_CONFIG, isRunning: false }}
        lastDecision={null}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Stopped')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });
});
