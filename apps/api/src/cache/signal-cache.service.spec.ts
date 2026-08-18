import {
  SignalCacheService,
  SIGNAL_TTL_TECHNICAL_MS,
  SIGNAL_TTL_MACRO_MS,
  SIGNAL_TTL_NEWS_MS,
  buildTechnicalSignalKey,
  buildMacroSignalKey,
  buildNewsSignalKey,
} from './signal-cache.service';
import { InMemorySharedCache } from './in-memory-shared-cache.service';
import { SharedCachePort } from './shared-cache.port';

function createMockPort(): jest.Mocked<SharedCachePort> {
  return {
    getOrCompute: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    invalidate: jest.fn(),
  };
}

describe('SignalCacheService', () => {
  const originalFlag = process.env.SHARED_SIGNAL_CACHE_ENABLED;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.SHARED_SIGNAL_CACHE_ENABLED;
    } else {
      process.env.SHARED_SIGNAL_CACHE_ENABLED = originalFlag;
    }
  });

  describe('key builders', () => {
    it('build keys from asset, pair and timeframe only — no userId', () => {
      expect(buildTechnicalSignalKey('BTC', 'USDT', '1h')).toBe(
        'sig:v1:tech:BTC:USDT:1h',
      );
      expect(buildMacroSignalKey('BTC', 'USDT', '1h')).toBe(
        'sig:v1:macro:BTC:USDT:1h',
      );
      expect(buildNewsSignalKey('BTC', 'USDT', 'fp-123')).toBe(
        'sig:v1:news:BTC:USDT:fp-123',
      );
    });
  });

  describe('flag disabled (default) — pass-through', () => {
    it('never touches the shared cache port and always invokes compute', async () => {
      delete process.env.SHARED_SIGNAL_CACHE_ENABLED;
      const port = createMockPort();
      const service = new SignalCacheService(port);
      const compute = jest.fn().mockResolvedValue('raw-output');

      const result = await service.getOrComputeTechnical(
        'BTC',
        'USDT',
        '1h',
        compute,
      );

      expect(result).toBe('raw-output');
      expect(compute).toHaveBeenCalledTimes(1);
      expect(port.getOrCompute).not.toHaveBeenCalled();
    });

    it('behaves the same for macro and news signals', async () => {
      process.env.SHARED_SIGNAL_CACHE_ENABLED = 'false';
      const port = createMockPort();
      const service = new SignalCacheService(port);

      await service.getOrComputeMacro('BTC', 'USDT', '1h', () =>
        Promise.resolve('m'),
      );
      await service.getOrComputeNews('BTC', 'USDT', 'fp', () =>
        Promise.resolve('n'),
      );

      expect(port.getOrCompute).not.toHaveBeenCalled();
    });
  });

  describe('flag enabled — shared across bots and users', () => {
    beforeEach(() => {
      process.env.SHARED_SIGNAL_CACHE_ENABLED = 'true';
    });

    it('two simulated users on the same (asset, pair, timeframe) share one computation', async () => {
      const cache = new InMemorySharedCache();
      const serviceForUserA = new SignalCacheService(cache);
      const serviceForUserB = new SignalCacheService(cache);
      let calls = 0;
      const computeForUserA = () => {
        calls++;
        return Promise.resolve('computed-once');
      };
      const computeForUserB = () => {
        calls++;
        return Promise.resolve('computed-once');
      };

      const [resultA, resultB] = await Promise.all([
        serviceForUserA.getOrComputeTechnical(
          'BTC',
          'USDT',
          '1h',
          computeForUserA,
        ),
        serviceForUserB.getOrComputeTechnical(
          'BTC',
          'USDT',
          '1h',
          computeForUserB,
        ),
      ]);

      expect(calls).toBe(1);
      expect(resultA).toBe('computed-once');
      expect(resultB).toBe('computed-once');
    });

    it('does not fold userId into the cache key even when called per-user', async () => {
      const cache = new InMemorySharedCache();
      const getOrComputeSpy = jest.spyOn(cache, 'getOrCompute');
      const service = new SignalCacheService(cache);

      await service.getOrComputeTechnical('BTC', 'USDT', '1h', () =>
        Promise.resolve('x'),
      );

      const [key] = getOrComputeSpy.mock.calls[0];
      expect(key).toBe('sig:v1:tech:BTC:USDT:1h');
      expect(key).not.toMatch(/user/i);
    });

    it('routes technical, macro and news signals through their own TTL, macro the largest', async () => {
      const port = createMockPort();
      port.getOrCompute.mockImplementation((_key, _ttl, compute) => compute());
      const service = new SignalCacheService(port);

      await service.getOrComputeTechnical('BTC', 'USDT', '1h', () =>
        Promise.resolve('t'),
      );
      await service.getOrComputeMacro('BTC', 'USDT', '1h', () =>
        Promise.resolve('m'),
      );
      await service.getOrComputeNews('BTC', 'USDT', 'fp', () =>
        Promise.resolve('n'),
      );

      expect(port.getOrCompute).toHaveBeenNthCalledWith(
        1,
        buildTechnicalSignalKey('BTC', 'USDT', '1h'),
        SIGNAL_TTL_TECHNICAL_MS,
        expect.any(Function),
      );
      expect(port.getOrCompute).toHaveBeenNthCalledWith(
        2,
        buildMacroSignalKey('BTC', 'USDT', '1h'),
        SIGNAL_TTL_MACRO_MS,
        expect.any(Function),
      );
      expect(port.getOrCompute).toHaveBeenNthCalledWith(
        3,
        buildNewsSignalKey('BTC', 'USDT', 'fp'),
        SIGNAL_TTL_NEWS_MS,
        expect.any(Function),
      );
      expect(SIGNAL_TTL_MACRO_MS).toBeGreaterThan(SIGNAL_TTL_TECHNICAL_MS);
    });
  });
});
