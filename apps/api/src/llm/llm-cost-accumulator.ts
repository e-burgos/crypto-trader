import { LLMUsageOutcome } from './llm-usage.service';

export interface LlmCostSummary {
  llmCallCount: number;
  pricedCallCount: number;
  unpricedCallCount: number;
  /** null when no tracked call resolved with a priced outcome (CE-07 — never a disguised zero) */
  costUsd: number | null;
}

export class LlmCostAccumulator {
  private readonly pending: Promise<LLMUsageOutcome>[] = [];

  track(outcome: Promise<LLMUsageOutcome>): void {
    this.pending.push(outcome);
  }

  async settle(): Promise<LlmCostSummary> {
    const settled = await Promise.allSettled(this.pending);

    let costUsd: number | null = null;
    let pricedCallCount = 0;
    let unpricedCallCount = 0;

    for (const result of settled) {
      if (result.status !== 'fulfilled' || result.value.costUsd === null) {
        unpricedCallCount += 1;
        continue;
      }
      pricedCallCount += 1;
      costUsd = (costUsd ?? 0) + result.value.costUsd;
    }

    return {
      llmCallCount: settled.length,
      pricedCallCount,
      unpricedCallCount,
      costUsd,
    };
  }
}
