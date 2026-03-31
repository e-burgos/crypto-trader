import axios from 'axios';
import { NewsItem } from '@crypto-trader/shared';
import { NewsSource, estimateSentiment, newsItemId } from './news-source.interface';

const REDDIT_BASE = 'https://www.reddit.com';

export interface RedditFetcherConfig {
  subreddits?: string[];
}

export class RedditFetcher implements NewsSource {
  readonly name = 'reddit';
  private readonly subreddits: string[];

  constructor(config: RedditFetcherConfig = {}) {
    this.subreddits = config.subreddits ?? ['CryptoCurrency', 'Bitcoin'];
  }

  async fetch(limit = 20): Promise<NewsItem[]> {
    const perSub = Math.ceil(limit / this.subreddits.length);
    const allItems: NewsItem[] = [];

    for (const sub of this.subreddits) {
      try {
        const { data } = await axios.get(
          `${REDDIT_BASE}/r/${sub}/hot.json`,
          {
            params: { limit: perSub },
            timeout: 10000,
            headers: {
              'User-Agent': 'crypto-trader-bot/1.0',
            },
          },
        );

        const posts = data?.data?.children ?? [];
        for (const post of posts) {
          const d = post.data;
          if (!d?.title || d.stickied) continue;
          const url = d.url || `https://reddit.com${d.permalink}`;
          allItems.push({
            id: newsItemId(this.name, url),
            source: `reddit:${sub}`,
            headline: d.title,
            url,
            sentiment: estimateSentiment(d.title),
            publishedAt: new Date(d.created_utc * 1000),
            cachedAt: new Date(),
          });
        }
      } catch {
        // skip failed subreddits silently
      }
    }

    return allItems.slice(0, limit);
  }
}
