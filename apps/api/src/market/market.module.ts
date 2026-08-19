import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { DataSourceRegistryService } from './data-source-registry.service';
import { DataSourceCredentialResolver } from './data-source-credential-resolver.service';
import { DataSourceProviderRegistrar } from './data-source-provider-registrar.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { DataSourceCacheService } from './data-source-cache.service';
import { RateLimiterService } from './rate-limiter.service';
import { DataSourceMetricsService } from './data-source-metrics.service';
import { NewsAnalysisScheduler } from './news-analysis.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { LlmModule } from '../llm/llm.module';
import { AgentConfigModule } from '../agents/agent-config.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [
    PrismaModule,
    OrchestratorModule,
    LlmModule,
    AgentConfigModule,
    GatewayModule,
  ],
  controllers: [MarketController],
  providers: [
    MarketService,
    DataSourceCredentialResolver,
    CircuitBreakerService,
    DataSourceCacheService,
    RateLimiterService,
    DataSourceMetricsService,
    DataSourceRegistryService,
    DataSourceProviderRegistrar,
    NewsAnalysisScheduler,
  ],
  exports: [
    MarketService,
    DataSourceRegistryService,
    DataSourceCredentialResolver,
  ],
})
export class MarketModule {}
