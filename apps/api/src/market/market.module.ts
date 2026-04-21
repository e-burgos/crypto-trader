import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { NewsAnalysisScheduler } from './news-analysis.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { LlmModule } from '../llm/llm.module';
import { AgentConfigModule } from '../agents/agent-config.module';

@Module({
  imports: [PrismaModule, OrchestratorModule, LlmModule, AgentConfigModule],
  controllers: [MarketController],
  providers: [MarketService, NewsAnalysisScheduler],
  exports: [MarketService],
})
export class MarketModule {}
