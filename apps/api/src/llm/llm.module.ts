import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OpenRouterModule } from '../openrouter/openrouter.module';
import { LLMUsageService } from './llm-usage.service';
import { LLMModelsService } from './llm-models.service';
import { ProviderHealthService } from './provider-health.service';
import { PlatformLLMProviderService } from './platform-llm-provider.service';
import { ModelPricingService } from './model-pricing.service';
import {
  PlatformLLMProviderController,
  LLMProviderStatusController,
} from './platform-llm-provider.controller';

@Module({
  imports: [PrismaModule, NotificationsModule, OpenRouterModule],
  controllers: [PlatformLLMProviderController, LLMProviderStatusController],
  providers: [
    LLMUsageService,
    LLMModelsService,
    ProviderHealthService,
    PlatformLLMProviderService,
    ModelPricingService,
  ],
  exports: [
    LLMUsageService,
    LLMModelsService,
    ProviderHealthService,
    PlatformLLMProviderService,
    ModelPricingService,
  ],
})
export class LlmModule {}
