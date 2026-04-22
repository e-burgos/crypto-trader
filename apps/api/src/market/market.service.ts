import { HttpException, Injectable, Logger, Optional } from '@nestjs/common';
import { BinanceRestClient } from '@crypto-trader/data-fetcher';
import {
  CoinGeckoNewsFetcher,
  RssFetcher,
  RedditFetcher,
  NewsDataFetcher,
  NewsAggregator,
} from '@crypto-trader/data-fetcher';
import {
  CandleInterval,
  LLMProvider as SharedLLMProvider,
} from '@crypto-trader/shared';
import { calculateIndicatorSnapshot } from '@crypto-trader/analysis';
import { createLLMProvider } from '@crypto-trader/analysis';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../users/utils/encryption.util';
import {
  NewsApiProvider,
  LLMSource,
  LLMProvider,
} from '../../generated/prisma/enums';
import { LLMUsageService } from '../llm/llm-usage.service';
import { recordCall } from '../llm/provider-health.service';
import { AgentConfigResolverService } from '../agents/agent-config-resolver.service';

const VALID_ASSETS = ['BTC', 'ETH'];
const VALID_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

const FREE_NEWS_SOURCES = [
  {
    id: 'coingecko',
    label: 'CoinGecko News',
    description: 'Free crypto news from CoinGecko API. No API key required.',
    factory: () => new CoinGeckoNewsFetcher(),
  },
  {
    id: 'rss:coindesk',
    label: 'CoinDesk RSS',
    description: 'CoinDesk news via public RSS feed. No API key required.',
    factory: () =>
      new RssFetcher({
        feeds: [
          {
            name: 'coindesk',
            url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
          },
        ],
      }),
  },
  {
    id: 'rss:cointelegraph',
    label: 'CoinTelegraph RSS',
    description: 'CoinTelegraph news via public RSS feed. No API key required.',
    factory: () =>
      new RssFetcher({
        feeds: [
          { name: 'cointelegraph', url: 'https://cointelegraph.com/rss' },
        ],
      }),
  },
  {
    id: 'rss:bitcoinmagazine',
    label: 'Bitcoin Magazine RSS',
    description:
      'Bitcoin Magazine — in-depth Bitcoin news and analysis. No API key required.',
    factory: () =>
      new RssFetcher({
        feeds: [
          { name: 'bitcoinmagazine', url: 'https://bitcoinmagazine.com/feed' },
        ],
      }),
  },
  {
    id: 'rss:theblock',
    label: 'The Block RSS',
    description:
      'The Block — institutional crypto and blockchain news. No API key required.',
    factory: () =>
      new RssFetcher({
        feeds: [{ name: 'theblock', url: 'https://www.theblock.co/rss.xml' }],
      }),
  },
  {
    id: 'rss:beincrypto',
    label: 'BeinCrypto RSS',
    description:
      'BeinCrypto — market news, DeFi, Web3 analysis. No API key required.',
    factory: () =>
      new RssFetcher({
        feeds: [{ name: 'beincrypto', url: 'https://beincrypto.com/feed/' }],
      }),
  },
  {
    id: 'reddit',
    label: 'Reddit',
    description: 'r/CryptoCurrency & r/Bitcoin posts. No API key required.',
    factory: () => new RedditFetcher(),
  },
] as const;

const OPTIONAL_NEWS_SOURCES = [
  {
    id: 'newsdata',
    provider: 'NEWSDATA' as NewsApiProvider,
    label: 'NewsData.io',
    description:
      'REST API with 200 free requests/day. Register at newsdata.io to get your free API key.',
    signupUrl: 'https://newsdata.io',
    factory: (apiKey: string) => new NewsDataFetcher({ apiKey }),
  },
] as const;

@Injectable()
export class MarketService {
  private readonly binance = new BinanceRestClient();
  private readonly logger = new Logger(MarketService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentConfigResolver: AgentConfigResolverService,
    @Optional() private readonly llmUsageService?: LLMUsageService,
  ) {}

  // ── News Config ────────────────────────────────────────────────────────────

  async getNewsConfig(userId: string) {
    const cfg = await this.prisma.newsConfig.findUnique({ where: { userId } });
    if (cfg) return cfg;
    return this.prisma.newsConfig.create({
      data: {
        userId,
        intervalMinutes: 10,
        newsCount: 15,
        enabledSources: [],
        onlySummary: true,
        botEnabled: true,
        newsWeight: 15,
      },
    });
  }

  async updateNewsConfig(
    userId: string,
    data: {
      intervalMinutes?: number;
      newsCount?: number;
      enabledSources?: string[];
      onlySummary?: boolean;
      botEnabled?: boolean;
      newsWeight?: number;
    },
  ) {
    return this.prisma.newsConfig.upsert({
      where: { userId },
      create: {
        userId,
        intervalMinutes: data.intervalMinutes ?? 10,
        newsCount: data.newsCount ?? 15,
        enabledSources: data.enabledSources ?? [],
        onlySummary: data.onlySummary ?? true,
        botEnabled: data.botEnabled ?? true,
        newsWeight: data.newsWeight ?? 15,
      },
      update: data,
    });
  }

  // ── Internal: build sources & fetch news ──────────────────────────────────

  private async buildNewsSources(userId: string, enabledSources: string[]) {
    const all = enabledSources.length === 0;
    const freeSources = FREE_NEWS_SOURCES.filter(
      (s) => all || enabledSources.includes(s.id),
    ).map((s) => s.factory());

    const optionalSources = await Promise.all(
      OPTIONAL_NEWS_SOURCES.map(async (s) => {
        if (!all && !enabledSources.includes(s.id)) return null;
        const cred = await this.prisma.newsApiCredential.findFirst({
          where: { userId, provider: s.provider, isActive: true },
        });
        if (!cred) return null;
        const apiKey = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv);
        return s.factory(apiKey);
      }),
    );

    return [...freeSources, ...optionalSources.filter(Boolean)] as ReturnType<
      (typeof FREE_NEWS_SOURCES)[number]['factory']
    >[];
  }

  // ── News fetch (raw) ───────────────────────────────────────────────────────

  async getNews(userId: string, limit?: number) {
    const cfg = await this.getNewsConfig(userId);
    const count = limit ?? cfg.newsCount;
    const sources = await this.buildNewsSources(userId, cfg.enabledSources);
    const aggregator = new NewsAggregator(sources, { cacheTtlSeconds: 300 });
    const items = await aggregator.fetchAll(Math.min(count, 100));
    return cfg.onlySummary ? items.filter((n) => !!n.summary) : items;
  }

  // ── Keyword sentiment analysis → persists to DB ───────────────────────────

  async runKeywordAnalysis(userId: string) {
    const cfg = await this.getNewsConfig(userId);
    const sources = await this.buildNewsSources(userId, cfg.enabledSources);
    const aggregator = new NewsAggregator(sources, { cacheTtlSeconds: 300 });
    const raw = await aggregator.fetchAll(Math.min(cfg.newsCount, 100));
    const items = cfg.onlySummary ? raw.filter((n) => !!n.summary) : raw;

    const positive = items.filter((n) => n.sentiment === 'POSITIVE').length;
    const negative = items.filter((n) => n.sentiment === 'NEGATIVE').length;
    const neutral = items.filter((n) => n.sentiment === 'NEUTRAL').length;
    const total = items.length;
    const score =
      total > 0 ? Math.round(((positive - negative) / total) * 100) : 0;
    const overallSentiment =
      score > 20 ? 'BULLISH' : score < -20 ? 'BEARISH' : 'NEUTRAL';
    const summary = `${positive} positivas, ${negative} negativas, ${neutral} neutrales — score ${score > 0 ? '+' : ''}${score} sobre ${total} noticias. Sentimiento general: ${overallSentiment}. Análisis keyword-based sobre titulares y resúmenes.`;

    const headlines = items.map((n) => ({
      id: n.id,
      source: n.source,
      headline: n.headline,
      sentiment: n.sentiment as string,
      summary: n.summary ?? null,
      author: n.author ?? null,
      publishedAt: n.publishedAt,
    }));

    // Upsert: preserve AI fields if they exist from a previous AI analysis
    const existing = await this.prisma.newsAnalysis.findFirst({
      where: { userId },
      orderBy: { analyzedAt: 'desc' },
    });

    if (existing) {
      return this.prisma.newsAnalysis.update({
        where: { id: existing.id },
        data: {
          analyzedAt: new Date(),
          newsCount: total,
          positiveCount: positive,
          negativeCount: negative,
          neutralCount: neutral,
          score,
          overallSentiment,
          summary,
          headlines: headlines as any,
          // AI fields are intentionally NOT touched — preserved from previous run
        },
      });
    }

    return this.prisma.newsAnalysis.create({
      data: {
        userId,
        newsCount: total,
        positiveCount: positive,
        negativeCount: negative,
        neutralCount: neutral,
        score,
        overallSentiment,
        summary,
        headlines: headlines as any,
      },
    });
  }

  // ── Get latest persisted analysis ─────────────────────────────────────────

  async getLatestAnalysis(userId: string) {
    return this.prisma.newsAnalysis.findFirst({
      where: { userId },
      orderBy: { analyzedAt: 'desc' },
    });
  }

  // ── AI Sentiment Analysis → updates latest DB record ──────────────────────

  async analyzeSentiment(userId: string) {
    // Resolve SIGMA agent config (market analysis agent)
    const agentCfg = await this.agentConfigResolver.resolveConfig(
      'market',
      userId,
    );
    const provider = agentCfg.provider as string;
    const model = agentCfg.model;
    // Ensure a keyword analysis exists; create one if not
    let analysis = await this.getLatestAnalysis(userId);
    if (!analysis) {
      analysis = await this.runKeywordAnalysis(userId);
    }

    const cfg = await this.getNewsConfig(userId);
    const headlines = (
      analysis.headlines as Array<{
        id: string;
        headline: string;
        summary?: string | null;
        source?: string;
        author?: string | null;
      }>
    ).slice(0, cfg.newsCount);

    const cred = await this.prisma.lLMCredential.findUnique({
      where: { userId_provider: { userId, provider: provider as LLMProvider } },
    });
    if (!cred)
      throw new HttpException(
        `No LLM credential found for provider: ${provider}`,
        400,
      );

    const apiKey = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv);
    const usedModel = model || cred.selectedModel || undefined;
    const llm = createLLMProvider(
      provider as SharedLLMProvider,
      apiKey,
      usedModel,
    );

    const system = `You are a financial news sentiment classifier for cryptocurrency markets.
Analyze each news item and classify its sentiment toward crypto markets.
Always respond with valid JSON only — no markdown, no extra text.

Rules:
- POSITIVE: bullish news, price increases, institutional adoption, positive regulatory news, new highs, partnerships
- NEGATIVE: crashes, hacks, scams, bans, heavy regulation, price drops, security issues, bankruptcies
- NEUTRAL: price tracking, routine updates, educational content, mixed signals
- reasoning: one sentence max (under 100 chars)`;

    const numbered = headlines
      .map((h, i) => {
        const lines = [`${i + 1}. [${h.source ?? ''}] ${h.headline}`];
        if (h.summary) lines.push(`   Summary: ${h.summary.slice(0, 200)}`);
        if (h.author) lines.push(`   Author: ${h.author}`);
        return lines.join('\n');
      })
      .join('\n\n');

    const user = `Classify the sentiment of each news item. Return a JSON array:
[{"index": 1, "sentiment": "POSITIVE"|"NEGATIVE"|"NEUTRAL", "reasoning": "string"}, ...]

News items:
${numbered}`;

    let parsed: { index: number; sentiment: string; reasoning: string }[] = [];
    try {
      const response = await llm.complete(system, user);

      // Track call for health monitoring
      recordCall(userId, provider, true);

      // Log usage for news analysis
      if (this.llmUsageService) {
        this.llmUsageService
          .log({
            userId,
            provider: provider as any,
            model: usedModel ?? 'unknown',
            usage: response.usage,
            source: LLMSource.ANALYSIS,
          })
          .catch(() => {
            /* fire-and-forget */
          });
      }

      // Robust JSON extraction: strip code fences, then extract the JSON array
      let cleaned = response.text.replace(/```(?:json)?\s*/gi, '').trim();
      // Try direct parse first
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Extract the outermost JSON array from the text
        const arrMatch = cleaned.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          cleaned = arrMatch[0];
        }
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          // LLM may have truncated the response — try to repair
          // Find the last complete object (ending with }) and close the array
          const lastCompleteObj = cleaned.lastIndexOf('}');
          if (lastCompleteObj > 0) {
            const repaired = cleaned.substring(0, lastCompleteObj + 1).trim();
            const closedArray = repaired.endsWith(']')
              ? repaired
              : repaired + ']';
            parsed = JSON.parse(closedArray);
          } else {
            this.logger.warn(
              `analyzeSentiment: no '}' found in cleaned response (len=${cleaned.length}): ${cleaned.substring(0, 300)}`,
            );
            throw new Error('No complete JSON object found in LLM response');
          }
        }
      }
    } catch (e) {
      recordCall(
        userId,
        provider,
        false,
        e instanceof Error ? e.message : String(e),
      );
      throw new HttpException(
        `Failed to parse LLM sentiment response: ${e instanceof Error ? e.message : String(e)}`,
        502,
      );
    }

    const validSentiments = new Set(['POSITIVE', 'NEGATIVE', 'NEUTRAL']);
    const aiHeadlines = headlines.map((h, i) => {
      const result = parsed.find((p) => p.index === i + 1);
      const rawSentiment = result?.sentiment?.toUpperCase?.() ?? '';
      const sentiment =
        validSentiments.has(rawSentiment)
          ? (rawSentiment as 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL')
          : 'NEUTRAL';
      return { id: h.id, sentiment, reasoning: result?.reasoning ?? '' };
    });

    const aiPos = aiHeadlines.filter((h) => h.sentiment === 'POSITIVE').length;
    const aiNeg = aiHeadlines.filter((h) => h.sentiment === 'NEGATIVE').length;
    const aiNeu = aiHeadlines.filter((h) => h.sentiment === 'NEUTRAL').length;
    const aiTotal = aiHeadlines.length;
    const aiScore =
      aiTotal > 0 ? Math.round(((aiPos - aiNeg) / aiTotal) * 100) : 0;
    const aiOverall =
      aiScore > 20 ? 'BULLISH' : aiScore < -20 ? 'BEARISH' : 'NEUTRAL';
    const aiSummary = `IA (${provider}${usedModel ? ' / ' + usedModel : ''}): ${aiPos} positivas, ${aiNeg} negativas, ${aiNeu} neutrales — score ${aiScore > 0 ? '+' : ''}${aiScore} sobre ${aiTotal} noticias. Sentimiento: ${aiOverall}.`;

    // Update the existing record with AI results
    return this.prisma.newsAnalysis.update({
      where: { id: analysis.id },
      data: {
        aiAnalyzedAt: new Date(),
        aiProvider: provider,
        aiModel: usedModel ?? null,
        aiPositiveCount: aiPos,
        aiNegativeCount: aiNeg,
        aiNeutralCount: aiNeu,
        aiScore,
        aiOverallSentiment: aiOverall,
        aiSummary,
        aiHeadlines: aiHeadlines as any,
      },
    });
  }

  // ── News Sources status ───────────────────────────────────────────────────

  async getNewsSourcesStatus(userId: string) {
    const freeResults = await Promise.allSettled(
      FREE_NEWS_SOURCES.map(async (s) => {
        const items = await s.factory().fetch(1);
        return items.length > 0;
      }),
    );

    const freeStatuses = FREE_NEWS_SOURCES.map((s, i) => {
      const result = freeResults[i];
      const isReachable =
        result.status === 'fulfilled' && result.value === true;
      const error =
        result.status === 'rejected'
          ? result.reason instanceof Error
            ? result.reason.message
            : String(result.reason)
          : undefined;
      return {
        id: s.id,
        label: s.label,
        description: s.description,
        requiresApiKey: false,
        isActive: true,
        isConfigured: true,
        isReachable,
        signupUrl: undefined as string | undefined,
        error,
      };
    });

    const optionalStatuses = await Promise.all(
      OPTIONAL_NEWS_SOURCES.map(async (s) => {
        const cred = await this.prisma.newsApiCredential.findFirst({
          where: { userId, provider: s.provider, isActive: true },
        });
        const isConfigured = !!cred;
        let isReachable = false;
        let error: string | undefined;
        if (cred) {
          try {
            const apiKey = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv);
            const items = await s.factory(apiKey).fetch(1);
            isReachable = items.length > 0;
          } catch (err) {
            error = err instanceof Error ? err.message : String(err);
          }
        }
        return {
          id: s.id,
          label: s.label,
          description: s.description,
          requiresApiKey: true,
          isActive: isConfigured,
          isConfigured,
          isReachable,
          signupUrl: s.signupUrl,
          error,
        };
      }),
    );

    return [...freeStatuses, ...optionalStatuses];
  }

  // ── OHLCV & Snapshot ──────────────────────────────────────────────────────

  async getOhlcv(asset: string, interval: string, limit = 200) {
    const assetUpper = asset.toUpperCase();
    const intervalClean = interval.toLowerCase();

    if (!VALID_ASSETS.includes(assetUpper)) {
      throw new Error(`Invalid asset: ${asset}. Must be BTC or ETH`);
    }
    if (!VALID_INTERVALS.includes(intervalClean)) {
      throw new Error(
        `Invalid interval: ${interval}. Must be one of ${VALID_INTERVALS.join(', ')}`,
      );
    }

    const symbol = `${assetUpper}USDT`;
    return this.binance.getKlines(
      symbol,
      intervalClean as CandleInterval,
      Math.min(limit, 500),
    );
  }

  async getSnapshot(symbol: string) {
    const VALID_SYMBOLS = ['BTCUSDT', 'BTCUSDC', 'ETHUSDT', 'ETHUSDC'];
    const sym = symbol.toUpperCase();
    if (!VALID_SYMBOLS.includes(sym)) {
      throw new Error(
        `Invalid symbol: ${symbol}. Must be one of ${VALID_SYMBOLS.join(', ')}`,
      );
    }
    const candles = await this.binance.getKlines(
      sym,
      '1h' as CandleInterval,
      200,
    );
    const currentPrice = candles[candles.length - 1]?.close ?? 0;
    const change24h =
      candles.length >= 24
        ? ((candles[candles.length - 1].close -
            candles[candles.length - 25].close) /
            candles[candles.length - 25].close) *
          100
        : 0;
    const snapshot = calculateIndicatorSnapshot(candles);
    return {
      symbol: sym,
      currentPrice: Math.round(currentPrice * 100) / 100,
      change24h: Math.round(change24h * 100) / 100,
      ...snapshot,
    };
  }
}
