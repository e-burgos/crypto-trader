import type { MarketTick } from '@crypto-trader/shared';
import { TradingMode } from '@crypto-trader/shared';
import { EntryFillWatchService } from './entry-fill-watch.service';
import { DEFAULT_REACTIVE_RUNTIME_THRESHOLDS } from './reactive-runtime-thresholds';

jest.mock('@crypto-trader/data-fetcher', () => ({
  BinanceRestClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../users/utils/encryption.util', () => ({
  decrypt: jest.fn((value: string) => `decrypted:${value}`),
}));

jest.mock('@crypto-trader/trading-engine', () => {
  const actual = jest.requireActual('@crypto-trader/trading-engine');
  return {
    ...actual,
    LiveOrderExecutor: jest.fn(),
  };
});

describe('EntryFillWatchService', () => {
  const baseConfig = {
    id: 'config-1',
    userId: 'user-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: TradingMode.LIVE,
    isRunning: true,
    reactiveLoopEnabled: true,
  };

  const baseOrder = {
    id: 'entry-1',
    userId: 'user-1',
    configId: 'config-1',
    symbol: 'BTCUSDT',
    limitPrice: 100,
    stopPrice: 110,
    orderListId: null,
    orderId: 'order-1',
    limitLegOrderId: null,
    stopLegOrderId: null,
  };

  const filledStatus = {
    state: 'FILLED' as const,
    filledLeg: 'LIMIT' as const,
    executedPrice: 100,
    executedQuantity: 1,
    remainingQuantity: 0,
    partial: false,
    orderId: 'order-1',
  };

  function buildPrisma(
    overrides: { configs?: any[]; credential?: any } = {},
  ) {
    return {
      tradingConfig: {
        findMany: jest.fn().mockResolvedValue(overrides.configs ?? [baseConfig]),
      },
      binanceCredential: {
        findUnique: jest.fn().mockResolvedValue(
          overrides.credential === undefined
            ? {
                apiKeyEncrypted: 'key',
                apiKeyIv: 'iv1',
                secretEncrypted: 'secret',
                secretIv: 'iv2',
              }
            : overrides.credential,
        ),
      },
    };
  }

  function buildMarketStream(overrides: { warmup?: boolean } = {}) {
    return {
      on: jest.fn(),
      off: jest.fn(),
      isWarmupComplete: jest.fn().mockReturnValue(overrides.warmup ?? true),
    };
  }

  function buildEntryOrderService(overrides: { orders?: any[]; settle?: any } = {}) {
    return {
      findResting: jest.fn().mockResolvedValue(overrides.orders ?? [baseOrder]),
      settleFill: jest.fn().mockResolvedValue(overrides.settle ?? 'SETTLED'),
    };
  }

  function buildFastPath() {
    return {
      invalidateOpenPositions: jest.fn(),
    };
  }

  function buildService(params: {
    prisma?: any;
    marketStream?: any;
    entryOrderService?: any;
    fastPath?: any;
    thresholds?: any;
  } = {}) {
    const prisma = params.prisma ?? buildPrisma();
    const marketStream = params.marketStream ?? buildMarketStream();
    const entryOrderService = params.entryOrderService ?? buildEntryOrderService();
    const fastPath = params.fastPath ?? buildFastPath();

    const service = new EntryFillWatchService(
      prisma as any,
      marketStream as any,
      entryOrderService as any,
      fastPath as any,
      params.thresholds ?? DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
    );

    return { service, prisma, marketStream, entryOrderService, fastPath };
  }

  beforeEach(() => {
    const { LiveOrderExecutor } = jest.requireMock('@crypto-trader/trading-engine') as any;
    LiveOrderExecutor.mockReset();
    LiveOrderExecutor.mockImplementation(() => ({
      getEntryOrderStatus: jest.fn().mockResolvedValue(filledStatus),
    }));
  });

  it('se suscribe al fan-out de ticks al iniciar y se desuscribe al apagar', () => {
    const { service, marketStream } = buildService();
    service.onModuleInit();
    expect(marketStream.on).toHaveBeenCalledWith('tick', expect.any(Function));
    service.onApplicationShutdown();
    expect(marketStream.off).toHaveBeenCalledWith('tick', expect.any(Function));
  });

  it('descarta el tick si el warmup del símbolo no terminó', async () => {
    const { service, prisma } = buildService({
      marketStream: buildMarketStream({ warmup: false }),
    });
    await service.handleTick({ symbol: 'BTCUSDT', price: 99, timestamp: 1 });
    expect(prisma.tradingConfig.findMany).not.toHaveBeenCalled();
  });

  it('en una réplica que no es dueña del símbolo, isWarmupComplete es false y no se prueba nada', async () => {
    const marketStream = buildMarketStream({ warmup: false });
    const { service, prisma } = buildService({ marketStream });
    await service.handleTick({ symbol: 'BTCUSDT', price: 100, timestamp: 1 });
    expect(prisma.tradingConfig.findMany).not.toHaveBeenCalled();

    const { LiveOrderExecutor } = jest.requireMock('@crypto-trader/trading-engine') as any;
    expect(LiveOrderExecutor).not.toHaveBeenCalled();
  });

  it('con reactiveLoopEnabled false no dispara ninguna sonda', async () => {
    const { service, entryOrderService } = buildService({
      prisma: buildPrisma({ configs: [] }),
    });
    await service.handleTick({ symbol: 'BTCUSDT', price: 99, timestamp: 1 });
    expect(entryOrderService.findResting).not.toHaveBeenCalled();
  });

  it('no dispara la sonda si el tick no cruza ningún nivel', async () => {
    const { service, entryOrderService } = buildService();
    const tick: MarketTick = { symbol: 'BTCUSDT', price: 105, timestamp: 1 };
    await service.handleTick(tick);
    expect(entryOrderService.settleFill).not.toHaveBeenCalled();
  });

  it('cruzar limitPrice dispara solo la pierna LIMIT', async () => {
    const { service } = buildService();
    const tick: MarketTick = { symbol: 'BTCUSDT', price: 100, timestamp: 1 };
    await service.handleTick(tick);

    const { LiveOrderExecutor } = jest.requireMock('@crypto-trader/trading-engine') as any;
    const instance = LiveOrderExecutor.mock.results[0].value;
    expect(instance.getEntryOrderStatus).toHaveBeenCalledWith(
      'BTCUSDT',
      {
        orderListId: null,
        orderId: 'order-1',
        limitLegOrderId: null,
        stopLegOrderId: null,
      },
      { leg: 'LIMIT' },
    );
    expect(instance.getEntryOrderStatus).toHaveBeenCalledTimes(1);
  });

  it('cruzar stopPrice dispara solo la pierna STOP', async () => {
    const { service } = buildService();
    const tick: MarketTick = { symbol: 'BTCUSDT', price: 110, timestamp: 1 };
    await service.handleTick(tick);

    const { LiveOrderExecutor } = jest.requireMock('@crypto-trader/trading-engine') as any;
    const instance = LiveOrderExecutor.mock.results[0].value;
    expect(instance.getEntryOrderStatus).toHaveBeenCalledWith(
      'BTCUSDT',
      expect.anything(),
      { leg: 'STOP' },
    );
  });

  it('respeta el debounce por (entryOrderId, leg)', async () => {
    const { service } = buildService();
    const tick: MarketTick = { symbol: 'BTCUSDT', price: 100, timestamp: 1 };

    await service.handleTick(tick);
    await service.handleTick(tick);

    const { LiveOrderExecutor } = jest.requireMock('@crypto-trader/trading-engine') as any;
    expect(LiveOrderExecutor).toHaveBeenCalledTimes(1);
  });

  it('tras el debounce, un nuevo cruce vuelve a disparar la sonda', async () => {
    const { service } = buildService({
      thresholds: { ...DEFAULT_REACTIVE_RUNTIME_THRESHOLDS, entryFillProbeDebounceMs: 1 },
    });
    const tick: MarketTick = { symbol: 'BTCUSDT', price: 100, timestamp: 1 };

    await service.handleTick(tick);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await service.handleTick(tick);

    const { LiveOrderExecutor } = jest.requireMock('@crypto-trader/trading-engine') as any;
    expect(LiveOrderExecutor).toHaveBeenCalledTimes(2);
  });

  it('en FILLED llama a settleFill y invalida el cache de fast-path', async () => {
    const { service, entryOrderService, fastPath } = buildService();
    const tick: MarketTick = { symbol: 'BTCUSDT', price: 100, timestamp: 1 };
    await service.handleTick(tick);

    expect(entryOrderService.settleFill).toHaveBeenCalledTimes(1);
    expect(entryOrderService.settleFill.mock.calls[0][0]).toMatchObject({
      userId: 'user-1',
      symbol: 'BTCUSDT',
      mode: TradingMode.LIVE,
      order: baseOrder,
      status: filledStatus,
    });
    expect(fastPath.invalidateOpenPositions).toHaveBeenCalledWith('config-1');
  });

  it('cualquier otro estado solo refresca el debounce, sin liquidar ni cancelar', async () => {
    const { LiveOrderExecutor } = jest.requireMock('@crypto-trader/trading-engine') as any;
    LiveOrderExecutor.mockImplementation(() => ({
      getEntryOrderStatus: jest.fn().mockResolvedValue({
        state: 'RESTING',
        filledLeg: null,
        executedPrice: null,
        executedQuantity: null,
        remainingQuantity: null,
        partial: false,
        orderId: 'order-1',
      }),
    }));

    const { service, entryOrderService, fastPath } = buildService();
    const tick: MarketTick = { symbol: 'BTCUSDT', price: 100, timestamp: 1 };
    await service.handleTick(tick);

    expect(entryOrderService.settleFill).not.toHaveBeenCalled();
    expect(fastPath.invalidateOpenPositions).not.toHaveBeenCalled();
  });

  it('nunca cancela ni marca MISSING, sin importar el estado devuelto', async () => {
    const { LiveOrderExecutor } = jest.requireMock('@crypto-trader/trading-engine') as any;
    const getEntryOrderStatus = jest.fn().mockResolvedValue({
      state: 'MISSING',
      filledLeg: null,
      executedPrice: null,
      executedQuantity: null,
      remainingQuantity: null,
      partial: false,
      orderId: 'order-1',
    });
    LiveOrderExecutor.mockImplementation(() => ({ getEntryOrderStatus }));

    const { service, entryOrderService } = buildService();
    const tick: MarketTick = { symbol: 'BTCUSDT', price: 100, timestamp: 1 };
    await service.handleTick(tick);

    expect(entryOrderService.settleFill).not.toHaveBeenCalled();
  });

  it('en LIVE sin credenciales configuradas, no invoca ningún executor', async () => {
    const { service, entryOrderService } = buildService({
      prisma: buildPrisma({ credential: null }),
    });
    const tick: MarketTick = { symbol: 'BTCUSDT', price: 100, timestamp: 1 };
    await service.handleTick(tick);

    const { LiveOrderExecutor } = jest.requireMock('@crypto-trader/trading-engine') as any;
    expect(LiveOrderExecutor).not.toHaveBeenCalled();
    expect(entryOrderService.settleFill).not.toHaveBeenCalled();
  });

  it('sin entradas RESTING para el config, no se resuelve executor', async () => {
    const { service } = buildService({
      entryOrderService: buildEntryOrderService({ orders: [] }),
    });
    const tick: MarketTick = { symbol: 'BTCUSDT', price: 100, timestamp: 1 };
    await service.handleTick(tick);

    const { LiveOrderExecutor } = jest.requireMock('@crypto-trader/trading-engine') as any;
    expect(LiveOrderExecutor).not.toHaveBeenCalled();
  });
});
