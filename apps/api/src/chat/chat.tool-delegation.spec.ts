/**
 * Regression tests for Phase A — Agent Profit Optimizer
 * Bug #5: Chat tools must delegate to TradingService
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { TradingService } from '../trading/trading.service';

// Mock the generated enums to avoid import resolution issues
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
  ChatRole: { USER: 'USER', ASSISTANT: 'ASSISTANT', SYSTEM: 'SYSTEM' },
  AgentId: {},
  LLMSource: {},
}));

describe('ChatService — Tool Delegation (Bug #5 Regression)', () => {
  let service: ChatService;
  let mockPrisma: any;
  let mockTradingService: any;

  beforeEach(async () => {
    mockPrisma = {
      chatSession: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'session-1',
          userId: 'user-1',
          provider: 'OPENAI',
          model: 'gpt-5.4',
        }),
      },
      tradingConfig: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'config-1',
          userId: 'user-1',
          isRunning: false,
        }),
        update: jest.fn(),
      },
      chatMessage: {
        create: jest.fn(),
      },
    };

    mockTradingService = {
      startAgent: jest.fn().mockResolvedValue({
        started: true,
        configId: 'config-1',
        asset: 'BTC',
        pair: 'USDT',
        mode: 'SANDBOX',
        jobId: 'job-1',
      }),
      stopAgent: jest.fn().mockResolvedValue({
        stopped: true,
        configId: 'config-1',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TradingService, useValue: mockTradingService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should delegate start_agent to TradingService.startAgent', async () => {
    const result = await service.executeTool('user-1', 'session-1', {
      tool: 'start_agent',
      params: { configId: 'config-1' },
      confirmation: 'confirmed',
    });

    expect(mockTradingService.startAgent).toHaveBeenCalledWith('user-1', {
      configId: 'config-1',
    });
    expect(result.result).toEqual(
      expect.objectContaining({ started: true, configId: 'config-1' }),
    );
    // Should NOT call prisma.tradingConfig.update directly
    expect(mockPrisma.tradingConfig.update).not.toHaveBeenCalled();
  });

  it('should delegate stop_agent to TradingService.stopAgent', async () => {
    mockPrisma.tradingConfig.findFirst.mockResolvedValue({
      id: 'config-1',
      userId: 'user-1',
      isRunning: true,
    });

    const result = await service.executeTool('user-1', 'session-1', {
      tool: 'stop_agent',
      params: { configId: 'config-1' },
      confirmation: 'confirmed',
    });

    expect(mockTradingService.stopAgent).toHaveBeenCalledWith(
      'user-1',
      'config-1',
    );
    expect(result.result).toEqual(
      expect.objectContaining({ stopped: true, configId: 'config-1' }),
    );
    // Should NOT call prisma.tradingConfig.update directly
    expect(mockPrisma.tradingConfig.update).not.toHaveBeenCalled();
  });
});
