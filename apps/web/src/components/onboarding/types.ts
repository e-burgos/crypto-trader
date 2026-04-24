export type TradingMode = 'LIVE' | 'SANDBOX' | 'TESTNET';
export type LLMProvider =
  | 'OPENROUTER'
  | 'CLAUDE'
  | 'OPENAI'
  | 'GROQ'
  | 'GEMINI'
  | 'MISTRAL'
  | 'TOGETHER';

export interface OnboardingState {
  // Step 1: Binance Keys (Live)
  binanceApiKey: string;
  binanceApiSecret: string;
  skipBinance: boolean;
  // Step 1: Binance Keys (Testnet)
  binanceTestnetApiKey: string;
  binanceTestnetApiSecret: string;
  skipTestnet: boolean;
  // Step 2: LLM Provider
  llmProvider: LLMProvider;
  llmApiKeys: Record<string, string>;
  llmModels: Record<string, string>;
  // Step 3: Trading Mode
  mode: TradingMode;
  initialCapital: string;
  initialCapitalUsdc: string;
}

export const LLM_PROVIDERS: {
  value: LLMProvider;
  label: string;
  models: string[];
  helpLink: string;
  helpLinkText: string;
}[] = [
  {
    value: 'OPENROUTER',
    label: 'OpenRouter',
    models: [], // Resolved dynamically via useOpenRouterModels hook
    helpLink: 'https://openrouter.ai/keys',
    helpLinkText: 'openrouter.ai',
  },
  {
    value: 'CLAUDE',
    label: 'Anthropic Claude',
    models: [
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-haiku-20240307',
    ],
    helpLink: 'https://console.anthropic.com/',
    helpLinkText: 'console.anthropic.com',
  },
  {
    value: 'OPENAI',
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini'],
    helpLink: 'https://platform.openai.com/api-keys',
    helpLinkText: 'platform.openai.com',
  },
  {
    value: 'GROQ',
    label: 'Groq',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    helpLink: 'https://console.groq.com/keys',
    helpLinkText: 'console.groq.com',
  },
  {
    value: 'GEMINI',
    label: 'Google Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    helpLink: 'https://aistudio.google.com/apikey',
    helpLinkText: 'aistudio.google.com',
  },
  {
    value: 'MISTRAL',
    label: 'Mistral AI',
    models: [
      'mistral-small-latest',
      'mistral-medium-latest',
      'mistral-large-latest',
    ],
    helpLink: 'https://console.mistral.ai/api-keys/',
    helpLinkText: 'console.mistral.ai',
  },
  {
    value: 'TOGETHER',
    label: 'Together AI',
    models: [
      'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
      'meta-llama/Llama-4-Scout-17B-16E-Instruct',
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    ],
    helpLink: 'https://api.together.xyz/settings/api-keys',
    helpLinkText: 'api.together.xyz',
  },
];
