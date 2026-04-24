import { LLMProvider } from '../../generated/prisma/enums';
import type { OpenRouterModelInfo } from '@crypto-trader/openrouter';

export interface ModelRank {
  provider: LLMProvider;
  model: string;
  label: string;
  intelligenceScore: number;
  tier: 'FRONTIER' | 'STRONG' | 'BUDGET';
  speed: 'FAST' | 'MEDIUM' | 'SLOW';
  costTier: 'PREMIUM' | 'STANDARD' | 'CHEAP' | 'FREE';
  bestFor: ('TRADING' | 'CHAT' | 'NEWS' | 'CLASSIFY')[];
}

const COST_ORDER: Record<ModelRank['costTier'], number> = {
  FREE: 0,
  CHEAP: 1,
  STANDARD: 2,
  PREMIUM: 3,
};

export const MODEL_RANKING: ModelRank[] = [
  // ── Tier FRONTIER (Intelligence ≥ 44) ──────────────────────────────────
  // OpenRouter models are resolved dynamically — see buildDynamicRanking()
  {
    provider: LLMProvider.GEMINI,
    model: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro Preview',
    intelligenceScore: 57,
    tier: 'FRONTIER',
    speed: 'MEDIUM',
    costTier: 'PREMIUM',
    bestFor: ['TRADING'],
  },
  {
    provider: LLMProvider.OPENAI,
    model: 'gpt-5.4',
    label: 'GPT-5.4',
    intelligenceScore: 57,
    tier: 'FRONTIER',
    speed: 'SLOW',
    costTier: 'PREMIUM',
    bestFor: ['TRADING'],
  },
  {
    provider: LLMProvider.CLAUDE,
    model: 'claude-opus-4-6',
    label: 'Claude Opus 4.6',
    intelligenceScore: 53,
    tier: 'FRONTIER',
    speed: 'SLOW',
    costTier: 'PREMIUM',
    bestFor: ['TRADING'],
  },
  {
    provider: LLMProvider.CLAUDE,
    model: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    intelligenceScore: 52,
    tier: 'FRONTIER',
    speed: 'MEDIUM',
    costTier: 'STANDARD',
    bestFor: ['TRADING', 'CHAT', 'NEWS'],
  },
  {
    provider: LLMProvider.OPENAI,
    model: 'gpt-5.4-mini',
    label: 'GPT-5.4 Mini',
    intelligenceScore: 49,
    tier: 'FRONTIER',
    speed: 'FAST',
    costTier: 'STANDARD',
    bestFor: ['TRADING', 'CHAT', 'NEWS'],
  },
  {
    provider: LLMProvider.GEMINI,
    model: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash',
    intelligenceScore: 46,
    tier: 'FRONTIER',
    speed: 'FAST',
    costTier: 'STANDARD',
    bestFor: ['TRADING', 'CHAT', 'NEWS'],
  },
  {
    provider: LLMProvider.OPENAI,
    model: 'gpt-5.4-nano',
    label: 'GPT-5.4 Nano',
    intelligenceScore: 44,
    tier: 'FRONTIER',
    speed: 'FAST',
    costTier: 'CHEAP',
    bestFor: ['NEWS', 'CLASSIFY', 'CHAT'],
  },

  // ── Tier STRONG (Intelligence 28-43) ───────────────────────────────────
  {
    provider: LLMProvider.CLAUDE,
    model: 'claude-haiku-4-5-20251001',
    label: 'Claude 4.5 Haiku',
    intelligenceScore: 37,
    tier: 'STRONG',
    speed: 'FAST',
    costTier: 'STANDARD',
    bestFor: ['CHAT', 'NEWS', 'CLASSIFY'],
  },
  {
    provider: LLMProvider.GEMINI,
    model: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    intelligenceScore: 35,
    tier: 'STRONG',
    speed: 'MEDIUM',
    costTier: 'STANDARD',
    bestFor: ['TRADING', 'NEWS'],
  },
  {
    provider: LLMProvider.GEMINI,
    model: 'gemini-3.1-flash-lite-preview',
    label: 'Gemini 3.1 Flash-Lite',
    intelligenceScore: 34,
    tier: 'STRONG',
    speed: 'FAST',
    costTier: 'CHEAP',
    bestFor: ['NEWS', 'CLASSIFY'],
  },
  {
    provider: LLMProvider.GROQ,
    model: 'openai/gpt-oss-120b',
    label: 'GPT OSS 120B (Groq)',
    intelligenceScore: 33,
    tier: 'STRONG',
    speed: 'FAST',
    costTier: 'CHEAP',
    bestFor: ['NEWS', 'CLASSIFY'],
  },
  {
    provider: LLMProvider.MISTRAL,
    model: 'mistral-small-latest',
    label: 'Mistral Small 4',
    intelligenceScore: 28,
    tier: 'STRONG',
    speed: 'FAST',
    costTier: 'CHEAP',
    bestFor: ['NEWS', 'CLASSIFY', 'CHAT'],
  },
  {
    provider: LLMProvider.TOGETHER,
    model: 'deepseek-ai/DeepSeek-R1',
    label: 'DeepSeek R1',
    intelligenceScore: 27,
    tier: 'STRONG',
    speed: 'SLOW',
    costTier: 'STANDARD',
    bestFor: ['TRADING'],
  },
  {
    provider: LLMProvider.MISTRAL,
    model: 'magistral-medium-latest',
    label: 'Magistral Medium 1.2',
    intelligenceScore: 27,
    tier: 'STRONG',
    speed: 'MEDIUM',
    costTier: 'STANDARD',
    bestFor: ['TRADING', 'CHAT'],
  },

  // ── Tier BUDGET (Intelligence < 28) ────────────────────────────────────
  {
    provider: LLMProvider.MISTRAL,
    model: 'mistral-large-latest',
    label: 'Mistral Large 3',
    intelligenceScore: 23,
    tier: 'BUDGET',
    speed: 'MEDIUM',
    costTier: 'STANDARD',
    bestFor: ['CHAT'],
  },
  {
    provider: LLMProvider.GEMINI,
    model: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    intelligenceScore: 22,
    tier: 'BUDGET',
    speed: 'FAST',
    costTier: 'CHEAP',
    bestFor: ['NEWS', 'CLASSIFY'],
  },
  {
    provider: LLMProvider.MISTRAL,
    model: 'mistral-medium-latest',
    label: 'Mistral Medium 3.1',
    intelligenceScore: 21,
    tier: 'BUDGET',
    speed: 'MEDIUM',
    costTier: 'STANDARD',
    bestFor: ['CHAT'],
  },
  {
    provider: LLMProvider.TOGETHER,
    model: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
    label: 'Llama 4 Maverick',
    intelligenceScore: 18,
    tier: 'BUDGET',
    speed: 'FAST',
    costTier: 'CHEAP',
    bestFor: ['NEWS', 'CLASSIFY'],
  },
  {
    provider: LLMProvider.GROQ,
    model: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3 70B (Groq)',
    intelligenceScore: 14,
    tier: 'BUDGET',
    speed: 'FAST',
    costTier: 'CHEAP',
    bestFor: ['CLASSIFY'],
  },
  {
    provider: LLMProvider.TOGETHER,
    model: 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
    label: 'Llama 4 Scout',
    intelligenceScore: 14,
    tier: 'BUDGET',
    speed: 'FAST',
    costTier: 'CHEAP',
    bestFor: ['CLASSIFY'],
  },
];

/**
 * Given the user's active providers and a target use case,
 * returns the best available model from the ranking.
 */
export function suggestModel(
  activeProviders: LLMProvider[],
  useCase: 'TRADING' | 'CHAT' | 'NEWS' | 'CLASSIFY',
  preferCheap = false,
): ModelRank | null {
  const candidates = MODEL_RANKING.filter(
    (m) => activeProviders.includes(m.provider) && m.bestFor.includes(useCase),
  );

  if (!candidates.length) return null;

  if (preferCheap) {
    return [...candidates].sort(
      (a, b) =>
        COST_ORDER[a.costTier] - COST_ORDER[b.costTier] ||
        b.intelligenceScore - a.intelligenceScore,
    )[0];
  }

  // Already sorted by intelligenceScore desc in MODEL_RANKING
  return candidates[0];
}

/**
 * Returns top N suggestions for a use case based on active providers.
 */
export function suggestModels(
  activeProviders: LLMProvider[],
  useCase: 'TRADING' | 'CHAT' | 'NEWS' | 'CLASSIFY',
  limit = 3,
): ModelRank[] {
  return MODEL_RANKING.filter(
    (m) => activeProviders.includes(m.provider) && m.bestFor.includes(useCase),
  ).slice(0, limit);
}

/**
 * Convert an OpenRouter model from the dynamic API into a ModelRank.
 * Uses heuristic scoring based on pricing and context length.
 */
export function openRouterModelToRank(model: OpenRouterModelInfo): ModelRank {
  const { pricing, contextLength, isFree } = model;

  // Heuristic intelligence score based on pricing (higher price ≈ more capable)
  let intelligenceScore: number;
  if (isFree) {
    intelligenceScore = contextLength >= 200_000 ? 25 : 18;
  } else if (pricing.completion >= 10.0) {
    intelligenceScore = 55;
  } else if (pricing.completion >= 3.0) {
    intelligenceScore = 48;
  } else if (pricing.completion >= 1.0) {
    intelligenceScore = 38;
  } else {
    intelligenceScore = 30;
  }

  // Tier
  let tier: ModelRank['tier'];
  if (intelligenceScore >= 44) tier = 'FRONTIER';
  else if (intelligenceScore >= 28) tier = 'STRONG';
  else tier = 'BUDGET';

  // Cost tier
  let costTier: ModelRank['costTier'];
  if (isFree) costTier = 'FREE';
  else if (pricing.completion < 1.0) costTier = 'CHEAP';
  else if (pricing.completion < 10.0) costTier = 'STANDARD';
  else costTier = 'PREMIUM';

  // Speed heuristic based on pricing (cheaper models tend to be faster)
  let speed: ModelRank['speed'];
  if (isFree || pricing.completion < 1.0) speed = 'FAST';
  else if (pricing.completion < 5.0) speed = 'MEDIUM';
  else speed = 'SLOW';

  // All OpenRouter models can potentially serve any use case
  const bestFor: ModelRank['bestFor'] = ['TRADING', 'CHAT', 'NEWS', 'CLASSIFY'];

  return {
    provider: LLMProvider.OPENROUTER,
    model: model.id,
    label: model.name,
    intelligenceScore,
    tier,
    speed,
    costTier,
    bestFor,
  };
}

/**
 * Build a combined ranking from static native providers + dynamic OpenRouter models.
 * Returns a new array sorted by intelligenceScore desc.
 */
export function buildDynamicRanking(
  openRouterModels: OpenRouterModelInfo[],
): ModelRank[] {
  const dynamicRanks = openRouterModels.map(openRouterModelToRank);
  return [...MODEL_RANKING, ...dynamicRanks].sort(
    (a, b) => b.intelligenceScore - a.intelligenceScore,
  );
}

/**
 * suggestModel variant that includes dynamic OpenRouter models.
 */
export function suggestModelDynamic(
  activeProviders: LLMProvider[],
  useCase: 'TRADING' | 'CHAT' | 'NEWS' | 'CLASSIFY',
  openRouterModels: OpenRouterModelInfo[],
  preferCheap = false,
): ModelRank | null {
  const ranking = buildDynamicRanking(openRouterModels);
  const candidates = ranking.filter(
    (m) => activeProviders.includes(m.provider) && m.bestFor.includes(useCase),
  );

  if (!candidates.length) return null;

  if (preferCheap) {
    return [...candidates].sort(
      (a, b) =>
        COST_ORDER[a.costTier] - COST_ORDER[b.costTier] ||
        b.intelligenceScore - a.intelligenceScore,
    )[0];
  }

  return candidates[0];
}
