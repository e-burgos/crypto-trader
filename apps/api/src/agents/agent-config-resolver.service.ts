import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentConfigService } from './agent-config.service';
import { AgentId, LLMProvider } from '../../generated/prisma/enums';
import { PRESET_FREE } from './agent-presets';

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
    const configurableAgents = Object.values(AgentId).filter(
      (id) => id !== AgentId.orchestrator,
    );
    return Promise.all(
      configurableAgents.map((agentId) => this.resolveConfig(agentId, userId)),
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
}
