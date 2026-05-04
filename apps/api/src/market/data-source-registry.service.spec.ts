import { Test, TestingModule } from '@nestjs/testing';
import { DataSourceRegistryService } from './data-source-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  IDataSourceProvider,
  DataSourcePayload,
  ProviderConfig,
  HealthCheckResult,
} from '@crypto-trader/providers';

const mockPrisma = {
  dataSourceConfig: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

function createMockProvider(
  name: string,
  overrides: Partial<IDataSourceProvider> = {},
): IDataSourceProvider {
  return {
    name,
    displayName: `Mock ${name}`,
    category: 'SENTIMENT',
    fetchData: jest.fn().mockResolvedValue({
      type: 'fear_greed',
      data: {
        value: 50,
        classification: 'Neutral',
        timestamp: new Date().toISOString(),
        previousClose: 48,
      },
    }),
    healthCheck: jest
      .fn()
      .mockResolvedValue({ available: true, latencyMs: 100 }),
    ...overrides,
  };
}

describe('DataSourceRegistryService', () => {
  let service: DataSourceRegistryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataSourceRegistryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(DataSourceRegistryService);
  });

  describe('registerProvider', () => {
    it('should register and retrieve a provider', () => {
      const provider = createMockProvider('test_provider');
      service.registerProvider(provider);
      expect(service.getProvider('test_provider')).toBe(provider);
    });

    it('should return undefined for unregistered provider', () => {
      expect(service.getProvider('nonexistent')).toBeUndefined();
    });
  });

  describe('getActiveConfigs', () => {
    it('should query active configs', async () => {
      mockPrisma.dataSourceConfig.findMany.mockResolvedValue([]);
      const result = await service.getActiveConfigs();
      expect(mockPrisma.dataSourceConfig.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { priority: 'desc' },
      });
      expect(result).toEqual([]);
    });

    it('should filter by category when provided', async () => {
      mockPrisma.dataSourceConfig.findMany.mockResolvedValue([]);
      await service.getActiveConfigs('DERIVATIVES');
      expect(mockPrisma.dataSourceConfig.findMany).toHaveBeenCalledWith({
        where: { isActive: true, category: 'DERIVATIVES' },
        orderBy: { priority: 'desc' },
      });
    });
  });

  describe('toggleSource', () => {
    it('should update isActive field', async () => {
      mockPrisma.dataSourceConfig.update.mockResolvedValue({
        id: '1',
        isActive: false,
      });
      const result = await service.toggleSource('1', false);
      expect(mockPrisma.dataSourceConfig.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });
  });

  describe('reportSuccess', () => {
    it('should reset consecutive errors on success', async () => {
      mockPrisma.dataSourceConfig.findUnique.mockResolvedValue({
        consecutiveErrors: 0,
        lastErrorAt: null,
      });
      mockPrisma.dataSourceConfig.update.mockResolvedValue({});
      await service.reportSuccess('test', 100);
      expect(mockPrisma.dataSourceConfig.update).toHaveBeenCalledWith({
        where: { name: 'test' },
        data: expect.objectContaining({
          consecutiveErrors: 0,
          lastErrorMessage: null,
        }),
      });
    });
  });

  describe('reportError', () => {
    it('should increment consecutive errors', async () => {
      mockPrisma.dataSourceConfig.findUnique.mockResolvedValue({
        consecutiveErrors: 2,
      });
      mockPrisma.dataSourceConfig.update.mockResolvedValue({});
      await service.reportError('test', 'timeout');
      expect(mockPrisma.dataSourceConfig.update).toHaveBeenCalledWith({
        where: { name: 'test' },
        data: expect.objectContaining({
          consecutiveErrors: 3,
          lastErrorMessage: 'timeout',
        }),
      });
    });
  });

  describe('fetchFromProvider', () => {
    it('should return null if config not found', async () => {
      mockPrisma.dataSourceConfig.findUnique.mockResolvedValue(null);
      const result = await service.fetchFromProvider('missing');
      expect(result).toBeNull();
    });

    it('should return null if source is inactive', async () => {
      mockPrisma.dataSourceConfig.findUnique.mockResolvedValue({
        isActive: false,
      });
      const result = await service.fetchFromProvider('disabled');
      expect(result).toBeNull();
    });

    it('should fetch data and report success', async () => {
      const provider = createMockProvider('alt_me');
      service.registerProvider(provider);
      mockPrisma.dataSourceConfig.findUnique.mockResolvedValue({
        name: 'alt_me',
        isActive: true,
        baseUrl: 'https://api.example.com',
        rateLimitPerMin: 60,
        pollingIntervalMs: 1800000,
      });
      mockPrisma.dataSourceConfig.update.mockResolvedValue({});

      const result = await service.fetchFromProvider('alt_me');
      expect(result).toBeDefined();
      expect(result!.type).toBe('fear_greed');
      expect(provider.fetchData).toHaveBeenCalled();
    });

    it('should return null and report error on failure', async () => {
      const provider = createMockProvider('failing', {
        fetchData: jest.fn().mockRejectedValue(new Error('Network error')),
      });
      service.registerProvider(provider);
      mockPrisma.dataSourceConfig.findUnique
        .mockResolvedValueOnce({
          name: 'failing',
          isActive: true,
          baseUrl: 'https://api.example.com',
          rateLimitPerMin: 60,
          pollingIntervalMs: 1800000,
        })
        .mockResolvedValueOnce({ consecutiveErrors: 0 });
      mockPrisma.dataSourceConfig.update.mockResolvedValue({});

      const result = await service.fetchFromProvider('failing');
      expect(result).toBeNull();
    });
  });

  describe('computeHealthStatus', () => {
    it('should return "unknown" if inactive', () => {
      expect(
        service.computeHealthStatus({
          isActive: false,
          consecutiveErrors: 0,
          lastSuccessAt: null,
        }),
      ).toBe('unknown');
    });

    it('should return "down" if 3+ consecutive errors', () => {
      expect(
        service.computeHealthStatus({
          isActive: true,
          consecutiveErrors: 3,
          lastSuccessAt: new Date(),
        }),
      ).toBe('down');
    });

    it('should return "degraded" if 1-2 consecutive errors', () => {
      expect(
        service.computeHealthStatus({
          isActive: true,
          consecutiveErrors: 1,
          lastSuccessAt: new Date(),
        }),
      ).toBe('degraded');
    });

    it('should return "healthy" if no errors and has success', () => {
      expect(
        service.computeHealthStatus({
          isActive: true,
          consecutiveErrors: 0,
          lastSuccessAt: new Date(),
        }),
      ).toBe('healthy');
    });

    it('should return "unknown" if active but no success yet', () => {
      expect(
        service.computeHealthStatus({
          isActive: true,
          consecutiveErrors: 0,
          lastSuccessAt: null,
        }),
      ).toBe('unknown');
    });
  });
});
