import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DataSourceRegistryService } from '../market/data-source-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import { LLMModelsService } from '../llm/llm-models.service';
import { LLMUsageService } from '../llm/llm-usage.service';
import { ProviderHealthService } from '../llm/provider-health.service';

const mockRegistry = {
  getAllConfigs: jest.fn(),
  computeHealthStatus: jest.fn(),
};

const mockPrisma = {
  dataSourceCredential: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  dataSourceConfig: {
    findFirst: jest.fn(),
  },
};

const mockUsersService = {};
const mockLLMModelsService = {};
const mockLLMUsageService = {};
const mockProviderHealthService = {};

const traderUser = {
  userId: 'trader-1',
  email: 'trader@test.com',
  role: 'TRADER',
};

const sampleConfig = {
  id: 'ds-1',
  name: 'alternative_me',
  displayName: 'Alternative.me Fear & Greed',
  category: 'SENTIMENT',
  isActive: true,
  requiresApiKey: false,
  monthlyCostUsd: 0,
  consecutiveErrors: 0,
  lastSuccessAt: new Date(),
};

describe('UsersController — Trader Data Sources (Phase B)', () => {
  let controller: UsersController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: DataSourceRegistryService, useValue: mockRegistry },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LLMModelsService, useValue: mockLLMModelsService },
        { provide: LLMUsageService, useValue: mockLLMUsageService },
        { provide: ProviderHealthService, useValue: mockProviderHealthService },
      ],
    }).compile();
    controller = module.get(UsersController);
  });

  // ── GET /users/me/data-sources ───────────────────────────────────────────

  describe('getMyDataSources', () => {
    it('should return active sources with correct credential flags', async () => {
      mockRegistry.getAllConfigs.mockResolvedValue([
        sampleConfig,
        { ...sampleConfig, id: 'ds-2', name: 'coinglass', isActive: true },
        { ...sampleConfig, id: 'ds-3', name: 'inactive', isActive: false },
      ]);
      mockRegistry.computeHealthStatus.mockReturnValue('healthy');

      // Trader has own credential for ds-1
      mockPrisma.dataSourceCredential.findMany
        .mockResolvedValueOnce([{ dataSourceId: 'ds-1' }]) // own credentials
        .mockResolvedValueOnce([{ dataSourceId: 'ds-2' }]); // shared credentials

      const result = await controller.getMyDataSources(traderUser as any);

      expect(result.sources).toHaveLength(2); // only active ones
      expect(result.sources[0].hasOwnCredential).toBe(true);
      expect(result.sources[0].hasSharedCredential).toBe(false);
      expect(result.sources[1].hasOwnCredential).toBe(false);
      expect(result.sources[1].hasSharedCredential).toBe(true);
    });
  });

  // ── PUT /users/me/data-sources/:id/credential ────────────────────────────

  describe('setMyDataSourceCredential', () => {
    it('should save encrypted key and return masked value', async () => {
      mockPrisma.dataSourceConfig.findFirst.mockResolvedValue(sampleConfig);
      mockPrisma.dataSourceCredential.upsert.mockResolvedValue({});

      const result = await controller.setMyDataSourceCredential(
        'ds-1',
        { apiKey: 'sk-test-secret-key-1234' },
        traderUser as any,
      );

      expect(result.success).toBe(true);
      expect(result.maskedKey).toBe('***1234');
      expect(mockPrisma.dataSourceCredential.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_dataSourceId: {
              userId: 'trader-1',
              dataSourceId: 'ds-1',
            },
          },
          create: expect.objectContaining({
            shared: false,
            userId: 'trader-1',
            dataSourceId: 'ds-1',
          }),
          update: expect.objectContaining({
            shared: false,
            isActive: true,
          }),
        }),
      );
    });

    it('should throw NotFoundException if source does not exist', async () => {
      mockPrisma.dataSourceConfig.findFirst.mockResolvedValue(null);

      await expect(
        controller.setMyDataSourceCredential(
          'non-existent',
          { apiKey: 'sk-test-1234' },
          traderUser as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── DELETE /users/me/data-sources/:id/credential ─────────────────────────

  describe('deleteMyDataSourceCredential', () => {
    it('should delete credential and return success', async () => {
      mockPrisma.dataSourceCredential.deleteMany.mockResolvedValue({
        count: 1,
      });

      const result = await controller.deleteMyDataSourceCredential(
        'ds-1',
        traderUser as any,
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.dataSourceCredential.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'trader-1', dataSourceId: 'ds-1' },
      });
    });

    it('should return success even if credential did not exist (idempotent)', async () => {
      mockPrisma.dataSourceCredential.deleteMany.mockResolvedValue({
        count: 0,
      });

      const result = await controller.deleteMyDataSourceCredential(
        'ds-non-existent',
        traderUser as any,
      );

      expect(result.success).toBe(true);
    });
  });
});
