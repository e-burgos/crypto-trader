import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import { JwtService } from '@nestjs/jwt';

const mockPrisma = {
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
};

jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));

const mockGateway = { emitToUser: jest.fn() };

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AppGateway, useValue: mockGateway },
        { provide: JwtService, useValue: { verify: jest.fn() } },
      ],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('create() saves notification and emits via gateway', async () => {
    const notif = {
      id: 'n1',
      type: 'TRADE_EXECUTED',
      message: 'Trade done',
      createdAt: new Date(),
    };
    mockPrisma.notification.create.mockResolvedValue(notif);
    const result = await service.create(
      'u1',
      'TRADE_EXECUTED' as any,
      'Trade done',
    );
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'u1' }),
      }),
    );
    expect(mockGateway.emitToUser).toHaveBeenCalledWith(
      'u1',
      'notification:new',
      notif,
    );
    expect(result).toEqual(notif);
  });

  it('getAll() returns notifications ordered by date', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([]);
    await service.getAll('u1', 20);
    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' }, take: 20 }),
    );
  });

  it('markAllRead() updates all unread notifications', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });
    await service.markAllRead('u1');
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', read: false } }),
    );
  });
});
