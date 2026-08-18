import { LlmCostAccumulator } from './llm-cost-accumulator';
import { LLMUsageOutcome } from './llm-usage.service';

function outcome(partial: Partial<LLMUsageOutcome>): LLMUsageOutcome {
  return {
    costUsd: 0,
    pricingSource: 'STATIC_TABLE',
    inputTokens: 100,
    outputTokens: 50,
    ...partial,
  };
}

describe('LlmCostAccumulator', () => {
  it('settles to costUsd: null and llmCallCount: 0 when nothing was tracked', async () => {
    const accumulator = new LlmCostAccumulator();

    const summary = await accumulator.settle();

    expect(summary).toEqual({
      llmCallCount: 0,
      pricedCallCount: 0,
      unpricedCallCount: 0,
      costUsd: null,
    });
  });

  it('sums the priced calls (real cost, CE-07 "priced" state)', async () => {
    const accumulator = new LlmCostAccumulator();
    accumulator.track(Promise.resolve(outcome({ costUsd: 0.01 })));
    accumulator.track(Promise.resolve(outcome({ costUsd: 0.02 })));

    const summary = await accumulator.settle();

    expect(summary.costUsd).toBeCloseTo(0.03, 6);
    expect(summary.llmCallCount).toBe(2);
    expect(summary.pricedCallCount).toBe(2);
    expect(summary.unpricedCallCount).toBe(0);
  });

  it('keeps costUsd null when every tracked call is unpriced (CE-07 "unknown" state, never a disguised zero)', async () => {
    const accumulator = new LlmCostAccumulator();
    accumulator.track(Promise.resolve(outcome({ costUsd: null, pricingSource: 'UNPRICED' })));
    accumulator.track(Promise.resolve(outcome({ costUsd: null, pricingSource: 'UNPRICED' })));

    const summary = await accumulator.settle();

    expect(summary.costUsd).toBeNull();
    expect(summary.llmCallCount).toBe(2);
    expect(summary.unpricedCallCount).toBe(2);
  });

  it('sums only the priced calls when priced and unpriced are mixed (partial cost)', async () => {
    const accumulator = new LlmCostAccumulator();
    accumulator.track(Promise.resolve(outcome({ costUsd: 0.05 })));
    accumulator.track(Promise.resolve(outcome({ costUsd: null, pricingSource: 'UNPRICED' })));

    const summary = await accumulator.settle();

    expect(summary.costUsd).toBeCloseTo(0.05, 6);
    expect(summary.llmCallCount).toBe(2);
    expect(summary.pricedCallCount).toBe(1);
    expect(summary.unpricedCallCount).toBe(1);
  });

  it('counts a rejected tracked promise as unpriced instead of throwing', async () => {
    const accumulator = new LlmCostAccumulator();
    accumulator.track(Promise.resolve(outcome({ costUsd: 0.02 })));
    accumulator.track(Promise.reject(new Error('log() rejected unexpectedly')));

    const summary = await accumulator.settle();

    expect(summary.costUsd).toBeCloseTo(0.02, 6);
    expect(summary.llmCallCount).toBe(2);
    expect(summary.unpricedCallCount).toBe(1);
  });
});
