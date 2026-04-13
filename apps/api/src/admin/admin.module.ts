import { Module, forwardRef } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminAgentsController } from './agents/admin-agents.controller';
import { AdminAgentsService } from './agents/admin-agents.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewayModule } from '../gateway/gateway.module';
import { TradingModule } from '../trading/trading.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';

@Module({
  imports: [
    PrismaModule,
    GatewayModule,
    forwardRef(() => TradingModule),
    OrchestratorModule,
  ],
  controllers: [AdminController, AdminAgentsController],
  providers: [AdminService, AdminAgentsService],
  exports: [AdminService],
})
export class AdminModule {}
