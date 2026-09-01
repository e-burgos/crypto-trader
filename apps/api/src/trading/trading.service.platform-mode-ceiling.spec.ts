import { BadRequestException } from '@nestjs/common';
import { TradingService } from './trading.service';

describe('TradingService — platform operation mode ceiling (FIX-e-burgos-011)', () => {
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

  function prismaWith(platformOperationMode: string, overrides: any = {}) {
    return {
      user: {
        findUnique: jest.fn().mockResolvedValue({ platformOperationMode }),
      },
      tradingConfig: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        ...(overrides.tradingConfig ?? {}),
      },
    };
  }

  describe('startAgent', () => {
    it('refuses to start a LIVE bot while the platform is in SANDBOX', async () => {
      const prisma = prismaWith('SANDBOX', {
        tradingConfig: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'cfg-1',
            userId: 'user-1',
            mode: 'LIVE',
            isRunning: false,
            asset: 'BTC',
            pair: 'USDT',
          }),
        },
      });
      const queue = { add: jest.fn() };
      const service = buildService(prisma, queue);

      await expect(
        service.startAgent('user-1', { configId: 'cfg-1' } as any),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.tradingConfig.update).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('refuses to start a LIVE bot while the platform is in TESTNET', async () => {
      const prisma = prismaWith('TESTNET', {
        tradingConfig: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'cfg-1',
            userId: 'user-1',
            mode: 'LIVE',
            isRunning: false,
          }),
        },
      });
      const service = buildService(prisma);

      await expect(
        service.startAgent('user-1', { configId: 'cfg-1' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('starts a bot whose mode matches the platform mode', async () => {
      const prisma = prismaWith('LIVE', {
        tradingConfig: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'cfg-1',
            userId: 'user-1',
            mode: 'LIVE',
            isRunning: false,
            asset: 'BTC',
            pair: 'USDT',
          }),
          count: jest.fn().mockResolvedValue(0),
          update: jest.fn().mockResolvedValue({}),
        },
      });
      const queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
      const service = buildService(prisma, queue);

      const result = await service.startAgent('user-1', {
        configId: 'cfg-1',
      } as any);

      expect(result.started).toBe(true);
      expect(queue.add).toHaveBeenCalled();
    });

    it('starts a SANDBOX bot while the platform is in LIVE — the mode is a ceiling, not an equality', async () => {
      const prisma = prismaWith('LIVE', {
        tradingConfig: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'cfg-2',
            userId: 'user-1',
            mode: 'SANDBOX',
            isRunning: false,
            asset: 'BTC',
            pair: 'USDT',
          }),
          count: jest.fn().mockResolvedValue(0),
          update: jest.fn().mockResolvedValue({}),
        },
      });
      const queue = { add: jest.fn().mockResolvedValue({ id: 'job-2' }) };
      const service = buildService(prisma, queue);

      const result = await service.startAgent('user-1', {
        configId: 'cfg-2',
      } as any);

      expect(result.started).toBe(true);
    });
  });

  describe('createConfig', () => {
    it('refuses to create a LIVE config while the platform is in SANDBOX', async () => {
      const prisma = prismaWith('SANDBOX');
      const service = buildService(prisma);

      await expect(
        service.createConfig('user-1', {
          asset: 'BTC',
          pair: 'USDT',
          mode: 'LIVE',
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.tradingConfig.create).not.toHaveBeenCalled();
    });

    it('creates a SANDBOX config while the platform is in SANDBOX', async () => {
      const prisma = prismaWith('SANDBOX', {
        tradingConfig: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({ id: 'cfg-3' }),
        },
      });
      const service = buildService(prisma);

      const result = await service.createConfig('user-1', {
        asset: 'BTC',
        pair: 'USDT',
        mode: 'SANDBOX',
      } as any);

      expect(result).toEqual({ id: 'cfg-3' });
    });
  });

  describe('updateConfig', () => {
    it('refuses to raise an existing config above the platform mode', async () => {
      const prisma = prismaWith('SANDBOX', {
        tradingConfig: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'cfg-1', userId: 'user-1', mode: 'SANDBOX' }),
        },
      });
      const service = buildService(prisma);

      await expect(
        service.updateConfig('user-1', 'cfg-1', { mode: 'LIVE' } as any),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.tradingConfig.update).not.toHaveBeenCalled();
    });

    it('applies an update that does not change the mode', async () => {
      const prisma = prismaWith('SANDBOX', {
        tradingConfig: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'cfg-1', userId: 'user-1', mode: 'SANDBOX' }),
          update: jest.fn().mockResolvedValue({ id: 'cfg-1', buyThreshold: 80 }),
        },
      });
      const service = buildService(prisma);

      const result = await service.updateConfig('user-1', 'cfg-1', {
        buyThreshold: 80,
      } as any);

      expect(result).toEqual({ id: 'cfg-1', buyThreshold: 80 });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });
});
