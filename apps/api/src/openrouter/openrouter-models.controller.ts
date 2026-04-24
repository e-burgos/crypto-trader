import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OpenRouterModelsApiService } from './openrouter-models-api.service';

@Controller('openrouter')
@UseGuards(JwtAuthGuard)
export class OpenRouterModelsController {
  constructor(private readonly modelsService: OpenRouterModelsApiService) {}

  @Get('models')
  async getModels(
    @Query('category') category?: string,
    @Query('freeOnly') freeOnly?: string,
  ) {
    const filter = {
      category: category || undefined,
      freeOnly: freeOnly === 'true',
      textOnly: true,
    };
    const models = await this.modelsService.getModels(filter);
    return { data: models, count: models.length };
  }
}
