import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentConfigService } from './agent-config.service';
import { AgentId, LLMProvider } from '../../generated/prisma/enums';
import { PRESET_FREE } from './agent-presets';
import { decrypt } from '../users/utils/encryption.util';
import { PlatformLLMProviderService } from '../llm/platform-llm-provider.service';
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  createLLMProvider,
  LLMProviderClient,
  OpenRouterProvider,
} from '@crypto-trader/analysis';
import type { LLMProvider as AnalysisLLMProvider } from '@crypto-trader/shared';
import { MODEL_SLOT_IDS, ModelSlotId } from './agent-identity';

export interface ResolvedAgentConfig {
  agentId: AgentId;
  provider: LLMProvider;
  model: string;
  source: 'user' | 'admin' | 'fallback';
}

export interface AgentHealthItem {
  agentId: AgentId;
  healthy: boolean;
  provider: LLMProvider;
  model: string;
  source: 'user' | 'admin' | 'fallback';
  hasKey: boolean;
}

export interface AgentHealthReport {
  healthy: boolean;
  agents: AgentHealthItem[];
}

export type ResolutionSource = 'override' | 'user' | 'admin' | 'preset' | 'credential';

export interface ResolvedAgentClient {
  slot: ModelSlotId;
  provider: LLMProvider;
  model: string;
  source: ResolutionSource;
  client: LLMProviderClient;
}

export class NoLLMCredentialError extends BadRequestException {
  constructor(userId: string) {
    super(
      `No active LLM credentials for user ${userId}. Configure them in Settings.`,
    );
  }
}

// Hardcoded fallback = PRESET_FREE (OpenRouter free models, chosen by agent role).
// Updated April 2026 — see agent-presets.ts for the full rationale per agent.
const AGENT_FALLBACK_CONFIGS = PRESET_FREE as Record<
  AgentId,
  { provider: LLMProvider; model: string }
>;

@Injectable()
export class AgentConfigResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentConfigService: AgentConfigService,
    private readonly platformLLMProviderService: PlatformLLMProviderService,
  ) {}

  /**
   * Resolve the effective config for a single agent.
   * Priority: user override > admin default > hardcoded fallback.
   */
  async resolveConfig(
    agentId: AgentId,
    userId: string,
  ): Promise<ResolvedAgentConfig> {
    // 1. User override
    const userOverride = await this.agentConfigService.getUserAgentConfig(
      userId,
      agentId,
    );
    if (userOverride) {
      const hasKey = await this.hasActiveKey(userId, userOverride.provider);
      if (hasKey) {
        return {
          agentId,
          provider: userOverride.provider,
          model: userOverride.model,
          source: 'user',
        };
      }
    }

    // 2. Admin default
    const adminDefault =
      await this.agentConfigService.getAdminAgentConfig(agentId);
    if (adminDefault) {
      return {
        agentId,
        provider: adminDefault.provider,
        model: adminDefault.model,
        source: 'admin',
      };
    }

    // 3. Hardcoded fallback
    const fallback = AGENT_FALLBACK_CONFIGS[agentId];
    return {
      agentId,
      provider: fallback.provider,
      model: fallback.model,
      source: 'fallback',
    };
  }

  /**
   * Resolve configs for all configurable agents (excluding abstract 'orchestrator').
   */
  async resolveAllConfigs(userId: string): Promise<ResolvedAgentConfig[]> {
    return Promise.all(
      MODEL_SLOT_IDS.map((slot) =>
        this.resolveConfig(slot as unknown as AgentId, userId),
      ),
    );
  }

  /**
   * Health check: verify user has active keys for all resolved providers.
   * Optionally simulate removing a provider.
   */
  async checkHealth(
    userId: string,
    simulateRemoveProvider?: LLMProvider,
  ): Promise<AgentHealthReport> {
    const configs = await this.resolveAllConfigs(userId);
    const agents: AgentHealthItem[] = await Promise.all(
      configs.map(async (cfg) => {
        let hasKey = await this.hasActiveKey(userId, cfg.provider);
        if (simulateRemoveProvider && cfg.provider === simulateRemoveProvider) {
          hasKey = false;
        }
        return {
          agentId: cfg.agentId,
          healthy: hasKey, // true solo si hay key activa — admin/fallback no garantizan disponibilidad
          provider: cfg.provider,
          model: cfg.model,
          source: cfg.source,
          hasKey,
        };
      }),
    );

    return {
      healthy: agents.every((a) => a.healthy),
      agents,
    };
  }

  private async hasActiveKey(
    userId: string,
    provider: LLMProvider,
  ): Promise<boolean> {
    const count = await this.prisma.lLMCredential.count({
      where: { userId, provider, isActive: true },
    });
    return count > 0;
  }

  /**
   * Single entry point to obtain an LLM client for an agent slot.
   * Cascade: explicit override > resolveConfig (user > admin > preset) > first active credential.
   * @throws NoLLMCredentialError if no step reaches an active credential.
   */
  async resolveClient(
    userId: string,
    slot: ModelSlotId,
    override?: { provider: LLMProvider; model: string },
  ): Promise<ResolvedAgentClient> {
    if (override) {
      const cred = await this.findActiveCredential(userId, override.provider);
      if (cred) {
        await this.platformLLMProviderService.assertProviderActive(
          override.provider,
        );
        return {
          slot,
          provider: override.provider,
          model: override.model,
          source: 'override',
          client: this.buildClient(
            override.provider,
            decrypt(cred.apiKeyEncrypted, cred.apiKeyIv),
            override.model,
            cred.fallbackModels,
          ),
        };
      }
    }

    const resolved = await this.resolveConfig(slot as unknown as AgentId, userId);
    const resolvedCred = await this.findActiveCredential(
      userId,
      resolved.provider,
    );
    if (resolvedCred) {
      await this.platformLLMProviderService.assertProviderActive(
        resolved.provider,
      );
      return {
        slot,
        provider: resolved.provider,
        model: resolved.model,
        source: resolved.source === 'fallback' ? 'preset' : resolved.source,
        client: this.buildClient(
          resolved.provider,
          decrypt(resolvedCred.apiKeyEncrypted, resolvedCred.apiKeyIv),
          resolved.model,
          resolvedCred.fallbackModels,
        ),
      };
    }

    const firstCred = await this.prisma.lLMCredential.findFirst({
      where: { userId, isActive: true },
    });
    if (firstCred) {
      await this.platformLLMProviderService.assertProviderActive(
        firstCred.provider,
      );
      return {
        slot,
        provider: firstCred.provider,
        model: firstCred.selectedModel,
        source: 'credential',
        client: this.buildClient(
          firstCred.provider,
          decrypt(firstCred.apiKeyEncrypted, firstCred.apiKeyIv),
          firstCred.selectedModel,
          firstCred.fallbackModels,
        ),
      };
    }

    throw new NoLLMCredentialError(userId);
  }

  private async findActiveCredential(userId: string, provider: LLMProvider) {
    return this.prisma.lLMCredential.findFirst({
      where: { userId, provider, isActive: true },
    });
  }

  private buildClient(
    provider: LLMProvider,
    apiKey: string,
    model: string,
    fallbackModels: string[],
  ): LLMProviderClient {
    return provider === LLMProvider.OPENROUTER
      ? new OpenRouterProvider({ apiKey, model, fallbackModels })
      : createLLMProvider(
          provider as unknown as AnalysisLLMProvider,
          apiKey,
          model,
        );
  }
}
