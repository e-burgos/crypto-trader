import {
  BinanceRestClient,
  OrderValidationError,
  getBinanceErrorCode,
  isRetryableBinanceErrorCode,
} from './binance-rest.client';
import axios from 'axios';

vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    request: vi.fn(),
    defaults: { baseURL: 'https://api.binance.com' },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
      __mock: mockAxiosInstance,
    },
  };
});

function getMockClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (axios as any).__mock;
}

describe('BinanceRestClient', () => {
  let client: BinanceRestClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new BinanceRestClient();
  });

  describe('getKlines', () => {
    it('should fetch and parse klines data', async () => {
      const mockKlines = [
        [
          1672531200000,
          '16500.00',
          '16600.00',
          '16400.00',
          '16550.00',
          '100.5',
          1672534799999,
          '1661625.00',
          500,
          '50.25',
          '830812.50',
          '0',
        ],
        [
          1672534800000,
          '16550.00',
          '16700.00',
          '16500.00',
          '16650.00',
          '200.3',
          1672538399999,
          '3336997.50',
          800,
          '100.15',
          '1668498.75',
          '0',
        ],
      ];
      getMockClient().get.mockResolvedValue({ data: mockKlines });

      const result = await client.getKlines('BTCUSDT', '1h', 2);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        openTime: 1672531200000,
        open: 16500,
        high: 16600,
        low: 16400,
        close: 16550,
        volume: 100.5,
        closeTime: 1672534799999,
      });
      expect(getMockClient().get).toHaveBeenCalledWith('/api/v3/klines', {
        params: { symbol: 'BTCUSDT', interval: '1h', limit: 2 },
      });
    });

    it('should propagate errors', async () => {
      getMockClient().get.mockRejectedValue(new Error('Network error'));
      await expect(client.getKlines('BTCUSDT', '1h')).rejects.toThrow(
        'Network error',
      );
    });

    it('should include startTime/endTime when range is passed', async () => {
      getMockClient().get.mockResolvedValue({ data: [] });

      await client.getKlines('BTCUSDT', '1m', 3, {
        startTime: 1000,
        endTime: 2000,
      });

      expect(getMockClient().get).toHaveBeenCalledWith('/api/v3/klines', {
        params: {
          symbol: 'BTCUSDT',
          interval: '1m',
          limit: 3,
          startTime: 1000,
          endTime: 2000,
        },
      });
    });

    it('should omit startTime/endTime when range is not passed', async () => {
      getMockClient().get.mockResolvedValue({ data: [] });

      await client.getKlines('BTCUSDT', '1m', 3);

      expect(getMockClient().get).toHaveBeenCalledWith('/api/v3/klines', {
        params: { symbol: 'BTCUSDT', interval: '1m', limit: 3 },
      });
    });
  });

  describe('getTickerPrice', () => {
    it('should return parsed price', async () => {
      getMockClient().get.mockResolvedValue({
        data: { price: '65432.10' },
      });

      const price = await client.getTickerPrice('BTCUSDT');

      expect(price).toBe(65432.1);
      expect(getMockClient().get).toHaveBeenCalledWith('/api/v3/ticker/price', {
        params: { symbol: 'BTCUSDT' },
      });
    });
  });

  describe('get24hrStats', () => {
    it('should return parsed 24h stats', async () => {
      getMockClient().get.mockResolvedValue({
        data: {
          priceChange: '1500.50',
          priceChangePercent: '2.35',
          volume: '12345.67',
        },
      });

      const stats = await client.get24hrStats('BTCUSDT');

      expect(stats).toEqual({
        priceChange: 1500.5,
        priceChangePct: 2.35,
        volume: 12345.67,
      });
    });
  });

  describe('constructor', () => {
    it('should create without config', () => {
      expect(() => new BinanceRestClient()).not.toThrow();
    });

    it('should accept testnet config', () => {
      const testClient = new BinanceRestClient({ testnet: true });
      expect(testClient).toBeDefined();
    });

    it('should require key+secret for signed requests', async () => {
      const noKeyClient = new BinanceRestClient();
      await expect(noKeyClient.getBalances()).rejects.toThrow(
        'API key and secret are required',
      );
    });
  });

  describe('endpoint weights', () => {
    async function weightFor(url: string, method: string): Promise<number> {
      new BinanceRestClient();
      const interceptor =
        getMockClient().interceptors.request.use.mock.calls.at(-1)[0];
      const cfg = await interceptor({ url, method });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (cfg as any).__weight;
    }

    const cases: Array<[string, string, number]> = [
      ['/api/v3/account', 'GET', 20],
      ['/api/v3/exchangeInfo', 'GET', 20],
      ['/api/v3/klines', 'GET', 2],
      ['/api/v3/ticker/24hr', 'GET', 2],
      ['/api/v3/ticker/price', 'GET', 2],
      ['/api/v3/openOrders', 'GET', 6],
      ['/api/v3/orderList/oco', 'POST', 1],
      ['/api/v3/orderList', 'GET', 4],
      ['/api/v3/orderList', 'DELETE', 1],
      ['/api/v3/order', 'GET', 4],
      ['/api/v3/order', 'POST', 1],
      ['/api/v3/order', 'DELETE', 1],
    ];

    for (const [url, method, expected] of cases) {
      it(`assigns weight ${expected} to ${method} ${url}`, async () => {
        await expect(weightFor(url, method)).resolves.toBe(expected);
      });
    }
  });
});

describe('BinanceRestClient — native orders (cycle-02)', () => {
  let client: BinanceRestClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new BinanceRestClient({
      apiKey: 'test-key',
      apiSecret: 'test-secret',
    });
  });

  function exchangeInfoFixture(
    symbol: string,
    opts: {
      lotSize?: { minQty: string; maxQty: string; stepSize: string };
      priceFilter?: { minPrice: string; maxPrice: string; tickSize: string };
      notional?: {
        minNotional: string;
        filterType?: 'NOTIONAL' | 'MIN_NOTIONAL';
        applyToMarket?: string;
      };
      trailingDelta?: {
        minTrailingAboveDelta: string;
        maxTrailingAboveDelta: string;
        minTrailingBelowDelta: string;
        maxTrailingBelowDelta: string;
      };
      omitFilters?: boolean;
    } = {},
  ) {
    const filters: Array<Record<string, string>> = [];
    if (!opts.omitFilters) {
      filters.push({
        filterType: 'LOT_SIZE',
        minQty: opts.lotSize?.minQty ?? '0.00001000',
        maxQty: opts.lotSize?.maxQty ?? '9000.00000000',
        stepSize: opts.lotSize?.stepSize ?? '0.00001000',
      });
      filters.push({
        filterType: 'PRICE_FILTER',
        minPrice: opts.priceFilter?.minPrice ?? '0.01000000',
        maxPrice: opts.priceFilter?.maxPrice ?? '1000000.00000000',
        tickSize: opts.priceFilter?.tickSize ?? '0.01000000',
      });
      filters.push({
        filterType: opts.notional?.filterType ?? 'NOTIONAL',
        minNotional: opts.notional?.minNotional ?? '10.00000000',
        applyToMarket: opts.notional?.applyToMarket ?? 'true',
      });
      if (opts.trailingDelta) {
        filters.push({
          filterType: 'TRAILING_DELTA',
          minTrailingAboveDelta: opts.trailingDelta.minTrailingAboveDelta,
          maxTrailingAboveDelta: opts.trailingDelta.maxTrailingAboveDelta,
          minTrailingBelowDelta: opts.trailingDelta.minTrailingBelowDelta,
          maxTrailingBelowDelta: opts.trailingDelta.maxTrailingBelowDelta,
        });
      }
    }
    return { symbols: [{ symbol, filters }] };
  }

  function mockExchangeInfo(
    symbol: string,
    opts?: Parameters<typeof exchangeInfoFixture>[1],
  ) {
    getMockClient().get.mockResolvedValueOnce({
      data: exchangeInfoFixture(symbol, opts),
    });
  }

  describe('getSymbolFilters', () => {
    it('parses LOT_SIZE, PRICE_FILTER and NOTIONAL', async () => {
      mockExchangeInfo('GSFUSDT1', {
        lotSize: { minQty: '0.001', maxQty: '900', stepSize: '0.001' },
        priceFilter: { minPrice: '1', maxPrice: '999999', tickSize: '0.1' },
        notional: { minNotional: '15', filterType: 'NOTIONAL' },
      });

      const filters = await client.getSymbolFilters('GSFUSDT1');

      expect(filters).toEqual({
        lotSize: { minQty: 0.001, maxQty: 900, stepSize: 0.001 },
        price: { minPrice: 1, maxPrice: 999999, tickSize: 0.1 },
        notional: { minNotional: 15, applyToMarket: true },
      });
    });

    it('accepts the MIN_NOTIONAL filter name', async () => {
      mockExchangeInfo('GSFUSDT2', {
        notional: { minNotional: '5', filterType: 'MIN_NOTIONAL' },
      });

      const filters = await client.getSymbolFilters('GSFUSDT2');
      expect(filters.notional.minNotional).toBe(5);
    });

    it('caches filters across calls for the same symbol', async () => {
      mockExchangeInfo('GSFUSDT3');

      await client.getSymbolFilters('GSFUSDT3');
      await client.getSymbolFilters('GSFUSDT3');

      expect(getMockClient().get).toHaveBeenCalledTimes(1);
    });

    it('falls back to permissive defaults when the symbol has no filters', async () => {
      mockExchangeInfo('GSFUSDT4', { omitFilters: true });

      const filters = await client.getSymbolFilters('GSFUSDT4');

      expect(filters).toEqual({
        lotSize: { minQty: 0, maxQty: 9e9, stepSize: 1e-8 },
        price: { minPrice: 0, maxPrice: 0, tickSize: 1e-8 },
        notional: { minNotional: 0, applyToMarket: false },
      });
    });

    it('parses the TRAILING_DELTA filter when the symbol declares it', async () => {
      mockExchangeInfo('GSFUSDT5', {
        trailingDelta: {
          minTrailingAboveDelta: '10',
          maxTrailingAboveDelta: '2000',
          minTrailingBelowDelta: '10',
          maxTrailingBelowDelta: '2000',
        },
      });

      const filters = await client.getSymbolFilters('GSFUSDT5');

      expect(filters.trailingDelta).toEqual({
        minTrailingAboveDelta: 10,
        maxTrailingAboveDelta: 2000,
        minTrailingBelowDelta: 10,
        maxTrailingBelowDelta: 2000,
      });
    });

    it('leaves trailingDelta absent when the symbol does not declare the filter', async () => {
      mockExchangeInfo('GSFUSDT6');

      const filters = await client.getSymbolFilters('GSFUSDT6');

      expect(filters.trailingDelta).toBeUndefined();
    });
  });

  describe('placeLimitOrder', () => {
    it('sends the exact LIMIT payload and parses the response', async () => {
      mockExchangeInfo('LIMUSDT1');
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderId: 111,
          symbol: 'LIMUSDT1',
          side: 'BUY',
          type: 'LIMIT',
          status: 'NEW',
          price: '65000.00',
          origQty: '0.10000',
          executedQty: '0.00000',
          cummulativeQuoteQty: '0.00000',
          transactTime: 1700000000000,
        },
      });

      const order = await client.placeLimitOrder(
        'LIMUSDT1',
        'BUY',
        0.1,
        65000,
      );

      const call = getMockClient().request.mock.calls[0][0];
      expect(call.method).toBe('POST');
      expect(call.url).toBe('/api/v3/order');
      expect(call.params).toEqual(
        expect.objectContaining({
          symbol: 'LIMUSDT1',
          side: 'BUY',
          type: 'LIMIT',
          timeInForce: 'GTC',
          quantity: '0.10000',
          price: '65000.00',
        }),
      );
      expect(call.params.newClientOrderId).toBeUndefined();
      expect(call.params.signature).toMatch(/^[0-9a-f]{64}$/);

      expect(order.orderId).toBe('111');
      expect(order.price).toBe(65000);
      expect(order.quantity).toBe(0.1);
    });

    it('includes newClientOrderId and a custom timeInForce when provided', async () => {
      mockExchangeInfo('LIMUSDT6');
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderId: 112,
          symbol: 'LIMUSDT6',
          side: 'SELL',
          status: 'NEW',
          price: '65000.00',
          origQty: '0.10000',
          executedQty: '0.00000',
          cummulativeQuoteQty: '0.00000',
          transactTime: 1700000000000,
        },
      });

      await client.placeLimitOrder('LIMUSDT6', 'SELL', 0.1, 65000, {
        timeInForce: 'IOC',
        clientOrderId: 'my-client-id',
      });

      const call = getMockClient().request.mock.calls[0][0];
      expect(call.params.timeInForce).toBe('IOC');
      expect(call.params.newClientOrderId).toBe('my-client-id');
    });

    it('floors quantity and price to the symbol step/tick before sending', async () => {
      mockExchangeInfo('LIMUSDT5', {
        lotSize: { minQty: '0.001', maxQty: '900', stepSize: '0.001' },
        priceFilter: { minPrice: '0.1', maxPrice: '999999', tickSize: '0.1' },
      });
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderId: 113,
          symbol: 'LIMUSDT5',
          side: 'BUY',
          status: 'NEW',
          price: '99.8',
          origQty: '1.234',
          executedQty: '0.000',
          cummulativeQuoteQty: '0.000',
          transactTime: 1700000000000,
        },
      });

      await client.placeLimitOrder('LIMUSDT5', 'BUY', 1.23456, 99.87);

      const call = getMockClient().request.mock.calls[0][0];
      expect(call.params.quantity).toBe('1.234');
      expect(call.params.price).toBe('99.8');
    });

    it('rejects locally on LOT_SIZE without calling the exchange', async () => {
      mockExchangeInfo('LIMUSDT2', {
        lotSize: { minQty: '1', maxQty: '900', stepSize: '0.001' },
      });

      await expect(
        client.placeLimitOrder('LIMUSDT2', 'BUY', 0.5, 65000),
      ).rejects.toMatchObject({ code: 'LOT_SIZE' });
      await expect(
        client.placeLimitOrder('LIMUSDT2', 'BUY', 0.5, 65000),
      ).rejects.toBeInstanceOf(OrderValidationError);
      expect(getMockClient().request).not.toHaveBeenCalled();
    });

    it('rejects locally on PRICE_FILTER without calling the exchange', async () => {
      mockExchangeInfo('LIMUSDT3', {
        priceFilter: { minPrice: '100', maxPrice: '999999', tickSize: '0.1' },
      });

      await expect(
        client.placeLimitOrder('LIMUSDT3', 'BUY', 1, 50),
      ).rejects.toMatchObject({ code: 'PRICE_FILTER' });
      expect(getMockClient().request).not.toHaveBeenCalled();
    });

    it('rejects locally on MIN_NOTIONAL without calling the exchange', async () => {
      mockExchangeInfo('LIMUSDT4', {
        notional: { minNotional: '1000000', filterType: 'NOTIONAL' },
      });

      await expect(
        client.placeLimitOrder('LIMUSDT4', 'BUY', 1, 100),
      ).rejects.toMatchObject({ code: 'MIN_NOTIONAL' });
      expect(getMockClient().request).not.toHaveBeenCalled();
    });
  });

  describe('placeLimitMakerBuyOrder', () => {
    it('sends the exact LIMIT_MAKER BUY payload without timeInForce', async () => {
      mockExchangeInfo('LMBUSDT1', {
        priceFilter: { minPrice: '0.01', maxPrice: '999999', tickSize: '0.01' },
      });
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderId: 300,
          symbol: 'LMBUSDT1',
          side: 'BUY',
          status: 'NEW',
          price: '46375.00',
          clientOrderId: 'gen-abc',
          executedQty: '0.00000',
          cummulativeQuoteQty: '0.00000',
          transactTime: 1700000000000,
        },
      });

      const result = await client.placeLimitMakerBuyOrder('LMBUSDT1', {
        quantity: 0.2,
        price: 46375,
        referencePrice: 47000,
      });

      const call = getMockClient().request.mock.calls[0][0];
      expect(call.method).toBe('POST');
      expect(call.url).toBe('/api/v3/order');
      expect(call.params).toEqual({
        symbol: 'LMBUSDT1',
        side: 'BUY',
        type: 'LIMIT_MAKER',
        quantity: '0.20000',
        price: '46375.00',
        newOrderRespType: 'FULL',
        timestamp: expect.any(String),
        recvWindow: '60000',
        signature: expect.any(String),
      });
      expect(call.params.timeInForce).toBeUndefined();
      expect(call.params.newClientOrderId).toBeUndefined();

      expect(result).toEqual({
        orderId: '300',
        clientOrderId: 'gen-abc',
        placedAt: new Date(1700000000000),
      });
    });

    it('includes newClientOrderId only when provided', async () => {
      mockExchangeInfo('LMBUSDT2');
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderId: 301,
          symbol: 'LMBUSDT2',
          side: 'BUY',
          status: 'NEW',
          price: '65000.00',
          clientOrderId: 'my-client-id',
          executedQty: '0.00000',
          cummulativeQuoteQty: '0.00000',
          transactTime: 1700000000000,
        },
      });

      await client.placeLimitMakerBuyOrder('LMBUSDT2', {
        quantity: 0.1,
        price: 65000,
        referencePrice: 66000,
        clientOrderId: 'my-client-id',
      });

      const call = getMockClient().request.mock.calls[0][0];
      expect(call.params.newClientOrderId).toBe('my-client-id');
    });

    it('rejects locally on LOT_SIZE without calling the exchange', async () => {
      mockExchangeInfo('LMBUSDT3', {
        lotSize: { minQty: '1', maxQty: '900', stepSize: '0.001' },
      });

      await expect(
        client.placeLimitMakerBuyOrder('LMBUSDT3', {
          quantity: 0.5,
          price: 65000,
          referencePrice: 66000,
        }),
      ).rejects.toMatchObject({ code: 'LOT_SIZE' });
      expect(getMockClient().request).not.toHaveBeenCalled();
    });

    it('rejects locally on PRICE_FILTER without calling the exchange', async () => {
      mockExchangeInfo('LMBUSDT4', {
        priceFilter: { minPrice: '100', maxPrice: '999999', tickSize: '0.1' },
      });

      await expect(
        client.placeLimitMakerBuyOrder('LMBUSDT4', {
          quantity: 1,
          price: 50,
          referencePrice: 60,
        }),
      ).rejects.toMatchObject({ code: 'PRICE_FILTER' });
      expect(getMockClient().request).not.toHaveBeenCalled();
    });

    it('rejects locally on MIN_NOTIONAL without calling the exchange', async () => {
      mockExchangeInfo('LMBUSDT5', {
        notional: { minNotional: '1000000', filterType: 'NOTIONAL' },
      });

      await expect(
        client.placeLimitMakerBuyOrder('LMBUSDT5', {
          quantity: 1,
          price: 100,
          referencePrice: 110,
        }),
      ).rejects.toMatchObject({ code: 'MIN_NOTIONAL' });
      expect(getMockClient().request).not.toHaveBeenCalled();
    });

    it('rejects locally on PRICE_CROSSES_MARKET when price is not below the reference', async () => {
      mockExchangeInfo('LMBUSDT6');

      await expect(
        client.placeLimitMakerBuyOrder('LMBUSDT6', {
          quantity: 0.2,
          price: 108210,
          referencePrice: 77292.81,
        }),
      ).rejects.toMatchObject({ code: 'PRICE_CROSSES_MARKET' });
      expect(getMockClient().request).not.toHaveBeenCalled();
    });
  });

  describe('placeStopLossLimitOrder', () => {
    it('sends the exact STOP_LOSS_LIMIT payload', async () => {
      mockExchangeInfo('SLLUSDT1');
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderId: 200,
          symbol: 'SLLUSDT1',
          side: 'SELL',
          status: 'NEW',
          price: '63000.00',
          origQty: '0.20000',
          executedQty: '0.00000',
          cummulativeQuoteQty: '0.00000',
          transactTime: 1700000000000,
        },
      });

      await client.placeStopLossLimitOrder(
        'SLLUSDT1',
        'SELL',
        0.2,
        63100,
        63000,
      );

      const call = getMockClient().request.mock.calls[0][0];
      expect(call.url).toBe('/api/v3/order');
      expect(call.params).toEqual(
        expect.objectContaining({
          symbol: 'SLLUSDT1',
          side: 'SELL',
          type: 'STOP_LOSS_LIMIT',
          timeInForce: 'GTC',
          quantity: '0.20000',
          price: '63000.00',
          stopPrice: '63100.00',
        }),
      );
    });

    it('rejects locally on MIN_NOTIONAL evaluated on the limit price', async () => {
      mockExchangeInfo('SLLUSDT2', {
        notional: { minNotional: '1000000', filterType: 'NOTIONAL' },
      });

      await expect(
        client.placeStopLossLimitOrder('SLLUSDT2', 'SELL', 1, 100, 99),
      ).rejects.toMatchObject({ code: 'MIN_NOTIONAL' });
      expect(getMockClient().request).not.toHaveBeenCalled();
    });

    it('rounds BUY-side stop and limit prices up to the tick (§2.5 corollary)', async () => {
      mockExchangeInfo('SLLUSDT3', {
        priceFilter: { minPrice: '0.1', maxPrice: '999999', tickSize: '0.1' },
      });
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderId: 201,
          symbol: 'SLLUSDT3',
          side: 'BUY',
          status: 'NEW',
          price: '108310.1',
          origQty: '0.20000',
          executedQty: '0.00000',
          cummulativeQuoteQty: '0.00000',
          transactTime: 1700000000000,
        },
      });

      await client.placeStopLossLimitOrder(
        'SLLUSDT3',
        'BUY',
        0.2,
        108210.03,
        108310.04,
      );

      const call = getMockClient().request.mock.calls[0][0];
      expect(call.params.side).toBe('BUY');
      expect(call.params.stopPrice).toBe('108210.1');
      expect(call.params.price).toBe('108310.1');
    });

    it('still rounds SELL-side stop and limit prices down to the tick (regression)', async () => {
      mockExchangeInfo('SLLUSDT4', {
        priceFilter: { minPrice: '0.1', maxPrice: '999999', tickSize: '0.1' },
      });
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderId: 202,
          symbol: 'SLLUSDT4',
          side: 'SELL',
          status: 'NEW',
          price: '108310.0',
          origQty: '0.20000',
          executedQty: '0.00000',
          cummulativeQuoteQty: '0.00000',
          transactTime: 1700000000000,
        },
      });

      await client.placeStopLossLimitOrder(
        'SLLUSDT4',
        'SELL',
        0.2,
        108210.03,
        108310.04,
      );

      const call = getMockClient().request.mock.calls[0][0];
      expect(call.params.stopPrice).toBe('108210.0');
      expect(call.params.price).toBe('108310.0');
    });

    it('includes trailingDelta when trailingDeltaBips is provided alongside stopPrice', async () => {
      mockExchangeInfo('SLLUSDT5', {
        trailingDelta: {
          minTrailingAboveDelta: '10',
          maxTrailingAboveDelta: '2000',
          minTrailingBelowDelta: '10',
          maxTrailingBelowDelta: '2000',
        },
      });
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderId: 203,
          symbol: 'SLLUSDT5',
          side: 'BUY',
          status: 'NEW',
          price: '108310.00',
          origQty: '0.20000',
          executedQty: '0.00000',
          cummulativeQuoteQty: '0.00000',
          transactTime: 1700000000000,
        },
      });

      await client.placeStopLossLimitOrder(
        'SLLUSDT5',
        'BUY',
        0.2,
        108210,
        108310,
        { trailingDeltaBips: 100 },
      );

      const call = getMockClient().request.mock.calls[0][0];
      expect(call.params.stopPrice).toBe('108210.00');
      expect(call.params.trailingDelta).toBe('100');
    });

    it('omits stopPrice and includes trailingDelta when placed with stopPrice null', async () => {
      mockExchangeInfo('SLLUSDT6', {
        trailingDelta: {
          minTrailingAboveDelta: '10',
          maxTrailingAboveDelta: '2000',
          minTrailingBelowDelta: '10',
          maxTrailingBelowDelta: '2000',
        },
      });
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderId: 204,
          symbol: 'SLLUSDT6',
          side: 'BUY',
          status: 'NEW',
          price: '108310.00',
          origQty: '0.20000',
          executedQty: '0.00000',
          cummulativeQuoteQty: '0.00000',
          transactTime: 1700000000000,
        },
      });

      await client.placeStopLossLimitOrder(
        'SLLUSDT6',
        'BUY',
        0.2,
        null,
        108310,
        { trailingDeltaBips: 100 },
      );

      const call = getMockClient().request.mock.calls[0][0];
      expect(call.params).not.toHaveProperty('stopPrice');
      expect(call.params.trailingDelta).toBe('100');
    });

    it('omits trailingDelta when trailingDeltaBips is not provided', async () => {
      mockExchangeInfo('SLLUSDT7');
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderId: 205,
          symbol: 'SLLUSDT7',
          side: 'SELL',
          status: 'NEW',
          price: '63000.00',
          origQty: '0.20000',
          executedQty: '0.00000',
          cummulativeQuoteQty: '0.00000',
          transactTime: 1700000000000,
        },
      });

      await client.placeStopLossLimitOrder('SLLUSDT7', 'SELL', 0.2, 63100, 63000);

      const call = getMockClient().request.mock.calls[0][0];
      expect(call.params).not.toHaveProperty('trailingDelta');
    });

    it('rejects locally when stopPrice is null and no trailingDeltaBips is given', async () => {
      await expect(
        client.placeStopLossLimitOrder('SLLUSDT8', 'BUY', 0.2, null, 108310),
      ).rejects.toMatchObject({ code: 'PRICE_FILTER' });
      expect(getMockClient().request).not.toHaveBeenCalled();
    });

    it('rejects locally on TRAILING_DELTA when the symbol declares no filter', async () => {
      mockExchangeInfo('SLLUSDT9');

      await expect(
        client.placeStopLossLimitOrder('SLLUSDT9', 'BUY', 0.2, 108210, 108310, {
          trailingDeltaBips: 100,
        }),
      ).rejects.toMatchObject({ code: 'TRAILING_DELTA' });
      expect(getMockClient().request).not.toHaveBeenCalled();
    });

    it('rejects locally on TRAILING_DELTA when the requested bips are out of range', async () => {
      mockExchangeInfo('SLLUSDT10', {
        trailingDelta: {
          minTrailingAboveDelta: '10',
          maxTrailingAboveDelta: '2000',
          minTrailingBelowDelta: '10',
          maxTrailingBelowDelta: '2000',
        },
      });

      await expect(
        client.placeStopLossLimitOrder(
          'SLLUSDT10',
          'BUY',
          0.2,
          108210,
          108310,
          { trailingDeltaBips: 5 },
        ),
      ).rejects.toMatchObject({ code: 'TRAILING_DELTA' });
      expect(getMockClient().request).not.toHaveBeenCalled();
    });
  });

  describe('placeOcoSellOrder', () => {
    it('sends the exact OCO payload and parses both legs from orderReports', async () => {
      mockExchangeInfo('OCOUSDT1', {
        priceFilter: { minPrice: '1', maxPrice: '999999', tickSize: '0.01' },
      });
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderListId: 555,
          listClientOrderId: 'list-abc',
          symbol: 'OCOUSDT1',
          transactionTime: 1700000000000,
          orders: [
            { symbol: 'OCOUSDT1', orderId: 601, clientOrderId: 'c1' },
            { symbol: 'OCOUSDT1', orderId: 602, clientOrderId: 'c2' },
          ],
          orderReports: [
            {
              symbol: 'OCOUSDT1',
              orderId: 601,
              clientOrderId: 'c1',
              type: 'STOP_LOSS_LIMIT',
            },
            {
              symbol: 'OCOUSDT1',
              orderId: 602,
              clientOrderId: 'c2',
              type: 'LIMIT_MAKER',
            },
          ],
        },
      });

      const result = await client.placeOcoSellOrder('OCOUSDT1', {
        quantity: 0.5,
        takeProfitPrice: 71000.123,
        stopPrice: 69000.007,
        stopLimitPrice: 68990.004,
        referencePrice: 70000,
        listClientOrderId: 'list-abc',
      });

      const call = getMockClient().request.mock.calls[0][0];
      expect(call.method).toBe('POST');
      expect(call.url).toBe('/api/v3/orderList/oco');
      expect(call.params).toEqual(
        expect.objectContaining({
          symbol: 'OCOUSDT1',
          side: 'SELL',
          quantity: '0.50000',
          aboveType: 'LIMIT_MAKER',
          abovePrice: '71000.13',
          belowType: 'STOP_LOSS_LIMIT',
          belowStopPrice: '69000.00',
          belowPrice: '68990.00',
          belowTimeInForce: 'GTC',
          newOrderRespType: 'FULL',
          listClientOrderId: 'list-abc',
        }),
      );

      expect(result).toEqual({
        orderListId: '555',
        listClientOrderId: 'list-abc',
        stopOrderId: '601',
        limitOrderId: '602',
        symbol: 'OCOUSDT1',
        quantity: 0.5,
        placedAt: new Date(1700000000000),
      });
    });

    it('succeeds without a referencePrice (cross-market check skipped)', async () => {
      mockExchangeInfo('OCOUSDT4');
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderListId: 556,
          listClientOrderId: 'list-def',
          symbol: 'OCOUSDT4',
          transactionTime: 1700000000000,
          orders: [
            { symbol: 'OCOUSDT4', orderId: 611, clientOrderId: 'c1' },
            { symbol: 'OCOUSDT4', orderId: 612, clientOrderId: 'c2' },
          ],
        },
      });

      await expect(
        client.placeOcoSellOrder('OCOUSDT4', {
          quantity: 0.1,
          takeProfitPrice: 71000,
          stopPrice: 69000,
          stopLimitPrice: 68990,
        }),
      ).resolves.toMatchObject({ orderListId: '556' });
    });

    it('rejects PRICE_CROSSES_MARKET when the reference price does not sit between the legs', async () => {
      mockExchangeInfo('OCOUSDT2');

      await expect(
        client.placeOcoSellOrder('OCOUSDT2', {
          quantity: 0.1,
          takeProfitPrice: 71000,
          stopPrice: 69000,
          stopLimitPrice: 68990,
          referencePrice: 72000,
        }),
      ).rejects.toMatchObject({ code: 'PRICE_CROSSES_MARKET' });
      expect(getMockClient().request).not.toHaveBeenCalled();
    });

    it('rejects MIN_NOTIONAL when the stop leg is below the minimum', async () => {
      mockExchangeInfo('OCOUSDT3', {
        notional: { minNotional: '75', filterType: 'NOTIONAL' },
      });

      await expect(
        client.placeOcoSellOrder('OCOUSDT3', {
          quantity: 0.001,
          takeProfitPrice: 80000,
          stopPrice: 70000,
          stopLimitPrice: 69999,
        }),
      ).rejects.toMatchObject({ code: 'MIN_NOTIONAL' });
      expect(getMockClient().request).not.toHaveBeenCalled();
    });
  });

  describe('placeOcoBuyOrder', () => {
    it('sends the exact OCO BUY payload and parses both legs by type, not array position', async () => {
      mockExchangeInfo('OCOBUSDT1', {
        priceFilter: { minPrice: '1', maxPrice: '999999', tickSize: '1' },
      });
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderListId: 700,
          listClientOrderId: 'list-buy-1',
          symbol: 'OCOBUSDT1',
          transactionTime: 1700000000000,
          orders: [
            { symbol: 'OCOBUSDT1', orderId: 801, clientOrderId: 'below-1' },
            { symbol: 'OCOBUSDT1', orderId: 802, clientOrderId: 'above-1' },
          ],
          orderReports: [
            {
              symbol: 'OCOBUSDT1',
              orderId: 802,
              clientOrderId: 'above-1',
              type: 'STOP_LOSS_LIMIT',
            },
            {
              symbol: 'OCOBUSDT1',
              orderId: 801,
              clientOrderId: 'below-1',
              type: 'LIMIT_MAKER',
            },
          ],
        },
      });

      const result = await client.placeOcoBuyOrder('OCOBUSDT1', {
        quantity: 0.001,
        belowPrice: 46375,
        aboveStopPrice: 108210,
        abovePrice: 108310,
        referencePrice: 77292.81,
        listClientOrderId: 'list-buy-1',
      });

      const call = getMockClient().request.mock.calls[0][0];
      expect(call.method).toBe('POST');
      expect(call.url).toBe('/api/v3/orderList/oco');
      expect(call.params).toEqual({
        symbol: 'OCOBUSDT1',
        side: 'BUY',
        quantity: '0.00100',
        belowType: 'LIMIT_MAKER',
        belowPrice: '46375',
        aboveType: 'STOP_LOSS_LIMIT',
        aboveStopPrice: '108210',
        abovePrice: '108310',
        aboveTimeInForce: 'GTC',
        newOrderRespType: 'FULL',
        listClientOrderId: 'list-buy-1',
        timestamp: expect.any(String),
        recvWindow: '60000',
        signature: expect.any(String),
      });
      expect(call.params.belowTimeInForce).toBeUndefined();
      expect(call.params.aboveTrailingDelta).toBeUndefined();

      expect(result).toEqual({
        orderListId: '700',
        listClientOrderId: 'list-buy-1',
        stopOrderId: '802',
        limitOrderId: '801',
        symbol: 'OCOBUSDT1',
        quantity: 0.001,
        placedAt: new Date(1700000000000),
      });
    });

    it('includes aboveTrailingDelta and belowClientOrderId/aboveClientOrderId when provided', async () => {
      mockExchangeInfo('OCOBUSDT2', {
        priceFilter: { minPrice: '1', maxPrice: '999999', tickSize: '1' },
        trailingDelta: {
          minTrailingAboveDelta: '10',
          maxTrailingAboveDelta: '2000',
          minTrailingBelowDelta: '10',
          maxTrailingBelowDelta: '2000',
        },
      });
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderListId: 701,
          listClientOrderId: 'list-buy-2',
          symbol: 'OCOBUSDT2',
          transactionTime: 1700000000000,
          orders: [
            { symbol: 'OCOBUSDT2', orderId: 811, clientOrderId: 'below-2' },
            { symbol: 'OCOBUSDT2', orderId: 812, clientOrderId: 'above-2' },
          ],
          orderReports: [
            {
              symbol: 'OCOBUSDT2',
              orderId: 811,
              clientOrderId: 'below-2',
              type: 'LIMIT_MAKER',
            },
            {
              symbol: 'OCOBUSDT2',
              orderId: 812,
              clientOrderId: 'above-2',
              type: 'STOP_LOSS_LIMIT',
            },
          ],
        },
      });

      await client.placeOcoBuyOrder('OCOBUSDT2', {
        quantity: 0.001,
        belowPrice: 46375,
        aboveStopPrice: 108210,
        abovePrice: 108310,
        aboveTrailingDeltaBips: 100,
        referencePrice: 77292.81,
        belowClientOrderId: 'below-2',
        aboveClientOrderId: 'above-2',
      });

      const call = getMockClient().request.mock.calls[0][0];
      expect(call.params.aboveTrailingDelta).toBe('100');
      expect(call.params.belowClientOrderId).toBe('below-2');
      expect(call.params.aboveClientOrderId).toBe('above-2');
      expect(call.params.trailingDelta).toBeUndefined();
    });

    it('rejects locally on LOT_SIZE without calling the exchange', async () => {
      mockExchangeInfo('OCOBUSDT3', {
        lotSize: { minQty: '1', maxQty: '900', stepSize: '0.001' },
      });

      await expect(
        client.placeOcoBuyOrder('OCOBUSDT3', {
          quantity: 0.5,
          belowPrice: 46375,
          aboveStopPrice: 108210,
          abovePrice: 108310,
          referencePrice: 77292.81,
        }),
      ).rejects.toMatchObject({ code: 'LOT_SIZE' });
      expect(getMockClient().request).not.toHaveBeenCalled();
    });

    it('rejects locally on PRICE_FILTER without calling the exchange', async () => {
      mockExchangeInfo('OCOBUSDT4', {
        priceFilter: { minPrice: '100000', maxPrice: '999999', tickSize: '1' },
      });

      await expect(
        client.placeOcoBuyOrder('OCOBUSDT4', {
          quantity: 0.1,
          belowPrice: 46375,
          aboveStopPrice: 108210,
          abovePrice: 108310,
          referencePrice: 77292.81,
        }),
      ).rejects.toMatchObject({ code: 'PRICE_FILTER' });
      expect(getMockClient().request).not.toHaveBeenCalled();
    });

    it('rejects locally on MIN_NOTIONAL without calling the exchange', async () => {
      mockExchangeInfo('OCOBUSDT5', {
        notional: { minNotional: '1000000', filterType: 'NOTIONAL' },
      });

      await expect(
        client.placeOcoBuyOrder('OCOBUSDT5', {
          quantity: 0.001,
          belowPrice: 46375,
          aboveStopPrice: 108210,
          abovePrice: 108310,
          referencePrice: 77292.81,
        }),
      ).rejects.toMatchObject({ code: 'MIN_NOTIONAL' });
      expect(getMockClient().request).not.toHaveBeenCalled();
    });

    it('rejects locally on PRICE_CROSSES_MARKET when the reference does not sit between the legs', async () => {
      mockExchangeInfo('OCOBUSDT6');

      await expect(
        client.placeOcoBuyOrder('OCOBUSDT6', {
          quantity: 0.1,
          belowPrice: 46375,
          aboveStopPrice: 108210,
          abovePrice: 108310,
          referencePrice: 200000,
        }),
      ).rejects.toMatchObject({ code: 'PRICE_CROSSES_MARKET' });
      expect(getMockClient().request).not.toHaveBeenCalled();
    });

    it('rejects locally on TRAILING_DELTA when the symbol declares no filter', async () => {
      mockExchangeInfo('OCOBUSDT7');

      await expect(
        client.placeOcoBuyOrder('OCOBUSDT7', {
          quantity: 0.1,
          belowPrice: 46375,
          aboveStopPrice: 108210,
          abovePrice: 108310,
          aboveTrailingDeltaBips: 100,
          referencePrice: 77292.81,
        }),
      ).rejects.toMatchObject({ code: 'TRAILING_DELTA' });
      expect(getMockClient().request).not.toHaveBeenCalled();
    });

    it('rejects locally on TRAILING_DELTA when the requested bips are out of range', async () => {
      mockExchangeInfo('OCOBUSDT8', {
        trailingDelta: {
          minTrailingAboveDelta: '10',
          maxTrailingAboveDelta: '2000',
          minTrailingBelowDelta: '10',
          maxTrailingBelowDelta: '2000',
        },
      });

      await expect(
        client.placeOcoBuyOrder('OCOBUSDT8', {
          quantity: 0.1,
          belowPrice: 46375,
          aboveStopPrice: 108210,
          abovePrice: 108310,
          aboveTrailingDeltaBips: 5,
          referencePrice: 77292.81,
        }),
      ).rejects.toMatchObject({ code: 'TRAILING_DELTA' });
      expect(getMockClient().request).not.toHaveBeenCalled();
    });
  });

  describe('getOrderStatus', () => {
    it('reports FILLED with the executed price/quantity and leg', async () => {
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderId: 700,
          symbol: 'STATUSUSDT',
          status: 'FILLED',
          type: 'STOP_LOSS_LIMIT',
          price: '69000.00',
          executedQty: '0.5',
          cummulativeQuoteQty: '34500.25',
        },
      });

      const status = await client.getOrderStatus('STATUSUSDT', '700');

      expect(status).toEqual({
        state: 'FILLED',
        filledLeg: 'STOP',
        executedPrice: 69000.5,
        executedQuantity: 0.5,
        orderId: '700',
      });
    });

    it('reports ACTIVE for NEW orders', async () => {
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderId: 701,
          symbol: 'STATUSUSDT',
          status: 'NEW',
          executedQty: '0',
          cummulativeQuoteQty: '0',
        },
      });

      const status = await client.getOrderStatus('STATUSUSDT', '701');
      expect(status.state).toBe('ACTIVE');
      expect(status.executedPrice).toBeNull();
    });

    it('reports CANCELLED for CANCELED orders', async () => {
      getMockClient().request.mockResolvedValueOnce({
        data: { orderId: 702, symbol: 'STATUSUSDT', status: 'CANCELED' },
      });

      const status = await client.getOrderStatus('STATUSUSDT', '702');
      expect(status.state).toBe('CANCELLED');
    });

    it('reports MISSING when Binance returns -2013', async () => {
      getMockClient().request.mockRejectedValueOnce({
        response: { data: { code: -2013, msg: 'Order does not exist.' } },
      });

      const status = await client.getOrderStatus('STATUSUSDT', '703');
      expect(status).toEqual({
        state: 'MISSING',
        filledLeg: null,
        executedPrice: null,
        executedQuantity: null,
        orderId: null,
      });
    });

    it('re-throws non-missing errors', async () => {
      const error = { response: { data: { code: -1013, msg: 'Filter' } } };
      getMockClient().request.mockRejectedValueOnce(error);

      await expect(
        client.getOrderStatus('STATUSUSDT', '704'),
      ).rejects.toBe(error);
    });
  });

  describe('getOcoStatus', () => {
    it('reports ACTIVE for an EXECUTING list without querying individual legs', async () => {
      getMockClient().request.mockResolvedValueOnce({
        data: { orderListId: 900, listOrderStatus: 'EXECUTING', orders: [] },
      });

      const status = await client.getOcoStatus('OCOSTATUS', '900');
      expect(status.state).toBe('ACTIVE');
      expect(getMockClient().request).toHaveBeenCalledTimes(1);
    });

    it('resolves the filled leg when the first order is FILLED', async () => {
      getMockClient()
        .request.mockResolvedValueOnce({
          data: {
            orderListId: 901,
            listOrderStatus: 'ALL_DONE',
            orders: [
              { symbol: 'OCOSTATUS', orderId: 911, clientOrderId: 'a' },
              { symbol: 'OCOSTATUS', orderId: 912, clientOrderId: 'b' },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: {
            orderId: 911,
            symbol: 'OCOSTATUS',
            status: 'FILLED',
            type: 'STOP_LOSS_LIMIT',
            executedQty: '1',
            cummulativeQuoteQty: '69000',
          },
        });

      const status = await client.getOcoStatus('OCOSTATUS', '901');

      expect(status.state).toBe('FILLED');
      expect(status.filledLeg).toBe('STOP');
      expect(getMockClient().request).toHaveBeenCalledTimes(2);
    });

    it('falls through to the second leg when the first is not filled', async () => {
      getMockClient()
        .request.mockResolvedValueOnce({
          data: {
            orderListId: 902,
            listOrderStatus: 'ALL_DONE',
            orders: [
              { symbol: 'OCOSTATUS', orderId: 921, clientOrderId: 'a' },
              { symbol: 'OCOSTATUS', orderId: 922, clientOrderId: 'b' },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: {
            orderId: 921,
            symbol: 'OCOSTATUS',
            status: 'EXPIRED',
            type: 'STOP_LOSS_LIMIT',
          },
        })
        .mockResolvedValueOnce({
          data: {
            orderId: 922,
            symbol: 'OCOSTATUS',
            status: 'FILLED',
            type: 'LIMIT_MAKER',
            executedQty: '1',
            cummulativeQuoteQty: '71000',
          },
        });

      const status = await client.getOcoStatus('OCOSTATUS', '902');

      expect(status.state).toBe('FILLED');
      expect(status.filledLeg).toBe('TAKE_PROFIT');
      expect(getMockClient().request).toHaveBeenCalledTimes(3);
    });

    it('reports CANCELLED for a REJECT list', async () => {
      getMockClient().request.mockResolvedValueOnce({
        data: { orderListId: 903, listOrderStatus: 'REJECT', orders: [] },
      });

      const status = await client.getOcoStatus('OCOSTATUS', '903');
      expect(status.state).toBe('CANCELLED');
    });

    it('reports MISSING when Binance returns -2013', async () => {
      getMockClient().request.mockRejectedValueOnce({
        response: { data: { code: -2013 } },
      });

      const status = await client.getOcoStatus('OCOSTATUS', '904');
      expect(status.state).toBe('MISSING');
    });
  });

  describe('getEntryOrderStatus', () => {
    it('reports a loose LIMIT_MAKER entry as FILLED with price/quantity', async () => {
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderId: 1001,
          symbol: 'ENTRYUSDT',
          status: 'FILLED',
          type: 'LIMIT_MAKER',
          origQty: '0.5',
          executedQty: '0.5',
          cummulativeQuoteQty: '23150',
        },
      });

      const status = await client.getEntryOrderStatus('ENTRYUSDT', {
        orderListId: null,
        orderId: '1001',
      });

      expect(status).toEqual({
        state: 'FILLED',
        filledLeg: 'LIMIT',
        executedPrice: 46300,
        executedQuantity: 0.5,
        remainingQuantity: 0,
        partial: false,
        orderId: '1001',
      });
      expect(getMockClient().request).toHaveBeenCalledTimes(1);
    });

    it('reports a partially filled entry as FILLED with partial: true', async () => {
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderId: 1002,
          symbol: 'ENTRYUSDT',
          status: 'PARTIALLY_FILLED',
          type: 'STOP_LOSS_LIMIT',
          origQty: '1',
          executedQty: '0.4',
          cummulativeQuoteQty: '43324',
        },
      });

      const status = await client.getEntryOrderStatus('ENTRYUSDT', {
        orderListId: null,
        orderId: '1002',
      });

      expect(status.state).toBe('FILLED');
      expect(status.partial).toBe(true);
      expect(status.filledLeg).toBe('STOP');
      expect(status.executedQuantity).toBe(0.4);
      expect(status.remainingQuantity).toBe(0.6);
    });

    it('reports RESTING for a loose entry still NEW', async () => {
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderId: 1003,
          symbol: 'ENTRYUSDT',
          status: 'NEW',
          type: 'LIMIT_MAKER',
          origQty: '0.5',
          executedQty: '0',
        },
      });

      const status = await client.getEntryOrderStatus('ENTRYUSDT', {
        orderListId: null,
        orderId: '1003',
      });

      expect(status.state).toBe('RESTING');
      expect(status.partial).toBe(false);
    });

    it('reports MISSING for a loose entry when Binance returns -2013', async () => {
      getMockClient().request.mockRejectedValueOnce({
        response: { data: { code: -2013 } },
      });

      const status = await client.getEntryOrderStatus('ENTRYUSDT', {
        orderListId: null,
        orderId: '1004',
      });

      expect(status.state).toBe('MISSING');
    });

    it('queries only the requested leg when opts.leg is given', async () => {
      getMockClient().request.mockResolvedValueOnce({
        data: {
          orderId: 2002,
          symbol: 'ENTRYOCOUSDT',
          status: 'NEW',
          type: 'STOP_LOSS_LIMIT',
          origQty: '0.2',
          executedQty: '0',
        },
      });

      const status = await client.getEntryOrderStatus(
        'ENTRYOCOUSDT',
        {
          orderListId: '2000',
          orderId: null,
          limitLegOrderId: '2001',
          stopLegOrderId: '2002',
        },
        { leg: 'STOP' },
      );

      expect(status.state).toBe('RESTING');
      expect(getMockClient().request).toHaveBeenCalledTimes(1);
      const call = getMockClient().request.mock.calls[0][0];
      expect(call.params).toEqual(
        expect.objectContaining({
          symbol: 'ENTRYOCOUSDT',
          orderId: '2002',
        }),
      );
    });

    it('queries the list and both legs when opts.leg is not given, and reports the leg that filled', async () => {
      getMockClient()
        .request.mockResolvedValueOnce({
          data: {
            orderListId: 2000,
            listOrderStatus: 'EXECUTING',
            orders: [
              { symbol: 'ENTRYOCOUSDT', orderId: 2001, clientOrderId: 'l' },
              { symbol: 'ENTRYOCOUSDT', orderId: 2002, clientOrderId: 's' },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: {
            orderId: 2001,
            symbol: 'ENTRYOCOUSDT',
            status: 'NEW',
            type: 'LIMIT_MAKER',
            origQty: '0.2',
            executedQty: '0',
          },
        })
        .mockResolvedValueOnce({
          data: {
            orderId: 2002,
            symbol: 'ENTRYOCOUSDT',
            status: 'FILLED',
            type: 'STOP_LOSS_LIMIT',
            origQty: '0.2',
            executedQty: '0.2',
            cummulativeQuoteQty: '21662',
          },
        });

      const status = await client.getEntryOrderStatus('ENTRYOCOUSDT', {
        orderListId: '2000',
        orderId: null,
        limitLegOrderId: '2001',
        stopLegOrderId: '2002',
      });

      expect(status.state).toBe('FILLED');
      expect(status.filledLeg).toBe('STOP');
      expect(status.executedQuantity).toBe(0.2);
      expect(getMockClient().request).toHaveBeenCalledTimes(3);
    });

    it('reports RESTING when the list is EXECUTING and neither leg filled', async () => {
      getMockClient()
        .request.mockResolvedValueOnce({
          data: {
            orderListId: 2003,
            listOrderStatus: 'EXECUTING',
            orders: [
              { symbol: 'ENTRYOCOUSDT', orderId: 2004, clientOrderId: 'l' },
              { symbol: 'ENTRYOCOUSDT', orderId: 2005, clientOrderId: 's' },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: {
            orderId: 2004,
            symbol: 'ENTRYOCOUSDT',
            status: 'NEW',
            type: 'LIMIT_MAKER',
            origQty: '0.2',
            executedQty: '0',
          },
        })
        .mockResolvedValueOnce({
          data: {
            orderId: 2005,
            symbol: 'ENTRYOCOUSDT',
            status: 'NEW',
            type: 'STOP_LOSS_LIMIT',
            origQty: '0.2',
            executedQty: '0',
          },
        });

      const status = await client.getEntryOrderStatus('ENTRYOCOUSDT', {
        orderListId: '2003',
        orderId: null,
        limitLegOrderId: '2004',
        stopLegOrderId: '2005',
      });

      expect(status.state).toBe('RESTING');
    });

    it('reports CANCELLED when the list is ALL_DONE and neither leg filled', async () => {
      getMockClient()
        .request.mockResolvedValueOnce({
          data: {
            orderListId: 2006,
            listOrderStatus: 'ALL_DONE',
            orders: [
              { symbol: 'ENTRYOCOUSDT', orderId: 2007, clientOrderId: 'l' },
              { symbol: 'ENTRYOCOUSDT', orderId: 2008, clientOrderId: 's' },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: {
            orderId: 2007,
            symbol: 'ENTRYOCOUSDT',
            status: 'EXPIRED',
            type: 'LIMIT_MAKER',
          },
        })
        .mockResolvedValueOnce({
          data: {
            orderId: 2008,
            symbol: 'ENTRYOCOUSDT',
            status: 'CANCELED',
            type: 'STOP_LOSS_LIMIT',
          },
        });

      const status = await client.getEntryOrderStatus('ENTRYOCOUSDT', {
        orderListId: '2006',
        orderId: null,
        limitLegOrderId: '2007',
        stopLegOrderId: '2008',
      });

      expect(status.state).toBe('CANCELLED');
    });

    it('reports MISSING for an OCO entry when the list itself returns -2013', async () => {
      getMockClient().request.mockRejectedValueOnce({
        response: { data: { code: -2013 } },
      });

      const status = await client.getEntryOrderStatus('ENTRYOCOUSDT', {
        orderListId: '2009',
        orderId: null,
        limitLegOrderId: '2010',
        stopLegOrderId: '2011',
      });

      expect(status.state).toBe('MISSING');
      expect(getMockClient().request).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelEntryOrder', () => {
    it('sends a DELETE to /api/v3/orderList when orderListId is present', async () => {
      getMockClient().request.mockResolvedValueOnce({ data: {} });

      await client.cancelEntryOrder('ENTRYUSDT', {
        orderListId: '3000',
        orderId: null,
      });

      const call = getMockClient().request.mock.calls[0][0];
      expect(call.method).toBe('DELETE');
      expect(call.url).toBe('/api/v3/orderList');
      expect(call.params).toEqual(
        expect.objectContaining({ symbol: 'ENTRYUSDT', orderListId: '3000' }),
      );
    });

    it('sends a DELETE to /api/v3/order when only orderId is present', async () => {
      getMockClient().request.mockResolvedValueOnce({ data: {} });

      await client.cancelEntryOrder('ENTRYUSDT', {
        orderListId: null,
        orderId: '3001',
      });

      const call = getMockClient().request.mock.calls[0][0];
      expect(call.method).toBe('DELETE');
      expect(call.url).toBe('/api/v3/order');
      expect(call.params).toEqual(
        expect.objectContaining({ symbol: 'ENTRYUSDT', orderId: '3001' }),
      );
    });

    it('resolves without throwing when Binance returns -2013 (already gone)', async () => {
      getMockClient().request.mockRejectedValueOnce({
        response: { data: { code: -2013 } },
      });

      await expect(
        client.cancelEntryOrder('ENTRYUSDT', {
          orderListId: null,
          orderId: '3002',
        }),
      ).resolves.toBeUndefined();
    });

    it('resolves without throwing when Binance returns -2011 (unknown order)', async () => {
      getMockClient().request.mockRejectedValueOnce({
        response: { data: { code: -2011 } },
      });

      await expect(
        client.cancelEntryOrder('ENTRYUSDT', {
          orderListId: '3003',
          orderId: null,
        }),
      ).resolves.toBeUndefined();
    });

    it('re-throws any other error', async () => {
      const error = { response: { data: { code: -1013 } } };
      getMockClient().request.mockRejectedValueOnce(error);

      await expect(
        client.cancelEntryOrder('ENTRYUSDT', {
          orderListId: null,
          orderId: '3004',
        }),
      ).rejects.toBe(error);
    });
  });

  describe('cancelOrder / cancelOcoOrderList', () => {
    it('sends a DELETE to /api/v3/order with symbol and orderId', async () => {
      getMockClient().request.mockResolvedValueOnce({ data: {} });

      await client.cancelOrder('CANCUSDT', '123');

      const call = getMockClient().request.mock.calls[0][0];
      expect(call.method).toBe('DELETE');
      expect(call.url).toBe('/api/v3/order');
      expect(call.params).toEqual(
        expect.objectContaining({ symbol: 'CANCUSDT', orderId: '123' }),
      );
    });

    it('sends a DELETE to /api/v3/orderList with symbol and orderListId', async () => {
      getMockClient().request.mockResolvedValueOnce({ data: {} });

      await client.cancelOcoOrderList('CANCUSDT', '456');

      const call = getMockClient().request.mock.calls[0][0];
      expect(call.method).toBe('DELETE');
      expect(call.url).toBe('/api/v3/orderList');
      expect(call.params).toEqual(
        expect.objectContaining({ symbol: 'CANCUSDT', orderListId: '456' }),
      );
    });
  });

  describe('getOpenOrders', () => {
    it('maps orders and normalizes orderListId -1 to null', async () => {
      getMockClient().request.mockResolvedValueOnce({
        data: [
          { orderId: 1, clientOrderId: 'prot-a', orderListId: 77 },
          { orderId: 2, clientOrderId: 'prot-b', orderListId: -1 },
        ],
      });

      const orders = await client.getOpenOrders('OPENUSDT');

      expect(orders).toEqual([
        { orderId: '1', clientOrderId: 'prot-a', orderListId: '77' },
        { orderId: '2', clientOrderId: 'prot-b', orderListId: null },
      ]);
    });
  });

});

describe('Binance error code classification', () => {
  describe('getBinanceErrorCode', () => {
    it('extracts the numeric code from an axios-shaped error', () => {
      const error = { response: { data: { code: -1021 } } };
      expect(getBinanceErrorCode(error)).toBe(-1021);
    });

    it('returns null when the error has no code', () => {
      expect(getBinanceErrorCode(new Error('boom'))).toBeNull();
      expect(getBinanceErrorCode(undefined)).toBeNull();
      expect(getBinanceErrorCode({ response: { data: {} } })).toBeNull();
    });
  });

  describe('isRetryableBinanceErrorCode', () => {
    it.each([-1021, -1001, -1000, -1003])(
      'treats %i as retryable',
      (code) => {
        expect(isRetryableBinanceErrorCode(code)).toBe(true);
      },
    );

    it.each([-1013, -2010, -2011, -2013])(
      'treats %i as non-retryable',
      (code) => {
        expect(isRetryableBinanceErrorCode(code)).toBe(false);
      },
    );

    it('treats null as non-retryable', () => {
      expect(isRetryableBinanceErrorCode(null)).toBe(false);
    });
  });
});
