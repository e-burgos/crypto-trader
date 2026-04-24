import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformLLMProviderService } from '../llm/platform-llm-provider.service';

const mockPlatformLLMProviderService = {
  assertProviderActive: jest.fn().mockResolvedValue(undefined),
  isProviderActive: jest.fn().mockResolvedValue(true),
};

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  binanceCredential: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    findUnique: jest.fn(),
  },
  lLMCredential: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  adminAction: {
    create: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.BINANCE_KEY_ENCRYPTION_KEY = 'dev-encryption-key-32-chars-long';
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: PlatformLLMProviderService,
          useValue: mockPlatformLLMProviderService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = mockPrismaService;
  });

  describe('getMe', () => {
    it('should return user profile', async () => {
      const user = {
        id: 'user-1',
        email: 'test@test.com',
        role: 'TRADER',
        isActive: true,
        createdAt: new Date(),
      };
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getMe('user-1');
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getMe('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setBinanceKeys', () => {
    it('should encrypt and store Binance keys', async () => {
      prisma.binanceCredential.upsert.mockResolvedValue({
        id: 'cred-1',
        isActive: true,
        createdAt: new Date(),
      });

      const result = await service.setBinanceKeys('user-1', {
        apiKey: 'my-binance-api-key',
        apiSecret: 'my-binance-secret',
      });

      expect(result.id).toBe('cred-1');
      // Verify that upsert was called with encrypted values (not plaintext)
      const call = prisma.binanceCredential.upsert.mock.calls[0][0];
      expect(call.create.apiKeyEncrypted).not.toBe('my-binance-api-key');
      expect(call.create.secretEncrypted).not.toBe('my-binance-secret');
    });
  });

  describe('getBinanceKeyStatus', () => {
    it('should return status when keys exist', async () => {
      prisma.binanceCredential.findUnique.mockResolvedValue({
        isActive: true,
        createdAt: new Date(),
      });

      const result = await service.getBinanceKeyStatus('user-1');
      expect(result).toEqual({ hasKeys: true, isActive: true });
    });

    it('should return no keys when none exist', async () => {
      prisma.binanceCredential.findUnique.mockResolvedValue(null);

      const result = await service.getBinanceKeyStatus('user-1');
      expect(result).toEqual({ hasKeys: false, isActive: false });
    });
  });

  describe('setLLMKey', () => {
    it('should encrypt and store LLM key', async () => {
      prisma.lLMCredential.upsert.mockResolvedValue({
        id: 'cred-1',
        provider: 'CLAUDE',
        selectedModel: 'claude-3.5-sonnet',
        isActive: true,
      });

      const result = await service.setLLMKey('user-1', {
        provider: 'CLAUDE',
        apiKey: 'sk-ant-123',
        selectedModel: 'claude-3.5-sonnet',
      });

      expect(result.provider).toBe('CLAUDE');
      const call = prisma.lLMCredential.upsert.mock.calls[0][0];
      expect(call.create.apiKeyEncrypted).not.toBe('sk-ant-123');
    });
  });

  describe('getAllUsers (admin)', () => {
    it('should return all users', async () => {
      const users = [
        {
          id: 'u1',
          email: 'a@test.com',
          role: 'ADMIN',
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 'u2',
          email: 'b@test.com',
          role: 'TRADER',
          isActive: true,
          createdAt: new Date(),
        },
      ];
      prisma.user.findMany.mockResolvedValue(users);

      const result = await service.getAllUsers('admin-1');
      expect(result).toHaveLength(2);
    });
  });

  describe('setUserStatus (admin)', () => {
    it('should deactivate a user and log admin action', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        isActive: false,
      });
      prisma.adminAction.create.mockResolvedValue({});

      const result = await service.setUserStatus('admin-1', 'user-1', false);
      expect(result.isActive).toBe(false);
      expect(prisma.adminAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'DEACTIVATE_USER',
          adminId: 'admin-1',
          targetUserId: 'user-1',
        }),
      });
    });

    it('should throw NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.setUserStatus('admin-1', 'fake', true),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateOperationMode', () => {
    it('should allow switching to SANDBOX without any key check', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        platformOperationMode: 'SANDBOX',
      });

      const result = await service.updateOperationMode('user-1', {
        mode: 'SANDBOX',
      });
      expect(result).toEqual({ platformOperationMode: 'SANDBOX' });
      expect(prisma.binanceCredential.findUnique).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when switching to LIVE without production keys', async () => {
      prisma.binanceCredential.findUnique.mockResolvedValue(null);

      await expect(
        service.updateOperationMode('user-1', { mode: 'LIVE' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow switching to LIVE when production keys exist', async () => {
      prisma.binanceCredential.findUnique.mockResolvedValue({
        id: 'cred-1',
        isTestnet: false,
        isActive: true,
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        platformOperationMode: 'LIVE',
      });

      const result = await service.updateOperationMode('user-1', {
        mode: 'LIVE',
      });
      expect(result).toEqual({ platformOperationMode: 'LIVE' });
      expect(prisma.binanceCredential.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_isTestnet: { userId: 'user-1', isTestnet: false } },
        }),
      );
    });

    it('should throw BadRequestException when switching to TESTNET without testnet keys', async () => {
      prisma.binanceCredential.findUnique.mockResolvedValue(null);

      await expect(
        service.updateOperationMode('user-1', { mode: 'TESTNET' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow switching to TESTNET when testnet keys exist', async () => {
      prisma.binanceCredential.findUnique.mockResolvedValue({
        id: 'cred-2',
        isTestnet: true,
        isActive: true,
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        platformOperationMode: 'TESTNET',
      });

      const result = await service.updateOperationMode('user-1', {
        mode: 'TESTNET',
      });
      expect(result).toEqual({ platformOperationMode: 'TESTNET' });
      expect(prisma.binanceCredential.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_isTestnet: { userId: 'user-1', isTestnet: true } },
        }),
      );
    });
  });

  describe('getMe', () => {
    it('should include platformOperationMode in the response', async () => {
      const user = {
        id: 'user-1',
        email: 'test@test.com',
        role: 'TRADER',
        isActive: true,
        platformOperationMode: 'SANDBOX',
        createdAt: new Date(),
      };
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getMe('user-1');
      expect(result).toHaveProperty('platformOperationMode', 'SANDBOX');
    });
  });
});
