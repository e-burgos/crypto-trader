import type { PredictionData } from '@crypto-trader/shared';
import type {
  IDataSourceProvider,
  ProviderConfig,
  DataSourcePayload,
  HealthCheckResult,
  DataSourceCategoryType,
} from './data-source.interface';
import { PredictionsArraySchema } from './schemas';

/**
 * Polymarket — Prediction Markets (crypto & macro)
 * Uses the Gamma API for read-only market data.
 * No API key required for read-only access.
 * Endpoint: GET /markets?limit=50&active=true&closed=false
 *
 * NOTE: Polymarket is geo-restricted in some regions (DNS blocked by ISPs).
 * If DNS doesn't resolve, the provider will gracefully degrade.
 */
export class PolymarketProvider implements IDataSourceProvider {
  readonly name = 'polymarket';
  readonly displayName = 'Polymarket — Prediction Markets';
  readonly category: DataSourceCategoryType = 'PREDICTION';

  async fetchData(
    config: ProviderConfig,
    _apiKey?: string,
  ): Promise<DataSourcePayload> {
    const base = config.baseUrl;

    // Gamma API returns paginated markets — fetch more to have enough after crypto filter
    const response = await this.fetchJSON<ClobMarket[]>(
      `${base}/markets?limit=200&active=true&closed=false`,
    );

    const markets = Array.isArray(response) ? response : [];

    // Filter for markets with volume, activity, AND crypto relevance
    const relevantMarkets = markets
      .filter(
        (m) =>
          m.active &&
          !m.closed &&
          parseFloat(m.volume ?? '0') > 0 &&
          isCryptoRelevant(m.question),
      )
      .sort(
        (a, b) => parseFloat(b.volume ?? '0') - parseFloat(a.volume ?? '0'),
      );

    const data: PredictionData[] = relevantMarkets
      .slice(0, 20)
      .map((market) => {
        // outcomePrices is a JSON string like "[\"0.57\", \"0.43\"]"
        let yesPrice = 0;
        try {
          const prices = JSON.parse(market.outcomePrices ?? '[]');
          yesPrice = parseFloat(prices[0] ?? '0');
        } catch {
          yesPrice = 0;
        }
        return {
          question: market.question,
          probability: Math.min(Math.max(yesPrice, 0), 1),
          volume: parseFloat(market.volume ?? '0'),
          source: 'polymarket',
          endDate: market.endDateIso ?? market.end_date_iso ?? '',
          url: market.slug
            ? `https://polymarket.com/event/${market.slug}`
            : market.condition_id
              ? `https://polymarket.com/event/${market.condition_id}`
              : undefined,
        };
      });

    const parsed = PredictionsArraySchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(
        `Polymarket response validation failed: ${parsed.error.message}`,
      );
    }

    return { type: 'predictions', data: parsed.data };
  }

  async healthCheck(config: ProviderConfig): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const response = await fetch(
        `${config.baseUrl}/markets?limit=1&active=true&closed=false`,
        { signal: AbortSignal.timeout(5_000) },
      );
      return {
        available: response.ok,
        latencyMs: Date.now() - start,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (err) {
      return {
        available: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private async fetchJSON<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Polymarket returned ${response.status} for ${url}`);
    }
    return response.json() as Promise<T>;
  }
}

// ── Polymarket Gamma API response shapes ─────────────────────────────────────

interface ClobMarket {
  condition_id?: string;
  question: string;
  outcomePrices?: string; // JSON string: "[\"0.57\", \"0.43\"]"
  volume?: string;
  active?: boolean;
  closed?: boolean;
  end_date_iso?: string;
  endDateIso?: string;
  volumeNum?: number;
  liquidityNum?: number;
  slug?: string;
}

// ── Crypto relevance filter ──────────────────────────────────────────────────

/**
 * Keywords that are safe to match as substrings (long enough to avoid false positives).
 */
const PHRASE_KEYWORDS = [
  'bitcoin',
  'ethereum',
  'crypto',
  'blockchain',
  'solana',
  'cardano',
  'ripple',
  'dogecoin',
  'binance',
  'coinbase',
  'stablecoin',
  'tether',
  'altcoin',
  'memecoin',
  'chainlink',
  'uniswap',
  'decentralized',
  'polygon',
  'arbitrum',
  'optimism',
  'airdrop',
  'halving',
  'mainnet',
  'testnet',
  'rollup',
  'layer 2',
  'market cap',
  'bull run',
  'bear market',
  'proof of stake',
  'proof of work',
  'base chain',
  'defi',
  'web3',
  'cbdc',
  'staking',
];

/**
 * Short keywords that MUST match as whole words to avoid false positives
 * (e.g. "eth" in "Netherlands", "ada" in "Canada", "sol" in "solution").
 */
const WORD_BOUNDARY_KEYWORDS = [
  'btc',
  'eth',
  'sol',
  'ada',
  'xrp',
  'doge',
  'bnb',
  'nft',
  'usdt',
  'usdc',
  'avax',
  'matic',
  'link',
  'sec',
  'etf',
  'dex',
  'cex',
  'l2',
  'sui',
  'aptos',
];

const WORD_BOUNDARY_REGEX = new RegExp(
  `\\b(${WORD_BOUNDARY_KEYWORDS.join('|')})\\b`,
  'i',
);

function isCryptoRelevant(question: string): boolean {
  const q = question.toLowerCase();
  // Check phrase keywords (substring match is safe for longer words)
  if (PHRASE_KEYWORDS.some((kw) => q.includes(kw))) return true;
  // Check short keywords with word boundaries
  return WORD_BOUNDARY_REGEX.test(q);
}
