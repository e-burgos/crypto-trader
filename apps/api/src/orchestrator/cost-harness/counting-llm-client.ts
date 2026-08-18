import type {
  LLMCallOptions,
  LLMProviderClient,
  LLMResponse,
} from '@crypto-trader/analysis';
import {
  estimatePromptTokens,
  resolvePromptCacheCapability,
  shouldMarkPromptForCache,
} from '@crypto-trader/analysis';
import type { AgentTask } from '../sub-agent.service';
import type { RecordedCall } from './cost-model';

const HARNESS_RESPONSES: Partial<Record<AgentTask, string>> = {
  technical_signal:
    '{"signal":"HOLD","confidence":0.5,"reasoning":"harness canonical response"}',
  news_sentiment:
    '{"sentiment":0,"impact":"neutral","reasoning":"harness canonical response"}',
  sizing_suggestion:
    '{"recommendation":"skip","maxTradeSize":0,"reasoning":"harness canonical response"}',
  risk_gate:
    '{"riskScore":0,"verdict":"PASS","positionSizeMultiplier":1,"blockReasons":[],"reason":"harness canonical response","alerts":[]}',
  macro_context:
    '{"regime":"CONSOLIDATION","bias":"NEUTRAL","confidence":0.5,"keyFactors":[],"reasoning":"harness canonical response"}',
};

export interface CountingLLMClientParams {
  scenarioId: string;
  task: AgentTask;
  provider: string;
  model: string;
  promptCachingEnabled: boolean;
  calls: RecordedCall[];
}

export class CountingLLMClient implements LLMProviderClient {
  readonly name: string;
  private readonly model: string;
  private readonly scenarioId: string;
  private readonly task: AgentTask;
  private readonly promptCachingEnabled: boolean;
  private readonly calls: RecordedCall[];

  constructor(params: CountingLLMClientParams) {
    this.name = params.provider;
    this.model = params.model;
    this.scenarioId = params.scenarioId;
    this.task = params.task;
    this.promptCachingEnabled = params.promptCachingEnabled;
    this.calls = params.calls;
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options?: LLMCallOptions,
  ): Promise<LLMResponse> {
    const maxTokens = options?.maxTokens ?? 1024;
    const capability = resolvePromptCacheCapability(this.name, this.model);
    const cacheMarked =
      this.promptCachingEnabled &&
      shouldMarkPromptForCache(capability, systemPrompt);

    this.calls.push({
      scenarioId: this.scenarioId,
      task: this.task,
      systemChars: systemPrompt.length,
      userChars: userPrompt.length,
      maxTokens,
      cacheMarked,
    });

    return {
      text: HARNESS_RESPONSES[this.task] ?? '{}',
      usage: {
        inputTokens:
          estimatePromptTokens(systemPrompt) + estimatePromptTokens(userPrompt),
        outputTokens: Math.round(maxTokens * 0.6),
      },
    };
  }
}
