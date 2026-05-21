import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AgentId,
  LLMProvider,
  TradingMode,
  RiskProfile,
} from '../../generated/prisma/enums';
import { MODEL_PRICING } from '../llm/model-pricing';

// ── Interfaces ──────────────────────────────────────────────

export interface ModelSelectionParams {
  agentId: AgentId;
  userId: string;
  mode: TradingMode;
  riskProfile: RiskProfile;
  pair: string;
  task: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  divergenceDetected?: boolean;
}

export interface ModelSelectionResult {
  model: string;
  provider: LLMProvider;
  reason: string;
  estimatedCostUsd: number;
}

// ── Constants ───────────────────────────────────────────────

const COLD_START_THRESHOLD = 10;
const DAILY_SPEND_CACHE_TTL_MS = 60_000;

const DEFAULT_MODELS: Record<string, { model: string; provider: LLMProvider }> =
  {
    orchestrator: { model: 'gpt-4o-mini', provider: LLMProvider.OPENAI },
    market: { model: 'gpt-4o-mini', provider: LLMProvider.OPENAI },
    risk: { model: 'gpt-4o-mini', provider: LLMProvider.OPENAI },
    synthesis: { model: 'gpt-4o', provider: LLMProvider.OPENAI },
    routing: { model: 'gpt-4o-mini', provider: LLMProvider.OPENAI },
    platform: { model: 'gpt-4o-mini', provider: LLMProvider.OPENAI },
    operations: { model: 'gpt-4o-mini', provider: LLMProvider.OPENAI },
    blockchain: { model: 'gpt-4o-mini', provider: LLMProvider.OPENAI },
  };

const PREMIUM_MODELS: Array<{ model: string; provider: LLMProvider }> = [
  { model: 'gpt-4o', provider: LLMProvider.OPENAI },
  { model: 'claude-sonnet-4-20250514', provider: LLMProvider.CLAUDE },
  { model: 'gemini-2.5-pro', provider: LLMProvider.GEMINI },
];

// ── Service ─────────────────────────────────────────────────

@Injectable()
export class ModelRouterService {
  private readonly logger = new Logger(ModelRouterService.name);

  /** In-memory cache: key = `${userId}:${agentId}` → { spend, ts } */
  private readonly dailySpendCache = new Map<
    string,
    { spend: number; ts: number }
  >();

  constructor(private readonly prisma: PrismaService) {}

  async selectModel(
    params: ModelSelectionParams,
  ): Promise<ModelSelectionResult> {
    const {
      agentId,
      userId,
      mode,
      riskProfile,
      pair,
      estimatedInputTokens,
      estimatedOutputTokens,
      divergenceDetected,
    } = params;

    // 1. Load policies
    const [budgetPolicy, modelPolicies] = await Promise.all([
      this.prisma.agentBudgetPolicy.findUnique({ where: { userId } }),
      this.prisma.agentModelPolicy.findMany({
        where: { agentId, OR: [{ userId }, { userId: null }] },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const maxDailyUsd = budgetPolicy?.dailyUsdBudget ?? 5;
    const maxCostPerDecision = budgetPolicy?.maxCostPerDecisionUsd ?? 0.15;
    const blockFreeModels = budgetPolicy?.livePremiumOnly ?? false;

    // 2. Budget circuit breaker — check daily spend
    const dailySpend = await this.getDailySpend(userId, agentId);
    if (dailySpend >= maxDailyUsd) {
      return {
        model: 'none',
        provider: LLMProvider.OPENAI,
        reason: 'BUDGET_EXHAUSTED',
        estimatedCostUsd: 0,
      };
    }

    // 3. Cold-start check
    const outcomeCount = await this.getOutcomeCount(agentId, pair, mode);
    if (outcomeCount < COLD_START_THRESHOLD) {
      const defaults = DEFAULT_MODELS[agentId] ?? DEFAULT_MODELS['market'];
      const cost = this.estimateCost(
        defaults.model,
        estimatedInputTokens,
        estimatedOutputTokens,
      );
      return {
        model: defaults.model,
        provider: defaults.provider,
        reason: 'COLD_START',
        estimatedCostUsd: cost,
      };
    }

    // 4. Premium escalation on divergence
    if (divergenceDetected) {
      const premium = this.selectPremiumModel(
        mode,
        blockFreeModels,
        estimatedInputTokens,
        estimatedOutputTokens,
        maxCostPerDecision,
      );
      if (premium) {
        return {
          ...premium,
          reason: 'DIVERGENCE_ESCALATION',
        };
      }
    }

    // 5. Policy-based selection — filter applicable model policies
    const applicable = modelPolicies.filter((p) => {
      if (p.mode && p.mode !== mode) return false;
      if (p.riskProfile && p.riskProfile !== riskProfile) return false;
      return true;
    });

    for (const policy of applicable) {
      const cost = this.estimateCost(
        policy.model,
        estimatedInputTokens,
        estimatedOutputTokens,
      );
      const pricing = MODEL_PRICING[policy.model];
      const isFree = !pricing || (pricing.input === 0 && pricing.output === 0);

      // Block free models in LIVE mode
      if (mode === TradingMode.LIVE && isFree) continue;
      // Block free models if policy says so
      if (blockFreeModels && isFree) continue;
      // Check per-decision cost limit
      if (cost > maxCostPerDecision) continue;
      // Check remaining daily budget
      if (dailySpend + cost > maxDailyUsd) continue;

      return {
        model: policy.model,
        provider: policy.provider,
        reason: 'POLICY_MATCH',
        estimatedCostUsd: cost,
      };
    }

    // 6. Fallback — use default model with cost-guard
    const defaults = DEFAULT_MODELS[agentId] ?? DEFAULT_MODELS['market'];
    const fallbackCost = this.estimateCost(
      defaults.model,
      estimatedInputTokens,
      estimatedOutputTokens,
    );

    if (fallbackCost > maxCostPerDecision) {
      // Try downgrade to cheapest known model
      const downgraded = this.findCheapestModel(
        mode,
        blockFreeModels,
        estimatedInputTokens,
        estimatedOutputTokens,
        maxCostPerDecision,
      );
      if (downgraded) {
        return { ...downgraded, reason: 'COST_DOWNGRADE' };
      }
      return {
        model: 'none',
        provider: LLMProvider.OPENAI,
        reason: 'BUDGET_EXHAUSTED',
        estimatedCostUsd: 0,
      };
    }

    return {
      model: defaults.model,
      provider: defaults.provider,
      reason: 'DEFAULT',
      estimatedCostUsd: fallbackCost,
    };
  }

  // ── Helpers ─────────────────────────────────────────────

  estimateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) return 0;
    return (
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output
    );
  }

  private async getDailySpend(
    userId: string,
    agentId: string,
  ): Promise<number> {
    const cacheKey = `${userId}:${agentId}`;
    const cached = this.dailySpendCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.ts < DAILY_SPEND_CACHE_TTL_MS) {
      return cached.spend;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const result = await this.prisma.llmUsageLog.aggregate({
      where: {
        userId,
        agentId: agentId as AgentId,
        createdAt: { gte: todayStart },
      },
      _sum: { costUsd: true },
    });

    const spend = result._sum.costUsd ?? 0;
    this.dailySpendCache.set(cacheKey, { spend, ts: now });
    return spend;
  }

  private async getOutcomeCount(
    agentId: string,
    pair: string,
    mode: TradingMode,
  ): Promise<number> {
    // AgentDecisionEvaluation doesn't have pair/mode directly,
    // so we count total evaluations for the agent via decisions
    return this.prisma.agentDecisionEvaluation.count({
      where: {
        decisionId: { startsWith: agentId },
      },
    });
  }

  private selectPremiumModel(
    mode: TradingMode,
    blockFreeModels: boolean,
    inputTokens: number,
    outputTokens: number,
    maxCostPerDecision: number,
  ): Omit<ModelSelectionResult, 'reason'> | null {
    for (const pm of PREMIUM_MODELS) {
      const cost = this.estimateCost(pm.model, inputTokens, outputTokens);
      const pricing = MODEL_PRICING[pm.model];
      const isFree = !pricing || (pricing.input === 0 && pricing.output === 0);

      if (mode === TradingMode.LIVE && isFree) continue;
      if (blockFreeModels && isFree) continue;
      // For premium escalation, allow up to 3x the normal cost limit
      if (cost > maxCostPerDecision * 3) continue;

      return { model: pm.model, provider: pm.provider, estimatedCostUsd: cost };
    }
    return null;
  }

  private findCheapestModel(
    mode: TradingMode,
    blockFreeModels: boolean,
    inputTokens: number,
    outputTokens: number,
    maxCost: number,
  ): Omit<ModelSelectionResult, 'reason'> | null {
    // Map model → provider for known cheap models
    const cheapCandidates: Array<{ model: string; provider: LLMProvider }> = [
      { model: 'gpt-4o-mini', provider: LLMProvider.OPENAI },
      { model: 'llama-3.1-8b-instant', provider: LLMProvider.GROQ },
      { model: 'mistral-small-latest', provider: LLMProvider.MISTRAL },
      { model: 'gemini-2.5-flash-lite', provider: LLMProvider.GEMINI },
    ];

    for (const candidate of cheapCandidates) {
      const cost = this.estimateCost(
        candidate.model,
        inputTokens,
        outputTokens,
      );
      const pricing = MODEL_PRICING[candidate.model];
      const isFree = !pricing || (pricing.input === 0 && pricing.output === 0);

      if (mode === TradingMode.LIVE && isFree) continue;
      if (blockFreeModels && isFree) continue;
      if (cost > maxCost) continue;

      return {
        model: candidate.model,
        provider: candidate.provider,
        estimatedCostUsd: cost,
      };
    }
    return null;
  }
}
