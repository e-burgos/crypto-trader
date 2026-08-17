import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RiskBudgetService } from './risk-budget.service';
import { PortfolioContextService } from './portfolio-context.service';

@Module({
  imports: [PrismaModule],
  providers: [RiskBudgetService, PortfolioContextService],
  exports: [RiskBudgetService, PortfolioContextService],
})
export class AgentDomainModule {}
