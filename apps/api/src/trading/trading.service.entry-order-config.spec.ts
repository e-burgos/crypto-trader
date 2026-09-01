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

describe('TradingService — entryOrderMode / TTL / trailingDelta persistence (spec-005 cycle-02 TASK-011)', () => {
  describe('createConfig', () => {
    it('passes the three fields through to prisma.tradingConfig.create when provided', async () => {
      const prisma = prismaWith();
      const service = buildService(prisma);

      await service.createConfig('user-1', {
        asset: 'BTC',
        pair: 'USDT',
        mode: 'SANDBOX',
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

    it('omits explicit overrides when absent so Prisma column defaults apply', async () => {
      const prisma = prismaWith();
      const service = buildService(prisma);

      await service.createConfig('user-1', {
        asset: 'BTC',
        pair: 'USDT',
        mode: 'SANDBOX',
      } as any);

      expect(prisma.tradingConfig.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entryOrderMode: 'MARKET',
            entryOrderTtlMinutes: 120,
            entryTrailingDeltaBips: null,
          }),
        }),
      );
    });
  });

  describe('updateConfig', () => {
    it('passes the three fields through to prisma.tradingConfig.update when provided', async () => {
      const prisma = prismaWith({
        tradingConfig: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'cfg-1', userId: 'user-1', mode: 'SANDBOX' }),
        },
      });
      const service = buildService(prisma);

      await service.updateConfig('user-1', 'cfg-1', {
        entryOrderMode: 'LIMIT_MAKER',
        entryOrderTtlMinutes: 30,
        entryTrailingDeltaBips: 500,
      } as any);

      expect(prisma.tradingConfig.update).toHaveBeenCalledWith({
        where: { id: 'cfg-1' },
        data: {
          entryOrderMode: 'LIMIT_MAKER',
          entryOrderTtlMinutes: 30,
          entryTrailingDeltaBips: 500,
        },
      });
    });

    it('does not include the three fields in the update payload when absent from the DTO', async () => {
      const prisma = prismaWith({
        tradingConfig: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'cfg-1', userId: 'user-1', mode: 'SANDBOX' }),
        },
      });
      const service = buildService(prisma);

      await service.updateConfig('user-1', 'cfg-1', { buyThreshold: 80 } as any);

      const callArgs = prisma.tradingConfig.update.mock.calls[0][0];
      expect(callArgs.data).not.toHaveProperty('entryOrderMode');
      expect(callArgs.data).not.toHaveProperty('entryOrderTtlMinutes');
      expect(callArgs.data).not.toHaveProperty('entryTrailingDeltaBips');
    });
  });
});
