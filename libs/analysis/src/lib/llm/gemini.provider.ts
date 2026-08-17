import axios from 'axios';
import { LLMCallOptions, LLMProviderClient, LLMResponse } from './llm-types';

export interface GeminiProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export class GeminiProvider implements LLMProviderClient {
  readonly name = 'gemini';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: GeminiProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'gemini-2.5-flash';
    this.maxTokens = config.maxTokens ?? 1024;
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options?: LLMCallOptions,
  ): Promise<LLMResponse> {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          maxOutputTokens: options?.maxTokens ?? this.maxTokens,
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      },
    );
    const data = response.data;

    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
      headers: response.headers as Record<string, string>,
      truncated: data.candidates?.[0]?.finishReason === 'MAX_TOKENS',
    };
  }
}
