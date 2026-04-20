import { LLMProvider } from '@crypto-trader/shared';
import { LLMProviderClient } from './llm-types';
import { ClaudeProvider } from './claude.provider';
import { OpenAIProvider } from './openai.provider';
import { GroqProvider } from './groq.provider';
import { GeminiProvider } from './gemini.provider';
import { MistralProvider } from './mistral.provider';
import { TogetherProvider } from './together.provider';
import { OpenRouterProvider } from './openrouter.provider';

/**
 * Factory to create the correct LLM provider given credentials.
 */
export function createLLMProvider(
  provider: LLMProvider,
  apiKey: string,
  model?: string,
): LLMProviderClient {
  switch (provider) {
    case LLMProvider.CLAUDE:
      return new ClaudeProvider({ apiKey, model });
    case LLMProvider.OPENAI:
      return new OpenAIProvider({ apiKey, model });
    case LLMProvider.GROQ:
      return new GroqProvider({ apiKey, model });
    case LLMProvider.GEMINI:
      return new GeminiProvider({ apiKey, model });
    case LLMProvider.MISTRAL:
      return new MistralProvider({ apiKey, model });
    case LLMProvider.TOGETHER:
      return new TogetherProvider({ apiKey, model });
    case LLMProvider.OPENROUTER:
      return new OpenRouterProvider({ apiKey, model });
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}
