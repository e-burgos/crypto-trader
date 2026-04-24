import { AgentId, LLMProvider } from '../../generated/prisma/enums';
import type { OpenRouterModelInfo } from '@crypto-trader/openrouter';

export type AgentPresetName = 'free' | 'optimized' | 'balanced';

export interface AgentPresetEntry {
  provider: LLMProvider;
  model: string;
}

export type AgentPreset = Partial<Record<AgentId, AgentPresetEntry>>;

// ── Selection criteria per agent role ───────────────────────────────────────

/**
 * Each agent role has specific requirements. These criteria define what makes
 * a good model for each role, scored against the live OpenRouter catalog.
 */
interface AgentModelCriteria {
  /** true = only free models, false = only paid, undefined = any */
  freeOnly?: boolean;
  /** Required categories the model MUST have (all must match) */
  requiredCategories?: string[];
  /** Preferred categories that boost the score (any match) */
  preferredCategories?: string[];
  /** Minimum context length */
  minContext?: number;
  /** Weight for price (lower = cheaper preferred). 0-1 */
  priceWeight: number;
  /** Weight for context length. 0-1 */
  contextWeight: number;
  /** Weight for reasoning capability. 0-1 */
  reasoningWeight: number;
}

/**
 * Criteria definitions for each preset × agent combination.
 *
 * FREE: all agents use free models, prioritize context length
 * OPTIMIZED: best paid model per role function
 * BALANCED: free where sufficient, paid where quality matters
 */
const PRESET_CRITERIA: Record<
  AgentPresetName,
  Partial<Record<AgentId, AgentModelCriteria>>
> = {
  free: {
    [AgentId.routing]: {
      freeOnly: true,
      priceWeight: 0,
      contextWeight: 0.3,
      reasoningWeight: 0.7,
    },
    [AgentId.orchestrator]: {
      freeOnly: true,
      preferredCategories: ['reasoning'],
      priceWeight: 0,
      contextWeight: 0.4,
      reasoningWeight: 0.6,
    },
    [AgentId.synthesis]: {
      freeOnly: true,
      preferredCategories: ['reasoning'],
      priceWeight: 0,
      contextWeight: 0.5,
      reasoningWeight: 0.5,
    },
    [AgentId.platform]: {
      freeOnly: true,
      priceWeight: 0,
      contextWeight: 0.6,
      reasoningWeight: 0.4,
    },
    [AgentId.operations]: {
      freeOnly: true,
      preferredCategories: ['tool-use'],
      priceWeight: 0,
      contextWeight: 0.4,
      reasoningWeight: 0.6,
    },
    [AgentId.market]: {
      freeOnly: true,
      preferredCategories: ['reasoning'],
      priceWeight: 0,
      contextWeight: 0.5,
      reasoningWeight: 0.5,
    },
    [AgentId.blockchain]: {
      freeOnly: true,
      priceWeight: 0,
      contextWeight: 0.5,
      reasoningWeight: 0.5,
    },
    [AgentId.risk]: {
      freeOnly: true,
      preferredCategories: ['reasoning'],
      priceWeight: 0,
      contextWeight: 0.3,
      reasoningWeight: 0.7,
    },
  },
  optimized: {
    [AgentId.routing]: {
      freeOnly: false,
      preferredCategories: ['fast'],
      priceWeight: 0.6,
      contextWeight: 0.1,
      reasoningWeight: 0.3,
    },
    [AgentId.orchestrator]: {
      freeOnly: false,
      preferredCategories: ['reasoning', 'tool-use'],
      minContext: 128_000,
      priceWeight: 0.2,
      contextWeight: 0.3,
      reasoningWeight: 0.5,
    },
    [AgentId.synthesis]: {
      freeOnly: false,
      preferredCategories: ['reasoning', 'premium'],
      minContext: 128_000,
      priceWeight: 0.1,
      contextWeight: 0.3,
      reasoningWeight: 0.6,
    },
    [AgentId.platform]: {
      freeOnly: false,
      preferredCategories: ['fast'],
      priceWeight: 0.5,
      contextWeight: 0.3,
      reasoningWeight: 0.2,
    },
    [AgentId.operations]: {
      freeOnly: false,
      requiredCategories: ['tool-use'],
      priceWeight: 0.4,
      contextWeight: 0.2,
      reasoningWeight: 0.4,
    },
    [AgentId.market]: {
      freeOnly: false,
      preferredCategories: ['reasoning'],
      minContext: 128_000,
      priceWeight: 0.3,
      contextWeight: 0.3,
      reasoningWeight: 0.4,
    },
    [AgentId.blockchain]: {
      freeOnly: false,
      preferredCategories: ['reasoning', 'tool-use'],
      priceWeight: 0.4,
      contextWeight: 0.2,
      reasoningWeight: 0.4,
    },
    [AgentId.risk]: {
      freeOnly: false,
      preferredCategories: ['reasoning', 'premium'],
      minContext: 128_000,
      priceWeight: 0.1,
      contextWeight: 0.2,
      reasoningWeight: 0.7,
    },
  },
  balanced: {
    [AgentId.routing]: {
      freeOnly: true,
      priceWeight: 0,
      contextWeight: 0.3,
      reasoningWeight: 0.7,
    },
    [AgentId.orchestrator]: {
      freeOnly: false,
      preferredCategories: ['reasoning', 'tool-use'],
      priceWeight: 0.4,
      contextWeight: 0.2,
      reasoningWeight: 0.4,
    },
    [AgentId.synthesis]: {
      freeOnly: false,
      preferredCategories: ['reasoning'],
      priceWeight: 0.3,
      contextWeight: 0.3,
      reasoningWeight: 0.4,
    },
    [AgentId.platform]: {
      freeOnly: true,
      priceWeight: 0,
      contextWeight: 0.5,
      reasoningWeight: 0.5,
    },
    [AgentId.operations]: {
      freeOnly: false,
      preferredCategories: ['tool-use'],
      priceWeight: 0.5,
      contextWeight: 0.2,
      reasoningWeight: 0.3,
    },
    [AgentId.market]: {
      freeOnly: false,
      preferredCategories: ['reasoning'],
      priceWeight: 0.5,
      contextWeight: 0.2,
      reasoningWeight: 0.3,
    },
    [AgentId.blockchain]: {
      freeOnly: true,
      preferredCategories: ['reasoning'],
      priceWeight: 0,
      contextWeight: 0.4,
      reasoningWeight: 0.6,
    },
    [AgentId.risk]: {
      freeOnly: false,
      preferredCategories: ['reasoning'],
      priceWeight: 0.3,
      contextWeight: 0.2,
      reasoningWeight: 0.5,
    },
  },
};

// ── Scoring engine ──────────────────────────────────────────────────────────

function scoreModel(
  model: OpenRouterModelInfo,
  criteria: AgentModelCriteria,
): number {
  // Exclude meta-models / routers (e.g. openrouter/auto, openrouter/free)
  if (model.id.startsWith('openrouter/')) return -1;

  // Exclude models with invalid pricing (negative = variable/unknown)
  if (model.pricing.prompt < 0 || model.pricing.completion < 0) return -1;

  // Hard filters
  if (criteria.freeOnly === true && !model.isFree) return -1;
  if (criteria.freeOnly === false && model.isFree) return -1;
  if (criteria.minContext && model.contextLength < criteria.minContext)
    return -1;
  if (criteria.requiredCategories) {
    for (const cat of criteria.requiredCategories) {
      if (!model.categories.includes(cat)) return -1;
    }
  }

  let score = 0;

  // Price score: cheaper = better (normalize to 0-1 range, cap at $100/M)
  const maxPrice = 100;
  const priceScore = model.isFree
    ? 1
    : 1 - Math.min(model.pricing.completion, maxPrice) / maxPrice;
  score += priceScore * criteria.priceWeight;

  // Context score: longer = better (normalize, cap at 2M)
  const maxCtx = 2_000_000;
  const ctxScore = Math.min(model.contextLength, maxCtx) / maxCtx;
  score += ctxScore * criteria.contextWeight;

  // Reasoning score: has reasoning or include_reasoning params
  const hasReasoning =
    model.categories.includes('reasoning') ||
    model.supportedParameters.includes('reasoning') ||
    model.supportedParameters.includes('include_reasoning');
  score += (hasReasoning ? 1 : 0) * criteria.reasoningWeight;

  // Bonus for preferred categories (up to 0.3 extra)
  if (criteria.preferredCategories) {
    const matched = criteria.preferredCategories.filter((c) =>
      model.categories.includes(c),
    ).length;
    score += (matched / criteria.preferredCategories.length) * 0.3;
  }

  return score;
}

/**
 * Build a preset dynamically from live OpenRouter model data.
 * Returns the best model for each agent role based on weighted criteria.
 * Uses progressive penalization to encourage model diversity across agents.
 */
export function buildDynamicPreset(
  presetName: AgentPresetName,
  models: OpenRouterModelInfo[],
): AgentPreset {
  const criteria = PRESET_CRITERIA[presetName];
  if (!criteria) return {};

  const preset: AgentPreset = {};
  // Track how many times each model has been assigned to penalize reuse
  const assignedCount = new Map<string, number>();

  for (const [agentIdStr, agentCriteria] of Object.entries(criteria)) {
    const agentId = agentIdStr as AgentId;

    let bestModel: OpenRouterModelInfo | null = null;
    let bestScore = -1;

    for (const model of models) {
      let s = scoreModel(model, agentCriteria);
      if (s <= 0) continue;

      // Penalize models already assigned to other agents (−30% per reuse)
      const reuses = assignedCount.get(model.id) ?? 0;
      if (reuses > 0) {
        s *= Math.pow(0.7, reuses);
      }

      if (s > bestScore) {
        bestScore = s;
        bestModel = model;
      }
    }

    if (bestModel) {
      preset[agentId] = {
        provider: LLMProvider.OPENROUTER,
        model: bestModel.id,
      };
      assignedCount.set(
        bestModel.id,
        (assignedCount.get(bestModel.id) ?? 0) + 1,
      );
    }
  }

  return preset;
}

// ── Legacy static presets (fallback when API is unavailable) ────────────────

export const PRESET_FREE: AgentPreset = {
  [AgentId.routing]: {
    provider: LLMProvider.OPENROUTER,
    model: 'nvidia/nemotron-nano-9b-v2:free',
  },
  [AgentId.orchestrator]: {
    provider: LLMProvider.OPENROUTER,
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
  },
  [AgentId.synthesis]: {
    provider: LLMProvider.OPENROUTER,
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
  },
  [AgentId.platform]: {
    provider: LLMProvider.OPENROUTER,
    model: 'google/gemma-4-31b-it:free',
  },
  [AgentId.operations]: {
    provider: LLMProvider.OPENROUTER,
    model: 'openai/gpt-oss-120b:free',
  },
  [AgentId.market]: {
    provider: LLMProvider.OPENROUTER,
    model: 'inclusionai/ling-2.6-flash:free',
  },
  [AgentId.blockchain]: {
    provider: LLMProvider.OPENROUTER,
    model: 'minimax/minimax-m2.5:free',
  },
  [AgentId.risk]: {
    provider: LLMProvider.OPENROUTER,
    model: 'openai/gpt-oss-120b:free',
  },
};

export const AGENT_PRESETS_STATIC: Record<AgentPresetName, AgentPreset> = {
  free: PRESET_FREE,
  optimized: PRESET_FREE, // fallback to free if API is down
  balanced: PRESET_FREE,
};

// ── Fallback model resolution ───────────────────────────────────────────────

/**
 * Criteria for a universal fallback model — must be a versatile all-rounder
 * that can handle any agent's work when no specific config exists.
 */
const FALLBACK_MODEL_CRITERIA: Record<AgentPresetName, AgentModelCriteria> = {
  free: {
    freeOnly: true,
    preferredCategories: ['reasoning', 'tool-use', 'long-context'],
    minContext: 32_000,
    priceWeight: 0,
    contextWeight: 0.4,
    reasoningWeight: 0.6,
  },
  optimized: {
    freeOnly: false,
    preferredCategories: ['reasoning', 'tool-use', 'long-context', 'premium'],
    minContext: 128_000,
    priceWeight: 0.1,
    contextWeight: 0.3,
    reasoningWeight: 0.6,
  },
  balanced: {
    preferredCategories: ['reasoning', 'tool-use', 'long-context'],
    minContext: 64_000,
    priceWeight: 0.3,
    contextWeight: 0.3,
    reasoningWeight: 0.4,
  },
};

/**
 * Resolve the best universal fallback model from the live OpenRouter catalog.
 * The preset name controls the criteria (free → free only, optimized → best paid, etc).
 */
export function resolveFallbackModel(
  presetName: AgentPresetName,
  models: OpenRouterModelInfo[],
): string | null {
  const criteria = FALLBACK_MODEL_CRITERIA[presetName];
  if (!criteria || models.length === 0) return null;

  let bestModel: OpenRouterModelInfo | null = null;
  let bestScore = -1;

  for (const model of models) {
    const s = scoreModel(model, criteria);
    if (s > bestScore) {
      bestScore = s;
      bestModel = model;
    }
  }

  return bestModel?.id ?? null;
}

/** Static fallback model ID used when the API is unavailable */
export const STATIC_FALLBACK_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
