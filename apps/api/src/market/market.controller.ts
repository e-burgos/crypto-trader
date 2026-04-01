import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MarketService } from './market.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('market')
@UseGuards(JwtAuthGuard)
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('ohlcv/:asset/:interval')
  getOhlcv(
    @Param('asset') asset: string,
    @Param('interval') interval: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketService.getOhlcv(asset, interval, limit ? +limit : 200);
  }

  @Get('news')
  getNews(@Query('limit') limit?: string) {
    return this.marketService.getNews(limit ? +limit : 20);
  }
}
