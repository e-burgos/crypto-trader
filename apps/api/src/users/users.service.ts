import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateUserDto,
  BinanceKeyDto,
  LLMKeyDto,
  NewsApiKeyDto,
} from '../auth/dto/auth.dto';
import { encrypt, decrypt } from './utils/encryption.util';
import { LLMProvider, NewsApiProvider } from '../../generated/prisma/enums';

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
    const { encrypted: secretEncrypted, iv: secretIv } = encrypt(dto.apiSecret);

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

  // ── News API credentials ───────────────────────────────────────────────────

  async setNewsApiKey(userId: string, dto: NewsApiKeyDto) {
    const provider = dto.provider as NewsApiProvider;
    const { encrypted: apiKeyEncrypted, iv: apiKeyIv } = encrypt(dto.apiKey);

    return this.prisma.newsApiCredential.upsert({
      where: { userId_provider: { userId, provider } },
      create: { userId, provider, apiKeyEncrypted, apiKeyIv, isActive: true },
      update: { apiKeyEncrypted, apiKeyIv, isActive: true },
      select: { id: true, provider: true, isActive: true },
    });
  }

  async deleteNewsApiKey(userId: string, provider: string) {
    await this.prisma.newsApiCredential.deleteMany({
      where: { userId, provider: provider as NewsApiProvider },
    });
  }

  async getNewsApiKeyStatus(userId: string) {
    const creds = await this.prisma.newsApiCredential.findMany({
      where: { userId },
      select: { provider: true, isActive: true },
    });
    return { providers: creds };
  }

  // ── Connection tests ───────────────────────────────────────────────────────

  async testBinanceConnection(userId: string) {
    const cred = await this.prisma.binanceCredential.findUnique({
      where: { userId },
    });
    if (!cred) return { connected: false, error: 'No credentials saved' };
    try {
      const { BinanceRestClient } = await import('@crypto-trader/data-fetcher');
      const client = new BinanceRestClient({
        apiKey: decrypt(cred.apiKeyEncrypted, cred.apiKeyIv),
        apiSecret: decrypt(cred.secretEncrypted, cred.secretIv),
      });
      await client.getBalances();
      return { connected: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { connected: false, error: msg };
    }
  }

  async testLLMKey(userId: string, provider: string) {
    const cred = await this.prisma.lLMCredential.findUnique({
      where: { userId_provider: { userId, provider: provider as LLMProvider } },
    });
    if (!cred) return { connected: false, error: 'No credentials saved' };
    const apiKey = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv);
    try {
      if (provider === 'CLAUDE') {
        await axios.get('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          timeout: 8000,
        });
      } else if (provider === 'OPENAI') {
        await axios.get('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 8000,
        });
      } else if (provider === 'GROQ') {
        await axios.get('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 8000,
        });
      } else {
        return { connected: false, error: 'Unknown provider' };
      }
      return { connected: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { connected: false, error: msg };
    }
  }

  async testNewsApiKey(userId: string, provider: string) {
    const cred = await this.prisma.newsApiCredential.findFirst({
      where: { userId, provider: provider as NewsApiProvider },
    });
    if (!cred) return { connected: false, error: 'No credentials saved' };
    const apiKey = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv);
    try {
      if (provider === 'CRYPTOPANIC') {
        await axios.get('https://cryptopanic.com/api/free/v1/posts/', {
          params: { auth_token: apiKey, currencies: 'BTC', kind: 'news', public: true },
          timeout: 8000,
        });
        return { connected: true };
      }
      return { connected: false, error: 'Unknown provider' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { connected: false, error: msg };
    }
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
