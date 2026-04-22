import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  PlatformLLMProviderService,
  ToggleResult,
} from './platform-llm-provider.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('../../generated/prisma/enums', () => ({
  LLMProvider: {
    CLAUDE: 'CLAUDE',
    OPENAI: 'OPENAI',
    GROQ: 'GROQ',
    GEMINI: 'GEMINI',
    MISTRAL: 'MISTRAL',
    TOGETHER: 'TOGETHER',
    OPENROUTER: 'OPENROUTER',
  },
  NotificationType: {
    TRADE_EXECUTED: 'TRADE_EXECUTED',
    STOP_LOSS_TRIGGERED: 'STOP_LOSS_TRIGGERED',
    TAKE_PROFIT_HIT: 'TAKE_PROFIT_HIT',
    AGENT_ERROR: 'AGENT_ERROR',
    AGENT_STARTED: 'AGENT_STARTED',
    AGENT_STOPPED: 'AGENT_STOPPED',
    AGENT_KILLED: 'AGENT_KILLED',
    LLM_PROVIDER_DISABLED: 'LLM_PROVIDER_DISABLED',
  },
}));

// Use string values since the enum module may not load correctly under jest mocks
const LLMProvider = {
  CLAUDE: 'CLAUDE' as any,
  OPENAI: 'OPENAI' as any,
  GROQ: 'GROQ' as any,
  OPENROUTER: 'OPENROUTER' as any,
};
const NotificationType = {
  LLM_PROVIDER_DISABLED: 'LLM_PROVIDER_DISABLED' as any,
};

const mockPrisma = {
  platformLLMProvider: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  adminAction: {
    create: jest.fn(),
  },
  agentConfig: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockNotifications = {
  create: jest.fn(),
};

describe('PlatformLLMProviderService', () => {
  let service: PlatformLLMProviderService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformLLMProviderService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();
    service = module.get<PlatformLLMProviderService>(
      PlatformLLMProviderService,
    );
  });

  describe('getAll', () => {
    it('should return all providers ordered by provider', async () => {
      const providers = [
        { id: '1', provider: 'CLAUDE', isActive: true },
        { id: '2', provider: 'OPENAI', isActive: true },
      ];
      mockPrisma.platformLLMProvider.findMany.mockResolvedValue(providers);

      const result = await service.getAll();
      expect(result).toEqual(providers);
      expect(mockPrisma.platformLLMProvider.findMany).toHaveBeenCalledWith({
        orderBy: { provider: 'asc' },
      });
    });
  });

  describe('getActiveProviders', () => {
    it('should return only active provider enums', async () => {
      mockPrisma.platformLLMProvider.findMany.mockResolvedValue([
        { provider: 'CLAUDE' },
        { provider: 'OPENROUTER' },
      ]);

      const result = await service.getActiveProviders();
      expect(result).toEqual(['CLAUDE', 'OPENROUTER']);
    });
  });

  describe('isProviderActive', () => {
    it('should return true for active provider', async () => {
      mockPrisma.platformLLMProvider.findUnique.mockResolvedValue({
        isActive: true,
      });

      expect(await service.isProviderActive(LLMProvider.CLAUDE)).toBe(true);
    });

    it('should return false for inactive provider', async () => {
      mockPrisma.platformLLMProvider.findUnique.mockResolvedValue({
        isActive: false,
      });

      expect(await service.isProviderActive(LLMProvider.GROQ)).toBe(false);
    });

    it('should return true if no record exists', async () => {
      mockPrisma.platformLLMProvider.findUnique.mockResolvedValue(null);

      expect(await service.isProviderActive(LLMProvider.CLAUDE)).toBe(true);
    });
  });

  describe('assertProviderActive', () => {
    it('should not throw for active provider', async () => {
      mockPrisma.platformLLMProvider.findUnique.mockResolvedValue({
        isActive: true,
      });

      await expect(
        service.assertProviderActive(LLMProvider.CLAUDE),
      ).resolves.toBeUndefined();
    });

    it('should throw ConflictException for inactive provider', async () => {
      mockPrisma.platformLLMProvider.findUnique.mockResolvedValue({
        isActive: false,
      });

      await expect(
        service.assertProviderActive(LLMProvider.GROQ),
      ).rejects.toThrow(ConflictException);
    });

    it('should not throw if no record exists', async () => {
      mockPrisma.platformLLMProvider.findUnique.mockResolvedValue(null);

      await expect(
        service.assertProviderActive(LLMProvider.CLAUDE),
      ).resolves.toBeUndefined();
    });
  });

  describe('toggle', () => {
    const adminId = 'admin-1';

    it('should enable provider with no side effects', async () => {
      mockPrisma.platformLLMProvider.findUnique.mockResolvedValue({
        provider: LLMProvider.GROQ,
        isActive: false,
      });
      mockPrisma.platformLLMProvider.update.mockResolvedValue({});
      mockPrisma.adminAction.create.mockResolvedValue({});

      const result: ToggleResult = await service.toggle(
        LLMProvider.GROQ,
        true,
        adminId,
      );

      expect(result).toEqual({
        provider: LLMProvider.GROQ,
        isActive: true,
        affectedAgentConfigs: 0,
        affectedUsers: 0,
      });
      expect(mockPrisma.platformLLMProvider.update).toHaveBeenCalledWith({
        where: { provider: LLMProvider.GROQ },
        data: { isActive: true, updatedBy: adminId },
      });
      expect(mockPrisma.adminAction.create).toHaveBeenCalledWith({
        data: {
          adminId,
          action: 'ENABLE_PROVIDER',
          details: { provider: LLMProvider.GROQ },
        },
      });
      // No agent configs affected on enable
      expect(mockPrisma.agentConfig.findMany).not.toHaveBeenCalled();
    });

    it('should disable provider, delete affected configs, and notify users', async () => {
      mockPrisma.platformLLMProvider.findUnique.mockResolvedValue({
        provider: LLMProvider.GROQ,
        isActive: true,
      });
      mockPrisma.platformLLMProvider.update.mockResolvedValue({});
      mockPrisma.adminAction.create.mockResolvedValue({});
      mockPrisma.agentConfig.findMany.mockResolvedValue([
        { id: 'cfg-1', userId: 'user-1' },
        { id: 'cfg-2', userId: 'user-1' },
        { id: 'cfg-3', userId: 'user-2' },
      ]);
      mockPrisma.agentConfig.deleteMany.mockResolvedValue({ count: 3 });
      mockNotifications.create.mockResolvedValue({});

      const result: ToggleResult = await service.toggle(
        LLMProvider.GROQ,
        false,
        adminId,
      );

      expect(result).toEqual({
        provider: LLMProvider.GROQ,
        isActive: false,
        affectedAgentConfigs: 3,
        affectedUsers: 2,
      });
      expect(mockPrisma.agentConfig.deleteMany).toHaveBeenCalledWith({
        where: { provider: LLMProvider.GROQ },
      });
      // 2 unique users notified
      expect(mockNotifications.create).toHaveBeenCalledTimes(2);
      expect(mockNotifications.create).toHaveBeenCalledWith(
        'user-1',
        NotificationType.LLM_PROVIDER_DISABLED,
        expect.any(String),
      );
      expect(mockNotifications.create).toHaveBeenCalledWith(
        'user-2',
        NotificationType.LLM_PROVIDER_DISABLED,
        expect.any(String),
      );
    });

    it('should disable with no affected configs', async () => {
      mockPrisma.platformLLMProvider.findUnique.mockResolvedValue({
        provider: LLMProvider.CLAUDE,
        isActive: true,
      });
      mockPrisma.platformLLMProvider.update.mockResolvedValue({});
      mockPrisma.adminAction.create.mockResolvedValue({});
      mockPrisma.agentConfig.findMany.mockResolvedValue([]);

      const result = await service.toggle(LLMProvider.CLAUDE, false, adminId);

      expect(result.affectedAgentConfigs).toBe(0);
      expect(result.affectedUsers).toBe(0);
      expect(mockPrisma.agentConfig.deleteMany).not.toHaveBeenCalled();
      expect(mockNotifications.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for unknown provider', async () => {
      mockPrisma.platformLLMProvider.findUnique.mockResolvedValue(null);

      await expect(
        service.toggle(LLMProvider.GROQ, false, adminId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
