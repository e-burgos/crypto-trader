export { CryptoPanicFetcher } from './cryptopanic.fetcher';
export type { CryptoPanicConfig } from './cryptopanic.fetcher';

export { CoinGeckoNewsFetcher } from './coingecko.fetcher';

export { RedditFetcher } from './reddit.fetcher';
export type { RedditFetcherConfig } from './reddit.fetcher';

export { RssFetcher } from './rss.fetcher';
export type { RssFetcherConfig } from './rss.fetcher';

export { NewsAggregator } from './news-aggregator';
export type { NewsSource, NewsAggregatorConfig } from './news-source.interface';
export { estimateSentiment, newsItemId } from './news-source.interface';
