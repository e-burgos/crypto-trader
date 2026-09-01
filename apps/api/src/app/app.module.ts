import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthService } from './health.service';
import { PrismaModule } from '../prisma';
import { AuthModule } from '../auth/auth.module';
import { AUTH_THROTTLER, LOGIN_RATE_LIMIT } from '../auth/auth.controller';
import { UsersModule } from '../users/users.module';
import { GatewayModule } from '../gateway/gateway.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminModule } from '../admin/admin.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { TradingModule } from '../trading/trading.module';
import { MarketModule } from '../market/market.module';
import { ChatModule } from '../chat/chat.module';
import { LlmModule } from '../llm/llm.module';
import { AgentConfigModule } from '../agents/agent-config.module';
import { AgentDomainModule } from '../agents/domain/agent-domain.module';
import { EvaluationModule } from '../agents/evaluation/evaluation.module';
import { OpenRouterModule } from '../openrouter/openrouter.module';
import { ReactiveModule } from '../reactive/reactive.module';

@Module({
  imports: [
    BullModule.forRoot({
      redis: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: AUTH_THROTTLER, ...LOGIN_RATE_LIMIT }],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    GatewayModule,
    NotificationsModule,
    AdminModule,
    AnalyticsModule,
    TradingModule,
    MarketModule,
    ChatModule,
    LlmModule,
    AgentConfigModule,
    AgentDomainModule,
    EvaluationModule,
    OpenRouterModule,
    ReactiveModule,
  ],
  controllers: [AppController],
  providers: [AppService, HealthService],
})
export class AppModule {}
