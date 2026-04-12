import { BinanceRestClient } from './binance-rest.client';
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
});
