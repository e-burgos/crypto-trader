import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateUserDto,
  BinanceKeyDto,
  SetTestnetBinanceKeysDto,
  LLMKeyDto,
  NewsApiKeyDto,
  UpdateOperationModeDto,
} from '../auth/dto/auth.dto';
import { encrypt, decrypt } from './utils/encryption.util';
import { LLMProvider, NewsApiProvider } from '../../generated/prisma/enums';
import { BinanceRestClient } from '@crypto-trader/data-fetcher';
import { recordCall } from '../llm/provider-health.service';

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
        platformOperationMode: true,
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

  // ── Operation mode ─────────────────────────────────────────────────────────

  async updateOperationMode(userId: string, dto: UpdateOperationModeDto) {
    const { mode } = dto;

    if (mode === 'LIVE') {
      const cred = await this.prisma.binanceCredential.findUnique({
        where: { userId_isTestnet: { userId, isTestnet: false } },
      });
      if (!cred) {
        throw new BadRequestException(
          'No Binance production keys configured. Add your API keys in Settings first.',
        );
      }
    }

    if (mode === 'TESTNET') {
      const cred = await this.prisma.binanceCredential.findUnique({
        where: { userId_isTestnet: { userId, isTestnet: true } },
      });
      if (!cred) {
        throw new BadRequestException(
          'No Binance testnet keys configured. Add your testnet API keys in Settings first.',
        );
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { platformOperationMode: mode },
    });

    return { platformOperationMode: mode };
  }

  // ── Binance credentials ────────────────────────────────────────────────────

  async setBinanceKeys(userId: string, dto: BinanceKeyDto) {
    const { encrypted: apiKeyEncrypted, iv: apiKeyIv } = encrypt(dto.apiKey);
    const { encrypted: secretEncrypted, iv: secretIv } = encrypt(dto.apiSecret);

    return this.prisma.binanceCredential.upsert({
      where: { userId_isTestnet: { userId, isTestnet: false } },
      create: {
        userId,
        isTestnet: false,
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
    await this.prisma.binanceCredential.deleteMany({
      where: { userId, isTestnet: false },
    });
  }

  async getBinanceKeyStatus(userId: string) {
    const cred = await this.prisma.binanceCredential.findUnique({
      where: { userId_isTestnet: { userId, isTestnet: false } },
      select: { isActive: true, createdAt: true },
    });
    return { hasKeys: !!cred, isActive: cred?.isActive ?? false };
  }

  async getBinanceKeys(userId: string) {
    const cred = await this.prisma.binanceCredential.findUnique({
      where: { userId_isTestnet: { userId, isTestnet: false } },
    });
    if (!cred) throw new NotFoundException('No Binance credentials found');
    return {
      apiKey: decrypt(cred.apiKeyEncrypted, cred.apiKeyIv),
      apiSecret: decrypt(cred.secretEncrypted, cred.secretIv),
    };
  }

  // ── Binance Testnet credentials ────────────────────────────────────────────

  async setTestnetBinanceKeys(userId: string, dto: SetTestnetBinanceKeysDto) {
    const { encrypted: apiKeyEncrypted, iv: apiKeyIv } = encrypt(dto.apiKey);
    const { encrypted: secretEncrypted, iv: secretIv } = encrypt(dto.apiSecret);

    return this.prisma.binanceCredential.upsert({
      where: { userId_isTestnet: { userId, isTestnet: true } },
      create: {
        userId,
        isTestnet: true,
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

  async deleteTestnetBinanceKeys(userId: string) {
    await this.prisma.binanceCredential.deleteMany({
      where: { userId, isTestnet: true },
    });
  }

  async getTestnetBinanceKeyStatus(userId: string) {
    const cred = await this.prisma.binanceCredential.findUnique({
      where: { userId_isTestnet: { userId, isTestnet: true } },
      select: { isActive: true, createdAt: true },
    });
    return { hasKeys: !!cred, isActive: cred?.isActive ?? false };
  }

  async testTestnetBinanceConnection(userId: string) {
    const cred = await this.prisma.binanceCredential.findUnique({
      where: { userId_isTestnet: { userId, isTestnet: true } },
    });
    if (!cred)
      return { connected: false, error: 'No testnet credentials saved' };
    try {
      const client = new BinanceRestClient({
        apiKey: decrypt(cred.apiKeyEncrypted, cred.apiKeyIv),
        apiSecret: decrypt(cred.secretEncrypted, cred.secretIv),
        testnet: true,
      });
      await client.getBalances();
      return { connected: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { connected: false, error: msg };
    }
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

  async updateLLMModel(
    userId: string,
    provider: string,
    selectedModel: string | null,
  ) {
    return this.prisma.lLMCredential.update({
      where: { userId_provider: { userId, provider: provider as LLMProvider } },
      data: { selectedModel: selectedModel ?? '' },
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
      where: { userId_isTestnet: { userId, isTestnet: false } },
    });
    if (!cred) return { connected: false, error: 'No credentials saved' };
    try {
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
      } else if (provider === 'GEMINI') {
        await axios.get(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
          { timeout: 8000 },
        );
      } else if (provider === 'MISTRAL') {
        await axios.get('https://api.mistral.ai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 8000,
        });
      } else if (provider === 'TOGETHER') {
        await axios.get('https://api.together.xyz/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 8000,
        });
      } else if (provider === 'OPENROUTER') {
        await axios.get('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 8000,
        });
      } else {
        return { connected: false, error: 'Unknown provider' };
      }
      recordCall(userId, provider, true);
      return { connected: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCall(userId, provider, false, msg);
      return { connected: false, error: msg };
    }
  }

  async validateAllLLMKeys(userId: string) {
    const credentials = await this.prisma.lLMCredential.findMany({
      where: { userId },
      select: { provider: true, isActive: true },
    });
    const results = await Promise.all(
      credentials.map(async (cred) => {
        if (!cred.isActive)
          return { provider: cred.provider, status: 'INACTIVE' as const };
        const result = await this.testLLMKey(userId, cred.provider);
        return {
          provider: cred.provider,
          status: result.connected ? ('ACTIVE' as const) : ('INVALID' as const),
          error: result.error,
        };
      }),
    );
    const active = results.filter((r) => r.status === 'ACTIVE').length;
    return { results, active, total: results.length };
  }

  async testNewsApiKey(userId: string, provider: string) {
    const cred = await this.prisma.newsApiCredential.findFirst({
      where: { userId, provider: provider as NewsApiProvider },
    });
    if (!cred) return { connected: false, error: 'No credentials saved' };
    const apiKey = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv);
    try {
      if (provider === 'NEWSDATA') {
        const { data } = await axios.get('https://newsdata.io/api/1/news', {
          params: { apikey: apiKey, language: 'en', q: 'bitcoin', size: 1 },
          timeout: 8000,
        });
        if (data.status === 'error') {
          return {
            connected: false,
            error: data.results?.message ?? 'API error',
          };
        }
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
