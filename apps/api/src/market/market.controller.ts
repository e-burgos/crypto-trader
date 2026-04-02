import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
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
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 200,
    description: 'Número de velas (máx 1000)',
  })
  @ApiResponse({ status: 200, description: 'Array de velas OHLCV' })
  getOhlcv(
    @Param('asset') asset: string,
    @Param('interval') interval: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketService.getOhlcv(asset, interval, limit ? +limit : 200);
  }

  @Get('news')
  @ApiOperation({ summary: 'Últimas noticias de crypto agregadas' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Lista de artículos de noticias' })
  getNews(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
  ) {
    return this.marketService.getNews(user.userId, limit ? +limit : 20);
  }
}
