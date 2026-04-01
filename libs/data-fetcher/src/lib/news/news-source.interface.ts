import { NewsItem, Sentiment } from '@crypto-trader/shared';

export interface NewsSource {
  /** Unique identifier for the source */
  readonly name: string;
  /** Fetch latest news items */
  fetch(limit?: number): Promise<NewsItem[]>;
}

export interface NewsAggregatorConfig {
  /** Maximum age of cached items in seconds (default: 300 = 5min) */
  cacheTtlSeconds?: number;
  /** Maximum items to keep in memory cache (default: 500) */
  maxCacheSize?: number;
}

/**
 * Helper to assign a basic sentiment based on keyword matching.
 * This is a placeholder; real sentiment comes from LLM analysis.
 */
export function estimateSentiment(text: string): Sentiment {
  const lower = text.toLowerCase();

  const bullish = [
    'surge',
    'rally',
    'bullish',
    'soar',
    'gain',
    'up',
    'high',
    'record',
    'breakout',
    'moon',
    'pump',
    'adoption',
    'institutional',
  ];
  const bearish = [
    'crash',
    'bearish',
    'plunge',
    'drop',
    'down',
    'low',
    'sell-off',
    'dump',
    'hack',
    'scam',
    'fraud',
    'ban',
    'regulation',
    'fine',
  ];

  let score = 0;
  for (const word of bullish) {
    if (lower.includes(word)) score++;
  }
  for (const word of bearish) {
    if (lower.includes(word)) score--;
  }

  if (score > 0) return Sentiment.POSITIVE;
  if (score < 0) return Sentiment.NEGATIVE;
  return Sentiment.NEUTRAL;
}

/**
 * Generate a deterministic ID from source + url to deduplicate.
 */
export function newsItemId(source: string, url: string): string {
  return `${source}:${Buffer.from(url).toString('base64url').slice(0, 64)}`;
}
