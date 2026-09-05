import { LLMDecision } from '@crypto-trader/shared';

/**
 * Token usage metadata from an LLM call.
 */
export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Response from an LLM provider including text and token usage.
 */
export interface LLMResponse {
  text: string;
  usage: LLMUsage;
  headers?: Record<string, string>;
  actualModel?: string;
  truncated?: boolean;
  cacheReadTokens?: number;
}

/**
 * Per-call options a provider may accept, independent of its construction config.
 */
export interface LLMCallOptions {
  maxTokens?: number;
  cacheSystemPrompt?: boolean;
}

/**
 * Interface for LLM provider implementations.
 */
export interface LLMProviderClient {
  /** Unique provider name */
  readonly name: string;
  /** Send prompt and get response with text + usage */
  complete(
    systemPrompt: string,
    userPrompt: string,
    options?: LLMCallOptions,
  ): Promise<LLMResponse>;
}

/**
 * Result of LLM analysis including the decision and token usage.
 */
export interface LLMAnalysisResult {
  decision: LLMDecision;
  usage: LLMUsage;
}

/**
 * Parse the LLM response into a validated LLMDecision.
 */
export function parseLLMResponse(raw: string): LLMDecision {
  // Strip markdown code blocks if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```(?:json)?\s*/gi, '').trim();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Extract outermost JSON object from mixed text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in LLM response');
    parsed = JSON.parse(match[0]);
  }

  // Validate required fields
  const decision = parsed.decision;
  if (!['BUY', 'SELL', 'HOLD'].includes(decision)) {
    throw new Error(`Invalid decision: ${decision}`);
  }

  const confidence = Number(parsed.confidence);
  if (isNaN(confidence) || confidence < 0 || confidence > 1) {
    throw new Error(`Invalid confidence: ${parsed.confidence}`);
  }

  const reasoning = String(parsed.reasoning || '').slice(0, 500);

  const suggestedWaitMinutes = Math.max(
    1,
    Math.min(60, Number(parsed.suggestedWaitMinutes) || 5),
  );

  return { decision, confidence, reasoning, suggestedWaitMinutes };
}
