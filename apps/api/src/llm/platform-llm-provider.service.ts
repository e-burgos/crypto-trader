import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  LLMProvider,
  NotificationType,
} from '../../generated/prisma/enums';
import type { PlatformLLMProvider } from '../../generated/prisma/client';

export interface ToggleResult {
  provider: LLMProvider;
  isActive: boolean;
  affectedAgentConfigs: number;
  affectedUsers: number;
}

@Injectable()
export class PlatformLLMProviderService {
  private readonly logger = new Logger(PlatformLLMProviderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getAll(): Promise<PlatformLLMProvider[]> {
    return this.prisma.platformLLMProvider.findMany({
      orderBy: { provider: 'asc' },
    });
  }

  async getActiveProviders(): Promise<LLMProvider[]> {
    const active = await this.prisma.platformLLMProvider.findMany({
      where: { isActive: true },
      select: { provider: true },
    });
    return active.map((p) => p.provider);
  }

  async isProviderActive(provider: LLMProvider): Promise<boolean> {
    const record = await this.prisma.platformLLMProvider.findUnique({
      where: { provider },
    });
    // If no record exists (shouldn't happen after seed), assume active
    return record?.isActive ?? true;
  }

  async assertProviderActive(provider: LLMProvider): Promise<void> {
    const record = await this.prisma.platformLLMProvider.findUnique({
      where: { provider },
    });
    if (record && !record.isActive) {
      throw new ConflictException({
        statusCode: 409,
        code: 'LLM_PROVIDER_DISABLED',
        message: `The LLM provider ${provider} has been disabled by the administrator`,
        redirect: '/dashboard/settings/llms',
      });
    }
  }

  async toggle(
    provider: LLMProvider,
    isActive: boolean,
    adminId: string,
  ): Promise<ToggleResult> {
    // Verify provider exists
    const existing = await this.prisma.platformLLMProvider.findUnique({
      where: { provider },
    });
    if (!existing) {
      throw new NotFoundException(`Provider ${provider} not found`);
    }

    // Update provider status
    await this.prisma.platformLLMProvider.update({
      where: { provider },
      data: { isActive, updatedBy: adminId },
    });

    // Log admin action
    await this.prisma.adminAction.create({
      data: {
        adminId,
        action: isActive ? 'ENABLE_PROVIDER' : 'DISABLE_PROVIDER',
        details: { provider },
      },
    });

    let affectedAgentConfigs = 0;
    let affectedUsers = 0;

    // If disabling: clean up affected agent configs and notify users
    if (!isActive) {
      // Find all agent configs using this provider
      const affected = await this.prisma.agentConfig.findMany({
        where: { provider },
        select: { id: true, userId: true },
      });

      affectedAgentConfigs = affected.length;

      if (affected.length > 0) {
        // Delete affected configs — user will fall back to admin defaults
        await this.prisma.agentConfig.deleteMany({
          where: { provider },
        });

        // Group by userId and send one notification per user
        const uniqueUserIds = [
          ...new Set(affected.map((a) => a.userId)),
        ];
        affectedUsers = uniqueUserIds.length;

        await Promise.all(
          uniqueUserIds.map((userId) =>
            this.notifications.create(
              userId,
              NotificationType.LLM_PROVIDER_DISABLED,
              JSON.stringify({
                key: 'llmProviderDisabled',
                provider,
              }),
            ),
          ),
        );

        this.logger.log(
          `Disabled provider ${provider}: ${affectedAgentConfigs} configs cleared, ${affectedUsers} users notified`,
        );
      }
    }

    return { provider, isActive, affectedAgentConfigs, affectedUsers };
  }
}
