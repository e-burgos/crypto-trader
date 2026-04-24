import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubAgentService, SubAgentId } from './sub-agent.service';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { LLMProvider } from '@crypto-trader/shared';
import {
  IntentClassification,
  SubAgentId as IntentSubAgentId,
} from './dto/intent-classification.dto';
import {
  AegisVerdict,
  DecisionPayload,
  SubAgentResult,
} from './dto/decision-synthesis.dto';
import { NewsEnrichment } from './dto/news-enrichment.dto';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { IndicatorSnapshot } from '@crypto-trader/shared';

export interface NewsItemInput {
  id: string;
  headline: string;
  summary?: string | null;
}

// ── JSON parsing helpers ─────────────────────────────────────────────────────

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```(?:json)?\s*/gi, '').trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // Extract the outermost JSON object or array from the text
      const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) return JSON.parse(match[0]) as T;
      return fallback;
    }
  } catch {
    return fallback;
  }
}

// ── OrchestratorService ──────────────────────────────────────────────────────

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subAgent: SubAgentService,
  ) {}

  // ── A) Intent Classification ───────────────────────────────────────────────

  /**
   * Classifies the user's message intent and routes to the correct sub-agent.
   * Uses a cheap model (Groq preferred) for low-latency classification.
   */
  async classifyIntent(
    message: string,
    userId: string,
  ): Promise<IntentClassification> {
    const raw = await this.subAgent.call(
      'orchestrator',
      'intent_classification',
      { message },
      userId,
      true, // preferCheap
    );

    const result = safeParseJson<Partial<IntentClassification>>(raw, {});

    const validAgents: IntentSubAgentId[] = [
      'platform',
      'operations',
      'market',
      'blockchain',
      'risk',
    ];
    const agentId: IntentSubAgentId = validAgents.includes(
      result.agentId as IntentSubAgentId,
    )
      ? (result.agentId as IntentSubAgentId)
      : 'market';

    return {
      agentId,
      confidence:
        typeof result.confidence === 'number' ? result.confidence : 0.7,
      reason: result.reason ?? 'Clasificación automática',
      suggestedGreeting:
        result.suggestedGreeting ?? 'Hola, estoy aquí para ayudarte.',
    };
  }

  // ── B) Trading Decision Orchestration ─────────────────────────────────────

  /**
   * Orchestrates a trading decision using 4 parallel sub-agent calls:
   * SIGMA×2 (technical + news), FORGE (sizing), AEGIS (risk gate).
   * Respects AEGIS BLOCK verdict — returns HOLD immediately without synthesis.
   */
  async orchestrateDecision(
    userId: string,
    configId: string,
    indicators: IndicatorSnapshot,
    news: Array<{
      headline: string;
      sentiment: string;
      summary?: string | null;
    }>,
    llmOverride?: { provider: string; model: string },
  ): Promise<DecisionPayload> {
    // Load config + open positions + wallet balances for FORGE and AEGIS context
    const [config, openPositions, sandboxWallets] = await Promise.all([
      this.prisma.tradingConfig.findFirst({
        where: { id: configId, userId },
        select: {
          buyThreshold: true,
          sellThreshold: true,
          maxTradePct: true,
          maxConcurrentPositions: true,
          stopLossPct: true,
          takeProfitPct: true,
          asset: true,
          pair: true,
          mode: true,
        },
      }),
      this.prisma.position.findMany({
        where: { userId, status: 'OPEN' },
        select: {
          asset: true,
          pair: true,
          entryPrice: true,
          quantity: true,
          pnl: true,
        },
      }),
      this.prisma.sandboxWallet.findMany({
        where: { userId },
        select: { currency: true, balance: true },
      }),
    ]);

    if (!config) {
      throw new Error(`Config ${configId} not found for user ${userId}`);
    }

    // Cast override to typed LLMProvider if present
    const typedOverride = llmOverride
      ? {
          provider: llmOverride.provider as LLMProvider,
          model: llmOverride.model,
        }
      : undefined;

    // ── SIGMA sentiment cache ────────────────────────────────────────────────
    // Reuse a recent SIGMA news_sentiment result from any bot of the same user
    // if it falls within the user's configured analysis interval (TTL).
    const newsConfig = await this.prisma.newsConfig.findUnique({
      where: { userId },
      select: { intervalMinutes: true },
    });
    const sentimentTtlMs = (newsConfig?.intervalMinutes ?? 10) * 60_000;

    let cachedSentiment: string | null = null;
    const recentDecision = await this.prisma.agentDecision.findFirst({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - sentimentTtlMs) },
        metadata: { not: { equals: null } },
      },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    });

    if (recentDecision?.metadata) {
      const meta = recentDecision.metadata as {
        subAgentResults?: SubAgentResult[];
      };
      const cached = meta.subAgentResults?.find(
        (r) => r.task === 'news_sentiment',
      );
      if (cached?.output && cached.output !== '{}') {
        cachedSentiment = cached.output;
        this.logger.log(
          `Reusing cached SIGMA news_sentiment for user=${userId} (TTL=${newsConfig?.intervalMinutes ?? 10}min)`,
        );
      }
    }

    // Parallel sub-agent calls (skip SIGMA sentiment if cached)
    const [techRaw, sentimentRaw, forgeRaw, aegisRaw] =
      await Promise.allSettled([
        this.subAgent.call(
          'market',
          'technical_signal',
          { indicators },
          userId,
          false,
          typedOverride,
        ),
        cachedSentiment
          ? Promise.resolve(cachedSentiment)
          : this.subAgent.call(
              'market',
              'news_sentiment',
              { news: news.slice(0, 10) },
              userId,
              false,
              typedOverride,
            ),
        this.subAgent.call(
          'operations',
          'sizing_suggestion',
          {
            config: {
              maxTradePct: config.maxTradePct,
              maxConcurrentPositions: config.maxConcurrentPositions,
              buyThreshold: config.buyThreshold,
              sellThreshold: config.sellThreshold,
            },
            openPositionsCount: openPositions.length,
          },
          userId,
          false,
          typedOverride,
        ),
        this.subAgent.call(
          'risk',
          'risk_gate',
          {
            portfolio: openPositions,
            availableBalances: sandboxWallets.map((w) => ({
              currency: w.currency,
              balance: Number(w.balance),
            })),
            indicators: {
              rsi: (indicators as unknown as Record<string, unknown>).rsi,
              price: (indicators as unknown as Record<string, unknown>).close,
              asset: config.asset,
            },
            config: {
              asset: config.asset,
              pair: config.pair,
              stopLossPct: config.stopLossPct,
              takeProfitPct: config.takeProfitPct,
              maxConcurrentPositions: config.maxConcurrentPositions,
            },
          },
          userId,
          false,
          typedOverride,
        ),
      ]);

    const subAgentResults: SubAgentResult[] = [];

    const techOutput = techRaw.status === 'fulfilled' ? techRaw.value : '{}';
    const sentimentOutput =
      sentimentRaw.status === 'fulfilled' ? sentimentRaw.value : '{}';
    const forgeOutput = forgeRaw.status === 'fulfilled' ? forgeRaw.value : '{}';
    const aegisOutput = aegisRaw.status === 'fulfilled' ? aegisRaw.value : '{}';

    // A2→DB: Persist fresh sentiment to NewsAnalysis (Spec 38, B.4)
    if (sentimentRaw.status === 'fulfilled' && !cachedSentiment) {
      try {
        await this.persistSentimentAsAIAnalysis(userId, sentimentRaw.value);
      } catch (err) {
        this.logger.warn(
          `Failed to persist sentiment A2→DB: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    subAgentResults.push(
      { agentId: 'market', task: 'technical_signal', output: techOutput },
      {
        agentId: 'market',
        task: 'news_sentiment',
        output: sentimentOutput,
        ...(cachedSentiment ? { cached: true } : {}),
      } as SubAgentResult,
      { agentId: 'operations', task: 'sizing_suggestion', output: forgeOutput },
      { agentId: 'risk', task: 'risk_gate', output: aegisOutput },
    );

    // AEGIS verdict gate
    const aegisVerdict = safeParseJson<Partial<AegisVerdict>>(aegisOutput, {});
    if (aegisVerdict.verdict === 'BLOCK') {
      const reason = aegisVerdict.reason ?? 'Riesgo elevado detectado';
      const alerts = aegisVerdict.alerts ?? [];

      // Ignore false-positive blocks about single-asset concentration.
      // Each bot trades one specific pair by design, so 100% concentration
      // in that asset is expected and not a real risk signal.
      const isFalseConcentrationBlock =
        /concentraci[oó]n|exposici[oó]n.*(?:un solo|single|[\d]+%.*(?:portfolio|cartera))/i.test(
          reason,
        );
      if (isFalseConcentrationBlock) {
        this.logger.log(
          `AEGIS BLOCK overridden (single-asset concentration is expected) for config=${configId}: ${reason}`,
        );
      } else {
        this.logger.warn(
          `AEGIS BLOCK for user=${userId} config=${configId}: ${reason}`,
        );
        return {
          decision: 'HOLD',
          confidence: 1.0,
          reasoning: `AEGIS BLOCK: ${reason}${alerts.length ? '. Alertas: ' + alerts.join(', ') : ''}`,
          waitMinutes: 30,
          orchestrated: true,
          subAgentResults,
        };
      }
    }

    // Synthesis call via orchestrator
    let synthesisRaw: string;
    let synthesisProvider: string | undefined;
    let synthesisModel: string | undefined;

    // Resolve model info before the synthesis call
    try {
      const resolved = await this.subAgent.getProvider(
        userId,
        'synthesis',
        typedOverride,
      );
      synthesisProvider = resolved.provider;
      synthesisModel = resolved.model;
    } catch {
      // Non-blocking — we'll still attempt the call
    }

    try {
      synthesisRaw = await this.subAgent.call(
        'orchestrator',
        'decision_synthesis',
        {
          technicalSignal: techOutput,
          newsSentiment: sentimentOutput,
          sizingSuggestion: forgeOutput,
          aegisVerdict: aegisOutput,
          buyThreshold: config.buyThreshold,
          sellThreshold: config.sellThreshold,
        },
        userId,
        false,
        typedOverride,
      );
    } catch (synthErr) {
      this.logger.warn(
        `Synthesis LLM call failed for user=${userId} config=${configId}: ${
          synthErr instanceof Error ? synthErr.message : String(synthErr)
        }`,
      );

      // All sub-agents failed + synthesis failed → propagate as LLM error
      // so the processor can retry instead of stopping the agent
      const allSubsFailed = [techRaw, sentimentRaw, forgeRaw, aegisRaw].every(
        (r) => r.status === 'rejected',
      );
      if (allSubsFailed) {
        // Re-throw so the processor's LLM error handler catches it
        throw synthErr;
      }

      // Partial data available — return HOLD with explanation
      return {
        decision: 'HOLD' as const,
        confidence: 0.3,
        reasoning:
          'LLM no disponible para síntesis. Sub-agentes parciales disponibles. Se recomienda esperar.',
        waitMinutes: 15,
        orchestrated: true,
        subAgentResults,
      };
    }

    const synthesis = safeParseJson<{
      decision?: string;
      confidence?: number;
      reasoning?: string;
      waitMinutes?: number;
    }>(synthesisRaw, {});

    const validDecisions = ['BUY', 'SELL', 'HOLD'] as const;
    type DecisionType = (typeof validDecisions)[number];
    const decision: DecisionType = validDecisions.includes(
      synthesis.decision as DecisionType,
    )
      ? (synthesis.decision as DecisionType)
      : 'HOLD';

    return {
      decision,
      confidence:
        typeof synthesis.confidence === 'number'
          ? Math.max(0, Math.min(1, synthesis.confidence))
          : 0.5,
      reasoning: synthesis.reasoning ?? 'Decisión orquestada por KRYPTO',
      waitMinutes:
        typeof synthesis.waitMinutes === 'number' ? synthesis.waitMinutes : 15,
      orchestrated: true,
      subAgentResults,
      llmProvider: synthesisProvider,
      llmModel: synthesisModel,
    };
  }

  // ── C) News Enrichment ────────────────────────────────────────────────────

  /**
   * Enriches a news item with technical relevance (SIGMA) and
   * ecosystem impact (CIPHER) in parallel.
   */
  async enrichNews(
    newsItem: NewsItemInput,
    userId: string,
  ): Promise<NewsEnrichment> {
    const context = {
      headline: newsItem.headline,
      summary: newsItem.summary ?? null,
    };

    const [techRaw, ecoRaw] = await Promise.allSettled([
      this.subAgent.call(
        'market',
        'news_technical_relevance',
        context,
        userId,
        true,
      ),
      this.subAgent.call(
        'blockchain',
        'ecosystem_impact',
        context,
        userId,
        true,
      ),
    ]);

    const techResult = safeParseJson<{
      relevance?: number;
      affectedIndicators?: string[];
      timeframe?: string;
    }>(techRaw.status === 'fulfilled' ? techRaw.value : '{}', {});

    const ecoResult = safeParseJson<{
      ecosystemImpact?: string;
      category?: string;
      chains?: string[];
      summary?: string;
    }>(ecoRaw.status === 'fulfilled' ? ecoRaw.value : '{}', {});

    const tags: string[] = [];
    if (techResult.affectedIndicators)
      tags.push(...techResult.affectedIndicators);
    if (techResult.timeframe) tags.push(`timeframe:${techResult.timeframe}`);
    if (ecoResult.category) tags.push(`category:${ecoResult.category}`);
    if (ecoResult.chains)
      tags.push(...ecoResult.chains.map((c) => `chain:${c}`));

    return {
      technicalRelevance:
        typeof techResult.relevance === 'number' ? techResult.relevance : 0,
      ecosystemImpact: ecoResult.summary ?? ecoResult.ecosystemImpact ?? 'none',
      orchestratedTags: tags,
    };
  }

  // ── D) Cross-agent synthesis ──────────────────────────────────────────────

  /**
   * Synthesizes responses from multiple sub-agents into a single cohesive response.
   * Used for multi-domain queries (e.g. "buy ETH now + what is a liquidity pool?").
   */
  async synthesizeCrossAgent(
    responses: Array<{ agentId: SubAgentId; response: string }>,
    originalQuery: string,
    userId: string,
    locale?: string,
  ): Promise<string> {
    return this.subAgent.call(
      'orchestrator',
      'cross_agent_synthesis',
      { responses, originalQuery, locale },
      userId,
      false,
    );
  }

  /**
   * A2→DB: Persist fresh SIGMA sentiment to NewsAnalysis (Spec 38).
   * Updates the most recent NewsAnalysis for this user, or creates a minimal one.
   */
  private async persistSentimentAsAIAnalysis(
    userId: string,
    sentimentResult: string,
  ): Promise<void> {
    // SIGMA returns: { sentiment: number, impact: "positive|negative|neutral", reasoning: string }
    // We also accept the alternate format: { score, overallSentiment, summary, headlines }
    const parsed = safeParseJson<{
      sentiment?: number;
      impact?: string;
      reasoning?: string;
      score?: number;
      overallSentiment?: string;
      summary?: string;
      headlines?: { id: string; sentiment: string; reasoning?: string }[];
    }>(sentimentResult, {});

    // Map SIGMA fields to NewsAnalysis AI fields
    // SIGMA returns sentiment as float (-1 to 1) or integer (-100 to 100)
    let aiScore: number | null = parsed.score ?? null;
    if (aiScore == null && parsed.sentiment != null) {
      aiScore =
        Math.abs(parsed.sentiment) <= 1
          ? Math.round(parsed.sentiment * 100)
          : Math.round(parsed.sentiment);
    }
    const aiOverallSentiment = parsed.overallSentiment ?? parsed.impact ?? null;
    const aiSummary = parsed.summary ?? parsed.reasoning ?? null;

    if (aiScore == null && !aiOverallSentiment) return;

    const latest = await this.prisma.newsAnalysis.findFirst({
      where: { userId },
      orderBy: { analyzedAt: 'desc' },
    });

    const aiData = {
      aiAnalyzedAt: new Date(),
      aiScore,
      aiOverallSentiment,
      aiSummary,
      aiHeadlines: (parsed.headlines as unknown) ?? undefined,
    };

    if (latest) {
      await this.prisma.newsAnalysis.update({
        where: { id: latest.id },
        data: aiData,
      });
    } else {
      await this.prisma.newsAnalysis.create({
        data: {
          userId,
          newsCount: 0,
          positiveCount: 0,
          negativeCount: 0,
          neutralCount: 0,
          score: aiScore ?? 50,
          overallSentiment: aiOverallSentiment ?? 'neutral',
          summary: aiSummary ?? 'AI analysis from trading orchestrator',
          headlines: [],
          ...aiData,
        },
      });
    }

    this.logger.log(
      `A2→DB: Persisted SIGMA sentiment to NewsAnalysis for user=${userId} (score=${aiScore}, sentiment=${aiOverallSentiment})`,
    );
  }
}
