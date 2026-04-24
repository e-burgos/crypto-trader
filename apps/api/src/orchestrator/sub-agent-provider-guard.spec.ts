import { ConflictException } from '@nestjs/common';

jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('../users/utils/encryption.util', () => ({
  decrypt: jest.fn().mockReturnValue('fake-api-key'),
  encrypt: jest.fn().mockReturnValue({ encrypted: 'enc', iv: 'iv' }),
}));
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
  AgentId: {
    platform: 'platform',
    operations: 'operations',
    market: 'market',
    blockchain: 'blockchain',
    risk: 'risk',
    orchestrator: 'orchestrator',
    routing: 'routing',
    synthesis: 'synthesis',
  },
  LLMSource: { ORCHESTRATOR: 'ORCHESTRATOR', CHAT: 'CHAT', MANUAL: 'MANUAL' },
}));

import { SubAgentService } from './sub-agent.service';

const LLMProvider = {
  CLAUDE: 'CLAUDE' as any,
  OPENAI: 'OPENAI' as any,
  OPENROUTER: 'OPENROUTER' as any,
};

const mockPrisma = {
  lLMCredential: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockPlatformLLMProviderService = {
  assertProviderActive: jest.fn(),
};

const mockAgentConfigResolver = {
  resolveConfig: jest.fn(),
};

describe('SubAgentService.getProvider — provider guard (Spec 38)', () => {
  let service: SubAgentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SubAgentService(
      mockPrisma as any,
      undefined, // ragService
      undefined, // llmUsageService
      mockAgentConfigResolver as any,
      mockPlatformLLMProviderService as any,
    );
  });

  it('should call assertProviderActive when override provider is used', async () => {
    const cred = {
      apiKeyEncrypted: Buffer.from('test').toString('hex'),
      apiKeyIv: Buffer.from('1234567890123456').toString('hex'),
      provider: LLMProvider.CLAUDE,
      selectedModel: 'claude-sonnet-4',
      fallbackModels: [],
    };
    mockPrisma.lLMCredential.findFirst.mockResolvedValue(cred);
    mockPlatformLLMProviderService.assertProviderActive.mockResolvedValue(
      undefined,
    );

    await service.getProvider('user1', 'market', {
      provider: LLMProvider.CLAUDE,
      model: 'claude-sonnet-4',
    });

    expect(
      mockPlatformLLMProviderService.assertProviderActive,
    ).toHaveBeenCalledWith(LLMProvider.CLAUDE);
  });

  it('should throw ConflictException when override provider is disabled', async () => {
    const cred = {
      apiKeyEncrypted: Buffer.from('test').toString('hex'),
      apiKeyIv: Buffer.from('1234567890123456').toString('hex'),
      provider: LLMProvider.OPENAI,
      selectedModel: 'gpt-4o',
      fallbackModels: [],
    };
    mockPrisma.lLMCredential.findFirst.mockResolvedValue(cred);
    mockPlatformLLMProviderService.assertProviderActive.mockRejectedValue(
      new ConflictException('Provider OPENAI is disabled'),
    );

    await expect(
      service.getProvider('user1', 'market', {
        provider: LLMProvider.OPENAI,
        model: 'gpt-4o',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should call assertProviderActive for AgentConfigResolver resolved provider', async () => {
    mockPrisma.lLMCredential.findFirst.mockResolvedValueOnce({
      // resolver branch
      apiKeyEncrypted: Buffer.from('test').toString('hex'),
      apiKeyIv: Buffer.from('1234567890123456').toString('hex'),
      provider: LLMProvider.CLAUDE,
      selectedModel: 'claude-sonnet-4',
      fallbackModels: [],
    });
    mockAgentConfigResolver.resolveConfig.mockResolvedValue({
      provider: LLMProvider.CLAUDE,
      model: 'claude-sonnet-4',
    });
    mockPlatformLLMProviderService.assertProviderActive.mockResolvedValue(
      undefined,
    );

    await service.getProvider('user1', 'market');

    expect(
      mockPlatformLLMProviderService.assertProviderActive,
    ).toHaveBeenCalledWith(LLMProvider.CLAUDE);
  });

  it('should call assertProviderActive for fallback provider', async () => {
    mockPrisma.lLMCredential.findFirst.mockResolvedValue(null);
    mockAgentConfigResolver.resolveConfig.mockRejectedValue(
      new Error('No config'),
    );
    mockPrisma.lLMCredential.findMany.mockResolvedValue([
      {
        apiKeyEncrypted: Buffer.from('test').toString('hex'),
        apiKeyIv: Buffer.from('1234567890123456').toString('hex'),
        provider: LLMProvider.OPENROUTER,
        selectedModel: 'meta-llama/llama-3',
        fallbackModels: [],
      },
    ]);
    mockPlatformLLMProviderService.assertProviderActive.mockResolvedValue(
      undefined,
    );

    await service.getProvider('user1', 'market');

    expect(
      mockPlatformLLMProviderService.assertProviderActive,
    ).toHaveBeenCalledWith(LLMProvider.OPENROUTER);
  });
});
