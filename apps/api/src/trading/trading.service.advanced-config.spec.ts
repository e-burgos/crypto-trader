import { TradingService } from './trading.service';

function buildService(prisma: any, queue: any = { add: jest.fn() }) {
  return new TradingService(
    prisma,
    queue as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

function prismaWith(overrides: any = {}) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({ platformOperationMode: 'SANDBOX' }),
    },
    tradingConfig: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'cfg-1' }),
      update: jest.fn().mockResolvedValue({ id: 'cfg-1' }),
      ...(overrides.tradingConfig ?? {}),
    },
  };
}

const baseCreateDto = {
  asset: 'BTC',
  pair: 'USDT',
  mode: 'SANDBOX',
};

const advancedFieldValues = {
  lossCutEnabled: true,
  lossCutConfidenceThreshold: 0.6,
  lossCutMinLossPct: 0.02,
  lossCutMinEdgeRatio: 5,
  smartSizingEnabled: true,
  reduceSizeFactor: 0.3,
  nativeProtectionEnabled: true,
  closeOnProtectionFailure: true,
  stopLimitOffsetPct: 0.01,
  trailingStopEnabled: true,
  trailingStopPct: 0.04,
  trailingActivationPct: 0.02,
  partialTpEnabled: true,
  partialTpTriggerPct: 0.03,
  partialTpSellPct: 0.4,
  moveStopToBreakevenAfterPartial: false,
  maxPositionHoldMinutes: 720,
  deterministicGateEnabled: true,
  gatePriceChangePct: 0.01,
  reactiveLoopEnabled: true,
  maxActionsPerHour: 12,
  minActionIntervalSec: 300,
};

describe('TradingService.createConfig — advanced fields persistence (FIX-e-burgos-026)', () => {
  it('passes each of the 22 advanced fields through to prisma.tradingConfig.create when present', async () => {
    const prisma = prismaWith();
    const service = buildService(prisma);

    await service.createConfig('user-1', {
      ...baseCreateDto,
      ...advancedFieldValues,
    } as any);

    const callArgs = prisma.tradingConfig.create.mock.calls[0][0];
    for (const [field, value] of Object.entries(advancedFieldValues)) {
      expect(callArgs.data[field]).toBe(value);
    }
  });

  it('yields the same create payload as before the fix when the advanced fields are absent (CA-002 equivalence)', async () => {
    const prisma = prismaWith();
    const service = buildService(prisma);

    await service.createConfig('user-1', { ...baseCreateDto } as any);

    expect(prisma.tradingConfig.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        name: '',
        asset: 'BTC',
        pair: 'USDT',
        mode: 'SANDBOX',
        buyThreshold: 70,
        sellThreshold: 70,
        stopLossPct: 0.03,
        takeProfitPct: 0.05,
        minProfitPct: 0.003,
        maxTradePct: 0.05,
        maxConcurrentPositions: 2,
        minIntervalMinutes: 5,
        intervalMode: 'AGENT',
        orderPriceOffsetPct: 0,
        riskProfile: 'MODERATE',
        entryOrderMode: 'MARKET',
        entryOrderTtlMinutes: 120,
        entryTrailingDeltaBips: null,
        maxPositionHoldMinutes: null,
      },
    });
  });

  it('keeps persisting the three entry-order fields (spec-005 cycle-02 TASK-011 stays green)', async () => {
    const prisma = prismaWith();
    const service = buildService(prisma);

    await service.createConfig('user-1', {
      ...baseCreateDto,
      entryOrderMode: 'OCO',
      entryOrderTtlMinutes: 90,
      entryTrailingDeltaBips: 250,
    } as any);

    expect(prisma.tradingConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entryOrderMode: 'OCO',
          entryOrderTtlMinutes: 90,
          entryTrailingDeltaBips: 250,
        }),
      }),
    );
  });
});
