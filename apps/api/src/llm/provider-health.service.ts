import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { LLMUsageService } from './llm-usage.service';
import { LLMProvider } from '../../generated/prisma/client';
import {
  getRateLimits,
  type ProviderRateLimits,
} from '@crypto-trader/analysis';
import { decrypt } from '../users/utils/encryption.util';

// ── Types ────────────────────────────────────────────────────────────────────

export type Availability = 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE';
export type KeyStatus = 'ACTIVE' | 'INVALID' | 'INACTIVE';

export interface ProviderStatus {
  provider: LLMProvider;
  availability: Availability;
  availabilityScore: number;
  reason?: string;
  rateLimits: ProviderRateLimits | null;
  usage: {
    totalTokensIn: number;
    totalTokensOut: number;
    totalCalls: number;
    totalErrors: number;
    estimatedCostUsd: number;
    bySource: {
      source: string;
      tokensIn: number;
      tokensOut: number;
      calls: number;
      costUsd: number;
    }[];
    dailySeries: {
      date: string;
      costUsd: number;
      tokens: number;
      calls: number;
    }[];
  };
  lastSuccessAt: string | null;
  lastError: string | null;
  keyStatus: KeyStatus;
}

// ── In-memory error tracking ─────────────────────────────────────────────────

interface CallRecord {
  at: number;
  ok: boolean;
  error?: string;
}

const recentCalls = new Map<string, CallRecord[]>();
const MAX_RECENT_CALLS = 50;

export function recordCall(
  userId: string,
  provider: string,
  ok: boolean,
  error?: string,
): void {
  const key = `${userId}:${provider}`;
  const list = recentCalls.get(key) ?? [];
  list.push({ at: Date.now(), ok, error });
  if (list.length > MAX_RECENT_CALLS) list.shift();
  recentCalls.set(key, list);
}

function getRecentErrorRate(userId: string, provider: string): number {
  const list = recentCalls.get(`${userId}:${provider}`);
  if (!list || list.length === 0) return 0;
  const errors = list.filter((c) => !c.ok).length;
  return errors / list.length;
}

function getLastSuccess(userId: string, provider: string): number | null {
  const list = recentCalls.get(`${userId}:${provider}`);
  if (!list) return null;
  const last = [...list].reverse().find((c) => c.ok);
  return last ? last.at : null;
}

function getLastError(userId: string, provider: string): string | null {
  const list = recentCalls.get(`${userId}:${provider}`);
  if (!list) return null;
  const last = [...list].reverse().find((c) => !c.ok);
  return last?.error ?? null;
}

/** Exposed for testing */
export function clearCallRecords(): void {
  recentCalls.clear();
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ProviderHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProviderHealthService.name);
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmUsageService: LLMUsageService,
  ) {}

  onModuleInit() {
    // Health check every 5 minutes
    this.healthCheckTimer = setInterval(
      () => this.runHealthChecks(),
      5 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
  }

  async getAllProvidersStatus(userId: string): Promise<ProviderStatus[]> {
    const credentials = await this.prisma.lLMCredential.findMany({
      where: { userId },
      select: { provider: true, isActive: true },
    });

    return Promise.all(
      credentials.map((cred) =>
        this.getProviderStatus(
          userId,
          cred.provider,
          cred.isActive ? 'ACTIVE' : 'INACTIVE',
        ),
      ),
    );
  }

  async getProviderStatus(
    userId: string,
    provider: LLMProvider,
    keyStatus?: KeyStatus,
  ): Promise<ProviderStatus> {
    // Determine key status if not provided
    if (!keyStatus) {
      const cred = await this.prisma.lLMCredential.findFirst({
        where: { userId, provider },
        select: { isActive: true },
      });
      keyStatus = !cred ? 'INACTIVE' : cred.isActive ? 'ACTIVE' : 'INACTIVE';
    }

    // Usage data (last 30 days)
    const usage = await this.getProviderUsage(userId, provider, '30d');

    // Rate limits from passive capture
    const rateLimits = getRateLimits(userId, provider);

    // Error tracking
    const recentErrorRate = getRecentErrorRate(userId, provider);
    const lastSuccessTs = getLastSuccess(userId, provider);
    const lastSuccessAge = lastSuccessTs ? Date.now() - lastSuccessTs : null;
    const lastError = getLastError(userId, provider);

    // Override keyStatus to INVALID if key is marked active but recent calls all fail
    if (keyStatus === 'ACTIVE' && recentErrorRate === 1 && lastError) {
      keyStatus = 'INVALID';
    }

    // Calculate availability
    const { score, availability, reason } = calculateAvailabilityScore(
      keyStatus,
      rateLimits,
      recentErrorRate,
      lastSuccessAge,
    );

    return {
      provider,
      availability,
      availabilityScore: score,
      reason,
      rateLimits,
      usage,
      lastSuccessAt: lastSuccessTs
        ? new Date(lastSuccessTs).toISOString()
        : null,
      lastError,
      keyStatus,
    };
  }

  async getProviderUsage(
    userId: string,
    provider: LLMProvider,
    period: '7d' | '30d' | '90d',
  ) {
    const now = new Date();
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const logs = await this.prisma.llmUsageLog.findMany({
      where: {
        userId,
        provider,
        createdAt: { gte: from, lte: now },
      },
      orderBy: { createdAt: 'asc' },
    });

    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let totalCalls = 0;
    const totalErrors = 0;
    let estimatedCostUsd = 0;

    const sourceMap = new Map<
      string,
      { tokensIn: number; tokensOut: number; calls: number; costUsd: number }
    >();
    const dailyMap = new Map<
      string,
      { costUsd: number; tokens: number; calls: number }
    >();

    for (const log of logs) {
      totalTokensIn += log.inputTokens;
      totalTokensOut += log.outputTokens;
      totalCalls += 1;
      estimatedCostUsd += log.costUsd;

      // By source
      const src = sourceMap.get(log.source) ?? {
        tokensIn: 0,
        tokensOut: 0,
        calls: 0,
        costUsd: 0,
      };
      src.tokensIn += log.inputTokens;
      src.tokensOut += log.outputTokens;
      src.calls += 1;
      src.costUsd += log.costUsd;
      sourceMap.set(log.source, src);

      // Daily
      const dateKey = log.createdAt.toISOString().slice(0, 10);
      const day = dailyMap.get(dateKey) ?? { costUsd: 0, tokens: 0, calls: 0 };
      day.costUsd += log.costUsd;
      day.tokens += log.inputTokens + log.outputTokens;
      day.calls += 1;
      dailyMap.set(dateKey, day);
    }

    return {
      totalTokensIn,
      totalTokensOut,
      totalCalls,
      totalErrors,
      estimatedCostUsd,
      bySource: Array.from(sourceMap.entries()).map(([source, data]) => ({
        source,
        ...data,
      })),
      dailySeries: Array.from(dailyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({ date, ...data })),
    };
  }

  // ── Health check (every 5 min via setInterval) ────────────────────────────

  async runHealthChecks(): Promise<void> {
    try {
      // Find providers with active trading agents
      const activeConfigs = await this.prisma.tradingConfig.findMany({
        where: { isRunning: true },
        select: {
          userId: true,
        },
      });

      const seen = new Set<string>();
      for (const cfg of activeConfigs) {
        // Check all active credentials for the user
        const creds = await this.prisma.lLMCredential.findMany({
          where: { userId: cfg.userId, isActive: true },
          select: {
            userId: true,
            provider: true,
            apiKeyEncrypted: true,
            apiKeyIv: true,
          },
        });

        for (const cred of creds) {
          const key = `${cfg.userId}:${cred.provider}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const apiKey = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv);
          const ok = await this.healthCheck(
            cred.provider as LLMProvider,
            apiKey,
          );
          recordCall(
            cfg.userId,
            cred.provider,
            ok,
            ok ? undefined : 'Health check failed',
          );
        }
      }
    } catch (err) {
      this.logger.warn(`Health check cycle failed: ${err}`);
    }
  }

  async healthCheck(provider: LLMProvider, apiKey: string): Promise<boolean> {
    try {
      switch (provider) {
        case LLMProvider.CLAUDE:
          await axios.get('https://api.anthropic.com/v1/models', {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            timeout: 5000,
          });
          break;
        case LLMProvider.OPENAI:
          await axios.get('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 5000,
            params: { limit: 1 },
          });
          break;
        case LLMProvider.GROQ:
          await axios.get('https://api.groq.com/openai/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 5000,
          });
          break;
        case LLMProvider.GEMINI:
          await axios.get(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=1`,
            { timeout: 5000 },
          );
          break;
        case LLMProvider.MISTRAL:
          await axios.get('https://api.mistral.ai/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 5000,
          });
          break;
        case LLMProvider.TOGETHER:
          await axios.get('https://api.together.xyz/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 5000,
          });
          break;
        case LLMProvider.OPENROUTER:
          await axios.get('https://openrouter.ai/api/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 5000,
          });
          break;
      }
      return true;
    } catch {
      return false;
    }
  }
}

// ── Availability Score ───────────────────────────────────────────────────────

export function calculateAvailabilityScore(
  keyStatus: string,
  rateLimits: ProviderRateLimits | null,
  recentErrorRate: number,
  lastSuccessAge: number | null,
): { score: number; availability: Availability; reason?: string } {
  if (keyStatus === 'INACTIVE')
    return {
      score: 0,
      availability: 'UNAVAILABLE',
      reason: 'API key not configured',
    };
  if (keyStatus === 'INVALID')
    return {
      score: 0,
      availability: 'UNAVAILABLE',
      reason: 'API key invalid or expired',
    };

  let score = 100;
  const reasons: string[] = [];

  // Error rate penalty
  if (recentErrorRate > 0.5) {
    score -= 60;
    reasons.push(`High error rate (${Math.round(recentErrorRate * 100)}%)`);
  } else if (recentErrorRate > 0.2) {
    score -= 30;
    reasons.push(`Elevated error rate (${Math.round(recentErrorRate * 100)}%)`);
  }

  // Rate limit penalty
  if (
    rateLimits?.tokensRemaining !== null &&
    rateLimits?.tokensRemaining !== undefined &&
    rateLimits?.tokensLimit !== null &&
    rateLimits?.tokensLimit !== undefined &&
    rateLimits.tokensLimit > 0
  ) {
    const pct = rateLimits.tokensRemaining / rateLimits.tokensLimit;
    if (pct < 0.05) {
      score -= 40;
      reasons.push('Token quota nearly exhausted (<5%)');
    } else if (pct < 0.2) {
      score -= 15;
      reasons.push(`Token quota low (${Math.round(pct * 100)}% remaining)`);
    }
  }

  // Staleness penalty
  if (lastSuccessAge !== null && lastSuccessAge > 30 * 60 * 1000) {
    score -= 10;
    reasons.push('No successful calls in last 30 minutes');
  }

  score = Math.max(0, Math.min(100, score));

  let availability: Availability;
  if (score >= 70) availability = 'AVAILABLE';
  else if (score >= 30) availability = 'LIMITED';
  else availability = 'UNAVAILABLE';

  return {
    score,
    availability,
    reason: reasons.length ? reasons.join('; ') : undefined,
  };
}
