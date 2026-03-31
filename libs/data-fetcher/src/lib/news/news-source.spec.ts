import { estimateSentiment, newsItemId } from './news-source.interface';

describe('estimateSentiment', () => {
  it('should detect bullish sentiment', () => {
    expect(estimateSentiment('Bitcoin surges to new record high')).toBe('POSITIVE');
    expect(estimateSentiment('BTC rally continues with institutional adoption')).toBe('POSITIVE');
  });

  it('should detect bearish sentiment', () => {
    expect(estimateSentiment('Bitcoin crashes after regulatory ban')).toBe('NEGATIVE');
    expect(estimateSentiment('Crypto scam leads to massive sell-off')).toBe('NEGATIVE');
  });

  it('should return neutral for ambiguous text', () => {
    expect(estimateSentiment('Bitcoin trading volume stays steady today')).toBe('NEUTRAL');
  });

  it('should handle empty string', () => {
    expect(estimateSentiment('')).toBe('NEUTRAL');
  });
});

describe('newsItemId', () => {
  it('should generate deterministic IDs', () => {
    const id1 = newsItemId('reddit', 'https://reddit.com/post/123');
    const id2 = newsItemId('reddit', 'https://reddit.com/post/123');
    expect(id1).toBe(id2);
  });

  it('should generate different IDs for different URLs', () => {
    const id1 = newsItemId('reddit', 'https://reddit.com/post/123');
    const id2 = newsItemId('reddit', 'https://reddit.com/post/456');
    expect(id1).not.toBe(id2);
  });

  it('should include source prefix', () => {
    const id = newsItemId('coingecko', 'https://example.com');
    expect(id.startsWith('coingecko:')).toBe(true);
  });
});
