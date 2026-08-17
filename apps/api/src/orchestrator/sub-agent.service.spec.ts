import { Test, TestingModule } from '@nestjs/testing';
import { SubAgentService } from './sub-agent.service';
import { AgentConfigResolverService } from '../agents/agent-config-resolver.service';
import { AgentPromptService } from '../agents/agent-prompt.service';
import { AgentId } from '../../generated/prisma/enums';
import {
  AGENT_TASK_MAX_TOKENS,
  LLMTruncatedResponseError,
} from './agent-task-limits';

const mockLLMProvider = {
  name: 'mock',
  complete: jest.fn(),
};

const mockCaptureRateLimits = jest.fn();

jest.mock('@crypto-trader/analysis', () => ({
  captureRateLimits: (...args: unknown[]) => mockCaptureRateLimits(...args),
}));

const mockAgentPromptService = {
  getSystemPrompt: jest.fn(),
};

const SYSTEM_PROMPT_BY_AGENT: Record<string, string> = {
  orchestrator: 'You are KRYPTO',
  platform: 'You are NEXUS',
  operations: 'You are FORGE',
  market: 'You are SIGMA',
  blockchain: 'You are CIPHER',
  risk: 'You are AEGIS',
};

const mockResolvedClient = {
  slot: AgentId.market,
  provider: 'GROQ',
  model: 'llama-3.3-70b-versatile',
  source: 'credential',
  client: mockLLMProvider,
};

const mockAgentConfigResolver = {
  resolveClient: jest.fn(),
};

describe('SubAgentService', () => {
  let service: SubAgentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAgentPromptService.getSystemPrompt.mockImplementation((agentId: string) =>
      Promise.resolve(SYSTEM_PROMPT_BY_AGENT[agentId] ?? 'generic prompt'),
    );
    mockAgentConfigResolver.resolveClient.mockResolvedValue(
      mockResolvedClient,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubAgentService,
        {
          provide: AgentConfigResolverService,
          useValue: mockAgentConfigResolver,
        },
        { provide: AgentPromptService, useValue: mockAgentPromptService },
      ],
    }).compile();

    service = module.get<SubAgentService>(SubAgentService);
  });

  describe('call', () => {
    it('should resolve the client via AgentConfigResolverService for the agent slot', async () => {
      mockLLMProvider.complete.mockResolvedValue({
        text: '{"signal":"BUY","confidence":0.8,"reasoning":"RSI oversold"}',
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const result = await service.call(
        'market',
        'technical_signal',
        { indicators: { rsi: 28 } },
        'user-1',
      );

      expect(result).toContain('BUY');
      expect(mockAgentConfigResolver.resolveClient).toHaveBeenCalledWith(
        'user-1',
        AgentId.market,
        undefined,
      );
      expect(mockLLMProvider.complete).toHaveBeenCalledWith(
        expect.stringContaining('SIGMA'),
        expect.stringContaining('indicadores'),
        { maxTokens: AGENT_TASK_MAX_TOKENS.technical_signal },
      );
    });

    it('should resolve the "routing" slot for orchestrator intent classification', async () => {
      mockLLMProvider.complete.mockResolvedValue({
        text: '{"agentId":"market","confidence":0.9}',
        usage: { inputTokens: 30, outputTokens: 10 },
      });

      await service.call(
        'orchestrator',
        'intent_classification',
        { message: 'hola' },
        'user-1',
        true,
      );

      expect(mockAgentConfigResolver.resolveClient).toHaveBeenCalledWith(
        'user-1',
        AgentId.routing,
        undefined,
      );
    });

    it('should resolve the "synthesis" slot for orchestrator decision synthesis', async () => {
      mockLLMProvider.complete.mockResolvedValue({
        text: '{"decision":"HOLD","confidence":0.5}',
        usage: { inputTokens: 30, outputTokens: 10 },
      });

      await service.call(
        'orchestrator',
        'decision_synthesis',
        {},
        'user-1',
        false,
      );

      expect(mockAgentConfigResolver.resolveClient).toHaveBeenCalledWith(
        'user-1',
        AgentId.synthesis,
        undefined,
      );
    });

    it('should call LLM with correct system prompt for risk agent', async () => {
      mockLLMProvider.complete.mockResolvedValue({
        text: '{"riskScore":30,"verdict":"PASS","positionSizeMultiplier":1.0,"reason":"ok","alerts":[]}',
        usage: { inputTokens: 200, outputTokens: 80 },
      });

      const result = await service.call(
        'risk',
        'risk_gate',
        { portfolio: [], indicators: { rsi: 45 } },
        'user-1',
      );

      expect(result).toContain('PASS');
      expect(mockLLMProvider.complete).toHaveBeenCalledWith(
        expect.stringContaining('AEGIS'),
        expect.any(String),
        { maxTokens: AGENT_TASK_MAX_TOKENS.risk_gate },
      );
    });

    it('should invoke captureRateLimits when response includes headers', async () => {
      const mockHeaders = {
        'x-ratelimit-remaining': '95',
        'x-ratelimit-limit': '100',
      };
      mockLLMProvider.complete.mockResolvedValue({
        text: '{"signal":"HOLD","confidence":0.5,"reasoning":"flat"}',
        usage: { inputTokens: 50, outputTokens: 20 },
        headers: mockHeaders,
      });

      await service.call(
        'market',
        'technical_signal',
        { indicators: { rsi: 50 } },
        'user-1',
      );

      expect(mockCaptureRateLimits).toHaveBeenCalledWith(
        'user-1',
        'GROQ',
        mockHeaders,
      );
    });

    it('should not invoke captureRateLimits when response has no headers', async () => {
      mockLLMProvider.complete.mockResolvedValue({
        text: '{"signal":"HOLD","confidence":0.5,"reasoning":"flat"}',
        usage: { inputTokens: 50, outputTokens: 20 },
      });

      await service.call(
        'market',
        'technical_signal',
        { indicators: { rsi: 50 } },
        'user-1',
      );

      expect(mockCaptureRateLimits).not.toHaveBeenCalled();
    });

    it('should propagate the error raised by AgentConfigResolverService', async () => {
      mockAgentConfigResolver.resolveClient.mockRejectedValueOnce(
        new Error('No active LLM credentials for user user-1.'),
      );

      await expect(
        service.call(
          'market',
          'technical_signal',
          { indicators: { rsi: 50 } },
          'user-1',
        ),
      ).rejects.toThrow('No active LLM credentials');
    });

    it('should resolve the system prompt via AgentPromptService for the agent id', async () => {
      mockLLMProvider.complete.mockResolvedValue({
        text: '{"signal":"HOLD","confidence":0.5,"reasoning":"flat"}',
        usage: { inputTokens: 50, outputTokens: 20 },
      });

      await service.call(
        'market',
        'technical_signal',
        { indicators: { rsi: 50 } },
        'user-1',
      );

      expect(mockAgentPromptService.getSystemPrompt).toHaveBeenCalledWith(
        'market',
      );
    });

    it('should propagate AgentPromptUnavailableError raised by AgentPromptService', async () => {
      mockAgentPromptService.getSystemPrompt.mockRejectedValueOnce(
        new Error(
          'AgentDefinition for "risk" is missing, inactive, or has an empty systemPrompt.',
        ),
      );

      await expect(
        service.call(
          'risk',
          'risk_gate',
          { portfolio: [], indicators: { rsi: 45 } },
          'user-1',
        ),
      ).rejects.toThrow('AgentDefinition for "risk"');
    });

    it.each([
      ['risk_gate', AGENT_TASK_MAX_TOKENS.risk_gate],
      ['sizing_suggestion', AGENT_TASK_MAX_TOKENS.sizing_suggestion],
      ['macro_context', AGENT_TASK_MAX_TOKENS.macro_context],
      ['decision_synthesis', AGENT_TASK_MAX_TOKENS.decision_synthesis],
    ] as const)(
      'should request the max_tokens limit for task %s regardless of agent (CA-050, CA-051)',
      async (task, expectedMaxTokens) => {
        mockLLMProvider.complete.mockResolvedValue({
          text: '{}',
          usage: { inputTokens: 10, outputTokens: 5 },
        });

        await service.call('risk', task, {}, 'user-1');

        expect(mockLLMProvider.complete).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          { maxTokens: expectedMaxTokens },
        );
      },
    );

    it('should request the same max_tokens limit for the same task from two different agents (CA-051)', async () => {
      mockLLMProvider.complete.mockResolvedValue({
        text: '{}',
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      await service.call('market', 'technical_signal', {}, 'user-1');
      await service.call('orchestrator', 'decision_synthesis', {}, 'user-1');

      expect(mockLLMProvider.complete).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.any(String),
        { maxTokens: AGENT_TASK_MAX_TOKENS.technical_signal },
      );
      expect(mockLLMProvider.complete).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.any(String),
        { maxTokens: AGENT_TASK_MAX_TOKENS.decision_synthesis },
      );
    });

    it('should throw LLMTruncatedResponseError when the response is truncated, never returning a partial decision (CA-052, CE-06)', async () => {
      mockLLMProvider.complete.mockResolvedValue({
        text: '{"riskScore":30,"verdict":"PASS"',
        usage: { inputTokens: 200, outputTokens: 350 },
        truncated: true,
      });

      await expect(
        service.call(
          'risk',
          'risk_gate',
          { portfolio: [], indicators: { rsi: 45 } },
          'user-1',
        ),
      ).rejects.toThrow(LLMTruncatedResponseError);
    });

    it('should follow the same failure path as a rejected call when the response is truncated', async () => {
      mockLLMProvider.complete.mockResolvedValue({
        text: '{"signal":"BUY"',
        usage: { inputTokens: 100, outputTokens: 500 },
        truncated: true,
      });

      await expect(
        service.call(
          'market',
          'technical_signal',
          { indicators: { rsi: 28 } },
          'user-1',
        ),
      ).rejects.toThrow('LLM response truncated');

      expect(mockAgentConfigResolver.resolveClient).toHaveBeenCalledTimes(1);
    });

    it('should not treat a complete response as truncated', async () => {
      mockLLMProvider.complete.mockResolvedValue({
        text: '{"signal":"BUY","confidence":0.8,"reasoning":"ok"}',
        usage: { inputTokens: 100, outputTokens: 50 },
        truncated: false,
      });

      const result = await service.call(
        'market',
        'technical_signal',
        { indicators: { rsi: 28 } },
        'user-1',
      );

      expect(result).toContain('BUY');
    });
  });
});
