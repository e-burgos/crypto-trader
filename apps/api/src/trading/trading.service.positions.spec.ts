import { TradingService } from './trading.service';

describe('TradingService — getPositions (EP-008 cycle-03 extended select)', () => {
  function buildService(prisma: any) {
    return new TradingService(
      prisma,
      { add: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  const fullyPopulatedRow = {
    id: 'pos-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'LIVE',
    entryPrice: 100,
    exitPrice: null,
    quantity: 0.5,
    entryAt: new Date('2026-08-01T00:00:00.000Z'),
    exitAt: null,
    fees: 0.05,
    status: 'OPEN',
    pnl: null,
    protectionStatus: 'PROTECTED',
    stopPrice: 97,
    takeProfitPrice: 110,
    highWaterPrice: 103,
    trailingActive: true,
    initialQuantity: 1,
    partialExitCount: 1,
    realizedPnl: 12.5,
    exitReason: null,
    config: {
      stopLossPct: 0.03,
      takeProfitPct: 0.05,
      maxTradePct: 0.1,
      buyThreshold: 70,
      sellThreshold: 70,
      minIntervalMinutes: 15,
      orderPriceOffsetPct: 0,
      maxConcurrentPositions: 3,
    },
    trades: [],
  };

  const neutralRow = {
    ...fullyPopulatedRow,
    id: 'pos-2',
    protectionStatus: 'NONE',
    stopPrice: null,
    takeProfitPrice: null,
    highWaterPrice: null,
    trailingActive: false,
    initialQuantity: null,
    partialExitCount: 0,
    realizedPnl: 0,
    exitReason: null,
  };

  function makePrisma(rows: any[]) {
    return {
      position: {
        findMany: jest.fn().mockResolvedValue(rows),
        count: jest.fn().mockResolvedValue(rows.length),
      },
    };
  }

  it('returns the 9 cycle-02 fields for a position with an active trailing/partial state (CA-073)', async () => {
    const prisma = makePrisma([fullyPopulatedRow]);
    const service = buildService(prisma);

    const result = await service.getPositions('user-1');

    expect(result.positions[0]).toEqual(
      expect.objectContaining({
        protectionStatus: 'PROTECTED',
        stopPrice: 97,
        takeProfitPrice: 110,
        highWaterPrice: 103,
        trailingActive: true,
        initialQuantity: 1,
        partialExitCount: 1,
        realizedPnl: 12.5,
        exitReason: null,
      }),
    );
  });

  it('mirrors the values Prisma returns without deriving them differently (CA-074)', async () => {
    const prisma = makePrisma([fullyPopulatedRow]);
    const service = buildService(prisma);

    const result = await service.getPositions('user-1');

    expect(result.positions[0].stopPrice).toBe(fullyPopulatedRow.stopPrice);
    expect(result.positions[0].realizedPnl).toBe(fullyPopulatedRow.realizedPnl);
    expect(result.positions[0].partialExitCount).toBe(
      fullyPopulatedRow.partialExitCount,
    );
  });

  it('includes the nullable fields as explicit null, never as an absent key (CE-11)', async () => {
    const prisma = makePrisma([neutralRow]);
    const service = buildService(prisma);

    const result = await service.getPositions('user-1');
    const position = result.positions[0];

    expect(position).toHaveProperty('stopPrice', null);
    expect(position).toHaveProperty('takeProfitPrice', null);
    expect(position).toHaveProperty('highWaterPrice', null);
    expect(position).toHaveProperty('initialQuantity', null);
    expect(position).toHaveProperty('exitReason', null);
    // Neutral, DB-defaulted fields stay defined values, never invented like a fake 0 for stopPrice.
    expect(position.protectionStatus).toBe('NONE');
    expect(position.trailingActive).toBe(false);
    expect(position.partialExitCount).toBe(0);
    expect(position.realizedPnl).toBe(0);
  });

  it('selects the 9 new fields from Prisma', async () => {
    const prisma = makePrisma([fullyPopulatedRow]);
    const service = buildService(prisma);

    await service.getPositions('user-1');

    const selectArg = prisma.position.findMany.mock.calls[0][0].select;
    expect(selectArg).toEqual(
      expect.objectContaining({
        protectionStatus: true,
        stopPrice: true,
        takeProfitPrice: true,
        highWaterPrice: true,
        trailingActive: true,
        initialQuantity: true,
        partialExitCount: true,
        realizedPnl: true,
        exitReason: true,
      }),
    );
  });
});
