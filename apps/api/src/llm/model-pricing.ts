export const MODEL_PRICING: Record<
  string,
  {
    input: number;
    output: number;
    label: string;
    contextWindow: number;
    deprecated?: boolean;
  }
> = {
  // Anthropic
  'claude-sonnet-4-20250514': {
    input: 3.0,
    output: 15.0,
    label: 'Claude Sonnet 4',
    contextWindow: 200_000,
  },
  'claude-opus-4-5': {
    input: 5.0,
    output: 25.0,
    label: 'Claude Opus 4.5',
    contextWindow: 200_000,
  },
  'claude-3-5-sonnet-20241022': {
    input: 3.0,
    output: 15.0,
    label: 'Claude 3.5 Sonnet',
    contextWindow: 200_000,
  },
  'claude-3-haiku-20240307': {
    input: 0.25,
    output: 1.25,
    label: 'Claude 3 Haiku',
    contextWindow: 200_000,
  },
  // OpenAI
  'gpt-4o': {
    input: 2.5,
    output: 10.0,
    label: 'GPT-4o',
    contextWindow: 128_000,
  },
  'gpt-4o-mini': {
    input: 0.15,
    output: 0.6,
    label: 'GPT-4o Mini',
    contextWindow: 128_000,
  },
  'gpt-4-turbo': {
    input: 10.0,
    output: 30.0,
    label: 'GPT-4 Turbo',
    contextWindow: 128_000,
    deprecated: true,
  },
  // Groq
  'llama-3.3-70b-versatile': {
    input: 0.59,
    output: 0.79,
    label: 'Llama 3.3 70B',
    contextWindow: 131_072,
  },
  'llama-3.1-8b-instant': {
    input: 0.05,
    output: 0.08,
    label: 'Llama 3.1 8B Instant',
    contextWindow: 131_072,
  },
  'mixtral-8x7b-32768': {
    input: 0.24,
    output: 0.24,
    label: 'Mixtral 8x7B',
    contextWindow: 32_768,
    deprecated: true,
  },
  // Google Gemini
  'gemini-2.5-pro': {
    input: 1.25,
    output: 10.0,
    label: 'Gemini 2.5 Pro',
    contextWindow: 1_000_000,
  },
  'gemini-2.5-flash': {
    input: 0.3,
    output: 2.5,
    label: 'Gemini 2.5 Flash',
    contextWindow: 1_000_000,
  },
  'gemini-2.5-flash-lite': {
    input: 0.1,
    output: 0.4,
    label: 'Gemini 2.5 Flash-Lite',
    contextWindow: 1_000_000,
  },
  // Mistral AI
  'mistral-large-latest': {
    input: 2.0,
    output: 6.0,
    label: 'Mistral Large',
    contextWindow: 131_072,
  },
  'mistral-medium-latest': {
    input: 0.4,
    output: 2.0,
    label: 'Mistral Medium',
    contextWindow: 131_072,
  },
  'mistral-small-latest': {
    input: 0.1,
    output: 0.3,
    label: 'Mistral Small',
    contextWindow: 131_072,
  },
};
