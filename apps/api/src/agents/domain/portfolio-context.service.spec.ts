import { PortfolioContextService } from './portfolio-context.service';

function createMockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    position: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    trade: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    sandboxWallet: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as any;
}

function buildService(prisma?: any) {
  const p = prisma ?? createMockPrisma();
  return { service: new PortfolioContextService(p), prisma: p };
}

describe('PortfolioContextService', () => {
  describe('build', () => {
    it('composes the symbol from asset + pair, never from a stored Position.pair alone', async () => {
      const prisma = createMockPrisma({
        position: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([
              {
                id: 'pos-1',
                asset: 'BTC',
                pair: 'USDT',
                mode: 'SANDBOX',
                quantity: 0.1,
                entryPrice: 65_000,
                entryAt: new Date('2026-08-10'),
              },
            ])
            .mockResolvedValueOnce([]),
        },
      });
      const { service } = buildService(prisma);

      const result = await service.build({ userId: 'user-1' });

      expect(result.positions).toHaveLength(1);
      expect(result.positions[0].symbol).toBe('BTCUSDT');
      expect(result.positions[0].notionalAtEntryUsd).toBe(6500);
      expect(result.exposureAtEntryUsd).toBe(6500);
    });

    it('sums realizedPnlUsd from Position.pnl of recent CLOSED positions, not from Trade', async () => {
      const prisma = createMockPrisma({
        position: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ pnl: 100 }, { pnl: -20 }, { pnl: null }]),
        },
      });
      const { service } = buildService(prisma);

      const result = await service.build({ userId: 'user-1' });

      expect(result.realizedPnlUsd).toBe(80);
    });

    it('maps wallets by currency, not by a nonexistent asset field', async () => {
      const prisma = createMockPrisma({
        sandboxWallet: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: 'w-1', currency: 'USDT', balance: 10_000 }]),
        },
      });
      const { service } = buildService(prisma);

      const result = await service.build({ userId: 'user-1' });

      expect(result.wallets).toEqual([{ currency: 'USDT', balance: 10_000 }]);
    });

    it('derives recentTrades symbol from the related Position, sums fees, and respects the limit', async () => {
      const prisma = createMockPrisma({
        trade: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 't-1',
              type: 'BUY',
              price: 65_000,
              quantity: 0.1,
              fee: 6.5,
              executedAt: new Date('2026-08-10'),
              position: { asset: 'BTC', pair: 'USDT' },
            },
          ]),
        },
      });
      const { service } = buildService(prisma);

      const result = await service.build({ userId: 'user-1', recentTradesLimit: 5 });

      expect(prisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
      expect(result.recentTrades).toHaveLength(1);
      expect(result.recentTrades[0].symbol).toBe('BTCUSDT');
      expect(result.feesUsd).toBe(6.5);
    });

    it('filters by configId through the Position relation when scoping trades', async () => {
      const prisma = createMockPrisma();
      const { service } = buildService(prisma);

      await service.build({ userId: 'user-1', configId: 'cfg-1' });

      expect(prisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            position: { configId: 'cfg-1' },
          }),
        }),
      );
      expect(prisma.position.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ configId: 'cfg-1' }),
        }),
      );
    });

    it('returns an empty snapshot when the user has no data', async () => {
      const { service } = buildService();

      const result = await service.build({ userId: 'user-1' });

      expect(result.positions).toEqual([]);
      expect(result.exposureAtEntryUsd).toBe(0);
      expect(result.realizedPnlUsd).toBe(0);
      expect(result.feesUsd).toBe(0);
      expect(result.wallets).toEqual([]);
      expect(result.recentTrades).toEqual([]);
    });
  });
});
