import axios from 'axios';
import { NewsItem } from '@crypto-trader/shared';
import { NewsSource, estimateSentiment, newsItemId } from './news-source.interface';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

export class CoinGeckoNewsFetcher implements NewsSource {
  readonly name = 'coingecko';

  async fetch(limit = 20): Promise<NewsItem[]> {
    const { data } = await axios.get(`${COINGECKO_BASE}/news`, {
      params: { per_page: limit },
      timeout: 10000,
    });

    const articles = (data.data || []).slice(0, limit);

    return articles.map(
      (item: {
        title: string;
        url: string;
        updated_at: number;
        description: string;
      }) => {
        const url = item.url || '';
        return {
          id: newsItemId(this.name, url),
          source: this.name,
          headline: item.title || '',
          url,
          sentiment: estimateSentiment(
            `${item.title || ''} ${item.description || ''}`,
          ),
          publishedAt: new Date(item.updated_at * 1000),
          cachedAt: new Date(),
        } satisfies NewsItem;
      },
    );
  }
}
