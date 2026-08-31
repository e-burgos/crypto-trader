import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService — lowering the platform mode with agents running (FIX-e-burgos-011)', () => {
  function buildService(prisma: any) {
    return new UsersService(prisma, {} as any);
  }

  it('refuses to switch down to SANDBOX while a LIVE agent is running', async () => {
    const prisma = {
      binanceCredential: { findUnique: jest.fn() },
      tradingConfig: { count: jest.fn().mockResolvedValue(1) },
      user: { update: jest.fn() },
    };
    const service = buildService(prisma as any);

    await expect(
      service.updateOperationMode('user-1', { mode: 'SANDBOX' } as any),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.tradingConfig.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          isRunning: true,
          mode: { in: ['TESTNET', 'LIVE'] },
        }),
      }),
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('switches down to SANDBOX when nothing is running above it', async () => {
    const prisma = {
      binanceCredential: { findUnique: jest.fn() },
      tradingConfig: { count: jest.fn().mockResolvedValue(0) },
      user: { update: jest.fn().mockResolvedValue({}) },
    };
    const service = buildService(prisma as any);

    const result = await service.updateOperationMode('user-1', {
      mode: 'SANDBOX',
    } as any);

    expect(result).toEqual({ platformOperationMode: 'SANDBOX' });
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('does not query running agents when switching up to LIVE', async () => {
    const prisma = {
      binanceCredential: {
        findUnique: jest.fn().mockResolvedValue({ id: 'cred-1' }),
      },
      tradingConfig: { count: jest.fn().mockResolvedValue(3) },
      user: { update: jest.fn().mockResolvedValue({}) },
    };
    const service = buildService(prisma as any);

    const result = await service.updateOperationMode('user-1', {
      mode: 'LIVE',
    } as any);

    expect(result).toEqual({ platformOperationMode: 'LIVE' });
    expect(prisma.tradingConfig.count).not.toHaveBeenCalled();
  });
});
