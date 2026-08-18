import { Test, TestingModule } from '@nestjs/testing';
import {
  AgentPromptService,
  AgentPromptUnavailableError,
} from './agent-prompt.service';
import { PrismaService } from '../prisma/prisma.service';

const PERSONA_IDS = [
  'orchestrator',
  'platform',
  'operations',
  'market',
  'blockchain',
  'risk',
] as const;

function buildDefinitions(
  overrides: Partial<
    Record<
      (typeof PERSONA_IDS)[number],
      { isActive: boolean; systemPrompt: string }
    >
  > = {},
) {
  return PERSONA_IDS.map((id) => ({
    id,
    isActive: overrides[id]?.isActive ?? true,
    systemPrompt: overrides[id]?.systemPrompt ?? `prompt-${id}`,
  }));
}

const mockPrismaService = {
  agentDefinition: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('AgentPromptService', () => {
  let service: AgentPromptService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentPromptService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AgentPromptService>(AgentPromptService);
  });

  describe('onModuleInit', () => {
    it('resolves when the 6 persona AgentDefinition rows are active with a prompt', async () => {
      mockPrismaService.agentDefinition.findMany.mockResolvedValue(
        buildDefinitions(),
      );

      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });

    it('throws naming the missing ids when a row does not exist', async () => {
      mockPrismaService.agentDefinition.findMany.mockResolvedValue(
        buildDefinitions().filter((d) => d.id !== 'risk'),
      );

      await expect(service.onModuleInit()).rejects.toThrow(/risk/);
    });

    it('throws when a row exists but is inactive', async () => {
      mockPrismaService.agentDefinition.findMany.mockResolvedValue(
        buildDefinitions({ market: { isActive: false, systemPrompt: 'x' } }),
      );

      await expect(service.onModuleInit()).rejects.toThrow(/market/);
    });

    it('throws when a row exists but has an empty systemPrompt', async () => {
      mockPrismaService.agentDefinition.findMany.mockResolvedValue(
        buildDefinitions({
          blockchain: { isActive: true, systemPrompt: '' },
        }),
      );

      await expect(service.onModuleInit()).rejects.toThrow(/blockchain/);
    });
  });

  describe('getSystemPrompt', () => {
    it('returns the systemPrompt from AgentDefinition', async () => {
      mockPrismaService.agentDefinition.findUnique.mockResolvedValue({
        systemPrompt: 'You are SIGMA',
        isActive: true,
      });

      const prompt = await service.getSystemPrompt('market');

      expect(prompt).toBe('You are SIGMA');
      expect(mockPrismaService.agentDefinition.findUnique).toHaveBeenCalledWith(
        {
          where: { id: 'market' },
          select: { systemPrompt: true, isActive: true },
        },
      );
    });

    it('serves subsequent calls within the TTL from cache without hitting Prisma', async () => {
      mockPrismaService.agentDefinition.findUnique.mockResolvedValue({
        systemPrompt: 'You are SIGMA',
        isActive: true,
      });

      await service.getSystemPrompt('market');
      await service.getSystemPrompt('market');

      expect(mockPrismaService.agentDefinition.findUnique).toHaveBeenCalledTimes(
        1,
      );
    });

    it('throws AgentPromptUnavailableError when the row is missing', async () => {
      mockPrismaService.agentDefinition.findUnique.mockResolvedValue(null);

      await expect(service.getSystemPrompt('risk')).rejects.toThrow(
        AgentPromptUnavailableError,
      );
    });

    it('throws AgentPromptUnavailableError when the row is inactive', async () => {
      mockPrismaService.agentDefinition.findUnique.mockResolvedValue({
        systemPrompt: 'inactive prompt',
        isActive: false,
      });

      await expect(service.getSystemPrompt('risk')).rejects.toThrow(
        AgentPromptUnavailableError,
      );
    });

    it('throws AgentPromptUnavailableError when the systemPrompt is empty', async () => {
      mockPrismaService.agentDefinition.findUnique.mockResolvedValue({
        systemPrompt: '',
        isActive: true,
      });

      await expect(service.getSystemPrompt('risk')).rejects.toThrow(
        AgentPromptUnavailableError,
      );
    });
  });

  describe('invalidate', () => {
    it('forces a fresh read for the given agent after invalidation', async () => {
      mockPrismaService.agentDefinition.findUnique.mockResolvedValue({
        systemPrompt: 'v1',
        isActive: true,
      });
      await service.getSystemPrompt('platform');

      mockPrismaService.agentDefinition.findUnique.mockResolvedValue({
        systemPrompt: 'v2',
        isActive: true,
      });
      service.invalidate('platform');
      const prompt = await service.getSystemPrompt('platform');

      expect(prompt).toBe('v2');
      expect(mockPrismaService.agentDefinition.findUnique).toHaveBeenCalledTimes(
        2,
      );
    });

    it('clears every cached agent when called with no argument', async () => {
      mockPrismaService.agentDefinition.findUnique.mockResolvedValue({
        systemPrompt: 'v1',
        isActive: true,
      });
      await service.getSystemPrompt('platform');
      await service.getSystemPrompt('operations');

      service.invalidate();

      await service.getSystemPrompt('platform');
      await service.getSystemPrompt('operations');

      expect(mockPrismaService.agentDefinition.findUnique).toHaveBeenCalledTimes(
        4,
      );
    });
  });
});
