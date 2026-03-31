import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

const mockJwtService = {
  signAsync: jest.fn(),
  verify: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: typeof mockPrismaService;
  let jwt: typeof mockJwtService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = mockPrismaService;
    jwt = mockJwtService;
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        role: 'TRADER',
        createdAt: new Date(),
      });
      jwt.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.register({
        email: 'test@test.com',
        password: 'password123',
      });

      expect(result.user.email).toBe('test@test.com');
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'test@test.com' }),
        }),
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({ email: 'taken@test.com', password: '12345678' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      // bcrypt hash of 'password123' with 12 rounds
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.default.hash('password123', 12);

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        role: 'TRADER',
        passwordHash: hash,
        isActive: true,
      });
      jwt.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.login({
        email: 'test@test.com',
        password: 'password123',
      });

      expect(result.user.email).toBe('test@test.com');
      expect(result.accessToken).toBe('access-token');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.default.hash('correct-password', 12);

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        passwordHash: hash,
        isActive: true,
      });

      await expect(
        service.login({ email: 'test@test.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'none@test.com', password: '12345678' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for deactivated user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        isActive: false,
      });

      await expect(
        service.login({ email: 'test@test.com', password: '12345678' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should return new tokens with valid refresh token', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        role: 'TRADER',
        isActive: true,
      });
      jwt.signAsync
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh');

      const result = await service.refresh('valid-token');

      expect(result.accessToken).toBe('new-access');
      expect(result.refreshToken).toBe('new-refresh');
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(service.refresh('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for deactivated user', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isActive: false,
      });

      await expect(service.refresh('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
