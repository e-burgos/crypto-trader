import { TradingProcessor } from './trading.processor';
import {
  createTradingPrismaMock,
  createTradingProcessorCollaborators,
} from './__mocks__/trading-processor-deps';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { BinanceRestClient } from '@crypto-trader/data-fetcher';

describe('TradingProcessor — wiring of the LLM_CYCLE path to actionGate.authorizeAndRun (TASK-019)', () => {
  const gatewayMock = { emitToUser: jest.fn() };
  const notificationsMock = { create: jest.fn().mockResolvedValue({}) };
  const aggregateRiskServiceMock = {
    assertBuyAllowed: jest.fn().mockResolvedValue({ allowed: true, blockedBy: null }),
  };

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

  function buildBlockingActionGate() {
    return {
      authorizeAndRun: jest.fn(async () => ({
        outcome: 'BLOCKED',
        blockedBy: 'ACTIONS_PER_HOUR',
        detail: 'ACTIONS_PER_HOUR',
        value: null,
      })),
    };
  }

  function buildProcessor(
    prisma: any,
    actionGate: { authorizeAndRun: jest.Mock },
    overrides: Partial<Record<string, any>> = {},
  ) {
    const prismaMock = createTradingPrismaMock(prisma);
    const gateway = overrides.gateway ?? (gatewayMock as any);
    const notificationsService =
      overrides.notificationsService ?? (notificationsMock as any);
    const aggregateRiskService =
      overrides.aggregateRiskService ?? (aggregateRiskServiceMock as any);

    return new TradingProcessor(
      prismaMock,
      gateway,
      notificationsService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      aggregateRiskService,
      ...createTradingProcessorCollaborators({
        prisma: prismaMock,
        gateway,
        notificationsService,
        aggregateRiskService,
        actionGate: actionGate as any,
      }),
    );
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    gatewayMock.emitToUser.mockClear();
    notificationsMock.create.mockClear();
    aggregateRiskServiceMock.assertBuyAllowed.mockClear();
  });

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

  describe('executeBuy', () => {
    function makePrismaMock() {
      return {
        position: {
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn().mockResolvedValue({ id: 'pos-new' }),
        },
        sandboxWallet: {
          upsert: jest.fn().mockResolvedValue({ balance: 10_000 }),
          update: jest.fn().mockResolvedValue({}),
        },
        trade: { create: jest.fn().mockResolvedValue({}) },
      };
    }

    it('routes the order through authorizeAndRun with kind BUY, source LLM_CYCLE and no expected state (SANDBOX)', async () => {
      const prisma = makePrismaMock();
      const actionGate = buildActionGate();
      const processor = buildProcessor(prisma, actionGate);

      await (processor as any).executeBuy(
        'user-1',
        baseConfig,
        'BTCUSDT',
        'SANDBOX',
        undefined,
        undefined,
        65_000,
        { decisionId: 'dec-1', confidence: 0.9 },
      );

      expect(actionGate.authorizeAndRun).toHaveBeenCalledTimes(1);
      const request = actionGate.authorizeAndRun.mock.calls[0][0];
      expect(request).toMatchObject({
        userId: 'user-1',
        configId: 'config-1',
        symbol: 'BTCUSDT',
        mode: 'SANDBOX',
        kind: 'BUY',
        source: 'LLM_CYCLE',
        positionId: null,
        decisionId: 'dec-1',
        expected: null,
      });
      expect(prisma.position.create).toHaveBeenCalledTimes(1);
    });

    it('never calls prisma.position.create when the gate blocks the BUY (SANDBOX)', async () => {
      const prisma = makePrismaMock();
      const actionGate = buildBlockingActionGate();
      const processor = buildProcessor(prisma, actionGate);

      await (processor as any).executeBuy(
        'user-1',
        baseConfig,
        'BTCUSDT',
        'SANDBOX',
        undefined,
        undefined,
        65_000,
        { decisionId: 'dec-1', confidence: 0.9 },
      );

      expect(actionGate.authorizeAndRun).toHaveBeenCalledTimes(1);
      expect(prisma.position.create).not.toHaveBeenCalled();
      expect(prisma.trade.create).not.toHaveBeenCalled();
    });

    it('routes the LIVE order (including native protection placement) through a single authorizeAndRun call', async () => {
      const prisma = {
        position: {
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn().mockImplementation(({ data }) =>
            Promise.resolve({
              id: 'pos-1',
              userId: 'user-1',
              asset: 'BTC',
              pair: 'USDT',
              mode: 'LIVE',
              status: 'OPEN',
              fees: 0,
              protectionStatus: 'NONE',
              ...data,
            }),
          ),
          update: jest.fn().mockResolvedValue({}),
        },
        trade: { create: jest.fn().mockResolvedValue({}) },
      };
      const actionGate = buildActionGate();
      const processor = buildProcessor(prisma, actionGate);

      jest
        .spyOn(BinanceRestClient.prototype, 'getBalances')
        .mockResolvedValue([{ asset: 'USDT', free: 10_000, locked: 0 }]);
      jest.spyOn(BinanceRestClient.prototype, 'placeMarketOrder').mockResolvedValue({
        orderId: 'order-1',
        symbol: 'BTCUSDT',
        side: 'BUY',
        price: 65_000,
        quantity: 0.1,
        status: 'FILLED',
        executedAt: new Date(),
      } as any);
      const placeOcoSellOrder = jest
        .spyOn(BinanceRestClient.prototype, 'placeOcoSellOrder')
        .mockResolvedValue({
          orderListId: 'ol-1',
          listClientOrderId: 'prot-pos-1-1',
          stopOrderId: 'so-1',
          limitOrderId: 'lo-1',
          symbol: 'BTCUSDT',
          quantity: 0.1,
          placedAt: new Date(),
        } as any);

      await (processor as any).executeBuy(
        'user-1',
        { ...baseConfig, mode: 'LIVE', stopLossPct: 0.03, takeProfitPct: 0.05, nativeProtectionEnabled: true },
        'BTCUSDT',
        'LIVE',
        'key',
        'secret',
        65_000,
        { decisionId: 'dec-2', confidence: 0.8 },
      );

      expect(actionGate.authorizeAndRun).toHaveBeenCalledTimes(1);
      expect(placeOcoSellOrder).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeLLMSell', () => {
    const basePosition = {
      id: 'pos-1',
      userId: 'user-1',
      configId: 'config-1',
      asset: 'BTC',
      pair: 'USDT',
      mode: 'SANDBOX',
      entryPrice: 100,
      quantity: 1,
      partialExitCount: 0,
      status: 'OPEN',
      exitPrice: null,
      exitAt: null,
      pnl: null,
      fees: 0,
    };

    function makePrismaMock() {
      return {
        position: {
          findMany: jest.fn().mockResolvedValue([{ ...basePosition }]),
          update: jest.fn().mockResolvedValue({}),
        },
        trade: { create: jest.fn().mockResolvedValue({}) },
        sandboxWallet: { upsert: jest.fn().mockResolvedValue({ balance: 10_000 }) },
        $transaction: jest.fn(async (fn: any) =>
          fn({
            sandboxWallet: {
              upsert: jest.fn().mockResolvedValue({}),
              findUnique: jest.fn().mockResolvedValue({ balance: 10_100 }),
            },
          }),
        ),
      };
    }

    const sellConfig = {
      ...baseConfig,
      stopLossPct: 0.03,
      minProfitPct: 0.003,
      lossCutEnabled: false,
    };

    it('routes each closing position through authorizeAndRun with kind SELL_FULL and the expected state', async () => {
      const prisma = makePrismaMock();
      const actionGate = buildActionGate();
      const processor = buildProcessor(prisma, actionGate);

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

      expect(actionGate.authorizeAndRun).toHaveBeenCalledTimes(1);
      const request = actionGate.authorizeAndRun.mock.calls[0][0];
      expect(request).toMatchObject({
        userId: 'user-1',
        configId: 'config-1',
        symbol: 'BTCUSDT',
        mode: 'SANDBOX',
        kind: 'SELL_FULL',
        source: 'LLM_CYCLE',
        positionId: 'pos-1',
        decisionId: 'dec-sell-1',
        expected: { positionStatus: 'OPEN', quantity: 1, partialExitCount: 0 },
      });
      expect(prisma.position.update).toHaveBeenCalledTimes(1);
    });

    it('never places the SELL order when the gate blocks the action', async () => {
      const prisma = makePrismaMock();
      const actionGate = buildBlockingActionGate();
      const processor = buildProcessor(prisma, actionGate);

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

      expect(actionGate.authorizeAndRun).toHaveBeenCalledTimes(1);
      expect(prisma.position.update).not.toHaveBeenCalled();
      expect(prisma.trade.create).not.toHaveBeenCalled();
    });

    it('does not call the gate when the sell policy itself disallows the exit', async () => {
      const prisma = makePrismaMock();
      const actionGate = buildActionGate();
      const processor = buildProcessor(prisma, actionGate);

      await (processor as any).executeLLMSell(
        'user-1',
        sellConfig,
        'BTCUSDT',
        'SANDBOX',
        undefined,
        undefined,
        100.1,
        { decisionId: 'dec-sell-1', confidence: 0.2 },
      );

      expect(actionGate.authorizeAndRun).not.toHaveBeenCalled();
    });
  });

  describe('checkOpenPositions — closePositionAtMarket / executePartialTakeProfit / protection rearm', () => {
    function makePrismaMock(position: any) {
      return {
        position: {
          findMany: jest.fn().mockResolvedValue([position]),
          update: jest.fn().mockResolvedValue({}),
        },
        trade: { create: jest.fn().mockResolvedValue({}) },
        sandboxWallet: { upsert: jest.fn().mockResolvedValue({ balance: 10_000 }) },
        $transaction: jest.fn(async (fn: any) =>
          fn({
            sandboxWallet: {
              upsert: jest.fn().mockResolvedValue({}),
              findUnique: jest.fn().mockResolvedValue({ balance: 10_100 }),
            },
          }),
        ),
      };
    }

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

    const basePosition = {
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

    it('routes a STOP_LOSS exit through authorizeAndRun with kind SELL_FULL', async () => {
      const prisma = makePrismaMock(basePosition);
      const actionGate = buildActionGate();
      const processor = buildProcessor(prisma, actionGate);

      // Price 96 breaches the 3% stop-loss on a 100 entry.
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

      expect(actionGate.authorizeAndRun).toHaveBeenCalledTimes(1);
      const request = actionGate.authorizeAndRun.mock.calls[0][0];
      expect(request).toMatchObject({
        kind: 'SELL_FULL',
        source: 'LLM_CYCLE',
        positionId: 'pos-stop-1',
        expected: { positionStatus: 'OPEN', quantity: 1, partialExitCount: 0 },
      });
      expect(prisma.trade.create).toHaveBeenCalledTimes(1);
    });

    it('routes a TIME_EXIT through authorizeAndRun with kind SELL_FULL', async () => {
      const oldPosition = {
        ...basePosition,
        entryAt: new Date(Date.now() - 999 * 60_000),
      };
      const prisma = makePrismaMock(oldPosition);
      const actionGate = buildActionGate();
      const processor = buildProcessor(prisma, actionGate);

      await (processor as any).checkOpenPositions(
        'user-1',
        { ...stopLossConfig, maxPositionHoldMinutes: 60 },
        'BTCUSDT',
        'SANDBOX',
        undefined,
        undefined,
        100,
        undefined,
      );

      expect(actionGate.authorizeAndRun).toHaveBeenCalledTimes(1);
      const request = actionGate.authorizeAndRun.mock.calls[0][0];
      expect(request).toMatchObject({ kind: 'SELL_FULL', detail: 'TIME_EXIT' });
    });

    it('routes a TAKE_PROFIT exit through authorizeAndRun with kind SELL_FULL', async () => {
      const prisma = makePrismaMock(basePosition);
      const actionGate = buildActionGate();
      const processor = buildProcessor(prisma, actionGate);

      // Price 106 clears the 5% take-profit on a 100 entry, trailing disabled.
      await (processor as any).checkOpenPositions(
        'user-1',
        stopLossConfig,
        'BTCUSDT',
        'SANDBOX',
        undefined,
        undefined,
        106,
        undefined,
      );

      expect(actionGate.authorizeAndRun).toHaveBeenCalledTimes(1);
      const request = actionGate.authorizeAndRun.mock.calls[0][0];
      expect(request).toMatchObject({ kind: 'SELL_FULL', detail: 'TAKE_PROFIT' });
    });

    it('routes a partial take-profit through authorizeAndRun with kind SELL_PARTIAL', async () => {
      const position = { ...basePosition, quantity: 1 };
      const prisma = makePrismaMock(position);
      const actionGate = buildActionGate();
      const processor = buildProcessor(prisma, actionGate);

      // Price 103 clears the 2% partial-TP trigger without breaching stop or full TP.
      await (processor as any).checkOpenPositions(
        'user-1',
        {
          ...stopLossConfig,
          takeProfitPct: 0.5,
          partialTpEnabled: true,
          partialTpTriggerPct: 0.02,
          partialTpSellPct: 0.5,
          moveStopToBreakevenAfterPartial: true,
        },
        'BTCUSDT',
        'SANDBOX',
        undefined,
        undefined,
        103,
        undefined,
      );

      expect(actionGate.authorizeAndRun).toHaveBeenCalledTimes(1);
      const request = actionGate.authorizeAndRun.mock.calls[0][0];
      expect(request).toMatchObject({
        kind: 'SELL_PARTIAL',
        source: 'LLM_CYCLE',
        positionId: 'pos-stop-1',
      });
    });

    it('routes a native-protection rearm (trailing stop moved) through authorizeAndRun with kind PROTECTION_REARM', async () => {
      const rearmPosition = {
        id: 'pos-1',
        userId: 'user-1',
        configId: 'config-1',
        asset: 'BTC',
        pair: 'USDT',
        mode: 'LIVE',
        entryPrice: 100,
        quantity: 1,
        entryAt: new Date(),
        status: 'OPEN',
        exitPrice: null,
        exitAt: null,
        pnl: null,
        fees: 0,
        stopPrice: 97,
        takeProfitPrice: 130,
        highWaterPrice: null,
        trailingActive: false,
        initialQuantity: 1,
        partialExitCount: 0,
        realizedPnl: 0,
        protectionStatus: 'PROTECTED',
        protectionOrderListId: 'ol-1',
        protectionStopOrderId: 'so-1',
        protectionFailureCount: 0,
      };
      const rearmConfig = {
        ...stopLossConfig,
        mode: 'LIVE',
        takeProfitPct: 0.5,
        trailingStopEnabled: true,
        trailingStopPct: 0.02,
        trailingActivationPct: 0.01,
        stopLimitOffsetPct: 0.002,
        nativeProtectionEnabled: true,
        closeOnProtectionFailure: false,
      };
      const prisma = makePrismaMock(rearmPosition);
      const actionGate = buildActionGate();
      const processor = buildProcessor(prisma, actionGate);

      jest
        .spyOn(BinanceRestClient.prototype, 'cancelOcoOrderList')
        .mockResolvedValue(undefined as any);
      jest
        .spyOn(BinanceRestClient.prototype, 'getTickerPrice')
        .mockResolvedValue(110);
      jest.spyOn(BinanceRestClient.prototype, 'placeOcoSellOrder').mockResolvedValue({
        orderListId: 'ol-2',
        listClientOrderId: 'prot-pos-1-1',
        stopOrderId: 'so-2',
        limitOrderId: 'lo-2',
        symbol: 'BTCUSDT',
        quantity: 1,
        placedAt: new Date(),
      } as any);

      // currentPrice 110 pushes the trailing stop from 97 to 107.8 — well past the 0.1% rearm delta.
      await (processor as any).checkOpenPositions(
        'user-1',
        rearmConfig,
        'BTCUSDT',
        'LIVE',
        'key',
        'secret',
        110,
        undefined,
      );

      expect(actionGate.authorizeAndRun).toHaveBeenCalledTimes(1);
      const request = actionGate.authorizeAndRun.mock.calls[0][0];
      expect(request).toMatchObject({
        kind: 'PROTECTION_REARM',
        source: 'LLM_CYCLE',
        positionId: 'pos-1',
        expected: { positionStatus: 'OPEN', quantity: 1, partialExitCount: 0 },
      });
    });
  });

  describe('no trading execution point bypasses the gate', () => {
    it('every this.positionAction call in trading.processor.ts sits inside a this.actionGate.authorizeAndRun() callback', () => {
      const fs = require('fs');
      const path = require('path');
      const lines: string[] = fs
        .readFileSync(path.join(__dirname, 'trading.processor.ts'), 'utf8')
        .split('\n');

      const gateCallLines = lines.reduce<number[]>((acc, line, idx) => {
        if (line.includes('this.actionGate.authorizeAndRun(')) acc.push(idx);
        return acc;
      }, []);
      const positionActionCallLines = lines.reduce<number[]>((acc, line, idx) => {
        if (
          /this\.positionAction\.(closeAtMarket|rearmProtection|releaseProtectionIfNeeded|executePartialTakeProfit|placeInitialProtection)\(/.test(
            line,
          )
        ) {
          acc.push(idx);
        }
        return acc;
      }, []);

      // Every point of execution the architect's §3.5 enumerates (executeBuy x2 branches,
      // executeLLMSell, closePositionAtMarket, the partial-TP wrap, ensureNativeProtection)
      // opens its own authorizeAndRun call, plus the two of the resting-entry path of
      // cycle-02 §7.1/§7.3 (placement and bot-decided cancellation).
      expect(gateCallLines).toHaveLength(8);
      // Each of the 5 PositionActionService methods the LLM path uses is invoked exactly once,
      // always as the execute() callback of the nearest preceding gate call.
      expect(positionActionCallLines).toHaveLength(5);
      for (const positionActionLine of positionActionCallLines) {
        const precedingGateLine = Math.max(
          ...gateCallLines.filter((gateLine) => gateLine <= positionActionLine),
        );
        expect(precedingGateLine).toBeGreaterThan(-Infinity);
        expect(positionActionLine - precedingGateLine).toBeLessThan(100);
      }
    });
  });
});
