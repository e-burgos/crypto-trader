import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentId, LLMProvider } from '../../generated/prisma/enums';
import {
  AGENT_PRESETS_STATIC,
  AgentPresetName,
  STATIC_FALLBACK_MODEL,
  buildDynamicPreset,
  resolveFallbackModel,
} from './agent-presets';
import { OpenRouterModelsApiService } from '../openrouter/openrouter-models-api.service';

@Injectable()
export class AgentConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openRouterModels: OpenRouterModelsApiService,
  ) {}

  // ── User configs ───────────────────────────────────────────────────────────

  async getUserAgentConfigs(userId: string) {
    return this.prisma.agentConfig.findMany({
      where: { userId },
      orderBy: { agentId: 'asc' },
    });
  }

  async getUserAgentConfig(userId: string, agentId: AgentId) {
    return this.prisma.agentConfig.findUnique({
      where: { userId_agentId: { userId, agentId } },
    });
  }

  async upsertUserAgentConfig(
    userId: string,
    agentId: AgentId,
    provider: LLMProvider,
    model: string,
  ) {
    // Users cannot configure the abstract 'orchestrator' — use routing/synthesis
    if (agentId === AgentId.orchestrator) {
      throw new BadRequestException(
        'Use "routing" or "synthesis" to configure the orchestrator models.',
      );
    }

    // Verify user has active credential for this provider
    const hasKey = await this.prisma.lLMCredential.findFirst({
      where: { userId, provider, isActive: true },
      select: { id: true },
    });
    if (!hasKey) {
      throw new BadRequestException(
        `No active API key for provider ${provider}. Add it in Settings first.`,
      );
    }

    return this.prisma.agentConfig.upsert({
      where: { userId_agentId: { userId, agentId } },
      create: { userId, agentId, provider, model },
      update: { provider, model },
    });
  }

  async deleteUserAgentConfig(userId: string, agentId: AgentId) {
    const existing = await this.prisma.agentConfig.findUnique({
      where: { userId_agentId: { userId, agentId } },
    });
    if (!existing) {
      throw new NotFoundException(`No override found for agent ${agentId}`);
    }
    await this.prisma.agentConfig.delete({
      where: { userId_agentId: { userId, agentId } },
    });
    return { deleted: agentId };
  }

  // ── Presets ────────────────────────────────────────────────────────────────

  async applyPreset(userId: string, presetName: AgentPresetName) {
    if (!['free', 'optimized', 'balanced'].includes(presetName)) {
      throw new BadRequestException(
        `Unknown preset "${presetName}". Valid values: free, optimized, balanced`,
      );
    }

    // Resolve preset dynamically from live OpenRouter models
    const models = await this.openRouterModels.getModels();
    const preset =
      models.length > 0
        ? buildDynamicPreset(presetName, models)
        : AGENT_PRESETS_STATIC[presetName];

    const results: Array<{ agentId: string; provider: string; model: string }> =
      [];

    for (const [agentIdStr, entry] of Object.entries(preset)) {
      const agentId = agentIdStr as AgentId;
      if (agentId === AgentId.orchestrator) continue; // internal only

      await this.prisma.agentConfig.upsert({
        where: { userId_agentId: { userId, agentId } },
        create: {
          userId,
          agentId,
          provider: entry.provider,
          model: entry.model,
        },
        update: { provider: entry.provider, model: entry.model },
      });

      results.push({ agentId, provider: entry.provider, model: entry.model });
    }

    // Also update the fallback model on the user's OpenRouter credential
    const fallbackModel =
      models.length > 0
        ? resolveFallbackModel(presetName, models)
        : STATIC_FALLBACK_MODEL;

    let appliedFallback: string | null = null;
    if (fallbackModel) {
      const updated = await this.prisma.lLMCredential.updateMany({
        where: {
          userId,
          provider: LLMProvider.OPENROUTER,
          isActive: true,
        },
        data: { selectedModel: fallbackModel },
      });
      if (updated.count > 0) appliedFallback = fallbackModel;
    }

    return {
      applied: presetName,
      count: results.length,
      agents: results,
      fallbackModel: appliedFallback,
    };
  }

  /**
   * Auto-resolve the best fallback model from the live OpenRouter catalog
   * and save it to the user's OpenRouter credential.
   */
  async autoResolveFallback(
    userId: string,
  ): Promise<{ fallbackModel: string }> {
    const models = await this.openRouterModels.getModels();
    const resolved =
      models.length > 0
        ? resolveFallbackModel('balanced', models)
        : STATIC_FALLBACK_MODEL;

    const fallbackModel = resolved ?? STATIC_FALLBACK_MODEL;

    await this.prisma.lLMCredential.updateMany({
      where: {
        userId,
        provider: LLMProvider.OPENROUTER,
        isActive: true,
      },
      data: { selectedModel: fallbackModel },
    });

    return { fallbackModel };
  }

  // ── Admin configs ──────────────────────────────────────────────────────────

  async getAdminAgentConfigs() {
    return this.prisma.adminAgentConfig.findMany({
      orderBy: { agentId: 'asc' },
    });
  }

  async getAdminAgentConfig(agentId: AgentId) {
    return this.prisma.adminAgentConfig.findUnique({
      where: { agentId },
    });
  }

  async upsertAdminAgentConfig(
    agentId: AgentId,
    provider: LLMProvider,
    model: string,
    adminUserId: string,
  ) {
    return this.prisma.adminAgentConfig.upsert({
      where: { agentId },
      create: {
        agentId,
        provider,
        model,
        updatedBy: adminUserId,
      },
      update: {
        provider,
        model,
        updatedBy: adminUserId,
      },
    });
  }

  async applyAdminPreset(presetName: AgentPresetName, adminUserId: string) {
    if (!['free', 'optimized', 'balanced'].includes(presetName)) {
      throw new BadRequestException(
        `Unknown preset "${presetName}". Valid values: free, optimized, balanced`,
      );
    }

    // Resolve preset dynamically from live OpenRouter models
    const models = await this.openRouterModels.getModels();
    const preset =
      models.length > 0
        ? buildDynamicPreset(presetName, models)
        : AGENT_PRESETS_STATIC[presetName];
    const results: AgentId[] = [];
    for (const [agentIdStr, entry] of Object.entries(preset)) {
      const agentId = agentIdStr as AgentId;
      await this.prisma.adminAgentConfig.upsert({
        where: { agentId },
        create: {
          agentId,
          provider: entry!.provider,
          model: entry!.model,
          updatedBy: adminUserId,
        },
        update: {
          provider: entry!.provider,
          model: entry!.model,
          updatedBy: adminUserId,
        },
      });
      results.push(agentId);
    }

    // Also update the fallback model on the admin's OpenRouter credential
    const fallbackModel =
      models.length > 0
        ? resolveFallbackModel(presetName, models)
        : STATIC_FALLBACK_MODEL;

    let appliedFallback: string | null = null;
    if (fallbackModel) {
      const updated = await this.prisma.lLMCredential.updateMany({
        where: {
          userId: adminUserId,
          provider: LLMProvider.OPENROUTER,
          isActive: true,
        },
        data: { selectedModel: fallbackModel },
      });
      if (updated.count > 0) appliedFallback = fallbackModel;
    }

    return {
      applied: presetName,
      count: results.length,
      agents: results,
      fallbackModel: appliedFallback,
    };
  }
}
