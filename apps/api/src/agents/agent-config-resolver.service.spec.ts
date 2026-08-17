import { ConflictException } from '@nestjs/common';

jest.mock('../users/utils/encryption.util', () => ({
  decrypt: jest.fn().mockReturnValue('decrypted-api-key'),
  encrypt: jest.fn().mockReturnValue({ encrypted: 'enc', iv: 'iv' }),
}));

const mockCreateLLMProvider = jest.fn().mockReturnValue({ name: 'stub-client' });
const mockOpenRouterProvider = jest
  .fn()
  .mockImplementation((config) => ({ name: 'openrouter-client', ...config }));

jest.mock('@crypto-trader/analysis', () => ({
  createLLMProvider: (...args: unknown[]) => mockCreateLLMProvider(...args),
  OpenRouterProvider: mockOpenRouterProvider,
}));

import {
  AgentConfigResolverService,
  NoLLMCredentialError,
} from './agent-config-resolver.service';
import { AgentId, LLMProvider } from '../../generated/prisma/enums';

describe('AgentConfigResolverService.resolveClient', () => {
  let service: AgentConfigResolverService;
  let mockPrisma: {
    lLMCredential: { findFirst: jest.Mock; count: jest.Mock };
  };
  let mockAgentConfigService: {
    getUserAgentConfig: jest.Mock;
    getAdminAgentConfig: jest.Mock;
  };
  let mockPlatformLLMProviderService: { assertProviderActive: jest.Mock };

  const buildCred = (overrides: Record<string, unknown> = {}) => ({
    apiKeyEncrypted: 'enc',
    apiKeyIv: 'iv',
    provider: LLMProvider.CLAUDE,
    selectedModel: 'claude-sonnet-4',
    fallbackModels: [],
    isActive: true,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      lLMCredential: {
        findFirst: jest.fn(),
        count: jest.fn(),
      },
    };
    mockAgentConfigService = {
      getUserAgentConfig: jest.fn().mockResolvedValue(null),
      getAdminAgentConfig: jest.fn().mockResolvedValue(null),
    };
    mockPlatformLLMProviderService = {
      assertProviderActive: jest.fn().mockResolvedValue(undefined),
    };
    service = new AgentConfigResolverService(
      mockPrisma as any,
      mockAgentConfigService as any,
      mockPlatformLLMProviderService as any,
    );
  });

  it('resolves via explicit override when the user has an active credential for it', async () => {
    const cred = buildCred({ provider: LLMProvider.CLAUDE });
    mockPrisma.lLMCredential.findFirst.mockResolvedValueOnce(cred);

    const result = await service.resolveClient('user1', AgentId.market, {
      provider: LLMProvider.CLAUDE,
      model: 'claude-opus-4',
    });

    expect(result.source).toBe('override');
    expect(result.provider).toBe(LLMProvider.CLAUDE);
    expect(result.model).toBe('claude-opus-4');
    expect(result.slot).toBe(AgentId.market);
    expect(mockAgentConfigService.getUserAgentConfig).not.toHaveBeenCalled();
    expect(
      mockPlatformLLMProviderService.assertProviderActive,
    ).toHaveBeenCalledWith(LLMProvider.CLAUDE);
  });

  it('falls through to resolveConfig when the override provider has no active credential', async () => {
    mockPrisma.lLMCredential.count.mockResolvedValue(1);
    mockPrisma.lLMCredential.findFirst
      .mockResolvedValueOnce(null) // override lookup fails
      .mockResolvedValueOnce(buildCred({ provider: LLMProvider.OPENAI, selectedModel: 'gpt-4o' })); // resolveConfig's credential lookup

    mockAgentConfigService.getUserAgentConfig.mockResolvedValueOnce({
      provider: LLMProvider.OPENAI,
      model: 'gpt-4o',
    });

    const result = await service.resolveClient('user1', AgentId.market, {
      provider: LLMProvider.CLAUDE,
      model: 'claude-opus-4',
    });

    expect(result.source).toBe('user');
    expect(result.provider).toBe(LLMProvider.OPENAI);
    expect(result.model).toBe('gpt-4o');
  });

  it('resolves via resolveConfig user override branch', async () => {
    mockPrisma.lLMCredential.count.mockResolvedValue(1);
    mockAgentConfigService.getUserAgentConfig.mockResolvedValueOnce({
      provider: LLMProvider.OPENAI,
      model: 'gpt-4o',
    });
    mockPrisma.lLMCredential.findFirst.mockResolvedValueOnce(
      buildCred({ provider: LLMProvider.OPENAI, selectedModel: 'gpt-4o' }),
    );

    const result = await service.resolveClient('user1', AgentId.market);

    expect(result.source).toBe('user');
    expect(result.provider).toBe(LLMProvider.OPENAI);
    expect(result.model).toBe('gpt-4o');
  });

  it('resolves via resolveConfig admin default branch', async () => {
    mockAgentConfigService.getUserAgentConfig.mockResolvedValueOnce(null);
    mockAgentConfigService.getAdminAgentConfig.mockResolvedValueOnce({
      provider: LLMProvider.GROQ,
      model: 'llama-3.3-70b',
    });
    mockPrisma.lLMCredential.findFirst.mockResolvedValueOnce(
      buildCred({ provider: LLMProvider.GROQ, selectedModel: 'llama-3.3-70b' }),
    );

    const result = await service.resolveClient('user1', AgentId.risk);

    expect(result.source).toBe('admin');
    expect(result.provider).toBe(LLMProvider.GROQ);
  });

  it('resolves via resolveConfig preset branch and maps its "fallback" source to "preset"', async () => {
    mockAgentConfigService.getUserAgentConfig.mockResolvedValueOnce(null);
    mockAgentConfigService.getAdminAgentConfig.mockResolvedValueOnce(null);
    mockPrisma.lLMCredential.findFirst.mockResolvedValueOnce(
      buildCred({ provider: LLMProvider.OPENROUTER, selectedModel: null }),
    );

    const result = await service.resolveClient('user1', AgentId.blockchain);

    expect(result.source).toBe('preset');
  });

  it('falls back to the first active credential when the cascade resolves to a provider without one', async () => {
    mockAgentConfigService.getUserAgentConfig.mockResolvedValueOnce(null);
    mockAgentConfigService.getAdminAgentConfig.mockResolvedValueOnce(null);
    mockPrisma.lLMCredential.findFirst
      .mockResolvedValueOnce(null) // resolveConfig's provider has no active credential
      .mockResolvedValueOnce(
        buildCred({
          provider: LLMProvider.OPENROUTER,
          selectedModel: 'meta-llama/llama-3',
        }),
      );

    const result = await service.resolveClient('user1', AgentId.blockchain);

    expect(result.source).toBe('credential');
    expect(result.provider).toBe(LLMProvider.OPENROUTER);
    expect(result.model).toBe('meta-llama/llama-3');
  });

  it('throws NoLLMCredentialError when no step in the cascade resolves a credential', async () => {
    mockAgentConfigService.getUserAgentConfig.mockResolvedValueOnce(null);
    mockAgentConfigService.getAdminAgentConfig.mockResolvedValueOnce(null);
    mockPrisma.lLMCredential.findFirst.mockResolvedValue(null);

    await expect(
      service.resolveClient('user1', AgentId.market),
    ).rejects.toThrow(NoLLMCredentialError);
  });

  it('propagates ConflictException when the resolved provider is disabled at platform level', async () => {
    mockPrisma.lLMCredential.findFirst.mockResolvedValueOnce(
      buildCred({ provider: LLMProvider.CLAUDE }),
    );
    mockPlatformLLMProviderService.assertProviderActive.mockRejectedValueOnce(
      new ConflictException('Provider CLAUDE is disabled'),
    );

    await expect(
      service.resolveClient('user1', AgentId.market, {
        provider: LLMProvider.CLAUDE,
        model: 'claude-opus-4',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('builds an OpenRouterProvider client with fallbackModels for OPENROUTER credentials', async () => {
    mockPrisma.lLMCredential.findFirst.mockResolvedValueOnce(
      buildCred({
        provider: LLMProvider.OPENROUTER,
        fallbackModels: ['meta-llama/llama-3'],
      }),
    );

    await service.resolveClient('user1', AgentId.market, {
      provider: LLMProvider.OPENROUTER,
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
    });

    expect(mockOpenRouterProvider).toHaveBeenCalledWith({
      apiKey: 'decrypted-api-key',
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
      fallbackModels: ['meta-llama/llama-3'],
    });
    expect(mockCreateLLMProvider).not.toHaveBeenCalled();
  });

  it('builds a direct-provider client via createLLMProvider for non-OpenRouter credentials', async () => {
    mockPrisma.lLMCredential.findFirst.mockResolvedValueOnce(
      buildCred({ provider: LLMProvider.CLAUDE }),
    );

    await service.resolveClient('user1', AgentId.market, {
      provider: LLMProvider.CLAUDE,
      model: 'claude-opus-4',
    });

    expect(mockCreateLLMProvider).toHaveBeenCalledWith(
      LLMProvider.CLAUDE,
      'decrypted-api-key',
      'claude-opus-4',
    );
    expect(mockOpenRouterProvider).not.toHaveBeenCalled();
  });
});
