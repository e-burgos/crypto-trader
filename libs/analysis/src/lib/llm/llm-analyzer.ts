import { LLMAnalysisInput, LLMDecision } from '@crypto-trader/shared';
import {
  LLMProviderClient,
  LLMAnalyzerConfig,
  LLMAnalysisResult,
  LLMUsage,
  buildAnalysisPrompt,
  parseLLMResponse,
} from './llm-types';

/**
 * LLM Analyzer — sends indicator snapshots + news to an LLM and gets trading decisions.
 */
export class LLMAnalyzer {
  private readonly provider: LLMProviderClient;
  private readonly maxRetries: number;

  constructor(provider: LLMProviderClient, config: LLMAnalyzerConfig = {}) {
    this.provider = provider;
    this.maxRetries = config.maxRetries ?? 2;
  }

  get providerName(): string {
    return this.provider.name;
  }

  /**
   * Analyze market data and return a trading decision with token usage.
   * Retries on parse failures up to maxRetries times.
   */
  async analyze(input: LLMAnalysisInput): Promise<LLMAnalysisResult> {
    const { system, user } = buildAnalysisPrompt(input);
    let lastError: Error | null = null;
    let lastUsage: LLMUsage = { inputTokens: 0, outputTokens: 0 };

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.provider.complete(system, user);
        lastUsage = {
          inputTokens: lastUsage.inputTokens + response.usage.inputTokens,
          outputTokens: lastUsage.outputTokens + response.usage.outputTokens,
        };
        const decision = parseLLMResponse(response.text);
        return { decision, usage: lastUsage };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Only retry on parse errors, not API errors
        if (
          lastError.message.includes('Invalid') ||
          lastError.message.includes('JSON')
        ) {
          continue;
        }
        throw lastError;
      }
    }

    throw new Error(
      `LLM analysis failed after ${this.maxRetries + 1} attempts: ${lastError?.message}`,
    );
  }
}
