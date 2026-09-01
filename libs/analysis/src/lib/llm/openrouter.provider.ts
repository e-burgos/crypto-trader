import axios from 'axios';
import { LLMCallOptions, LLMProviderClient, LLMResponse } from './llm-types';
import {
  postWithCacheControlRetry,
  resolvePromptCacheCapability,
  shouldMarkPromptForCache,
} from './prompt-cache';

export interface OpenRouterProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  fallbackModels?: string[];
}

export class OpenRouterProvider implements LLMProviderClient {
  readonly name = 'openrouter';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly fallbackModels: string[];

  constructor(config: OpenRouterProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'anthropic/claude-sonnet-4.6';
    this.maxTokens = config.maxTokens ?? 1024;
    this.fallbackModels = config.fallbackModels ?? [];
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options?: LLMCallOptions,
  ): Promise<LLMResponse> {
    const maxTokens = options?.maxTokens ?? this.maxTokens;
    const capability = resolvePromptCacheCapability(this.name, this.model);
    const shouldMark = shouldMarkPromptForCache(capability, systemPrompt);

    const buildBody = (
      withCacheControl: boolean,
      disableReasoning: boolean,
    ): Record<string, unknown> => {
      const body: Record<string, unknown> = {
        model: this.model,
        max_tokens: maxTokens,
        // Reasoning models spend the whole max_tokens budget thinking and return
        // an empty message, which the caller can only read as a truncated answer
        // (FIX-e-burgos-014). Measured on deepseek-v4-pro with the real risk_gate
        // prompt: 350/350 tokens, 1361 characters of reasoning, ZERO characters of
        // content — with reasoning off, 136 tokens and a valid verdict.
        //
        // It must be `enabled: false`, not `exclude: true`: exclude only hides the
        // reasoning from the response, the model still generates it, still burns
        // the budget and it is still billed. Measured too — exclude left content
        // empty at 350/350.
        messages: [
          {
            role: 'system',
            content: withCacheControl
              ? [
                  {
                    type: 'text',
                    text: systemPrompt,
                    cache_control: { type: 'ephemeral' },
                  },
                ]
              : systemPrompt,
          },
          { role: 'user', content: userPrompt },
        ],
      };

      // Reasoning models spend the whole max_tokens budget thinking and return an
      // empty message, which the caller can only read as a truncated answer
      // (FIX-e-burgos-014). Measured on deepseek-v4-pro with the real risk_gate
      // prompt: 350/350 tokens, 1361 characters of reasoning, ZERO of content;
      // with reasoning off, 136 tokens and a valid verdict.
      //
      // `enabled: false`, never `exclude: true`: exclude only hides the reasoning
      // from the response — the model still generates it, still burns the budget
      // and it is still billed. Measured too.
      //
      // Some endpoints refuse to disable it (minimax-m2.7 answers 400 "Reasoning
      // is mandatory"), so this flag is what the retry below turns off.
      if (disableReasoning) {
        body['reasoning'] = { enabled: false };
      }

      // Enable fallback routing when fallback models are configured
      if (this.fallbackModels.length > 0) {
        body['route'] = 'fallback';
        body['models'] = [this.model, ...this.fallbackModels];
      }

      return body;
    };

    const response = await postWithMandatoryReasoningRetry((disableReasoning) =>
      postWithCacheControlRetry(
        (withCacheControl) =>
          axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            buildBody(withCacheControl, disableReasoning),
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://cryptotrader.app',
              'X-Title': 'CryptoTrader',
            },
            timeout: 60000,
          },
          ),
        shouldMark,
      ),
    );
    const data = response.data;

    const rawText = data.choices?.[0]?.message?.content ?? '';

    // Strip <think>...</think> tags from reasoning models (e.g. Qwen3, DeepSeek-R1)
    // Keep only the actual response content after the thinking block
    let text = rawText;
    if (text.includes('<think>')) {
      text = text.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
      // If stripping thinking left empty output, use the thinking content as fallback
      if (!text && rawText.includes('</think>')) {
        const thinkMatch = rawText.match(/<think>([\s\S]*?)<\/think>/);
        text = thinkMatch?.[1]?.trim() ?? rawText;
      }
    }

    return {
      text,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      headers: response.headers as Record<string, string>,
      actualModel: data.model ?? undefined,
      truncated: data.choices?.[0]?.finish_reason === 'length',
    };
  }
}

/**
 * Retries without `reasoning: { enabled: false }` when the endpoint refuses to
 * disable it (FIX-e-burgos-014). Mirrors postWithCacheControlRetry: ask for the
 * cheaper behaviour first, fall back to the provider's terms if it says no.
 *
 * Measured: minimax/minimax-m2.7 answers HTTP 400 with "Reasoning is mandatory
 * for this endpoint and cannot be disabled." Without this retry, adding the flag
 * turned a truncated answer into a hard failure for those models.
 */
export async function postWithMandatoryReasoningRetry<T>(
  post: (disableReasoning: boolean) => Promise<T>,
): Promise<T> {
  try {
    return await post(true);
  } catch (err) {
    if (isMandatoryReasoningRejection(err)) return await post(false);
    throw err;
  }
}

function isMandatoryReasoningRejection(err: unknown): boolean {
  const response = (err as { response?: { status?: number; data?: unknown } })
    ?.response;
  if (response?.status !== 400) return false;
  const message = JSON.stringify(response.data ?? '').toLowerCase();
  return message.includes('reasoning') && message.includes('mandatory');
}
