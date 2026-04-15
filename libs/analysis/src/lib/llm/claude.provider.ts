import axios from 'axios';
import { LLMProviderClient, LLMResponse } from './llm-types';

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
  ): Promise<LLMResponse> {
    const { data } = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      },
      {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 30000,
      },
    );

    return {
      text: data.content?.[0]?.text ?? '',
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
    };
  }
}
