import {
  Controller,
  Get,
  Param,
  Post,
  Put,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { MarketService } from './market.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';

@ApiTags('market')
@ApiBearerAuth('access-token')
@Controller('market')
@UseGuards(JwtAuthGuard)
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('ohlcv/:asset/:interval')
  @ApiOperation({
    summary: 'Datos OHLCV de Binance para un par e intervalo dado',
  })
  @ApiParam({ name: 'asset', enum: ['BTC', 'ETH'], example: 'BTC' })
  @ApiParam({
    name: 'interval',
    example: '1h',
    description: 'Intervalo de vela (1m, 5m, 15m, 1h, 4h, 1d)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 200 })
  @ApiResponse({ status: 200, description: 'Array de velas OHLCV' })
  getOhlcv(
    @Param('asset') asset: string,
    @Param('interval') interval: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketService.getOhlcv(asset, interval, limit ? +limit : 200);
  }

  @Get('news')
  @ApiOperation({
    summary: 'Últimas noticias de crypto (filtradas por config del usuario)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 40 })
  @ApiResponse({ status: 200, description: 'Lista de noticias' })
  getNews(@CurrentUser() user: RequestUser, @Query('limit') limit?: string) {
    return this.marketService.getNews(user.userId, limit ? +limit : undefined);
  }

  @Get('news-sources/status')
  @ApiOperation({
    summary: 'Estado de conectividad de todas las fuentes de noticias',
  })
  @ApiResponse({ status: 200 })
  getNewsSourcesStatus(@CurrentUser() user: RequestUser) {
    return this.marketService.getNewsSourcesStatus(user.userId);
  }

  @Get('news/config')
  @ApiOperation({ summary: 'Obtener configuración de noticias del usuario' })
  @ApiResponse({ status: 200 })
  getNewsConfig(@CurrentUser() user: RequestUser) {
    return this.marketService.getNewsConfig(user.userId);
  }

  @Put('news/config')
  @ApiOperation({ summary: 'Actualizar configuración de noticias del usuario' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        intervalMinutes: { type: 'number', example: 30 },
        newsCount: { type: 'number', example: 40 },
        enabledSources: { type: 'array', items: { type: 'string' } },
        onlySummary: { type: 'boolean', example: true },
        newsWeight: { type: 'number', example: 15 },
      },
    },
  })
  @ApiResponse({ status: 200 })
  updateNewsConfig(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      intervalMinutes?: number;
      newsCount?: number;
      enabledSources?: string[];
      onlySummary?: boolean;
      botEnabled?: boolean;
      newsWeight?: number;
      primaryProvider?: string | null;
      primaryModel?: string | null;
      fallbackProvider?: string | null;
      fallbackModel?: string | null;
    },
  ) {
    return this.marketService.updateNewsConfig(user.userId, body as any);
  }

  @Get('news/analysis')
  @ApiOperation({
    summary: 'Obtener el último análisis de sentimiento guardado',
  })
  @ApiResponse({ status: 200 })
  getLatestAnalysis(@CurrentUser() user: RequestUser) {
    return this.marketService.getLatestAnalysis(user.userId);
  }

  @Post('news/analysis/run')
  @ApiOperation({
    summary: 'Ejecutar análisis keyword-based y persistir en DB',
  })
  @ApiResponse({ status: 201 })
  runKeywordAnalysis(@CurrentUser() user: RequestUser) {
    return this.marketService.runKeywordAnalysis(user.userId);
  }

  @Post('news/analysis/ai')
  @ApiOperation({
    summary: 'Ejecutar análisis IA sobre el último análisis guardado',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['provider'],
      properties: {
        provider: { type: 'string', example: 'CLAUDE' },
        model: {
          type: 'string',
          example: 'claude-sonnet-4-20250514',
          nullable: true,
        },
      },
    },
  })
  @ApiResponse({ status: 200 })
  analyzeSentiment(
    @CurrentUser() user: RequestUser,
    @Body() body: { provider: string; model?: string },
  ) {
    return this.marketService.analyzeSentiment(
      user.userId,
      body.provider,
      body.model,
    );
  }

  @Get('snapshot/:symbol')
  @ApiOperation({ summary: 'Snapshot de indicadores técnicos para un par' })
  @ApiParam({ name: 'symbol', example: 'BTCUSDT' })
  @ApiResponse({ status: 200 })
  getSnapshot(@Param('symbol') symbol: string) {
    return this.marketService.getSnapshot(symbol);
  }
}
