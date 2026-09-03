import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
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

const MIXED_CONFIG: TradingConfigWire = {
  id: 'cfg-mixed',
  userId: 'user-1',
  name: 'Mixed Agent',
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
  isRunning: false,
  lossCutEnabled: false,
  lossCutConfidenceThreshold: 0.8,
  lossCutMinLossPct: 0.01,
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
  maxPositionHoldMinutes: 720,
  reactiveLoopEnabled: false,
  maxActionsPerHour: 10,
  minActionIntervalSec: 90,
  entryOrderMode: 'LIMIT_MAKER',
  entryOrderTtlMinutes: 120,
  entryTrailingDeltaBips: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function clickSave() {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
}

beforeEach(() => {
  mockMutate.mockClear();
});

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

describe('EditAgentModal — el PUT lleva solo lo cambiado (CA-003)', () => {
  it('performs no PUT when nothing changed', () => {
    const onClose = vi.fn();
    render(<EditAgentModal cfg={MIXED_CONFIG} onClose={onClose} />);

    clickSave();

    expect(mockMutate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sends exactly the one base field changed', () => {
    render(<EditAgentModal cfg={MIXED_CONFIG} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '5' }));
    clickSave();

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const [{ id, data }] = mockMutate.mock.calls[0];
    expect(id).toBe('cfg-mixed');
    expect(data).toEqual({ maxConcurrentPositions: 5 });
  });

  it('sends exactly the switch and the dependent param when enabling a family', () => {
    render(<EditAgentModal cfg={MIXED_CONFIG} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('switch', { name: 'Native OCO protection' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Stop-limit offset' }), {
      target: { value: '1.5' },
    });
    clickSave();

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const [{ data }] = mockMutate.mock.calls[0];
    expect(data).toEqual({ nativeProtectionEnabled: true, stopLimitOffsetPct: 0.015 });
  });

  it('sends null when the synthetic switch of maxPositionHoldMinutes is turned off', () => {
    render(<EditAgentModal cfg={MIXED_CONFIG} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('switch', { name: 'Time limit in position' }));
    clickSave();

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const [{ data }] = mockMutate.mock.calls[0];
    expect(data).toEqual({ maxPositionHoldMinutes: null });
  });

  it('clamps an out-of-range value before it reaches the PUT', () => {
    render(<EditAgentModal cfg={MIXED_CONFIG} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('switch', { name: 'Reactive loop' }));
    const slider = screen.getByRole('slider', { name: 'Maximum actions per hour' });
    fireEvent.change(slider, { target: { value: '999' } });

    expect(slider).toHaveValue('60');

    clickSave();

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const [{ data }] = mockMutate.mock.calls[0];
    expect(data).toEqual({ reactiveLoopEnabled: true, maxActionsPerHour: 60 });
  });
});
