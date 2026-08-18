import { TradingProcessor } from './trading.processor';
import { encrypt } from '../users/utils/encryption.util';

describe('TradingProcessor — reconciliation runs as step 0 of runCycle (TASK-013, RN-07)', () => {
  const originalKey = process.env.BINANCE_KEY_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.BINANCE_KEY_ENCRYPTION_KEY = 'a'.repeat(32);
  });

  afterAll(() => {
    process.env.BINANCE_KEY_ENCRYPTION_KEY = originalKey;
  });

  it('calls ReconciliationService before the LLM health check, and before any decision is made', async () => {
    const callOrder: string[] = [];
    const apiKeyEnc = encrypt('test-api-key');
    const apiSecretEnc = encrypt('test-api-secret');

    const config = {
      id: 'config-1',
      userId: 'user-1',
      asset: 'BTC',
      pair: 'USDT',
      mode: 'LIVE',
      isRunning: true,
    };

    const prisma = {
      tradingConfig: {
        findFirst: jest.fn().mockResolvedValue(config),
        update: jest.fn().mockResolvedValue({}),
      },
      binanceCredential: {
        findUnique: jest.fn().mockResolvedValue({
          apiKeyEncrypted: apiKeyEnc.encrypted,
          apiKeyIv: apiKeyEnc.iv,
          secretEncrypted: apiSecretEnc.encrypted,
          secretIv: apiSecretEnc.iv,
        }),
      },
    };

    const reconciliationService = {
      reconcile: jest.fn().mockImplementation(async () => {
        callOrder.push('reconcile');
        return {
          checked: 0,
          closedByExchange: 0,
          reprotected: 0,
          stillUnprotected: 0,
          orphanOrdersCancelled: 0,
        };
      }),
    };

    const agentConfigResolver = {
      checkHealth: jest.fn().mockImplementation(async () => {
        callOrder.push('checkHealth');
        return { healthy: false, agents: [] };
      }),
    };

    const orchestratorService = {
      orchestrateDecision: jest.fn().mockImplementation(async () => {
        callOrder.push('orchestrateDecision');
        throw new Error('should not be reached');
      }),
    };

    const notificationsService = { create: jest.fn().mockResolvedValue({}) };

    const processor = new TradingProcessor(
      prisma as any,
      {} as any,
      notificationsService as any,
      {} as any,
      {} as any,
      orchestratorService as any,
      {} as any,
      agentConfigResolver as any,
      {} as any,
      reconciliationService as any,
      {} as any,
    );

    await processor.runCycle({
      data: { userId: 'user-1', configId: 'config-1' },
      queue: { add: jest.fn() },
    } as any);

    expect(reconciliationService.reconcile).toHaveBeenCalledTimes(1);
    expect(reconciliationService.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', symbol: 'BTCUSDT' }),
    );
    expect(agentConfigResolver.checkHealth).toHaveBeenCalledTimes(1);
    expect(orchestratorService.orchestrateDecision).not.toHaveBeenCalled();
    expect(callOrder).toEqual(['reconcile', 'checkHealth']);
  });

  it('does not reconcile in SANDBOX mode', async () => {
    const config = {
      id: 'config-2',
      userId: 'user-1',
      asset: 'BTC',
      pair: 'USDT',
      mode: 'SANDBOX',
      isRunning: true,
    };

    const prisma = {
      tradingConfig: {
        findFirst: jest.fn().mockResolvedValue(config),
        update: jest.fn().mockResolvedValue({}),
      },
      binanceCredential: { findUnique: jest.fn() },
    };

    const reconciliationService = { reconcile: jest.fn() };
    const agentConfigResolver = {
      checkHealth: jest
        .fn()
        .mockResolvedValue({ healthy: false, agents: [] }),
    };
    const notificationsService = { create: jest.fn().mockResolvedValue({}) };

    const processor = new TradingProcessor(
      prisma as any,
      {} as any,
      notificationsService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      agentConfigResolver as any,
      {} as any,
      reconciliationService as any,
      {} as any,
    );

    await processor.runCycle({
      data: { userId: 'user-1', configId: 'config-2' },
      queue: { add: jest.fn() },
    } as any);

    expect(reconciliationService.reconcile).not.toHaveBeenCalled();
  });
});
