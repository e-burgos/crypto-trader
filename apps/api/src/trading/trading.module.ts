import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TradingController } from './trading.controller';
import { TradingService, TRADING_QUEUE } from './trading.service';
import { TradingProcessor } from './trading.processor';
import { PositionActionService } from './position-action.service';
import { ReconciliationService } from './reconciliation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewayModule } from '../gateway/gateway.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { MarketModule } from '../market/market.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { AgentConfigModule } from '../agents/agent-config.module';
import { EvaluationModule } from '../agents/evaluation/evaluation.module';
import { AgentDomainModule } from '../agents/domain/agent-domain.module';
import { ReactiveCoordinationModule } from '../reactive/reactive-coordination.module';
import { ActionGateService } from './action-gate.service';
import { EntryOrderService } from './entry-order.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: TRADING_QUEUE }),
    PrismaModule,
    GatewayModule,
    NotificationsModule,
    UsersModule,
    MarketModule,
    OrchestratorModule,
    AgentConfigModule,
    EvaluationModule,
    AgentDomainModule,
    ReactiveCoordinationModule,
  ],
  controllers: [TradingController],
  providers: [
    TradingService,
    TradingProcessor,
    PositionActionService,
    ReconciliationService,
    ActionGateService,
    EntryOrderService,
  ],
  exports: [
    TradingService,
    PositionActionService,
    ActionGateService,
    EntryOrderService,
    BullModule,
  ],
})
export class TradingModule {}
