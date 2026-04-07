import axios from 'axios';
import { NewsItem } from '@crypto-trader/shared';
import {
  NewsSource,
  estimateSentiment,
  newsItemId,
} from './news-source.interface';

const NEWSDATA_BASE = 'https://newsdata.io/api/1';

export interface NewsDataConfig {
  apiKey: string;
}

export class NewsDataFetcher implements NewsSource {
  readonly name = 'newsdata';
  private readonly apiKey: string;

  constructor(config: NewsDataConfig) {
    this.apiKey = config.apiKey;
  }

  async fetch(limit = 20): Promise<NewsItem[]> {
    const { data } = await axios.get(`${NEWSDATA_BASE}/news`, {
      params: {
        apikey: this.apiKey,
        language: 'en',
        q: 'crypto OR bitcoin OR ethereum',
        size: Math.min(limit, 50),
      },
      timeout: 10000,
    });

    const articles = (data.results || []).slice(0, limit);

    return articles.map(
      (item: {
        title: string;
        link: string;
        pubDate: string;
        description: string | null;
        creator?: string[];
      }) => {
        const url = item.link || '';
        const snippet = item.description?.trim() || '';
        return {
          id: newsItemId(this.name, url),
          source: this.name,
          headline: item.title || '',
          url,
          summary: snippet || undefined,
          author: item.creator?.[0]?.trim() || undefined,
          sentiment: estimateSentiment(`${item.title || ''} ${snippet}`),
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          cachedAt: new Date(),
        } satisfies NewsItem;
      },
    );
  }
}
