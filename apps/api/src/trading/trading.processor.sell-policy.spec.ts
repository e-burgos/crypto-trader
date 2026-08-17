import { TradingProcessor } from './trading.processor';

describe('TradingProcessor — executeLLMSell sell policy wiring (TASK-010)', () => {
  const makePrismaMock = (positions: any[]) => ({
    position: {
      findMany: jest.fn().mockResolvedValue(positions),
      update: jest.fn().mockResolvedValue({}),
    },
    trade: {
      create: jest.fn().mockResolvedValue({}),
    },
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

  const gatewayMock = { emitToUser: jest.fn() };
  const notificationsMock = { create: jest.fn().mockResolvedValue({}) };

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

  const baseConfig = {
    id: 'config-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'SANDBOX',
    stopLossPct: 0.03,
    minProfitPct: 0.003,
    lossCutEnabled: false,
    lossCutConfidenceThreshold: 0.85,
    lossCutMinLossPct: 0.005,
    lossCutMinEdgeRatio: 2,
  };

  function buildProcessor(prisma: any) {
    return new TradingProcessor(
      prisma,
      gatewayMock as any,
      notificationsMock as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  it('keeps the existing veto with the default config — a losing position is never sold (CA-003 regression)', async () => {
    const prisma = makePrismaMock([{ ...basePosition, entryPrice: 100 }]);
    const processor = buildProcessor(prisma);

    await (processor as any).executeLLMSell(
      'user-1',
      baseConfig,
      'BTCUSDT',
      'SANDBOX',
      undefined,
      undefined,
      98,
      { decisionId: 'dec-1', confidence: 0.95 },
    );

    expect(prisma.trade.create).not.toHaveBeenCalled();
  });

  it('rejects a loss-cut candidate when confidence is below the threshold (CA-001)', async () => {
    const prisma = makePrismaMock([{ ...basePosition, entryPrice: 100 }]);
    const processor = buildProcessor(prisma);

    await (processor as any).executeLLMSell(
      'user-1',
      { ...baseConfig, lossCutEnabled: true },
      'BTCUSDT',
      'SANDBOX',
      undefined,
      undefined,
      98,
      { decisionId: 'dec-1', confidence: 0.5 },
    );

    expect(prisma.trade.create).not.toHaveBeenCalled();
  });

  it('allows the loss-cut sell when confidence clears the threshold and sets exitReason=LOSS_CUT (CA-002)', async () => {
    const prisma = makePrismaMock([{ ...basePosition, entryPrice: 100 }]);
    const processor = buildProcessor(prisma);

    await (processor as any).executeLLMSell(
      'user-1',
      { ...baseConfig, lossCutEnabled: true },
      'BTCUSDT',
      'SANDBOX',
      undefined,
      undefined,
      98,
      { decisionId: 'dec-1', confidence: 0.9 },
    );

    expect(prisma.trade.create).toHaveBeenCalledTimes(1);
    expect(prisma.position.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pos-1' },
        data: expect.objectContaining({ exitReason: 'LOSS_CUT' }),
      }),
    );
  });

  it('sells at take profit and sets exitReason=LLM_SIGNAL, independent of loss cut config', async () => {
    const prisma = makePrismaMock([{ ...basePosition, entryPrice: 100 }]);
    const processor = buildProcessor(prisma);

    await (processor as any).executeLLMSell(
      'user-1',
      baseConfig,
      'BTCUSDT',
      'SANDBOX',
      undefined,
      undefined,
      101,
      { decisionId: 'dec-1', confidence: 0.6 },
    );

    expect(prisma.trade.create).toHaveBeenCalledTimes(1);
    expect(prisma.position.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ exitReason: 'LLM_SIGNAL' }),
      }),
    );
  });
});
