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
import { MODEL_SLOT_IDS, ModelSlotId, toAgentId } from './agent-identity';

export type ResolutionSource = 'override' | 'user' | 'admin' | 'preset' | 'credential';

export interface ResolvedAgentModel {
  slot: ModelSlotId;
  provider: LLMProvider;
  model: string;
  source: ResolutionSource;
}

export interface ResolvedAgentClient extends ResolvedAgentModel {
  client: LLMProviderClient;
}

export interface AgentHealthItem {
  slot: ModelSlotId;
  healthy: boolean;
  provider: LLMProvider;
  model: string;
  source: ResolutionSource;
  hasKey: boolean;
}

export interface AgentHealthReport {
  healthy: boolean;
  agents: AgentHealthItem[];
}

export class NoLLMCredentialError extends BadRequestException {
  constructor(userId: string) {
    super(
      `No active LLM credentials for user ${userId}. Configure them in Settings.`,
    );
  }
}

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

  async resolveConfig(
    slot: ModelSlotId,
    userId: string,
  ): Promise<ResolvedAgentModel> {
    const agentId = toAgentId(slot);

    const userOverride = await this.agentConfigService.getUserAgentConfig(
      userId,
      agentId,
    );
    if (userOverride) {
      const hasKey = await this.hasActiveKey(userId, userOverride.provider);
      if (hasKey) {
        return {
          slot,
          provider: userOverride.provider,
          model: userOverride.model,
          source: 'user',
        };
      }
    }

    const adminDefault =
      await this.agentConfigService.getAdminAgentConfig(agentId);
    if (adminDefault) {
      return {
        slot,
        provider: adminDefault.provider,
        model: adminDefault.model,
        source: 'admin',
      };
    }

    const fallback = AGENT_FALLBACK_CONFIGS[agentId];
    return {
      slot,
      provider: fallback.provider,
      model: fallback.model,
      source: 'preset',
    };
  }

  async resolveAllConfigs(userId: string): Promise<ResolvedAgentModel[]> {
    return Promise.all(
      MODEL_SLOT_IDS.map((slot) => this.resolveConfig(slot, userId)),
    );
  }

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
          slot: cfg.slot,
          healthy: hasKey,
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

    const resolved = await this.resolveConfig(slot, userId);
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
        source: resolved.source,
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
