import type { MarketTick } from '@crypto-trader/shared';
import { TradingMode } from '@crypto-trader/shared';
import { FastPathService } from './fast-path.service';
import { DEFAULT_REACTIVE_RUNTIME_THRESHOLDS } from './reactive-runtime-thresholds';

const planFastPathMock = jest.fn();

jest.mock('@crypto-trader/trading-engine', () => ({
  ...jest.requireActual('@crypto-trader/trading-engine'),
  planFastPath: (...args: unknown[]) => planFastPathMock(...args),
}));

jest.mock('@crypto-trader/data-fetcher', () => ({
  BinanceRestClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../users/utils/encryption.util', () => ({
  decrypt: jest.fn((value: string) => `decrypted:${value}`),
}));

describe('FastPathService', () => {
  const baseConfig = {
    id: 'config-1',
    userId: 'user-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: TradingMode.SANDBOX,
    isRunning: true,
    reactiveLoopEnabled: true,
    stopLossPct: 0.03,
    takeProfitPct: 0.05,
    trailingStopEnabled: true,
    trailingStopPct: 0.02,
    trailingActivationPct: 0.01,
    partialTpEnabled: false,
    partialTpTriggerPct: 0.02,
    partialTpSellPct: 0.5,
    moveStopToBreakevenAfterPartial: true,
    nativeProtectionEnabled: false,
  };

  const basePosition = {
    id: 'pos-1',
    configId: 'config-1',
    entryPrice: 100,
    quantity: 2,
    stopPrice: 97,
    highWaterPrice: 100,
    trailingActive: false,
    partialExitCount: 0,
    protectionStatus: 'NONE',
    takeProfitPrice: null,
  };

  const tick: MarketTick = { symbol: 'BTCUSDT', price: 99, timestamp: 1_700_000_000_000 };

  function buildPrisma(
    overrides: { configs?: any[]; positions?: any[]; credential?: any } = {},
  ) {
    return {
      tradingConfig: {
        findMany: jest.fn().mockResolvedValue(overrides.configs ?? [baseConfig]),
      },
      position: {
        findMany: jest.fn().mockResolvedValue(overrides.positions ?? [basePosition]),
        update: jest.fn().mockResolvedValue({}),
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

  function buildMarketStream(overrides: { warmup?: boolean; filters?: any } = {}) {
    return {
      on: jest.fn(),
      off: jest.fn(),
      isWarmupComplete: jest.fn().mockReturnValue(overrides.warmup ?? true),
      getSymbolFilters: jest.fn().mockReturnValue(
        overrides.filters === undefined
          ? { lotSize: { stepSize: 0.0001 }, notional: { minNotional: 10 } }
          : overrides.filters,
      ),
    };
  }

  function buildActionGate() {
    return {
      authorizeAndRun: jest.fn(async (_request: any, execute: () => Promise<unknown>) => ({
        outcome: 'EXECUTED',
        blockedBy: null,
        detail: 'ok',
        value: await execute(),
      })),
    };
  }

  function buildPositionAction() {
    return {
      closeAtMarket: jest.fn().mockResolvedValue({ tradeId: 'trade-1', exitPrice: 99 }),
      executePartialTakeProfit: jest.fn().mockResolvedValue({ tradeId: 'trade-2' }),
      rearmProtection: jest.fn().mockResolvedValue({ protectionStatus: 'PROTECTED' }),
    };
  }

  function buildService(
    params: { prisma?: any; marketStream?: any; thresholds?: any } = {},
  ) {
    const prisma = params.prisma ?? buildPrisma();
    const marketStream = params.marketStream ?? buildMarketStream();
    const actionGate = buildActionGate();
    const positionAction = buildPositionAction();

    const service = new FastPathService(
      prisma as any,
      marketStream as any,
      actionGate as any,
      positionAction as any,
      params.thresholds ?? DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
    );

    return { service, prisma, marketStream, actionGate, positionAction };
  }

  function noneTrailingPlan(trailing: {
    stopPrice: number | null;
    highWaterPrice: number | null;
    trailingActive: boolean;
  }) {
    return {
      action: 'NONE' as const,
      reason: 'NO_ACTION_MATCHED',
      trailing: { entryPrice: 100, ...trailing },
    };
  }

  beforeEach(() => {
    planFastPathMock.mockReset();
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
    await service.handleTick(tick);
    expect(prisma.tradingConfig.findMany).not.toHaveBeenCalled();
    expect(planFastPathMock).not.toHaveBeenCalled();
  });

  it('no hace nada si ningún config activo coincide con el símbolo del tick', async () => {
    const { service, prisma } = buildService({
      prisma: buildPrisma({ configs: [{ ...baseConfig, asset: 'ETH' }] }),
    });
    await service.handleTick(tick);
    expect(prisma.position.findMany).not.toHaveBeenCalled();
    expect(planFastPathMock).not.toHaveBeenCalled();
  });

  it('no computa el plan si el config no tiene posiciones abiertas', async () => {
    const { service, prisma } = buildService({ prisma: buildPrisma({ positions: [] }) });
    await service.handleTick(tick);
    expect(planFastPathMock).not.toHaveBeenCalled();
  });

  it('un plan NONE sin cambios de trailing no escribe la posición', async () => {
    planFastPathMock.mockReturnValue(
      noneTrailingPlan({ stopPrice: 97, highWaterPrice: 100, trailingActive: false }),
    );
    const { service, prisma, actionGate } = buildService();
    await service.handleTick(tick);
    expect(prisma.position.update).not.toHaveBeenCalled();
    expect(actionGate.authorizeAndRun).not.toHaveBeenCalled();
  });

  it('un plan NONE que movió el stop persiste el trailing sin pasar por la puerta', async () => {
    planFastPathMock.mockReturnValue(
      noneTrailingPlan({ stopPrice: 98, highWaterPrice: 101, trailingActive: true }),
    );
    const { service, prisma, actionGate } = buildService();
    await service.handleTick(tick);
    expect(prisma.position.update).toHaveBeenCalledWith({
      where: { id: 'pos-1' },
      data: { stopPrice: 98, highWaterPrice: 101, trailingActive: true },
    });
    expect(actionGate.authorizeAndRun).not.toHaveBeenCalled();
  });

  it('un cambio de solo highWaterPrice se throttlea por trailingPersistIntervalMs', async () => {
    planFastPathMock.mockReturnValue(
      noneTrailingPlan({ stopPrice: 97, highWaterPrice: 105, trailingActive: false }),
    );
    const { service, prisma } = buildService({
      thresholds: {
        ...DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
        trailingPersistIntervalMs: 10_000,
      },
    });

    await service.handleTick(tick);
    expect(prisma.position.update).toHaveBeenCalledTimes(1);

    await service.handleTick(tick);
    expect(prisma.position.update).toHaveBeenCalledTimes(1);
  });

  it('HARD_STOP_EXIT pasa por ActionGateService y cierra la posición a mercado', async () => {
    planFastPathMock.mockReturnValue({
      action: 'HARD_STOP_EXIT',
      trailing: { entryPrice: 100, stopPrice: 97, highWaterPrice: 100, trailingActive: false },
      effectiveStop: 97,
    });
    const { service, actionGate, positionAction } = buildService();
    await service.handleTick(tick);

    expect(actionGate.authorizeAndRun).toHaveBeenCalledTimes(1);
    const request = actionGate.authorizeAndRun.mock.calls[0][0];
    expect(request).toMatchObject({
      configId: 'config-1',
      symbol: 'BTCUSDT',
      mode: TradingMode.SANDBOX,
      kind: 'SELL_FULL',
      source: 'FAST_PATH',
      positionId: 'pos-1',
      decisionId: null,
      expected: { positionStatus: 'OPEN', quantity: 2, partialExitCount: 0 },
    });

    expect(positionAction.closeAtMarket).toHaveBeenCalledTimes(1);
    expect(positionAction.closeAtMarket.mock.calls[0][0]).toMatchObject({
      exitReason: 'STOP_LOSS',
      symbol: 'BTCUSDT',
      mode: TradingMode.SANDBOX,
    });
    expect(positionAction.executePartialTakeProfit).not.toHaveBeenCalled();
    expect(positionAction.rearmProtection).not.toHaveBeenCalled();
  });

  it('TRAILING_EXIT pasa por ActionGateService y cierra con exitReason TRAILING_STOP', async () => {
    planFastPathMock.mockReturnValue({
      action: 'TRAILING_EXIT',
      trailing: { entryPrice: 100, stopPrice: 98, highWaterPrice: 110, trailingActive: true },
      effectiveStop: 98,
    });
    const { service, actionGate, positionAction } = buildService();
    await service.handleTick(tick);

    expect(actionGate.authorizeAndRun.mock.calls[0][0]).toMatchObject({ kind: 'SELL_FULL' });
    expect(positionAction.closeAtMarket.mock.calls[0][0]).toMatchObject({
      exitReason: 'TRAILING_STOP',
    });
  });

  it('PARTIAL_TAKE_PROFIT pasa por ActionGateService y ejecuta la venta parcial', async () => {
    const partial = { sellQuantity: 1, newStopPrice: 100 };
    planFastPathMock.mockReturnValue({
      action: 'PARTIAL_TAKE_PROFIT',
      trailing: { entryPrice: 100, stopPrice: 97, highWaterPrice: 100, trailingActive: false },
      partial,
    });
    const { service, actionGate, positionAction } = buildService();
    await service.handleTick(tick);

    expect(actionGate.authorizeAndRun.mock.calls[0][0]).toMatchObject({ kind: 'SELL_PARTIAL' });
    expect(positionAction.executePartialTakeProfit).toHaveBeenCalledTimes(1);
    const ctx = positionAction.executePartialTakeProfit.mock.calls[0][0];
    expect(ctx.partial).toBe(partial);
    expect(ctx.trailingState).toEqual({
      entryPrice: 100,
      stopPrice: 97,
      highWaterPrice: 100,
      trailingActive: false,
    });
    expect(positionAction.closeAtMarket).not.toHaveBeenCalled();
  });

  it('PROTECTION_REARM pasa por ActionGateService y re-arma con el nuevo stop', async () => {
    planFastPathMock.mockReturnValue({
      action: 'PROTECTION_REARM',
      trailing: { entryPrice: 100, stopPrice: 99, highWaterPrice: 105, trailingActive: true },
      desiredStopPrice: 99,
    });
    const { service, actionGate, positionAction } = buildService();
    await service.handleTick(tick);

    expect(actionGate.authorizeAndRun.mock.calls[0][0]).toMatchObject({
      kind: 'PROTECTION_REARM',
    });
    expect(positionAction.rearmProtection).toHaveBeenCalledTimes(1);
    expect(positionAction.rearmProtection.mock.calls[0][0].levels).toEqual({
      stopPrice: 99,
      takeProfitPrice: basePosition.entryPrice * (1 + baseConfig.takeProfitPct),
      quantity: basePosition.quantity,
    });
  });

  it('si la puerta bloquea la acción, PositionActionService nunca se invoca', async () => {
    planFastPathMock.mockReturnValue({
      action: 'PARTIAL_TAKE_PROFIT',
      trailing: { entryPrice: 100, stopPrice: 97, highWaterPrice: 100, trailingActive: false },
      partial: { sellQuantity: 1, newStopPrice: 100 },
    });
    const { service, actionGate, positionAction, prisma } = buildService();
    actionGate.authorizeAndRun.mockResolvedValue({
      outcome: 'BLOCKED',
      blockedBy: 'ACTIONS_PER_HOUR',
      detail: 'blocked',
      value: null,
    } as any);

    await service.handleTick(tick);
    await service.handleTick(tick);

    expect(positionAction.executePartialTakeProfit).not.toHaveBeenCalled();
    expect(prisma.position.findMany).toHaveBeenCalledTimes(1);
  });

  it('invalida el cache de posiciones abiertas tras una acción ejecutada', async () => {
    planFastPathMock.mockReturnValue({
      action: 'HARD_STOP_EXIT',
      trailing: { entryPrice: 100, stopPrice: 97, highWaterPrice: 100, trailingActive: false },
      effectiveStop: 97,
    });
    const { service, prisma } = buildService();

    await service.handleTick(tick);
    await service.handleTick(tick);

    expect(prisma.position.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.tradingConfig.findMany).toHaveBeenCalledTimes(1);
  });

  it('en SANDBOX no consulta credenciales de Binance', async () => {
    planFastPathMock.mockReturnValue(
      noneTrailingPlan({ stopPrice: 97, highWaterPrice: 100, trailingActive: false }),
    );
    const { service, prisma } = buildService();
    await service.handleTick(tick);
    expect(prisma.binanceCredential.findUnique).not.toHaveBeenCalled();
  });

  it('en LIVE sin credenciales configuradas, descarta el config sin invocar planFastPath', async () => {
    const liveConfig = { ...baseConfig, mode: TradingMode.LIVE };
    const { service, prisma } = buildService({
      prisma: buildPrisma({ configs: [liveConfig], credential: null }),
    });
    await service.handleTick(tick);
    expect(planFastPathMock).not.toHaveBeenCalled();
  });

  it('en LIVE con credenciales, resuelve un LiveOrderExecutor y ejecuta la acción', async () => {
    const liveConfig = { ...baseConfig, mode: TradingMode.LIVE };
    planFastPathMock.mockReturnValue({
      action: 'HARD_STOP_EXIT',
      trailing: { entryPrice: 100, stopPrice: 97, highWaterPrice: 100, trailingActive: false },
      effectiveStop: 97,
    });
    const { service, prisma, positionAction } = buildService({
      prisma: buildPrisma({ configs: [liveConfig] }),
    });
    await service.handleTick(tick);

    expect(prisma.binanceCredential.findUnique).toHaveBeenCalledTimes(1);
    expect(positionAction.closeAtMarket).toHaveBeenCalledTimes(1);
    expect(positionAction.closeAtMarket.mock.calls[0][0].mode).toBe(TradingMode.LIVE);
  });
});
