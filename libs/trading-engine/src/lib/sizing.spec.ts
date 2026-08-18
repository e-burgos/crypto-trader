import { calculateTradeQuantity } from './order-executor';
import { resolveTradeQuantity } from './sizing';

describe('resolveTradeQuantity', () => {
  const balance = 10_000;
  const price = 65_000;
  const maxTradePct = 0.05;
  const ceiling = calculateTradeQuantity(balance, price, maxTradePct);

  it('matches calculateTradeQuantity when AEGIS is neutral and FORGE sizing is at or above the ceiling (CA-005)', () => {
    const result = resolveTradeQuantity({
      balance,
      price,
      maxTradePct,
      verdict: 'PASS',
      positionSizeMultiplier: 1,
      forgeRecommendation: 'proceed',
      forgeMaxTradePct: maxTradePct,
    });

    expect(result.quantity).toBe(ceiling);
    expect(result.ceilingQuantity).toBe(ceiling);
    expect(result.effectiveFactor).toBe(1);
    expect(result.blockedBy).toBeNull();
  });

  it('matches calculateTradeQuantity when no modulation input is provided at all', () => {
    const result = resolveTradeQuantity({ balance, price, maxTradePct });

    expect(result.quantity).toBe(ceiling);
    expect(result.effectiveFactor).toBe(1);
    expect(result.blockedBy).toBeNull();
  });

  it('reduces the resulting size proportionally to positionSizeMultiplier < 1 (CA-006)', () => {
    const result = resolveTradeQuantity({
      balance,
      price,
      maxTradePct,
      positionSizeMultiplier: 0.4,
    });

    expect(result.factors.aegis).toBe(0.4);
    expect(result.quantity).toBeLessThan(ceiling);
    expect(result.quantity).toBeCloseTo(ceiling * 0.4, 8);
  });

  it('clamps positionSizeMultiplier above 1 to 1 — modular is only reducing', () => {
    const result = resolveTradeQuantity({
      balance,
      price,
      maxTradePct,
      positionSizeMultiplier: 3,
    });

    expect(result.factors.aegis).toBe(1);
    expect(result.quantity).toBe(ceiling);
  });

  describe('AEGIS vs FORGE contradiction — the more conservative wins (CA-007)', () => {
    const cases: Array<{
      positionSizeMultiplier: number;
      forgeMaxTradePct: number;
      expectedFactor: number;
    }> = [
      {
        positionSizeMultiplier: 0.8,
        forgeMaxTradePct: 0.02,
        expectedFactor: 0.4,
      },
      {
        positionSizeMultiplier: 0.3,
        forgeMaxTradePct: 0.045,
        expectedFactor: 0.3,
      },
      {
        positionSizeMultiplier: 1,
        forgeMaxTradePct: 0.01,
        expectedFactor: 0.2,
      },
    ];

    it.each(cases)(
      'aegis=$positionSizeMultiplier forge=$forgeMaxTradePct -> factor=$expectedFactor',
      ({ positionSizeMultiplier, forgeMaxTradePct, expectedFactor }) => {
        const result = resolveTradeQuantity({
          balance,
          price,
          maxTradePct,
          positionSizeMultiplier,
          forgeMaxTradePct,
        });

        expect(result.effectiveFactor).toBeCloseTo(expectedFactor, 8);
        expect(result.effectiveFactor).toBeLessThanOrEqual(
          Math.min(positionSizeMultiplier, forgeMaxTradePct / maxTradePct),
        );
        expect(result.blockedBy).toBeNull();
      },
    );
  });

  it('REDUCE applies reduceSizeFactor and never blocks (CA-008)', () => {
    const withoutReduce = resolveTradeQuantity({
      balance,
      price,
      maxTradePct,
      verdict: 'PASS',
    });
    const withReduce = resolveTradeQuantity({
      balance,
      price,
      maxTradePct,
      verdict: 'REDUCE',
      reduceSizeFactor: 0.5,
    });

    expect(withReduce.factors.verdict).toBe(0.5);
    expect(withReduce.quantity).toBeCloseTo(withoutReduce.quantity * 0.5, 8);
    expect(withReduce.blockedBy).toBeNull();
    expect(withReduce.quantity).toBeGreaterThan(0);
  });

  it('REDUCE falls back to 0.5 when reduceSizeFactor is not provided', () => {
    const result = resolveTradeQuantity({
      balance,
      price,
      maxTradePct,
      verdict: 'REDUCE',
    });

    expect(result.factors.verdict).toBe(0.5);
  });

  it('clamps a reduceSizeFactor above 1 to 1', () => {
    const result = resolveTradeQuantity({
      balance,
      price,
      maxTradePct,
      verdict: 'REDUCE',
      reduceSizeFactor: 2,
    });

    expect(result.factors.verdict).toBe(1);
  });

  it('FORGE skip zeroes out the size and is reported as FORGE_SKIP, not a BLOCK', () => {
    const result = resolveTradeQuantity({
      balance,
      price,
      maxTradePct,
      verdict: 'PASS',
      positionSizeMultiplier: 1,
      forgeRecommendation: 'skip',
      forgeMaxTradePct: 0.05,
    });

    expect(result.factors.forge).toBe(0);
    expect(result.quantity).toBe(0);
    expect(result.blockedBy).toBe('FORGE_SKIP');
  });

  it('reports AEGIS_BLOCK when verdict is BLOCK regardless of the computed quantity', () => {
    const result = resolveTradeQuantity({
      balance,
      price,
      maxTradePct,
      verdict: 'BLOCK',
      positionSizeMultiplier: 1,
    });

    expect(result.blockedBy).toBe('AEGIS_BLOCK');
  });

  it('reports ZERO_SIZE when the effective factor rounds the quantity down to zero', () => {
    const result = resolveTradeQuantity({
      balance: 1,
      price: 1_000_000,
      maxTradePct: 0.0000001,
    });

    expect(result.quantity).toBe(0);
    expect(result.blockedBy).toBe('ZERO_SIZE');
  });

  it('never exceeds balance * maxTradePct for extreme combinations of multiplier/FORGE/verdict (CA-009)', () => {
    const extremeInputs = [
      { positionSizeMultiplier: 3, forgeMaxTradePct: 0.9, verdict: undefined },
      {
        positionSizeMultiplier: -1,
        forgeMaxTradePct: -0.5,
        verdict: 'REDUCE' as const,
      },
      {
        positionSizeMultiplier: 1,
        forgeMaxTradePct: 10,
        verdict: 'REDUCE' as const,
        reduceSizeFactor: 5,
      },
      {
        positionSizeMultiplier: 0,
        forgeMaxTradePct: 1,
        verdict: 'PASS' as const,
      },
    ];

    for (const input of extremeInputs) {
      const result = resolveTradeQuantity({
        balance,
        price,
        maxTradePct,
        ...input,
      });

      expect(result.quantity).toBeLessThanOrEqual(ceiling);
      expect(result.effectiveFactor).toBeGreaterThanOrEqual(0);
      expect(result.effectiveFactor).toBeLessThanOrEqual(1);
    }
  });

  it('is disabled behind smartSizingEnabled at the caller level — omitting modulation inputs reproduces today\'s balance * maxTradePct exactly', () => {
    const legacy = calculateTradeQuantity(balance, price, maxTradePct);
    const result = resolveTradeQuantity({ balance, price, maxTradePct });

    expect(result.quantity).toBe(legacy);
  });
});
