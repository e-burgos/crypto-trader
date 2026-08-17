import { evaluateSellPolicy, SellPolicyConfig } from './sell-policy';
import { simulateTrade } from './risk/trade-simulation';

describe('evaluateSellPolicy', () => {
  const enabledConfig: SellPolicyConfig = {
    minProfitPct: 0.003,
    lossCutEnabled: true,
    lossCutConfidenceThreshold: 0.85,
    lossCutMinLossPct: 0.005,
    lossCutMinEdgeRatio: 2,
  };
  const disabledConfig: SellPolicyConfig = {
    ...enabledConfig,
    lossCutEnabled: false,
  };

  describe('take profit path — identical to today', () => {
    it('allows SELL when profit reaches minProfitPct, regardless of loss cut config', () => {
      const result = evaluateSellPolicy({
        asset: 'BTC',
        entryPrice: 100,
        currentPrice: 100.5,
        quantity: 1,
        stopLossPct: 0.03,
        signalConfidence: null,
        config: enabledConfig,
      });

      expect(result.allow).toBe(true);
      expect(result.path).toBe('TAKE_PROFIT');
    });

    it('rejects SELL when profit is positive but below minProfitPct, with loss cut disabled (CA-004)', () => {
      const result = evaluateSellPolicy({
        asset: 'BTC',
        entryPrice: 100,
        currentPrice: 100.1,
        quantity: 1,
        stopLossPct: 0.03,
        signalConfidence: 0.99,
        config: disabledConfig,
      });

      expect(result.allow).toBe(false);
      expect(result.path).toBe('NONE');
      expect(result.profitPct).toBeCloseTo(0.001, 8);
    });
  });

  describe('loss cut path (RN-01)', () => {
    it('rejects SELL in loss when confidence is below the threshold (CA-001)', () => {
      const result = evaluateSellPolicy({
        asset: 'BTC',
        entryPrice: 100,
        currentPrice: 98,
        quantity: 1,
        stopLossPct: 0.03,
        signalConfidence: 0.5,
        config: enabledConfig,
      });

      expect(result.allow).toBe(false);
      expect(result.path).toBe('NONE');
    });

    it('allows SELL in loss when confidence is at or above the threshold and the edge ratio clears the minimum (CA-002)', () => {
      const result = evaluateSellPolicy({
        asset: 'BTC',
        entryPrice: 100,
        currentPrice: 98,
        quantity: 1,
        stopLossPct: 0.03,
        signalConfidence: 0.9,
        config: enabledConfig,
      });

      const expectedFriction = simulateTrade({
        asset: 'BTC',
        side: 'SELL',
        price: 98,
        quantity: 1,
        stopLossPct: 0,
        takeProfitPct: 0,
      }).downsideUsd;

      expect(result.allow).toBe(true);
      expect(result.path).toBe('LOSS_CUT');
      expect(result.avoidedLossUsd).toBeCloseTo(1, 8);
      expect(result.exitFrictionUsd).toBeCloseTo(expectedFriction, 8);
      expect(result.edgeRatio).toBeGreaterThan(enabledConfig.lossCutMinEdgeRatio);
    });

    it('the CA-002 scenario stays rejected with the migration default (lossCutEnabled=false) — regression (CA-003)', () => {
      const result = evaluateSellPolicy({
        asset: 'BTC',
        entryPrice: 100,
        currentPrice: 98,
        quantity: 1,
        stopLossPct: 0.03,
        signalConfidence: 0.9,
        config: disabledConfig,
      });

      expect(result.allow).toBe(false);
      expect(result.path).toBe('NONE');
      expect(result.reason).toMatch(/disabled/i);
    });

    it('rejects when the edge ratio does not clear the minimum — stop already very close', () => {
      const result = evaluateSellPolicy({
        asset: 'BTC',
        entryPrice: 100,
        currentPrice: 97.1,
        quantity: 1,
        stopLossPct: 0.03,
        signalConfidence: 0.9,
        config: enabledConfig,
      });

      expect(result.allow).toBe(false);
      expect(result.path).toBe('NONE');
      expect(result.edgeRatio).toBeLessThan(enabledConfig.lossCutMinEdgeRatio);
    });

    it('rejects when the loss has not reached lossCutMinLossPct — avoids churn on noise', () => {
      const result = evaluateSellPolicy({
        asset: 'BTC',
        entryPrice: 100,
        currentPrice: 99.8,
        quantity: 1,
        stopLossPct: 0.03,
        signalConfidence: 0.99,
        config: enabledConfig,
      });

      expect(result.allow).toBe(false);
      expect(result.path).toBe('NONE');
    });

    it('rejects when profitPct is exactly zero — not a loss', () => {
      const result = evaluateSellPolicy({
        asset: 'BTC',
        entryPrice: 100,
        currentPrice: 100,
        quantity: 1,
        stopLossPct: 0.03,
        signalConfidence: 0.99,
        config: enabledConfig,
      });

      expect(result.allow).toBe(false);
      expect(result.path).toBe('NONE');
    });
  });

  describe('CE-01 — invalid/missing confidence never reads as high confidence (fail-closed)', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['NaN', NaN],
      ['negative', -0.1],
      ['above 1', 1.5],
    ])('rejects a loss-cut candidate when confidence is %s', (_label, confidence) => {
      const result = evaluateSellPolicy({
        asset: 'BTC',
        entryPrice: 100,
        currentPrice: 98,
        quantity: 1,
        stopLossPct: 0.03,
        signalConfidence: confidence as number | null | undefined,
        config: enabledConfig,
      });

      expect(result.allow).toBe(false);
      expect(result.path).toBe('NONE');
    });
  });
});
