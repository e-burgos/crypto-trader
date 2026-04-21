import axios from 'axios';
import { LLMProviderClient, LLMResponse } from './llm-types';

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
  ): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    };

    // Enable fallback routing when fallback models are configured
    if (this.fallbackModels.length > 0) {
      body['route'] = 'fallback';
      body['models'] = [this.model, ...this.fallbackModels];
    }

    const { data } = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      body,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://cryptotrader.app',
          'X-Title': 'CryptoTrader',
        },
        timeout: 60000,
      },
    );

    return {
      text: data.choices?.[0]?.message?.content ?? '',
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }
}
