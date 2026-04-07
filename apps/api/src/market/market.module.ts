import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { NewsAnalysisScheduler } from './news-analysis.scheduler';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MarketController],
  providers: [MarketService, NewsAnalysisScheduler],
  exports: [MarketService],
})
export class MarketModule {}
