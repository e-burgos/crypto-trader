import {
  Candle,
  Balance,
  OrderResult,
  TradeType,
  ExchangeOrderState,
  ExchangeOrderStatus,
} from '@crypto-trader/shared';
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
  { prefix: '/api/v3/openOrders', weight: 6 },
  { prefix: '/api/v3/orderList/oco', method: 'POST', weight: 1 },
  { prefix: '/api/v3/orderList', method: 'GET', weight: 4 },
  { prefix: '/api/v3/orderList', method: 'DELETE', weight: 1 },
  { prefix: '/api/v3/order', method: 'GET', weight: 4 },
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

interface BinanceOrderResponse {
  orderId: number;
  symbol: string;
  side: string;
  status: string;
  price: string;
  origQty?: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  transactTime: number;
  fills?: Array<{ price: string; qty: string; commission: string }>;
}

interface BinanceOrderStatusResponse {
  orderId: number;
  symbol: string;
  status: string;
  type?: string;
  price?: string;
  executedQty?: string;
  cummulativeQuoteQty?: string;
}

interface BinanceOcoOrderReport {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  type?: string;
}

interface BinanceOcoPlaceResponse {
  orderListId: number;
  listClientOrderId: string;
  symbol: string;
  transactionTime: number;
  orders: BinanceOcoOrderReport[];
  orderReports?: BinanceOcoOrderReport[];
}

interface BinanceOcoStatusResponse {
  orderListId: number;
  listOrderStatus: string;
  orders: Array<{ symbol: string; orderId: number; clientOrderId: string }>;
}

export interface BinanceRestConfig {
  apiKey?: string;
  apiSecret?: string;
  testnet?: boolean;
}

export interface TrailingDeltaFilter {
  minTrailingAboveDelta: number;
  maxTrailingAboveDelta: number;
  minTrailingBelowDelta: number;
  maxTrailingBelowDelta: number;
}

export interface SymbolFilters {
  lotSize: { minQty: number; maxQty: number; stepSize: number };
  price: { minPrice: number; maxPrice: number; tickSize: number };
  notional: { minNotional: number; applyToMarket: boolean };
  trailingDelta?: TrailingDeltaFilter;
}

export type OrderValidationCode =
  | 'LOT_SIZE'
  | 'PRICE_FILTER'
  | 'MIN_NOTIONAL'
  | 'PRICE_CROSSES_MARKET'
  | 'TRAILING_DELTA';

export class OrderValidationError extends Error {
  constructor(
    readonly code: OrderValidationCode,
    message: string,
  ) {
    super(message);
    this.name = 'OrderValidationError';
  }
}

export interface OcoOrderResult {
  orderListId: string;
  listClientOrderId: string;
  stopOrderId: string;
  limitOrderId: string;
  symbol: string;
  quantity: number;
  placedAt: Date;
}

export const RETRYABLE_BINANCE_ERROR_CODES: ReadonlySet<number> = new Set([
  -1021, -1001, -1000, -1003,
]);

export function getBinanceErrorCode(error: unknown): number | null {
  const code = (error as { response?: { data?: { code?: unknown } } })
    ?.response?.data?.code;
  return typeof code === 'number' ? code : null;
}

export function isRetryableBinanceErrorCode(code: number | null): boolean {
  return code !== null && RETRYABLE_BINANCE_ERROR_CODES.has(code);
}

export class BinanceRestClient {
  private readonly client: AxiosInstance;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;
  /** Process-level symbol filters cache shared across instances (same base URL) */
  private static readonly symbolFiltersCache = new Map<string, SymbolFilters>();
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
    range?: { startTime?: number; endTime?: number },
  ): Promise<Candle[]> {
    const params: Record<string, unknown> = { symbol, interval, limit };
    if (range?.startTime !== undefined) params['startTime'] = range.startTime;
    if (range?.endTime !== undefined) params['endTime'] = range.endTime;

    const { data } = await this.client.get<unknown[][]>('/api/v3/klines', {
      params,
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
   * Fetch and cache LOT_SIZE, PRICE_FILTER and MIN_NOTIONAL for a symbol.
   */
  async getSymbolFilters(symbol: string): Promise<SymbolFilters> {
    const cacheKey = `${this.client.defaults.baseURL}:${symbol}`;
    const cached = BinanceRestClient.symbolFiltersCache.get(cacheKey);
    if (cached) return cached;

    const { data } = await this.client.get<{
      symbols: Array<{
        symbol: string;
        filters: Array<Record<string, string> & { filterType: string }>;
      }>;
    }>('/api/v3/exchangeInfo', { params: { symbol } });

    const symbolInfo = data.symbols.find((s) => s.symbol === symbol);
    const lotSizeFilter = symbolInfo?.filters.find(
      (f) => f.filterType === 'LOT_SIZE',
    );
    const priceFilter = symbolInfo?.filters.find(
      (f) => f.filterType === 'PRICE_FILTER',
    );
    const notionalFilter = symbolInfo?.filters.find(
      (f) => f.filterType === 'NOTIONAL' || f.filterType === 'MIN_NOTIONAL',
    );
    const trailingDeltaFilter = symbolInfo?.filters.find(
      (f) => f.filterType === 'TRAILING_DELTA',
    );

    const result: SymbolFilters = {
      lotSize: lotSizeFilter
        ? {
            minQty: parseFloat(lotSizeFilter['minQty']),
            maxQty: parseFloat(lotSizeFilter['maxQty']),
            stepSize: parseFloat(lotSizeFilter['stepSize']),
          }
        : { minQty: 0, maxQty: 9e9, stepSize: 1e-8 },
      price: priceFilter
        ? {
            minPrice: parseFloat(priceFilter['minPrice']),
            maxPrice: parseFloat(priceFilter['maxPrice']),
            tickSize: parseFloat(priceFilter['tickSize']),
          }
        : { minPrice: 0, maxPrice: 0, tickSize: 1e-8 },
      notional: notionalFilter
        ? {
            minNotional: parseFloat(
              notionalFilter['minNotional'] ?? notionalFilter['notional'],
            ),
            applyToMarket:
              notionalFilter['applyToMarket'] === 'true' ||
              notionalFilter['applyMinToMarket'] === 'true',
          }
        : { minNotional: 0, applyToMarket: false },
      ...(trailingDeltaFilter
        ? {
            trailingDelta: {
              minTrailingAboveDelta: parseFloat(
                trailingDeltaFilter['minTrailingAboveDelta'],
              ),
              maxTrailingAboveDelta: parseFloat(
                trailingDeltaFilter['maxTrailingAboveDelta'],
              ),
              minTrailingBelowDelta: parseFloat(
                trailingDeltaFilter['minTrailingBelowDelta'],
              ),
              maxTrailingBelowDelta: parseFloat(
                trailingDeltaFilter['maxTrailingBelowDelta'],
              ),
            },
          }
        : {}),
    };

    BinanceRestClient.symbolFiltersCache.set(cacheKey, result);
    return result;
  }

  private stepDecimals(step: number): number {
    return (step.toString().split('.')[1] ?? '').length;
  }

  private floorToStep(value: number, step: number): number {
    const factor = Math.pow(10, this.stepDecimals(step));
    return Math.floor(value * factor) / factor;
  }

  private ceilToStep(value: number, step: number): number {
    const factor = Math.pow(10, this.stepDecimals(step));
    return Math.ceil(value * factor) / factor;
  }

  private formatDecimal(value: number, step: number): string {
    return value.toFixed(this.stepDecimals(step));
  }

  private validateQuantity(
    quantity: number,
    filter: SymbolFilters['lotSize'],
  ): number {
    const adjusted = this.floorToStep(quantity, filter.stepSize);
    if (adjusted <= 0 || adjusted < filter.minQty || adjusted > filter.maxQty) {
      throw new OrderValidationError(
        'LOT_SIZE',
        `Quantity ${quantity} adjusts to ${adjusted}, outside [${filter.minQty}, ${filter.maxQty}] for step ${filter.stepSize}`,
      );
    }
    return adjusted;
  }

  private validatePrice(
    price: number,
    filter: SymbolFilters['price'],
    rounding: 'up' | 'down',
  ): number {
    const adjusted =
      rounding === 'up'
        ? this.ceilToStep(price, filter.tickSize)
        : this.floorToStep(price, filter.tickSize);
    const belowMin = adjusted <= 0 || adjusted < filter.minPrice;
    const aboveMax = filter.maxPrice > 0 && adjusted > filter.maxPrice;
    if (belowMin || aboveMax) {
      throw new OrderValidationError(
        'PRICE_FILTER',
        `Price ${price} adjusts to ${adjusted}, outside [${filter.minPrice}, ${filter.maxPrice}] for tick ${filter.tickSize}`,
      );
    }
    return adjusted;
  }

  private validateNotional(
    price: number,
    quantity: number,
    filter: SymbolFilters['notional'],
  ): void {
    const notional = price * quantity;
    if (notional < filter.minNotional) {
      throw new OrderValidationError(
        'MIN_NOTIONAL',
        `Notional ${notional} is below minimum ${filter.minNotional}`,
      );
    }
  }

  private validateTrailingDelta(
    bips: number,
    filter: TrailingDeltaFilter | undefined,
  ): void {
    if (!filter) {
      throw new OrderValidationError(
        'TRAILING_DELTA',
        `trailingDelta ${bips} was requested but the symbol does not declare a TRAILING_DELTA filter`,
      );
    }
    if (
      bips < filter.minTrailingAboveDelta ||
      bips > filter.maxTrailingAboveDelta
    ) {
      throw new OrderValidationError(
        'TRAILING_DELTA',
        `trailingDelta ${bips} is outside [${filter.minTrailingAboveDelta}, ${filter.maxTrailingAboveDelta}]`,
      );
    }
  }

  private assertBuyPriceCrossesMarket(condition: boolean, message: string): void {
    if (!condition) {
      throw new OrderValidationError('PRICE_CROSSES_MARKET', message);
    }
  }

  private toOrderResult(data: BinanceOrderResponse): OrderResult {
    const executedQty = parseFloat(data.executedQty ?? '0');
    const quoteQty = parseFloat(data.cummulativeQuoteQty ?? '0');
    const avgPrice =
      executedQty > 0 && quoteQty > 0
        ? quoteQty / executedQty
        : parseFloat(data.fills?.[0]?.price ?? data.price ?? '0');

    return {
      orderId: String(data.orderId),
      symbol: data.symbol,
      side: data.side === 'BUY' ? TradeType.BUY : TradeType.SELL,
      price: avgPrice,
      quantity:
        executedQty > 0 ? executedQty : parseFloat(data.origQty ?? '0'),
      status: data.status,
      executedAt: new Date(data.transactTime),
    };
  }

  /**
   * Place a market order.
   */
  async placeMarketOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
  ): Promise<OrderResult> {
    const filters = await this.getSymbolFilters(symbol);
    const adjustedQty = this.floorToStep(quantity, filters.lotSize.stepSize);
    if (adjustedQty <= 0 || adjustedQty < filters.lotSize.minQty) {
      throw new Error(
        `Quantity ${quantity} is below minimum lot size ${filters.lotSize.minQty} for ${symbol}`,
      );
    }
    const qtyStr = this.formatDecimal(adjustedQty, filters.lotSize.stepSize);

    const { data } = await this.signedRequest<BinanceOrderResponse>(
      '/api/v3/order',
      'POST',
      {
        symbol,
        side,
        type: 'MARKET',
        quantity: qtyStr,
      },
    );

    return this.toOrderResult(data);
  }

  /**
   * Place a LIMIT order.
   */
  async placeLimitOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number,
    opts?: { timeInForce?: 'GTC' | 'IOC' | 'FOK'; clientOrderId?: string },
  ): Promise<OrderResult> {
    const filters = await this.getSymbolFilters(symbol);
    const adjustedQty = this.validateQuantity(quantity, filters.lotSize);
    const adjustedPrice = this.validatePrice(price, filters.price, 'down');
    this.validateNotional(adjustedPrice, adjustedQty, filters.notional);

    const { data } = await this.signedRequest<BinanceOrderResponse>(
      '/api/v3/order',
      'POST',
      {
        symbol,
        side,
        type: 'LIMIT',
        timeInForce: opts?.timeInForce ?? 'GTC',
        quantity: this.formatDecimal(adjustedQty, filters.lotSize.stepSize),
        price: this.formatDecimal(adjustedPrice, filters.price.tickSize),
        ...(opts?.clientOrderId
          ? { newClientOrderId: opts.clientOrderId }
          : {}),
      },
    );

    return this.toOrderResult(data);
  }

  /**
   * Place a STOP_LOSS_LIMIT order.
   */
  async placeStopLossLimitOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    stopPrice: number,
    limitPrice: number,
    opts?: { clientOrderId?: string },
  ): Promise<OrderResult> {
    const filters = await this.getSymbolFilters(symbol);
    const rounding = side === 'BUY' ? 'up' : 'down';
    const adjustedQty = this.validateQuantity(quantity, filters.lotSize);
    const adjustedStopPrice = this.validatePrice(
      stopPrice,
      filters.price,
      rounding,
    );
    const adjustedLimitPrice = this.validatePrice(
      limitPrice,
      filters.price,
      rounding,
    );
    this.validateNotional(adjustedLimitPrice, adjustedQty, filters.notional);

    const { data } = await this.signedRequest<BinanceOrderResponse>(
      '/api/v3/order',
      'POST',
      {
        symbol,
        side,
        type: 'STOP_LOSS_LIMIT',
        timeInForce: 'GTC',
        quantity: this.formatDecimal(adjustedQty, filters.lotSize.stepSize),
        price: this.formatDecimal(adjustedLimitPrice, filters.price.tickSize),
        stopPrice: this.formatDecimal(
          adjustedStopPrice,
          filters.price.tickSize,
        ),
        ...(opts?.clientOrderId
          ? { newClientOrderId: opts.clientOrderId }
          : {}),
      },
    );

    return this.toOrderResult(data);
  }

  private parseOcoResult(
    data: BinanceOcoPlaceResponse,
    fallbackSymbol: string,
    quantity: number,
  ): OcoOrderResult {
    const reports = data.orderReports ?? data.orders ?? [];
    const stopOrder = reports.find((o) => o.type === 'STOP_LOSS_LIMIT');
    const limitOrder = reports.find((o) => o.type === 'LIMIT_MAKER');

    return {
      orderListId: String(data.orderListId),
      listClientOrderId: data.listClientOrderId,
      stopOrderId: String(stopOrder?.orderId ?? reports[0]?.orderId ?? ''),
      limitOrderId: String(limitOrder?.orderId ?? reports[1]?.orderId ?? ''),
      symbol: data.symbol ?? fallbackSymbol,
      quantity,
      placedAt: new Date(data.transactionTime),
    };
  }

  /**
   * Place an OCO SELL order (LIMIT_MAKER take-profit + STOP_LOSS_LIMIT stop leg).
   */
  async placeOcoSellOrder(
    symbol: string,
    params: {
      quantity: number;
      takeProfitPrice: number;
      stopPrice: number;
      stopLimitPrice: number;
      listClientOrderId?: string;
      referencePrice?: number;
    },
  ): Promise<OcoOrderResult> {
    const filters = await this.getSymbolFilters(symbol);
    const adjustedQty = this.validateQuantity(params.quantity, filters.lotSize);
    const adjustedTakeProfit = this.validatePrice(
      params.takeProfitPrice,
      filters.price,
      'up',
    );
    const adjustedStopPrice = this.validatePrice(
      params.stopPrice,
      filters.price,
      'down',
    );
    const adjustedStopLimitPrice = this.validatePrice(
      params.stopLimitPrice,
      filters.price,
      'down',
    );

    this.validateNotional(adjustedTakeProfit, adjustedQty, filters.notional);
    this.validateNotional(
      adjustedStopLimitPrice,
      adjustedQty,
      filters.notional,
    );

    if (
      params.referencePrice !== undefined &&
      !(
        adjustedTakeProfit > params.referencePrice &&
        params.referencePrice > adjustedStopPrice
      )
    ) {
      throw new OrderValidationError(
        'PRICE_CROSSES_MARKET',
        `takeProfitPrice ${adjustedTakeProfit} / referencePrice ${params.referencePrice} / stopPrice ${adjustedStopPrice} do not satisfy takeProfit > reference > stop`,
      );
    }

    const priceStep = filters.price.tickSize;

    const { data } = await this.signedRequest<BinanceOcoPlaceResponse>(
      '/api/v3/orderList/oco',
      'POST',
      {
        symbol,
        side: 'SELL',
        quantity: this.formatDecimal(adjustedQty, filters.lotSize.stepSize),
        aboveType: 'LIMIT_MAKER',
        abovePrice: this.formatDecimal(adjustedTakeProfit, priceStep),
        belowType: 'STOP_LOSS_LIMIT',
        belowStopPrice: this.formatDecimal(adjustedStopPrice, priceStep),
        belowPrice: this.formatDecimal(adjustedStopLimitPrice, priceStep),
        belowTimeInForce: 'GTC',
        newOrderRespType: 'FULL',
        ...(params.listClientOrderId
          ? { listClientOrderId: params.listClientOrderId }
          : {}),
      },
    );

    return this.parseOcoResult(data, symbol, adjustedQty);
  }

  private isOrderMissing(error: unknown): boolean {
    return getBinanceErrorCode(error) === -2013;
  }

  private missingOrderStatus(): ExchangeOrderStatus {
    return {
      state: 'MISSING',
      filledLeg: null,
      executedPrice: null,
      executedQuantity: null,
      orderId: null,
    };
  }

  private legForOrderType(type?: string): 'STOP' | 'TAKE_PROFIT' | null {
    if (type === 'STOP_LOSS_LIMIT' || type === 'STOP_LOSS') return 'STOP';
    if (type === 'LIMIT_MAKER' || type === 'TAKE_PROFIT_LIMIT') {
      return 'TAKE_PROFIT';
    }
    return null;
  }

  private mapOrderStatusToState(status: string): ExchangeOrderState {
    if (status === 'FILLED') return 'FILLED';
    if (status === 'NEW' || status === 'PARTIALLY_FILLED') return 'ACTIVE';
    return 'CANCELLED';
  }

  private toExchangeOrderStatus(
    data: BinanceOrderStatusResponse,
  ): ExchangeOrderStatus {
    const state = this.mapOrderStatusToState(data.status);
    const executedQty = parseFloat(data.executedQty ?? '0');
    const quoteQty = parseFloat(data.cummulativeQuoteQty ?? '0');
    const executedPrice =
      state === 'FILLED'
        ? executedQty > 0 && quoteQty > 0
          ? quoteQty / executedQty
          : parseFloat(data.price ?? '0')
        : null;

    return {
      state,
      filledLeg: state === 'FILLED' ? this.legForOrderType(data.type) : null,
      executedPrice,
      executedQuantity: state === 'FILLED' ? executedQty : null,
      orderId: data.orderId != null ? String(data.orderId) : null,
    };
  }

  /**
   * Query the current state of a single order.
   */
  async getOrderStatus(
    symbol: string,
    orderId: string,
  ): Promise<ExchangeOrderStatus> {
    try {
      const { data } = await this.signedRequest<BinanceOrderStatusResponse>(
        '/api/v3/order',
        'GET',
        { symbol, orderId },
      );
      return this.toExchangeOrderStatus(data);
    } catch (error) {
      if (this.isOrderMissing(error)) return this.missingOrderStatus();
      throw error;
    }
  }

  /**
   * Query the current state of an OCO order list, resolving which leg (if any) filled.
   */
  async getOcoStatus(
    symbol: string,
    orderListId: string,
  ): Promise<ExchangeOrderStatus> {
    let listData: BinanceOcoStatusResponse;
    try {
      const { data } = await this.signedRequest<BinanceOcoStatusResponse>(
        '/api/v3/orderList',
        'GET',
        { orderListId },
      );
      listData = data;
    } catch (error) {
      if (this.isOrderMissing(error)) return this.missingOrderStatus();
      throw error;
    }

    if (listData.listOrderStatus === 'EXECUTING') {
      return {
        state: 'ACTIVE',
        filledLeg: null,
        executedPrice: null,
        executedQuantity: null,
        orderId: null,
      };
    }

    if (listData.listOrderStatus === 'ALL_DONE') {
      for (const order of listData.orders) {
        const status = await this.getOrderStatus(
          symbol,
          String(order.orderId),
        );
        if (status.state === 'FILLED') return status;
      }
    }

    return {
      state: 'CANCELLED',
      filledLeg: null,
      executedPrice: null,
      executedQuantity: null,
      orderId: null,
    };
  }

  /**
   * Cancel a single open order.
   */
  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    await this.signedRequest('/api/v3/order', 'DELETE', { symbol, orderId });
  }

  /**
   * Cancel an open OCO order list.
   */
  async cancelOcoOrderList(
    symbol: string,
    orderListId: string,
  ): Promise<void> {
    await this.signedRequest('/api/v3/orderList', 'DELETE', {
      symbol,
      orderListId,
    });
  }

  /**
   * List open orders for a symbol (always scoped to a symbol to keep the request weight at 6).
   */
  async getOpenOrders(
    symbol: string,
  ): Promise<
    Array<{ orderId: string; clientOrderId: string; orderListId: string | null }>
  > {
    const { data } = await this.signedRequest<
      Array<{ orderId: number; clientOrderId: string; orderListId: number }>
    >('/api/v3/openOrders', 'GET', { symbol });

    return data.map((o) => ({
      orderId: String(o.orderId),
      clientOrderId: o.clientOrderId,
      orderListId: o.orderListId > 0 ? String(o.orderListId) : null,
    }));
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
