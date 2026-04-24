import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma';
import { AuthModule } from '../auth/auth.module';
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
import { OpenRouterModule } from '../openrouter/openrouter.module';

@Module({
  imports: [
    BullModule.forRoot({
      redis: process.env.REDIS_URL || 'redis://localhost:6379',
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
    OpenRouterModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
