import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { RiskBudgetService } from './risk-budget.service';
import { PortfolioContextService } from './portfolio-context.service';
import { AggregateRiskService } from './aggregate-risk.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [RiskBudgetService, PortfolioContextService, AggregateRiskService],
  exports: [RiskBudgetService, PortfolioContextService, AggregateRiskService],
})
export class AgentDomainModule {}
