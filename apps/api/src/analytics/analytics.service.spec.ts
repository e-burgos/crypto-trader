import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  position: { findMany: jest.fn() },
  trade: { findMany: jest.fn() },
  tradingConfig: { findMany: jest.fn() },
  agentDecision: { findMany: jest.fn() },
};

jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalyticsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('getPortfolioSummary() returns open/closed positions and PnL summary', async () => {
    mockPrisma.position.findMany
      .mockResolvedValueOnce([
        {
          asset: 'BTC',
          pair: 'BTCUSDT',
          entryPrice: 50000,
          quantity: 0.5,
          mode: 'LIVE',
        },
      ])
      .mockResolvedValueOnce([{ pnl: 2500, fees: 25, mode: 'LIVE' }]);
    mockPrisma.tradingConfig.findMany.mockResolvedValue([{ isRunning: true }]);

    const result = await service.getPortfolioSummary('user1');
    expect(result.openPositions).toBe(1);
    expect(result.closedPositions).toBe(1);
    expect(result.realizedPnl).toBe(2500);
    expect(result.totalFees).toBe(25);
    expect(result.netPnl).toBe(2475);
    expect(result.activeConfigs).toBe(1);
  });

  it('getTradeHistory() returns trades ordered by executedAt desc', async () => {
    mockPrisma.trade.findMany.mockResolvedValue([
      {
        id: 't1',
        type: 'BUY',
        price: 2000,
        quantity: 1,
        fee: 2,
        executedAt: new Date(),
        mode: 'LIVE',
      },
    ]);

    const result = await service.getTradeHistory('user1', 10);
    expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user1' },
        take: 10,
        orderBy: { executedAt: 'desc' },
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('getAgentDecisionHistory() returns decisions ordered by createdAt desc', async () => {
    mockPrisma.agentDecision.findMany.mockResolvedValue([]);
    await service.getAgentDecisionHistory('user1', 5);
    expect(mockPrisma.agentDecision.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user1' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    );
  });
});
