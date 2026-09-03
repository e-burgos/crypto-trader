import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TradingConfigWire } from '@crypto-trader/shared';
import '../../lib/i18n';
import { EditAgentModal } from './edit-agent-modal';

const mockMutate = vi.fn();

vi.mock('../../hooks/use-trading', () => ({
  useUpdateConfig: () => ({ mutate: mockMutate, isPending: false }),
}));

vi.mock('../../hooks/use-user', () => ({
  useTestnetBinanceKeyStatus: () => ({ data: { hasKeys: true } }),
}));

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

describe('EditAgentModal — advanced sections precargadas con el estado real', () => {
  it('shows each advanced switch in its real persisted state', () => {
    render(<EditAgentModal cfg={FULL_ON_CONFIG} onClose={vi.fn()} />);

    expect(screen.getByRole('switch', { name: 'Native OCO protection' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('switch', { name: 'Trailing stop' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('switch', { name: 'Partial take-profit' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('switch', { name: 'Signal loss cut' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('switch', { name: 'Smart sizing' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('switch', { name: 'Deterministic gate' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('switch', { name: 'Reactive loop' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('switch', { name: 'Time limit in position' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('switch', { name: 'Trailing on breakout' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('prefills advanced numeric params with the persisted value', () => {
    render(<EditAgentModal cfg={FULL_ON_CONFIG} onClose={vi.fn()} />);

    expect(screen.getByRole('slider', { name: 'Stop-limit offset' })).toHaveValue('1.5');
    expect(screen.getByRole('slider', { name: 'Maximum time in position' })).toHaveValue('720');
    expect(screen.getByRole('slider', { name: 'Maximum actions per hour' })).toHaveValue('12');
    expect(screen.getByRole('slider', { name: 'Breakout trailing' })).toHaveValue('150');
    expect(screen.getByText('Support + breakout (OCO)')).toBeInTheDocument();
  });
});
