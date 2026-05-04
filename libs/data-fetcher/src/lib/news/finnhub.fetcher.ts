import { NewsItem } from '@crypto-trader/shared';
import {
  NewsSource,
  estimateSentiment,
  newsItemId,
} from './news-source.interface';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

export interface FinnhubNewsConfig {
  apiKey: string;
}

interface FinnhubArticle {
  id: number;
  headline: string;
  source: string;
  url: string;
  summary: string;
  datetime: number;
  related: string;
  category: string;
  image: string;
}

export class FinnhubNewsFetcher implements NewsSource {
  readonly name = 'finnhub';
  private readonly apiKey: string;

  constructor(config: FinnhubNewsConfig) {
    this.apiKey = config.apiKey;
  }

  async fetch(limit = 20): Promise<NewsItem[]> {
    const response = await fetch(`${FINNHUB_BASE}/news?category=crypto`, {
      headers: { 'X-Finnhub-Token': this.apiKey },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Finnhub news returned ${response.status}`);
    }

    const articles = (await response.json()) as FinnhubArticle[];

    return articles.slice(0, limit).map((article) => {
      const url = article.url || '';
      const text = `${article.headline} ${article.summary || ''}`;
      return {
        id: newsItemId(this.name, url),
        source: this.name,
        headline: article.headline || '',
        url,
        summary: article.summary?.trim() || undefined,
        sentiment: estimateSentiment(text),
        publishedAt: new Date(article.datetime * 1000),
        cachedAt: new Date(),
      } satisfies NewsItem;
    });
  }
}
