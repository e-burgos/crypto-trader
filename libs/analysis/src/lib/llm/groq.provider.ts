import axios from 'axios';
import { LLMProviderClient } from './llm-types';

export interface GroqProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export class GroqProvider implements LLMProviderClient {
  readonly name = 'groq';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: GroqProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'llama-3.3-70b-versatile';
    this.maxTokens = config.maxTokens ?? 1024;
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const { data } = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
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

    return data.choices?.[0]?.message?.content ?? '';
  }
}
