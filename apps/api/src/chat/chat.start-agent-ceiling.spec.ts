import { BadRequestException } from '@nestjs/common';
import { ChatService } from './chat.service';

jest.mock('../../generated/prisma/enums', () => ({
  LLMProvider: {},
  ChatRole: { USER: 'USER', ASSISTANT: 'ASSISTANT', SYSTEM: 'SYSTEM' },
  AgentId: {},
  LLMSource: {},
}));

describe('ChatService — start_agent without TradingService honours the platform ceiling (FIX-e-burgos-011)', () => {
  function buildPrisma(platformOperationMode: string, mode: string) {
    return {
      chatSession: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'session-1', userId: 'user-1' }),
      },
      tradingConfig: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'cfg-1', userId: 'user-1', mode }),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ platformOperationMode }),
      },
      chatMessage: { create: jest.fn() },
    };
  }

  const startAgent = {
    tool: 'start_agent',
    params: { configId: 'cfg-1' },
    confirmation: 'confirmed',
  } as any;

  it('refuses to start a LIVE bot while the platform is in SANDBOX', async () => {
    const prisma = buildPrisma('SANDBOX', 'LIVE');
    const service = new ChatService(prisma as any);

    await expect(
      service.executeTool('user-1', 'session-1', startAgent),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.tradingConfig.update).not.toHaveBeenCalled();
  });

  it('starts a SANDBOX bot while the platform is in SANDBOX', async () => {
    const prisma = buildPrisma('SANDBOX', 'SANDBOX');
    const service = new ChatService(prisma as any);

    const result = await service.executeTool('user-1', 'session-1', startAgent);

    expect(result.result).toEqual({ started: true, configId: 'cfg-1' });
    expect(prisma.tradingConfig.update).toHaveBeenCalled();
  });
});
