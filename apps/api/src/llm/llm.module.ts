import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LLMUsageService } from './llm-usage.service';
import { LLMModelsService } from './llm-models.service';
import { ProviderHealthService } from './provider-health.service';

@Module({
  imports: [PrismaModule],
  providers: [LLMUsageService, LLMModelsService, ProviderHealthService],
  exports: [LLMUsageService, LLMModelsService, ProviderHealthService],
})
export class LlmModule {}
