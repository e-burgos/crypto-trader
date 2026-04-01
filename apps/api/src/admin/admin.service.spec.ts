import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  user: { count: jest.fn() },
  trade: { count: jest.fn(), findMany: jest.fn(), aggregate: jest.fn() },
  position: { count: jest.fn() },
  tradingConfig: { updateMany: jest.fn() },
  adminAction: { create: jest.fn(), findMany: jest.fn() },
};

jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<AdminService>(AdminService);
  });

  it('getStats() returns aggregated platform stats', async () => {
    mockPrisma.user.count.mockResolvedValueOnce(10).mockResolvedValueOnce(8);
    mockPrisma.trade.count.mockResolvedValue(200);
    mockPrisma.position.count.mockResolvedValue(3);
    mockPrisma.trade.aggregate.mockResolvedValue({ _sum: { quantity: 5.0 } });
    mockPrisma.trade.findMany.mockResolvedValue([]);

    const stats = await service.getStats();
    expect(stats.users.total).toBe(10);
    expect(stats.users.active).toBe(8);
    expect(stats.trades.total).toBe(200);
    expect(stats.positions.open).toBe(3);
    expect(stats.volume.total).toBe(5.0);
  });

  it('killSwitch() stops all running configs and logs action', async () => {
    mockPrisma.tradingConfig.updateMany.mockResolvedValue({ count: 3 });
    mockPrisma.adminAction.create.mockResolvedValue({});

    const result = await service.killSwitch('admin1');
    expect(mockPrisma.tradingConfig.updateMany).toHaveBeenCalledWith({
      where: { isRunning: true },
      data: { isRunning: false },
    });
    expect(mockPrisma.adminAction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'KILL_SWITCH' }),
      }),
    );
    expect(result.stopped).toBe(3);
  });

  it('getAuditLog() returns last 100 admin actions', async () => {
    mockPrisma.adminAction.findMany.mockResolvedValue([]);
    await service.getAuditLog('admin1');
    expect(mockPrisma.adminAction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});
