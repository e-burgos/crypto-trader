import { Module } from '@nestjs/common';
import { OpenRouterModelsApiService } from './openrouter-models-api.service';
import { OpenRouterModelsController } from './openrouter-models.controller';

@Module({
  controllers: [OpenRouterModelsController],
  providers: [OpenRouterModelsApiService],
  exports: [OpenRouterModelsApiService],
})
export class OpenRouterModule {}
