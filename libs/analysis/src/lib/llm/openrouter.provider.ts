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

    const buildBody = (withCacheControl: boolean): Record<string, unknown> => {
      const body: Record<string, unknown> = {
        model: this.model,
        max_tokens: maxTokens,
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

      // Enable fallback routing when fallback models are configured
      if (this.fallbackModels.length > 0) {
        body['route'] = 'fallback';
        body['models'] = [this.model, ...this.fallbackModels];
      }

      return body;
    };

    const response = await postWithCacheControlRetry(
      (withCacheControl) =>
        axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          buildBody(withCacheControl),
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
