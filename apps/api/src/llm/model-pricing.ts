export const MODEL_PRICING: Record<
  string,
  {
    input: number;
    output: number;
    label: string;
    contextWindow: number;
    deprecated?: boolean;
    recommended?: boolean;
  }
> = {
  // ── Anthropic ────────────────────────────────────────────
  'claude-opus-4-6': {
    input: 5.0,
    output: 25.0,
    label: 'Claude Opus 4.6',
    contextWindow: 1_000_000,
    recommended: true,
  },
  'claude-sonnet-4-6': {
    input: 3.0,
    output: 15.0,
    label: 'Claude Sonnet 4.6',
    contextWindow: 1_000_000,
    recommended: true,
  },
  'claude-haiku-4-5-20251001': {
    input: 1.0,
    output: 5.0,
    label: 'Claude Haiku 4.5',
    contextWindow: 200_000,
    recommended: true,
  },
  // Anthropic legacy (backward compat)
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
    deprecated: true,
  },
  'claude-3-haiku-20240307': {
    input: 0.25,
    output: 1.25,
    label: 'Claude 3 Haiku',
    contextWindow: 200_000,
    deprecated: true,
  },
  // ── OpenAI ───────────────────────────────────────────────
  'gpt-5.4': {
    input: 2.5,
    output: 10.0,
    label: 'GPT-5.4',
    contextWindow: 128_000,
    recommended: true,
  },
  'gpt-5.4-mini': {
    input: 0.75,
    output: 4.5,
    label: 'GPT-5.4 Mini',
    contextWindow: 128_000,
    recommended: true,
  },
  'gpt-5.4-nano': {
    input: 0.1,
    output: 0.4,
    label: 'GPT-5.4 Nano',
    contextWindow: 128_000,
    recommended: true,
  },
  // OpenAI legacy (backward compat)
  'gpt-4o': {
    input: 2.5,
    output: 10.0,
    label: 'GPT-4o',
    contextWindow: 128_000,
    deprecated: true,
  },
  'gpt-4o-mini': {
    input: 0.15,
    output: 0.6,
    label: 'GPT-4o Mini',
    contextWindow: 128_000,
    deprecated: true,
  },
  'gpt-4-turbo': {
    input: 10.0,
    output: 30.0,
    label: 'GPT-4 Turbo',
    contextWindow: 128_000,
    deprecated: true,
  },
  // ── Groq ─────────────────────────────────────────────────
  'llama-3.3-70b-versatile': {
    input: 0.59,
    output: 0.79,
    label: 'Llama 3.3 70B',
    contextWindow: 131_072,
    recommended: true,
  },
  'llama-3.1-8b-instant': {
    input: 0.05,
    output: 0.08,
    label: 'Llama 3.1 8B Instant',
    contextWindow: 131_072,
    recommended: true,
  },
  'openai/gpt-oss-120b': {
    input: 0.3,
    output: 0.5,
    label: 'GPT OSS 120B (Groq)',
    contextWindow: 131_072,
  },
  'mixtral-8x7b-32768': {
    input: 0.24,
    output: 0.24,
    label: 'Mixtral 8x7B',
    contextWindow: 32_768,
    deprecated: true,
  },
  // ── Google Gemini ────────────────────────────────────────
  'gemini-3.1-pro-preview': {
    input: 2.0,
    output: 12.0,
    label: 'Gemini 3.1 Pro Preview',
    contextWindow: 2_000_000,
    recommended: true,
  },
  'gemini-3-flash-preview': {
    input: 0.5,
    output: 3.0,
    label: 'Gemini 3 Flash Preview',
    contextWindow: 1_000_000,
    recommended: true,
  },
  'gemini-3.1-flash-lite-preview': {
    input: 0.25,
    output: 1.5,
    label: 'Gemini 3.1 Flash-Lite Preview',
    contextWindow: 1_000_000,
  },
  'gemini-2.5-pro': {
    input: 1.25,
    output: 10.0,
    label: 'Gemini 2.5 Pro',
    contextWindow: 1_000_000,
    recommended: true,
  },
  'gemini-2.5-flash': {
    input: 0.3,
    output: 2.5,
    label: 'Gemini 2.5 Flash',
    contextWindow: 1_000_000,
    recommended: true,
  },
  'gemini-2.5-flash-lite': {
    input: 0.1,
    output: 0.4,
    label: 'Gemini 2.5 Flash-Lite',
    contextWindow: 1_000_000,
  },
  // ── Mistral AI ───────────────────────────────────────────
  'mistral-large-latest': {
    input: 2.0,
    output: 6.0,
    label: 'Mistral Large 3',
    contextWindow: 131_072,
    recommended: true,
  },
  'mistral-medium-latest': {
    input: 0.4,
    output: 2.0,
    label: 'Mistral Medium 3.1',
    contextWindow: 131_072,
    recommended: true,
  },
  'mistral-small-latest': {
    input: 0.1,
    output: 0.3,
    label: 'Mistral Small 4',
    contextWindow: 131_072,
    recommended: true,
  },
  'open-mistral-nemo': {
    input: 0.15,
    output: 0.15,
    label: 'Mistral Nemo 12B',
    contextWindow: 131_072,
  },
  'magistral-medium-latest': {
    input: 0.4,
    output: 2.0,
    label: 'Magistral Medium 1.2',
    contextWindow: 131_072,
  },
  // ── Together AI ──────────────────────────────────────────
  'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8': {
    input: 0.27,
    output: 0.85,
    label: 'Llama 4 Maverick 17B',
    contextWindow: 1_000_000,
    recommended: true,
  },
  'meta-llama/Llama-4-Scout-17B-16E-Instruct': {
    input: 0.18,
    output: 0.59,
    label: 'Llama 4 Scout 17B',
    contextWindow: 512_000,
    recommended: true,
  },
  'deepseek-ai/DeepSeek-R1': {
    input: 3.0,
    output: 7.0,
    label: 'DeepSeek R1',
    contextWindow: 163_840,
  },
  'Qwen/Qwen3-235B-A22B-fp8': {
    input: 0.5,
    output: 0.5,
    label: 'Qwen 3 235B',
    contextWindow: 131_072,
  },
  'meta-llama/Llama-3.3-70B-Instruct-Turbo': {
    input: 0.59,
    output: 0.79,
    label: 'Llama 3.3 70B Turbo',
    contextWindow: 131_072,
    recommended: true,
  },
  // ── OpenRouter — Top Paid (prices from openrouter.ai, Apr 2026) ──
  'anthropic/claude-sonnet-4.6': {
    input: 3.0,
    output: 15.0,
    label: 'Claude Sonnet 4.6 (OpenRouter)',
    contextWindow: 1_000_000,
    recommended: true,
  },
  'google/gemini-3-flash-preview': {
    input: 0.5,
    output: 3.0,
    label: 'Gemini 3 Flash Preview (OpenRouter)',
    contextWindow: 1_000_000,
    recommended: true,
  },
  'anthropic/claude-opus-4.6': {
    input: 5.0,
    output: 25.0,
    label: 'Claude Opus 4.6 (OpenRouter)',
    contextWindow: 1_000_000,
  },
  'deepseek/deepseek-v3.2': {
    input: 0.259,
    output: 0.42,
    label: 'DeepSeek V3.2 (OpenRouter)',
    contextWindow: 164_000,
    recommended: true,
  },
  'google/gemini-2.5-flash-lite': {
    input: 0.1,
    output: 0.4,
    label: 'Gemini 2.5 Flash Lite (OpenRouter)',
    contextWindow: 1_000_000,
  },
  // ── OpenRouter — Top Free ──
  'openrouter/elephant-alpha': {
    input: 0,
    output: 0,
    label: 'Elephant Alpha (OpenRouter, free)',
    contextWindow: 262_000,
    recommended: true,
  },
  'nvidia/nemotron-3-super-120b-a12b:free': {
    input: 0,
    output: 0,
    label: 'Nemotron 3 Super 120B (OpenRouter, free)',
    contextWindow: 262_000,
  },
  'google/gemma-4-31b-it:free': {
    input: 0,
    output: 0,
    label: 'Gemma 4 31B (OpenRouter, free)',
    contextWindow: 262_000,
  },
};
