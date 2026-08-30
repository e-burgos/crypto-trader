import { TradingProcessor } from './trading.processor';
import { PositionActionService } from './position-action.service';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { BinanceRestClient } from '@crypto-trader/data-fetcher';

describe('TradingProcessor — Isolation & Atomicity', () => {
  const gatewayMock = { emitToUser: jest.fn() };
  const notificationsMock = { create: jest.fn().mockResolvedValue({}) };
  const aggregateRiskServiceMock = {
    assertBuyAllowed: jest.fn().mockResolvedValue({ allowed: true, blockedBy: null }),
  };

  function buildProcessor(prisma: any, overrides: Partial<Record<string, any>> = {}) {
    return new TradingProcessor(
      prisma,
      overrides.gateway ?? (gatewayMock as any),
      overrides.notificationsService ?? (notificationsMock as any),
      overrides.usersService ?? ({} as any),
      overrides.marketService ?? ({} as any),
      overrides.orchestratorService ?? ({} as any),
      overrides.decisionGateService ?? ({} as any),
      overrides.agentConfigResolver ?? ({} as any),
      overrides.evaluationService ?? ({} as any),
      overrides.reconciliationService ?? ({} as any),
      overrides.aggregateRiskService ?? (aggregateRiskServiceMock as any),
    );
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    gatewayMock.emitToUser.mockClear();
    notificationsMock.create.mockClear();
  });

  describe('executeLLMSell scopes open positions to configId + pair (Bug #2)', () => {
    it('filters by userId, configId, pair, status and mode — not by asset alone', async () => {
      const prisma = { position: { findMany: jest.fn().mockResolvedValue([]) } };
      const processor = buildProcessor(prisma);
      const config = {
        id: 'config-A',
        asset: 'BTC',
        pair: 'USDT',
        mode: 'SANDBOX',
        minProfitPct: 0.003,
      };

      await (processor as any).executeLLMSell(
        'user-1',
        config,
        'BTCUSDT',
        'SANDBOX',
        undefined,
        undefined,
        100,
        undefined,
      );

      expect(prisma.position.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          configId: 'config-A',
          pair: 'USDT',
          status: 'OPEN',
          mode: 'SANDBOX',
        },
      });
    });
  });

  describe('executeBuy counts open positions scoped to configId (Bug #3)', () => {
    it('checks maxConcurrentPositions against a count filtered by configId', async () => {
      const prisma = { position: { count: jest.fn().mockResolvedValue(5) } };
      const processor = buildProcessor(prisma);
      const config = {
        id: 'config-A',
        asset: 'BTC',
        pair: 'USDT',
        mode: 'SANDBOX',
        maxConcurrentPositions: 5,
      };

      await (processor as any).executeBuy(
        'user-1',
        config,
        'BTCUSDT',
        'SANDBOX',
        undefined,
        undefined,
        100,
        undefined,
      );

      expect(prisma.position.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          configId: 'config-A',
          status: 'OPEN',
          asset: 'BTC',
          mode: 'SANDBOX',
        },
      });
    });
  });

  describe('sandbox wallet crediting is atomic (Bug #6)', () => {
    it('credits the balance through a single $transaction, then broadcasts the new balance', async () => {
      const txSandboxWallet = {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ balance: 10_100 }),
      };
      const prisma = {
        $transaction: jest.fn(async (fn: any) =>
          fn({ sandboxWallet: txSandboxWallet }),
        ),
      };
      const positionAction = new PositionActionService(
        prisma as any,
        gatewayMock as any,
        notificationsMock as any,
      );

      await (positionAction as any).creditSandboxWallet('user-1', 'USDT', 100, 1);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txSandboxWallet.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_currency: { userId: 'user-1', currency: 'USDT' } },
        }),
      );
      expect(txSandboxWallet.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_currency: { userId: 'user-1', currency: 'USDT' } },
        }),
      );
      expect(gatewayMock.emitToUser).toHaveBeenCalledWith(
        'user-1',
        'wallet:updated',
        expect.objectContaining({ currency: 'USDT', balance: 10_100 }),
      );
    });
  });

  describe('runCycle scopes recent-trade context to configId (Bug #7)', () => {
    it('loads the last trades through the position relation, filtered by configId', async () => {
      const config = {
        id: 'config-A',
        userId: 'user-1',
        asset: 'BTC',
        pair: 'USDT',
        mode: 'SANDBOX',
        isRunning: true,
      };

      jest.spyOn(BinanceRestClient.prototype, 'getKlines').mockResolvedValue([]);

      const prisma = {
        tradingConfig: {
          findFirst: jest.fn().mockResolvedValue(config),
          update: jest.fn().mockResolvedValue({}),
        },
        trade: { findMany: jest.fn().mockResolvedValue([]) },
        agentDecision: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const agentConfigResolver = {
        checkHealth: jest.fn().mockResolvedValue({ healthy: true, agents: [] }),
      };
      const marketService = {
        getNewsConfig: jest.fn().mockResolvedValue({ botEnabled: false }),
        buildEnrichedSnapshot: jest.fn().mockResolvedValue(null),
      };
      const decisionGateService = {
        evaluate: jest.fn().mockRejectedValue(new Error('stop-before-orchestrator')),
      };

      const processor = buildProcessor(prisma, {
        agentConfigResolver,
        marketService,
        decisionGateService,
      });

      await processor.runCycle({
        data: { userId: 'user-1', configId: 'config-A' },
        queue: { add: jest.fn() },
      } as any);

      expect(prisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', position: { configId: 'config-A' } },
        }),
      );
    });
  });
});
