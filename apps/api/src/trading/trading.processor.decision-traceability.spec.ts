import { TradingProcessor } from './trading.processor';
import {
  createTradingPrismaMock,
  createTradingProcessorCollaborators,
} from './__mocks__/trading-processor-deps';

describe('TradingProcessor — Trade.decisionId traceability (TASK-016)', () => {
  const gatewayMock = { emitToUser: jest.fn() };
  const notificationsMock = { create: jest.fn().mockResolvedValue({}) };

  const aggregateRiskServiceMock = {
    assertBuyAllowed: jest.fn().mockResolvedValue({ allowed: true, blockedBy: null }),
  };

  function buildProcessor(prisma: any) {
    const prismaMock = createTradingPrismaMock(prisma);
    return new TradingProcessor(
      prismaMock,
      gatewayMock as any,
      notificationsMock as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      aggregateRiskServiceMock as any,
      ...createTradingProcessorCollaborators({
        prisma: prismaMock,
        gateway: gatewayMock,
        notificationsService: notificationsMock,
        aggregateRiskService: aggregateRiskServiceMock,
      }),
    );
  }

  const baseConfig = {
    id: 'config-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'SANDBOX',
    maxTradePct: 0.05,
    maxConcurrentPositions: 5,
    orderPriceOffsetPct: 0,
    smartSizingEnabled: false,
  };

  describe('executeBuy (CA-026 / CA-028)', () => {
    const makePrismaMock = () => ({
      position: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'pos-new' }),
      },
      sandboxWallet: {
        upsert: jest.fn().mockResolvedValue({ balance: 10_000 }),
        update: jest.fn().mockResolvedValue({}),
      },
      trade: { create: jest.fn().mockResolvedValue({}) },
    });

    it('sets decisionId to the AgentDecision that originated the BUY (CA-026)', async () => {
      const prisma = makePrismaMock();
      const processor = buildProcessor(prisma);

      await (processor as any).executeBuy(
        'user-1',
        baseConfig,
        'BTCUSDT',
        'SANDBOX',
        undefined,
        undefined,
        65_000,
        { decisionId: 'dec-buy-1', confidence: 0.8 },
      );

      expect(prisma.trade.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ decisionId: 'dec-buy-1' }),
        }),
      );
    });

    it('persists the Trade with decisionId: null when there is no decision context (CA-028)', async () => {
      const prisma = makePrismaMock();
      const processor = buildProcessor(prisma);

      await (processor as any).executeBuy(
        'user-1',
        baseConfig,
        'BTCUSDT',
        'SANDBOX',
        undefined,
        undefined,
        65_000,
        undefined,
      );

      expect(prisma.trade.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ decisionId: null }),
        }),
      );
    });
  });

  describe('executeLLMSell (CA-026 / CA-028)', () => {
    const basePosition = {
      id: 'pos-1',
      userId: 'user-1',
      configId: 'config-1',
      asset: 'BTC',
      pair: 'USDT',
      mode: 'SANDBOX',
      entryPrice: 100,
      quantity: 1,
      status: 'OPEN',
      exitPrice: null,
      exitAt: null,
      pnl: null,
      fees: 0,
    };

    const sellConfig = {
      ...baseConfig,
      stopLossPct: 0.03,
      minProfitPct: 0.003,
      lossCutEnabled: false,
    };

    const makePrismaMock = () => ({
      position: {
        findMany: jest.fn().mockResolvedValue([{ ...basePosition }]),
        update: jest.fn().mockResolvedValue({}),
      },
      trade: { create: jest.fn().mockResolvedValue({}) },
      sandboxWallet: {
        upsert: jest.fn().mockResolvedValue({ balance: 10_000 }),
      },
      $transaction: jest.fn(async (fn: any) =>
        fn({
          sandboxWallet: {
            upsert: jest.fn().mockResolvedValue({}),
            findUnique: jest.fn().mockResolvedValue({ balance: 10_100 }),
          },
        }),
      ),
    });

    it('sets decisionId to the AgentDecision that originated the SELL (CA-026)', async () => {
      const prisma = makePrismaMock();
      const processor = buildProcessor(prisma);

      await (processor as any).executeLLMSell(
        'user-1',
        sellConfig,
        'BTCUSDT',
        'SANDBOX',
        undefined,
        undefined,
        101,
        { decisionId: 'dec-sell-1', confidence: 0.7 },
      );

      expect(prisma.trade.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ decisionId: 'dec-sell-1' }),
        }),
      );
    });

    it('persists the Trade with decisionId: null when there is no decision context (CA-028)', async () => {
      const prisma = makePrismaMock();
      const processor = buildProcessor(prisma);

      await (processor as any).executeLLMSell(
        'user-1',
        sellConfig,
        'BTCUSDT',
        'SANDBOX',
        undefined,
        undefined,
        101,
        undefined,
      );

      expect(prisma.trade.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ decisionId: null }),
        }),
      );
    });
  });

  describe('checkOpenPositions — automatic stop-loss/take-profit has no AgentDecision (CA-028)', () => {
    it('creates the Trade without a decisionId field, defaulting to null in the DB', async () => {
      const position = {
        id: 'pos-stop-1',
        userId: 'user-1',
        configId: 'config-1',
        asset: 'BTC',
        pair: 'USDT',
        mode: 'SANDBOX',
        entryPrice: 100,
        quantity: 1,
        entryAt: new Date(),
        status: 'OPEN',
        exitPrice: null,
        exitAt: null,
        pnl: null,
        fees: 0,
        stopPrice: null,
        highWaterPrice: null,
        trailingActive: false,
        partialExitCount: 0,
      };
      const stopLossConfig = {
        ...baseConfig,
        stopLossPct: 0.03,
        takeProfitPct: 0.05,
        trailingStopEnabled: false,
        trailingStopPct: 0.02,
        trailingActivationPct: 0.01,
        partialTpEnabled: false,
        maxPositionHoldMinutes: null,
      };

      const prisma = {
        position: {
          findMany: jest.fn().mockResolvedValue([position]),
          update: jest.fn().mockResolvedValue({}),
        },
        trade: { create: jest.fn().mockResolvedValue({}) },
        sandboxWallet: {
          upsert: jest.fn().mockResolvedValue({ balance: 10_000 }),
        },
        $transaction: jest.fn(async (fn: any) =>
          fn({
            sandboxWallet: {
              upsert: jest.fn().mockResolvedValue({}),
              findUnique: jest.fn().mockResolvedValue({ balance: 10_100 }),
            },
          }),
        ),
      };
      const processor = buildProcessor(prisma);

      // Price 96 breaches the 3% stop-loss on a 100 entry — no decisionContext supplied.
      await (processor as any).checkOpenPositions(
        'user-1',
        stopLossConfig,
        'BTCUSDT',
        'SANDBOX',
        undefined,
        undefined,
        96,
        undefined,
      );

      expect(prisma.trade.create).toHaveBeenCalledTimes(1);
      const tradeArgs = (prisma.trade.create as jest.Mock).mock.calls[0][0].data;
      expect(tradeArgs.decisionId).toBeUndefined();
    });
  });
});
