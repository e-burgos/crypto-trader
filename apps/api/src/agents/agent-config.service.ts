import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentId, LLMProvider } from '../../generated/prisma/enums';
import { AGENT_PRESETS, AgentPresetName } from './agent-presets';

@Injectable()
export class AgentConfigService {
  constructor(private readonly prisma: PrismaService) {}

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
    const preset = AGENT_PRESETS[presetName];
    if (!preset) {
      throw new BadRequestException(
        `Unknown preset "${presetName}". Valid values: free, optimized, balanced`,
      );
    }

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

    return { applied: presetName, count: results.length, agents: results };
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
    const preset = AGENT_PRESETS[presetName];
    if (!preset) {
      throw new BadRequestException(
        `Unknown preset "${presetName}". Valid values: free, optimized, balanced`,
      );
    }
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
    return { applied: presetName, count: results.length, agents: results };
  }
}
