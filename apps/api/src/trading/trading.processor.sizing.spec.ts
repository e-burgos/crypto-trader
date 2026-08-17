import { TradingProcessor } from './trading.processor';
import type { AegisVerdict } from '../orchestrator/dto/decision-synthesis.dto';

describe('TradingProcessor — resolveBuySizing (TASK-011)', () => {
  const processor = new TradingProcessor(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const resolve = (
    balance: number,
    price: number,
    config: any,
    decisionContext?: any,
  ) =>
    (processor as any).resolveBuySizing(
      balance,
      price,
      config,
      decisionContext,
    );

  const baseConfig = { maxTradePct: 0.05, reduceSizeFactor: 0.5 };

  it('ignores AEGIS/FORGE entirely when smartSizingEnabled is off — same result as today', () => {
    const reducingRisk: AegisVerdict = {
      riskScore: 90,
      verdict: 'REDUCE',
      positionSizeMultiplier: 0.1,
      blockReasons: [],
      reason: 'test',
      alerts: [],
    };

    const withoutContext = resolve(10_000, 65_000, {
      ...baseConfig,
      smartSizingEnabled: false,
    });
    const withStrongReduceContext = resolve(
      10_000,
      65_000,
      { ...baseConfig, smartSizingEnabled: false },
      { risk: reducingRisk, sizing: { recommendation: 'skip', maxTradePct: 0 } },
    );

    expect(withStrongReduceContext.quantity).toBe(withoutContext.quantity);
    expect(withStrongReduceContext.blockedBy).toBeNull();
  });

  it('applies AEGIS positionSizeMultiplier when smartSizingEnabled is on', () => {
    const risk: AegisVerdict = {
      riskScore: 60,
      verdict: 'PASS',
      positionSizeMultiplier: 0.4,
      blockReasons: [],
      reason: 'test',
      alerts: [],
    };

    const disabled = resolve(10_000, 65_000, {
      ...baseConfig,
      smartSizingEnabled: false,
    });
    const enabled = resolve(
      10_000,
      65_000,
      { ...baseConfig, smartSizingEnabled: true },
      { risk },
    );

    expect(enabled.quantity).toBeCloseTo(disabled.quantity * 0.4, 8);
  });

  it('blocks the buy when FORGE recommends skip and smartSizingEnabled is on', () => {
    const result = resolve(
      10_000,
      65_000,
      { ...baseConfig, smartSizingEnabled: true },
      { sizing: { recommendation: 'skip', maxTradePct: 0.05 } },
    );

    expect(result.blockedBy).toBe('FORGE_SKIP');
    expect(result.quantity).toBe(0);
  });

  it('reduces size on AEGIS REDUCE verdict using config.reduceSizeFactor', () => {
    const risk: AegisVerdict = {
      riskScore: 55,
      verdict: 'REDUCE',
      positionSizeMultiplier: 1,
      blockReasons: [],
      reason: 'test',
      alerts: [],
    };

    const disabled = resolve(10_000, 65_000, {
      ...baseConfig,
      smartSizingEnabled: false,
    });
    const enabled = resolve(
      10_000,
      65_000,
      { ...baseConfig, smartSizingEnabled: true, reduceSizeFactor: 0.5 },
      { risk },
    );

    expect(enabled.quantity).toBeCloseTo(disabled.quantity * 0.5, 8);
  });
});
