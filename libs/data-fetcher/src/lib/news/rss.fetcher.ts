import RssParser from 'rss-parser';
import { NewsItem } from '@crypto-trader/shared';
import {
  NewsSource,
  estimateSentiment,
  newsItemId,
} from './news-source.interface';

export interface RssFetcherConfig {
  feeds?: Array<{ name: string; url: string }>;
}

const DEFAULT_FEEDS = [
  { name: 'coindesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { name: 'cointelegraph', url: 'https://cointelegraph.com/rss' },
];

export class RssFetcher implements NewsSource {
  readonly name = 'rss';
  private readonly feeds: Array<{ name: string; url: string }>;
  private readonly parser: RssParser;

  constructor(config: RssFetcherConfig = {}) {
    this.feeds = config.feeds ?? DEFAULT_FEEDS;
    this.parser = new RssParser({ timeout: 10000 });
  }

  async fetch(limit = 20): Promise<NewsItem[]> {
    const allItems: NewsItem[] = [];
    const perFeed = Math.ceil(limit / this.feeds.length);

    for (const feed of this.feeds) {
      try {
        const parsed = await this.parser.parseURL(feed.url);
        const items = (parsed.items || []).slice(0, perFeed);

        for (const item of items) {
          const url = item.link || '';
          const snippet = item.contentSnippet?.trim() || '';
          allItems.push({
            id: newsItemId(`rss:${feed.name}`, url),
            source: `rss:${feed.name}`,
            headline: item.title || '',
            url,
            summary: snippet || undefined,
            author: (item as { creator?: string }).creator?.trim() || undefined,
            sentiment: estimateSentiment(`${item.title || ''} ${snippet}`),
            publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            cachedAt: new Date(),
          });
        }
      } catch {
        // skip failed feeds silently
      }
    }

    return allItems.slice(0, limit);
  }
}
