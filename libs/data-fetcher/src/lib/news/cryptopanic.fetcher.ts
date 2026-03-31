import axios from 'axios';
import { NewsItem } from '@crypto-trader/shared';
import { NewsSource, estimateSentiment, newsItemId } from './news-source.interface';

const CRYPTOPANIC_BASE = 'https://cryptopanic.com/api/free/v1';

export interface CryptoPanicConfig {
  authToken?: string;
  currencies?: string; // e.g. 'BTC,ETH'
}

export class CryptoPanicFetcher implements NewsSource {
  readonly name = 'cryptopanic';
  private readonly authToken?: string;
  private readonly currencies: string;

  constructor(config: CryptoPanicConfig = {}) {
    this.authToken = config.authToken;
    this.currencies = config.currencies ?? 'BTC,ETH';
  }

  async fetch(limit = 20): Promise<NewsItem[]> {
    if (!this.authToken) {
      return []; // CryptoPanic requires auth token
    }

    const { data } = await axios.get(`${CRYPTOPANIC_BASE}/posts/`, {
      params: {
        auth_token: this.authToken,
        currencies: this.currencies,
        kind: 'news',
        public: true,
      },
      timeout: 10000,
    });

    const results = (data.results || []).slice(0, limit);

    return results.map(
      (item: { title: string; url: string; published_at: string }) => {
        const url = item.url || '';
        return {
          id: newsItemId(this.name, url),
          source: this.name,
          headline: item.title || '',
          url,
          sentiment: estimateSentiment(item.title || ''),
          publishedAt: new Date(item.published_at),
          cachedAt: new Date(),
        } satisfies NewsItem;
      },
    );
  }
}
