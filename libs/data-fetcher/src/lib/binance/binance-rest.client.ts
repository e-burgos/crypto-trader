import { Candle, Balance, OrderResult, TradeType } from '@crypto-trader/shared';
import { CandleInterval } from '@crypto-trader/shared';
import axios, { AxiosInstance } from 'axios';
import { BinanceRateLimiter } from './binance-rate-limiter';

const BINANCE_BASE_URL =
  process.env['BINANCE_BASE_URL'] || 'https://api.binance.com';
// Public data endpoint — kept as env var but no longer used as default.
// api.binance.com serves public klines without auth and has more stable rate limits.
const BINANCE_PUBLIC_URL =
  process.env['BINANCE_PUBLIC_URL'] || 'https://api.binance.com';
const BINANCE_TESTNET_URL = 'https://testnet.binance.vision';

/** Request weights per endpoint as per Binance REST API docs. */
const ENDPOINT_WEIGHTS: Array<{
  prefix: string;
  method?: string;
  weight: number;
}> = [
  { prefix: '/api/v3/account', weight: 20 },
  { prefix: '/api/v3/exchangeInfo', weight: 20 },
  { prefix: '/api/v3/klines', weight: 2 },
  { prefix: '/api/v3/ticker/24hr', weight: 2 },
  { prefix: '/api/v3/ticker/price', weight: 2 },
  { prefix: '/api/v3/order', method: 'POST', weight: 1 },
  { prefix: '/api/v3/order', method: 'DELETE', weight: 1 },
];

function getEndpointWeight(url: string, method: string): number {
  const upperMethod = method.toUpperCase();
  for (const rule of ENDPOINT_WEIGHTS) {
    if (url.startsWith(rule.prefix)) {
      if (!rule.method || rule.method === upperMethod) return rule.weight;
    }
  }
  return 1;
}

export interface BinanceRestConfig {
  apiKey?: string;
  apiSecret?: string;
  testnet?: boolean;
}

interface LotSizeFilter {
  stepSize: number;
  minQty: number;
  maxQty: number;
}

export class BinanceRestClient {
  private readonly client: AxiosInstance;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;
  /** Process-level LOT_SIZE cache shared across instances (same base URL) */
  private static readonly lotSizeCache = new Map<string, LotSizeFilter>();
  /** Process-level rate limiters per base URL (IP-based limit shared by all API keys) */
  private static readonly rateLimiters = new Map<string, BinanceRateLimiter>();
  /** Short-lived ticker price cache to avoid redundant calls within a cycle */
  private static readonly priceCache = new Map<
    string,
    { price: number; expiresAt: number }
  >();
  private static readonly PRICE_CACHE_TTL_MS = 8_000; // 8 seconds

  constructor(config: BinanceRestConfig = {}) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;

    const baseURL = config.testnet
      ? BINANCE_TESTNET_URL
      : config.apiKey
        ? BINANCE_BASE_URL
        : BINANCE_PUBLIC_URL;
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: this.apiKey ? { 'X-MBX-APIKEY': this.apiKey } : {},
    });

    // Retrieve or create the process-level rate limiter for this base URL
    if (!BinanceRestClient.rateLimiters.has(baseURL)) {
      BinanceRestClient.rateLimiters.set(
        baseURL,
        new BinanceRateLimiter(1100, 60_000),
      );
    }
    const rateLimiter = BinanceRestClient.rateLimiters.get(baseURL)!;

    // Request interceptor: wait for a weight slot before each request
    this.client.interceptors.request.use(async (reqConfig) => {
      const weight = getEndpointWeight(
        reqConfig.url ?? '',
        reqConfig.method ?? 'GET',
      );
      (reqConfig as any).__weight = weight;
      await rateLimiter.waitForSlot(weight);
      return reqConfig;
    });

    // Response interceptor: sync local counter with Binance's reported weight
    this.client.interceptors.response.use(
      (response) => {
        const header =
          response.headers['x-mbx-used-weight-1m'] ??
          response.headers['X-MBX-USED-WEIGHT-1M'];
        if (header) {
          const serverUsed = parseInt(header as string, 10);
          if (!isNaN(serverUsed)) {
            rateLimiter.syncUsedWeight(serverUsed);
          }
        }
        return response;
      },
      (error) => {
        // Also sync weight from error responses (Binance often includes the header)
        const errHeaders = (error?.response?.headers ?? {}) as Record<
          string,
          string
        >;
        const weightHeader =
          errHeaders['x-mbx-used-weight-1m'] ??
          errHeaders['X-MBX-USED-WEIGHT-1M'];
        if (weightHeader) {
          const serverUsed = parseInt(weightHeader, 10);
          if (!isNaN(serverUsed)) {
            rateLimiter.syncUsedWeight(serverUsed);
          }
        }

        // On 429: hard-block the limiter for the Retry-After duration
        if (error?.response?.status === 429) {
          const retryAfterHeader = errHeaders['retry-after'];
          const retryAfterSeconds = retryAfterHeader
            ? Math.max(parseInt(retryAfterHeader, 10), 60)
            : 60;
          rateLimiter.blockUntil(Date.now() + retryAfterSeconds * 1_000);
        }

        return Promise.reject(error);
      },
    );
  }

  /**
   * Fetch OHLCV (klines) data from Binance.
   */
  async getKlines(
    symbol: string,
    interval: CandleInterval,
    limit = 200,
  ): Promise<Candle[]> {
    const { data } = await this.client.get<unknown[][]>('/api/v3/klines', {
      params: { symbol, interval, limit },
    });

    return data.map((k) => ({
      openTime: Number(k[0]),
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
      closeTime: Number(k[6]),
    }));
  }

  /**
   * Get current ticker price for a symbol.
   * Results are cached for a short TTL to avoid redundant calls within the same cycle.
   */
  async getTickerPrice(symbol: string): Promise<number> {
    const cacheKey = `${this.client.defaults.baseURL}:${symbol}`;
    const cached = BinanceRestClient.priceCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.price;
    }

    const { data } = await this.client.get<{ price: string }>(
      '/api/v3/ticker/price',
      { params: { symbol } },
    );
    const price = parseFloat(data.price);
    BinanceRestClient.priceCache.set(cacheKey, {
      price,
      expiresAt: Date.now() + BinanceRestClient.PRICE_CACHE_TTL_MS,
    });
    return price;
  }

  /**
   * Get 24hr ticker stats.
   */
  async get24hrStats(
    symbol: string,
  ): Promise<{ priceChange: number; priceChangePct: number; volume: number }> {
    const { data } = await this.client.get<{
      priceChange: string;
      priceChangePercent: string;
      volume: string;
    }>('/api/v3/ticker/24hr', { params: { symbol } });

    return {
      priceChange: parseFloat(data.priceChange),
      priceChangePct: parseFloat(data.priceChangePercent),
      volume: parseFloat(data.volume),
    };
  }

  /**
   * Get account balances (requires API key + secret).
   */
  async getBalances(): Promise<Balance[]> {
    const { data } = await this.signedRequest<{
      balances: Array<{ asset: string; free: string; locked: string }>;
    }>('/api/v3/account');

    return data.balances
      .filter((b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map((b) => ({
        asset: b.asset,
        free: parseFloat(b.free),
        locked: parseFloat(b.locked),
      }));
  }

  /**
   * Fetch and cache the LOT_SIZE filter for a symbol.
   */
  async getLotSizeFilter(symbol: string): Promise<LotSizeFilter> {
    const cacheKey = `${this.client.defaults.baseURL}:${symbol}`;
    const cached = BinanceRestClient.lotSizeCache.get(cacheKey);
    if (cached) return cached;

    const { data } = await this.client.get<{
      symbols: Array<{
        symbol: string;
        filters: Array<{
          filterType: string;
          minQty: string;
          maxQty: string;
          stepSize: string;
        }>;
      }>;
    }>('/api/v3/exchangeInfo', { params: { symbol } });

    const symbolInfo = data.symbols.find((s) => s.symbol === symbol);
    const lotFilter = symbolInfo?.filters.find(
      (f) => f.filterType === 'LOT_SIZE',
    );

    const result: LotSizeFilter = lotFilter
      ? {
          stepSize: parseFloat(lotFilter.stepSize),
          minQty: parseFloat(lotFilter.minQty),
          maxQty: parseFloat(lotFilter.maxQty),
        }
      : { stepSize: 1e-8, minQty: 1e-8, maxQty: 9e9 };

    BinanceRestClient.lotSizeCache.set(cacheKey, result);
    return result;
  }

  /**
   * Floor a quantity to the nearest valid LOT_SIZE step.
   */
  private adjustToLotSize(quantity: number, filter: LotSizeFilter): number {
    const precision = (filter.stepSize.toString().split('.')[1] ?? '').length;
    const factor = Math.pow(10, precision);
    const adjusted = Math.floor(quantity * factor) / factor;
    return adjusted < filter.minQty ? 0 : adjusted;
  }

  /**
   * Place a market order.
   */
  async placeMarketOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
  ): Promise<OrderResult> {
    const lotFilter = await this.getLotSizeFilter(symbol);
    const adjustedQty = this.adjustToLotSize(quantity, lotFilter);
    if (adjustedQty <= 0) {
      throw new Error(
        `Quantity ${quantity} is below minimum lot size ${lotFilter.minQty} for ${symbol}`,
      );
    }
    const precision = (lotFilter.stepSize.toString().split('.')[1] ?? '')
      .length;
    const qtyStr = adjustedQty.toFixed(precision);

    const { data } = await this.signedRequest<{
      orderId: number;
      symbol: string;
      side: string;
      price: string;
      executedQty: string;
      cummulativeQuoteQty: string;
      status: string;
      transactTime: number;
      fills?: Array<{ price: string; qty: string; commission: string }>;
    }>('/api/v3/order', 'POST', {
      symbol,
      side,
      type: 'MARKET',
      quantity: qtyStr,
    });

    // For MARKET orders, `price` is "0.00000000". Derive the real avg fill price.
    const executedQty = parseFloat(data.executedQty);
    const quoteQty = parseFloat(data.cummulativeQuoteQty);
    const avgPrice =
      executedQty > 0 && quoteQty > 0
        ? quoteQty / executedQty
        : parseFloat(data.fills?.[0]?.price ?? data.price);

    return {
      orderId: String(data.orderId),
      symbol: data.symbol,
      side: data.side === 'BUY' ? TradeType.BUY : TradeType.SELL,
      price: avgPrice,
      quantity: executedQty,
      status: data.status,
      executedAt: new Date(data.transactTime),
    };
  }

  /**
   * Sign a request with HMAC SHA256 (Binance requirement for account endpoints).
   */
  private async signedRequest<T>(
    path: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    params: Record<string, string> = {},
  ): Promise<{ data: T }> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API key and secret are required for signed requests');
    }

    const { createHmac } = await import('node:crypto');
    const timestamp = Date.now();
    const queryParams = {
      ...params,
      timestamp: String(timestamp),
      recvWindow: '60000',
    };
    const queryString = new URLSearchParams(queryParams).toString();
    const signature = createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');

    return this.client.request<T>({
      method,
      url: path,
      params: { ...queryParams, signature },
    });
  }
}
