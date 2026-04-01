import { Candle, Balance, OrderResult, TradeType } from '@crypto-trader/shared';
import { CandleInterval } from '@crypto-trader/shared';
import axios, { AxiosInstance } from 'axios';

const BINANCE_BASE_URL = 'https://api.binance.com';
const BINANCE_TESTNET_URL = 'https://testnet.binance.vision';

export interface BinanceRestConfig {
  apiKey?: string;
  apiSecret?: string;
  testnet?: boolean;
}

export class BinanceRestClient {
  private readonly client: AxiosInstance;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;

  constructor(config: BinanceRestConfig = {}) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;

    const baseURL = config.testnet ? BINANCE_TESTNET_URL : BINANCE_BASE_URL;
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: this.apiKey ? { 'X-MBX-APIKEY': this.apiKey } : {},
    });
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
   */
  async getTickerPrice(symbol: string): Promise<number> {
    const { data } = await this.client.get<{ price: string }>(
      '/api/v3/ticker/price',
      { params: { symbol } },
    );
    return parseFloat(data.price);
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
   * Place a market order.
   */
  async placeMarketOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
  ): Promise<OrderResult> {
    const { data } = await this.signedRequest<{
      orderId: number;
      symbol: string;
      side: string;
      price: string;
      executedQty: string;
      status: string;
      transactTime: number;
    }>('/api/v3/order', 'POST', {
      symbol,
      side,
      type: 'MARKET',
      quantity: quantity.toFixed(8),
    });

    return {
      orderId: String(data.orderId),
      symbol: data.symbol,
      side: data.side === 'BUY' ? TradeType.BUY : TradeType.SELL,
      price: parseFloat(data.price),
      quantity: parseFloat(data.executedQty),
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
    const queryParams = { ...params, timestamp: String(timestamp) };
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
