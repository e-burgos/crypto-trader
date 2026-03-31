import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateUserDto,
  BinanceKeyDto,
  LLMKeyDto,
} from '../auth/dto/auth.dto';
import { encrypt, decrypt } from './utils/encryption.util';
import { LLMProvider } from '../../generated/prisma/enums';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Profile ────────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const data: Record<string, unknown> = {};
    if (dto.email) data.email = dto.email;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, role: true, updatedAt: true },
    });
  }

  // ── Binance credentials ────────────────────────────────────────────────────

  async setBinanceKeys(userId: string, dto: BinanceKeyDto) {
    const { encrypted: apiKeyEncrypted, iv: apiKeyIv } = encrypt(dto.apiKey);
    const { encrypted: secretEncrypted, iv: secretIv } = encrypt(
      dto.apiSecret,
    );

    return this.prisma.binanceCredential.upsert({
      where: { userId },
      create: {
        userId,
        apiKeyEncrypted,
        apiKeyIv,
        secretEncrypted,
        secretIv,
        isActive: true,
      },
      update: {
        apiKeyEncrypted,
        apiKeyIv,
        secretEncrypted,
        secretIv,
        isActive: true,
      },
      select: { id: true, isActive: true, createdAt: true },
    });
  }

  async deleteBinanceKeys(userId: string) {
    await this.prisma.binanceCredential.deleteMany({ where: { userId } });
  }

  async getBinanceKeyStatus(userId: string) {
    const cred = await this.prisma.binanceCredential.findUnique({
      where: { userId },
      select: { isActive: true, createdAt: true },
    });
    return { hasKeys: !!cred, isActive: cred?.isActive ?? false };
  }

  async getBinanceKeys(userId: string) {
    const cred = await this.prisma.binanceCredential.findUnique({
      where: { userId },
    });
    if (!cred) throw new NotFoundException('No Binance credentials found');
    return {
      apiKey: decrypt(cred.apiKeyEncrypted, cred.apiKeyIv),
      apiSecret: decrypt(cred.secretEncrypted, cred.secretIv),
    };
  }

  // ── LLM credentials ────────────────────────────────────────────────────────

  async setLLMKey(userId: string, dto: LLMKeyDto) {
    const provider = dto.provider as LLMProvider;
    const { encrypted: apiKeyEncrypted, iv: apiKeyIv } = encrypt(dto.apiKey);

    return this.prisma.lLMCredential.upsert({
      where: { userId_provider: { userId, provider } },
      create: {
        userId,
        provider,
        apiKeyEncrypted,
        apiKeyIv,
        selectedModel: dto.selectedModel,
        isActive: true,
      },
      update: { apiKeyEncrypted, apiKeyIv, selectedModel: dto.selectedModel },
      select: { id: true, provider: true, selectedModel: true, isActive: true },
    });
  }

  async deleteLLMKey(userId: string, provider: string) {
    await this.prisma.lLMCredential.deleteMany({
      where: { userId, provider: provider as LLMProvider },
    });
  }

  async getLLMKeyStatus(userId: string) {
    const creds = await this.prisma.lLMCredential.findMany({
      where: { userId },
      select: { provider: true, selectedModel: true, isActive: true },
    });
    return { providers: creds };
  }

  async getLLMKey(userId: string, provider: string) {
    const cred = await this.prisma.lLMCredential.findUnique({
      where: {
        userId_provider: { userId, provider: provider as LLMProvider },
      },
    });
    if (!cred) throw new NotFoundException('LLM credential not found');
    return {
      provider: cred.provider,
      apiKey: decrypt(cred.apiKeyEncrypted, cred.apiKeyIv),
      selectedModel: cred.selectedModel,
    };
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  async getAllUsers(adminId: string) {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setUserStatus(
    adminId: string,
    targetUserId: string,
    isActive: boolean,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!user) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive },
      select: { id: true, email: true, isActive: true },
    });
    await this.prisma.adminAction.create({
      data: {
        adminId,
        action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
        targetUserId,
      },
    });
    return updated;
  }
}
