import type { NewsWithSentiment } from '@crypto-trader/shared';
import type {
  IDataSourceProvider,
  ProviderConfig,
  DataSourcePayload,
  HealthCheckResult,
  DataSourceCategoryType,
} from './data-source.interface';
import { NewsArraySchema } from './schemas';

/**
 * Finnhub — Crypto News with NLP Sentiment
 * Requires API key (free tier: 60 calls/min).
 * Endpoint: GET /news?category=crypto&token={key}
 */
export class FinnhubProvider implements IDataSourceProvider {
  readonly name = 'finnhub';
  readonly displayName = 'Finnhub — Noticias + Sentimiento NLP';
  readonly category: DataSourceCategoryType = 'NEWS';

  async fetchData(
    config: ProviderConfig,
    apiKey?: string,
  ): Promise<DataSourcePayload> {
    if (!apiKey) {
      throw new Error('Finnhub requires an API key');
    }

    const url = `${config.baseUrl}/news?category=crypto`;
    const response = await fetch(url, {
      headers: { 'X-Finnhub-Token': apiKey },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Finnhub returned ${response.status}`);
    }

    const articles = (await response.json()) as FinnhubArticle[];

    const data: NewsWithSentiment[] = articles.slice(0, 20).map((article) => {
      const sentimentScore = normalizeSentiment(
        article.sentiment,
        article.headline,
        article.summary || '',
      );
      return {
        headline: article.headline,
        source: article.source,
        url: article.url,
        publishedAt: new Date(article.datetime * 1000).toISOString(),
        sentiment: sentimentScore,
        sentimentLabel: classifySentiment(sentimentScore),
        relatedSymbols: extractSymbols(article.related),
      };
    });

    const parsed = NewsArraySchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(
        `Finnhub response validation failed: ${parsed.error.message}`,
      );
    }

    return { type: 'news', data: parsed.data };
  }

  async healthCheck(config: ProviderConfig): Promise<HealthCheckResult> {
    const start = Date.now();
    // Health check without API key just checks if the host is reachable
    try {
      const response = await fetch(`${config.baseUrl}/news?category=crypto`, {
        signal: AbortSignal.timeout(5_000),
      });
      // Finnhub returns 401 without a key, which means server is reachable
      return {
        available: response.status === 200 || response.status === 401,
        latencyMs: Date.now() - start,
        error:
          response.status !== 200 && response.status !== 401
            ? `HTTP ${response.status}`
            : undefined,
      };
    } catch (err) {
      return {
        available: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Keyword-based sentiment analysis as a fallback when Finnhub doesn't provide
 * sentiment scores (free tier /news endpoint).
 * Returns a value between -1 and 1.
 */
const POSITIVE_KEYWORDS = [
  'rally',
  'surge',
  'soar',
  'bullish',
  'gain',
  'pump',
  'breakout',
  'moon',
  'all-time high',
  'ath',
  'record',
  'boost',
  'recover',
  'uptrend',
  'growth',
  'adoption',
  'partnership',
  'launch',
  'upgrade',
  'approval',
  'etf approved',
  'institutional',
  'accumulate',
  'outperform',
  'spike',
];

const NEGATIVE_KEYWORDS = [
  'crash',
  'plunge',
  'dump',
  'bearish',
  'drop',
  'fall',
  'collapse',
  'hack',
  'exploit',
  'scam',
  'fraud',
  'ban',
  'crackdown',
  'regulation',
  'lawsuit',
  'fine',
  'sell-off',
  'selloff',
  'liquidat',
  'fear',
  'panic',
  'decline',
  'downtrend',
  'bankrupt',
  'insolvent',
  'sec charges',
  'rug pull',
];

function analyzeSentimentFromText(headline: string, summary: string): number {
  const text = `${headline} ${summary}`.toLowerCase();
  let score = 0;
  for (const kw of POSITIVE_KEYWORDS) {
    if (text.includes(kw)) score += 0.3;
  }
  for (const kw of NEGATIVE_KEYWORDS) {
    if (text.includes(kw)) score -= 0.3;
  }
  // Clamp to [-1, 1]
  return Math.max(-1, Math.min(1, score));
}

function normalizeSentiment(
  raw: number | undefined | null,
  headline: string,
  summary: string,
): number {
  if (raw != null && raw !== 0) {
    // Finnhub sentiment is already -1 to 1 range
    return Math.max(-1, Math.min(1, raw));
  }
  // Fallback: keyword-based analysis
  return analyzeSentimentFromText(headline, summary);
}

function classifySentiment(value: number): string {
  if (value > 0.2) return 'positive';
  if (value < -0.2) return 'negative';
  return 'neutral';
}

function extractSymbols(related: string | undefined): string[] {
  if (!related) return [];
  return related
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

// ── Finnhub response shape ───────────────────────────────────────────────────

interface FinnhubArticle {
  category: string;
  datetime: number; // UNIX seconds
  headline: string;
  id: number;
  image: string;
  related: string; // comma-separated symbols
  source: string;
  summary: string;
  url: string;
  sentiment?: number;
}
