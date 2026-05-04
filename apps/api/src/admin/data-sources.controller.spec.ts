import { Test, TestingModule } from '@nestjs/testing';
import { DataSourcesController } from './data-sources.controller';
import { DataSourceRegistryService } from '../market/data-source-registry.service';
import { PrismaService } from '../prisma/prisma.service';

const mockRegistry = {
  getAllConfigs: jest.fn(),
  toggleSource: jest.fn(),
  updateConfig: jest.fn(),
  checkHealth: jest.fn(),
  checkHealthAll: jest.fn(),
  computeHealthStatus: jest.fn(),
  getCircuitStates: jest.fn().mockReturnValue({}),
  getCacheStats: jest.fn().mockReturnValue({ entries: 0, sources: [] }),
  getRateLimiterStats: jest.fn().mockReturnValue({}),
  getProviderMetrics: jest.fn().mockReturnValue({}),
};

const mockPrisma = {
  adminAction: { create: jest.fn() },
  dataSourceConfig: { findUniqueOrThrow: jest.fn() },
};

describe('DataSourcesController', () => {
  let controller: DataSourcesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataSourcesController],
      providers: [
        { provide: DataSourceRegistryService, useValue: mockRegistry },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    controller = module.get(DataSourcesController);
  });

  describe('listAll', () => {
    it('should return all sources with health status', async () => {
      mockRegistry.getAllConfigs.mockResolvedValue([
        {
          id: '1',
          name: 'alternative_me',
          displayName: 'Alternative.me',
          category: 'SENTIMENT',
          isActive: true,
          priority: 1,
          targetAgents: ['market'],
          requiresApiKey: false,
          baseUrl: 'https://api.alternative.me',
          rateLimitPerMin: 100,
          pollingIntervalMs: 1800000,
          monthlyCostUsd: 0,
          lastSuccessAt: new Date(),
          lastErrorAt: null,
          lastErrorMessage: null,
          consecutiveErrors: 0,
        },
      ]);
      mockRegistry.computeHealthStatus.mockReturnValue('healthy');

      const result = await controller.listAll();
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].name).toBe('alternative_me');
      expect(result.sources[0].health).toBe('healthy');
    });
  });

  describe('toggle', () => {
    it('should toggle source and create audit log', async () => {
      mockRegistry.toggleSource.mockResolvedValue({
        id: '1',
        name: 'alternative_me',
        isActive: false,
      });
      mockPrisma.adminAction.create.mockResolvedValue({});

      const result = await controller.toggle(
        '1',
        { isActive: false },
        { userId: 'admin1', email: 'admin@test.com', role: 'ADMIN' },
      );

      expect(result.isActive).toBe(false);
      expect(result.name).toBe('alternative_me');
      expect(mockPrisma.adminAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'DATA_SOURCE_DISABLED',
          }),
        }),
      );
    });
  });

  describe('healthCheckAll', () => {
    it('should return health results for all active sources', async () => {
      mockRegistry.checkHealthAll.mockResolvedValue({
        alternative_me: { available: true, latencyMs: 120 },
        coinalyze: { available: false, latencyMs: 0, error: 'Timeout' },
      });

      const result = await controller.healthCheckAll();
      expect(result).toHaveProperty('alternative_me');
      expect(result).toHaveProperty('coinalyze');
      expect(result.coinalyze.available).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update config and create audit log', async () => {
      mockRegistry.updateConfig.mockResolvedValue({
        id: '1',
        name: 'coinalyze',
        priority: 5,
      });
      mockPrisma.adminAction.create.mockResolvedValue({});

      const result = await controller.updateConfig(
        '1',
        { priority: 5 },
        { userId: 'admin1', email: 'admin@test.com', role: 'ADMIN' },
      );

      expect(result.priority).toBe(5);
      expect(mockPrisma.adminAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adminId: 'admin1',
            action: 'DATA_SOURCE_CONFIG_UPDATED',
            details: { dataSourceId: '1', changes: { priority: 5 } },
          }),
        }),
      );
    });
  });
});
