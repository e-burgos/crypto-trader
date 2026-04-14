import axios from 'axios';
import { LLMProviderClient, LLMResponse } from './llm-types';

export interface OpenAIProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export class OpenAIProvider implements LLMProviderClient {
  readonly name = 'openai';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: OpenAIProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'gpt-4o-mini';
    this.maxTokens = config.maxTokens ?? 1024;
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<LLMResponse> {
    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
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
