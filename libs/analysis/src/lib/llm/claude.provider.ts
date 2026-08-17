import axios from 'axios';
import { LLMCallOptions, LLMProviderClient, LLMResponse } from './llm-types';
import {
  postWithCacheControlRetry,
  resolvePromptCacheCapability,
  shouldMarkPromptForCache,
} from './prompt-cache';

export interface ClaudeProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export class ClaudeProvider implements LLMProviderClient {
  readonly name = 'claude';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: ClaudeProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens ?? 1024;
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options?: LLMCallOptions,
  ): Promise<LLMResponse> {
    const maxTokens = options?.maxTokens ?? this.maxTokens;
    const capability = resolvePromptCacheCapability(this.name, this.model);
    const shouldMark = shouldMarkPromptForCache(capability, systemPrompt);

    const buildBody = (withCacheControl: boolean) => ({
      model: this.model,
      max_tokens: maxTokens,
      system: withCacheControl
        ? [
            {
              type: 'text',
              text: systemPrompt,
              cache_control: { type: 'ephemeral' },
            },
          ]
        : systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const headers = {
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    };

    const response = await postWithCacheControlRetry(
      (withCacheControl) =>
        axios.post(
          'https://api.anthropic.com/v1/messages',
          buildBody(withCacheControl),
          { headers, timeout: 30000 },
        ),
      shouldMark,
    );
    const data = response.data;

    return {
      text: data.content?.[0]?.text ?? '',
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
      headers: response.headers as Record<string, string>,
      truncated: data.stop_reason === 'max_tokens',
      cacheReadTokens: data.usage?.cache_read_input_tokens ?? undefined,
    };
  }
}
