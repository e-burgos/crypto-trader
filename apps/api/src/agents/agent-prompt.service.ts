import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PERSONA_AGENT_IDS, PersonaAgentId } from './agent-identity';

const CACHE_TTL_MS = 60_000;

export class AgentPromptUnavailableError extends Error {
  constructor(agentId: PersonaAgentId) {
    super(
      `AgentDefinition for "${agentId}" is missing, inactive, or has an empty systemPrompt.`,
    );
  }
}

interface CachedPrompt {
  prompt: string;
  fetchedAt: number;
}

@Injectable()
export class AgentPromptService implements OnModuleInit {
  private readonly logger = new Logger(AgentPromptService.name);
  private readonly cache = new Map<PersonaAgentId, CachedPrompt>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const definitions = await this.prisma.agentDefinition.findMany({
      where: { id: { in: [...PERSONA_AGENT_IDS] } },
      select: { id: true, isActive: true, systemPrompt: true },
    });
    const byId = new Map(
      definitions.map((d) => [d.id as unknown as PersonaAgentId, d]),
    );

    const missing = PERSONA_AGENT_IDS.filter((id) => {
      const definition = byId.get(id);
      return !definition || !definition.isActive || !definition.systemPrompt;
    });

    if (missing.length > 0) {
      throw new Error(
        `Missing AgentDefinition rows: [${missing.join(', ')}]. Run 'pnpm db:seed'.`,
      );
    }

    this.logger.log(
      `Verified ${PERSONA_AGENT_IDS.length} AgentDefinition prompts at boot`,
    );
  }

  async getSystemPrompt(agentId: PersonaAgentId): Promise<string> {
    const cached = this.cache.get(agentId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.prompt;
    }

    const definition = await this.prisma.agentDefinition.findUnique({
      where: { id: agentId },
      select: { systemPrompt: true, isActive: true },
    });

    if (!definition?.isActive || !definition.systemPrompt) {
      throw new AgentPromptUnavailableError(agentId);
    }

    this.cache.set(agentId, {
      prompt: definition.systemPrompt,
      fetchedAt: Date.now(),
    });
    return definition.systemPrompt;
  }

  invalidate(agentId?: PersonaAgentId): void {
    if (agentId) {
      this.cache.delete(agentId);
      return;
    }
    this.cache.clear();
  }
}
