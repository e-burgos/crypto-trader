import { NewsAggregator } from './news-aggregator';
import { NewsSource } from './news-source.interface';
import { NewsItem } from '@crypto-trader/shared';

function createMockSource(
  name: string,
  items: Partial<NewsItem>[],
): NewsSource {
  return {
    name,
    fetch: vi.fn().mockResolvedValue(
      items.map((item, i) => ({
        id: `${name}:${i}`,
        source: name,
        headline: `Headline ${i}`,
        url: `https://example.com/${name}/${i}`,
        sentiment: 'NEUTRAL',
        publishedAt: new Date(Date.now() - i * 60000),
        cachedAt: new Date(),
        ...item,
      })),
    ),
  };
}

function createFailingSource(name: string): NewsSource {
  return {
    name,
    fetch: vi.fn().mockRejectedValue(new Error('Source unavailable')),
  };
}

describe('NewsAggregator', () => {
  it('should aggregate items from multiple sources', async () => {
    const source1 = createMockSource('source1', [{}, {}]);
    const source2 = createMockSource('source2', [{}, {}, {}]);
    const aggregator = new NewsAggregator([source1, source2], {
      cacheTtlSeconds: 0,
    });

    const items = await aggregator.fetchAll();

    expect(items).toHaveLength(5);
    expect(source1.fetch).toHaveBeenCalled();
    expect(source2.fetch).toHaveBeenCalled();
  });

  it('should deduplicate items by ID', async () => {
    const sharedItem = {
      id: 'shared-id',
      headline: 'Same News',
      url: 'https://example.com/same',
    };
    const source1 = createMockSource('s1', [sharedItem]);
    const source2 = createMockSource('s2', [sharedItem]);
    const aggregator = new NewsAggregator([source1, source2], {
      cacheTtlSeconds: 0,
    });

    const items = await aggregator.fetchAll();

    const sharedItems = items.filter((i) => i.id === 'shared-id');
    expect(sharedItems).toHaveLength(1);
  });

  it('should cache results within TTL', async () => {
    const source = createMockSource('s1', [{}]);
    const aggregator = new NewsAggregator([source], {
      cacheTtlSeconds: 300,
    });

    await aggregator.fetchAll();
    await aggregator.fetchAll(); // should use cache

    expect(source.fetch).toHaveBeenCalledTimes(1);
  });

  it('should force refresh when requested', async () => {
    const source = createMockSource('s1', [{}]);
    const aggregator = new NewsAggregator([source], {
      cacheTtlSeconds: 300,
    });

    await aggregator.fetchAll();
    await aggregator.refresh();

    expect(source.fetch).toHaveBeenCalledTimes(2);
  });

  it('should handle source failures gracefully', async () => {
    const goodSource = createMockSource('good', [{}, {}]);
    const badSource = createFailingSource('bad');
    const aggregator = new NewsAggregator([goodSource, badSource], {
      cacheTtlSeconds: 0,
    });

    const items = await aggregator.fetchAll();

    expect(items).toHaveLength(2); // Only from good source
  });

  it('should sort items newest first', async () => {
    const now = Date.now();
    const source = createMockSource('s1', [
      { publishedAt: new Date(now - 3600000) }, // 1hr ago
      { publishedAt: new Date(now - 60000) }, // 1min ago
      { publishedAt: new Date(now) }, // now
    ]);
    const aggregator = new NewsAggregator([source], {
      cacheTtlSeconds: 0,
    });

    const items = await aggregator.fetchAll();

    expect(
      new Date(items[0].publishedAt).getTime(),
    ).toBeGreaterThanOrEqual(new Date(items[1].publishedAt).getTime());
  });

  it('should evict oldest entries when cache exceeds max size', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: `item-${i}`,
      publishedAt: new Date(Date.now() - i * 60000),
    }));
    const source = createMockSource('s1', items);
    const aggregator = new NewsAggregator([source], {
      cacheTtlSeconds: 0,
      maxCacheSize: 5,
    });

    await aggregator.fetchAll();

    expect(aggregator.cacheSize).toBeLessThanOrEqual(5);
  });

  it('should clear cache', async () => {
    const source = createMockSource('s1', [{}]);
    const aggregator = new NewsAggregator([source], {
      cacheTtlSeconds: 300,
    });

    await aggregator.fetchAll();
    expect(aggregator.cacheSize).toBe(1);

    aggregator.clearCache();
    expect(aggregator.cacheSize).toBe(0);
  });
});
