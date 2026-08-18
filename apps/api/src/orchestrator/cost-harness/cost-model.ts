import type { AgentTask } from '../sub-agent.service';

export const HARNESS_CHARS_PER_TOKEN = 4;
export const HARNESS_OUTPUT_WEIGHT = 5;
export const HARNESS_CACHE_READ_WEIGHT = 0.1;

export interface RecordedCall {
  scenarioId: string;
  task: AgentTask;
  systemChars: number;
  userChars: number;
  maxTokens: number;
  cacheMarked: boolean;
}

export interface RunScore {
  invocations: number;
  costProxy: number;
}

/**
 * Deterministic proxy for LLM spend, not the provider's real billing — same
 * reinterpretation precedent as CA-001 (cycle-01) and CA-012 (cycle-02).
 * The output ceiling (maxTokens), not the actual output length, is what the
 * -50% optimizations change, so it is what the proxy charges for.
 */
export function scoreRun(calls: RecordedCall[]): RunScore {
  let costProxy = 0;
  for (const call of calls) {
    const inputTokensProxy = Math.ceil(
      (call.systemChars + call.userChars) / HARNESS_CHARS_PER_TOKEN,
    );
    const cacheFactor = call.cacheMarked ? HARNESS_CACHE_READ_WEIGHT : 1;
    costProxy +=
      inputTokensProxy * cacheFactor + call.maxTokens * HARNESS_OUTPUT_WEIGHT;
  }
  return { invocations: calls.length, costProxy };
}
