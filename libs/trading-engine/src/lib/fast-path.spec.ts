import { readFileSync } from 'fs';
import { join } from 'path';
import {
  FastPathConfigSnapshot,
  FastPathPositionSnapshot,
  PlanFastPathInput,
  planFastPath,
} from './fast-path';

function basePosition(overrides: Partial<FastPathPositionSnapshot> = {}): FastPathPositionSnapshot {
  return {
    id: 'pos-1',
    entryPrice: 100,
    quantity: 1,
    stopPrice: null,
    highWaterPrice: null,
    trailingActive: false,
    partialExitCount: 0,
    protectionStatus: 'NOT_PROTECTED',
    ...overrides,
  };
}

function baseConfig(overrides: Partial<FastPathConfigSnapshot> = {}): FastPathConfigSnapshot {
  return {
    stopLossPct: 0.05,
    trailingStopEnabled: false,
    trailingStopPct: 0.03,
    trailingActivationPct: 0.02,
    partialTpEnabled: false,
    partialTpTriggerPct: 0.05,
    partialTpSellPct: 0.5,
    moveStopToBreakevenAfterPartial: false,
    nativeProtectionEnabled: false,
    takeProfitPct: 0.1,
    ...overrides,
  };
}

function baseInput(overrides: Partial<PlanFastPathInput> = {}): PlanFastPathInput {
  return {
    now: 1_000_000,
    currentPrice: 101,
    position: basePosition(),
    config: baseConfig(),
    isSandbox: false,
    lotStep: 0.0001,
    minNotional: 10,
    ...overrides,
  };
}

describe('planFastPath', () => {
  it('returns NONE when the price is stable and no rule matches', () => {
    const plan = planFastPath(baseInput({ currentPrice: 101 }));
    expect(plan.action).toBe('NONE');
    expect(plan.trailing.highWaterPrice).toBe(101);
  });

  it('returns HARD_STOP_EXIT when price falls to the static stop and trailing never activated', () => {
    const plan = planFastPath(
      baseInput({
        currentPrice: 94,
        config: baseConfig({ stopLossPct: 0.05 }),
      }),
    );
    expect(plan).toMatchObject({ action: 'HARD_STOP_EXIT', effectiveStop: 95 });
  });

  it('returns TRAILING_EXIT when the trailing stop was already active and price falls to the trailed level', () => {
    const plan = planFastPath(
      baseInput({
        currentPrice: 98,
        position: basePosition({ stopPrice: 99, highWaterPrice: 105, trailingActive: true }),
        config: baseConfig({
          trailingStopEnabled: true,
          trailingStopPct: 0.03,
          trailingActivationPct: 0.02,
          stopLossPct: 0.05,
        }),
      }),
    );
    expect(plan.action).toBe('TRAILING_EXIT');
    if (plan.action === 'TRAILING_EXIT') {
      expect(plan.effectiveStop).toBeCloseTo(101.85, 5);
      expect(plan.trailing.trailingActive).toBe(true);
    }
  });

  it('returns PARTIAL_TAKE_PROFIT when the trigger is reached, the stop is untouched and it is the first partial', () => {
    const plan = planFastPath(
      baseInput({
        currentPrice: 106,
        config: baseConfig({
          partialTpEnabled: true,
          partialTpTriggerPct: 0.05,
          partialTpSellPct: 0.5,
        }),
      }),
    );
    expect(plan.action).toBe('PARTIAL_TAKE_PROFIT');
    if (plan.action === 'PARTIAL_TAKE_PROFIT') {
      expect(plan.partial.sellQuantity).toBeCloseTo(0.5, 6);
      expect(plan.partial.newStopPrice).toBeNull();
    }
  });

  it('returns PROTECTION_REARM when the trailing stop moved past the threshold and native protection applies', () => {
    const plan = planFastPath(
      baseInput({
        currentPrice: 110,
        position: basePosition({
          stopPrice: 95,
          highWaterPrice: 104,
          trailingActive: true,
          protectionStatus: 'PROTECTED',
        }),
        config: baseConfig({
          trailingStopEnabled: true,
          trailingStopPct: 0.03,
          trailingActivationPct: 0.02,
          stopLossPct: 0.05,
          nativeProtectionEnabled: true,
        }),
        isSandbox: false,
      }),
    );
    expect(plan.action).toBe('PROTECTION_REARM');
    if (plan.action === 'PROTECTION_REARM') {
      expect(plan.desiredStopPrice).toBeCloseTo(106.7, 5);
    }
  });

  it('does not rearm in sandbox even when the trailing stop moved past the threshold', () => {
    const plan = planFastPath(
      baseInput({
        currentPrice: 110,
        position: basePosition({
          stopPrice: 95,
          highWaterPrice: 104,
          trailingActive: true,
          protectionStatus: 'PROTECTED',
        }),
        config: baseConfig({
          trailingStopEnabled: true,
          trailingStopPct: 0.03,
          trailingActivationPct: 0.02,
          stopLossPct: 0.05,
          nativeProtectionEnabled: true,
        }),
        isSandbox: true,
      }),
    );
    expect(plan.action).toBe('NONE');
  });

  it('does not rearm when native protection is disabled', () => {
    const plan = planFastPath(
      baseInput({
        currentPrice: 110,
        position: basePosition({
          stopPrice: 95,
          highWaterPrice: 104,
          trailingActive: true,
          protectionStatus: 'PROTECTED',
        }),
        config: baseConfig({
          trailingStopEnabled: true,
          trailingStopPct: 0.03,
          trailingActivationPct: 0.02,
          stopLossPct: 0.05,
          nativeProtectionEnabled: false,
        }),
        isSandbox: false,
      }),
    );
    expect(plan.action).toBe('NONE');
  });

  it('does not attempt a rearm when the trailing stop did not change', () => {
    const plan = planFastPath(
      baseInput({
        currentPrice: 101,
        position: basePosition({ stopPrice: null, trailingActive: false }),
        config: baseConfig({ trailingStopEnabled: false }),
      }),
    );
    expect(plan.action).toBe('NONE');
  });

  describe('fixed precedence order (architect.md §6.2)', () => {
    it('a hard/trailing exit preempts a partial take profit that would also trigger', () => {
      const plan = planFastPath(
        baseInput({
          currentPrice: 107,
          position: basePosition({
            stopPrice: 108,
            highWaterPrice: 115,
            trailingActive: true,
          }),
          config: baseConfig({
            trailingStopEnabled: true,
            trailingStopPct: 0.03,
            trailingActivationPct: 0.02,
            stopLossPct: 0.05,
            partialTpEnabled: true,
            partialTpTriggerPct: 0.05,
            partialTpSellPct: 0.5,
          }),
        }),
      );
      expect(plan.action).toBe('TRAILING_EXIT');
    });

    it('a partial take profit preempts a protection rearm that would also trigger', () => {
      const plan = planFastPath(
        baseInput({
          currentPrice: 106,
          position: basePosition({
            stopPrice: 90,
            highWaterPrice: 100,
            trailingActive: false,
            protectionStatus: 'PROTECTED',
          }),
          config: baseConfig({
            trailingStopEnabled: true,
            trailingStopPct: 0.03,
            trailingActivationPct: 0.02,
            stopLossPct: 0.05,
            partialTpEnabled: true,
            partialTpTriggerPct: 0.05,
            partialTpSellPct: 0.5,
            nativeProtectionEnabled: true,
          }),
          isSandbox: false,
        }),
      );
      expect(plan.action).toBe('PARTIAL_TAKE_PROFIT');
    });
  });

  describe('contract exclusions (architect.md §12.2)', () => {
    const source = readFileSync(join(__dirname, 'fast-path.ts'), 'utf8');

    it('never invokes evaluateSellPolicy', () => {
      expect(source).not.toContain('evaluateSellPolicy');
    });

    it('never invokes shouldExitByTime', () => {
      expect(source).not.toContain('shouldExitByTime');
    });
  });
});
