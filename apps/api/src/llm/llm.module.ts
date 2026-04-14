import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LLMUsageService } from './llm-usage.service';
import { LLMModelsService } from './llm-models.service';

@Module({
  imports: [PrismaModule],
  providers: [LLMUsageService, LLMModelsService],
  exports: [LLMUsageService, LLMModelsService],
})
export class LlmModule {}
