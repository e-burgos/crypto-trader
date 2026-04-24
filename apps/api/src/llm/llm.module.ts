import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LLMUsageService } from './llm-usage.service';
import { LLMModelsService } from './llm-models.service';
import { ProviderHealthService } from './provider-health.service';
import { PlatformLLMProviderService } from './platform-llm-provider.service';
import {
  PlatformLLMProviderController,
  LLMProviderStatusController,
} from './platform-llm-provider.controller';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [PlatformLLMProviderController, LLMProviderStatusController],
  providers: [
    LLMUsageService,
    LLMModelsService,
    ProviderHealthService,
    PlatformLLMProviderService,
  ],
  exports: [
    LLMUsageService,
    LLMModelsService,
    ProviderHealthService,
    PlatformLLMProviderService,
  ],
})
export class LlmModule {}
