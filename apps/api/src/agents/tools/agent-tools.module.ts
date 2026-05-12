import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MarketModule } from '../../market/market.module';
import { AgentToolRegistry } from './agent-tool-registry';
import { ContextPlannerService } from './context-planner.service';
import { PortfolioContextTool } from './portfolio-context.tool';
import { MarketEdgeTool } from './market-edge.tool';
import { TradeSimulationTool } from './trade-simulation.tool';
import { RiskBudgetTool } from './risk-budget.tool';
import { DecisionMemoryTool } from './decision-memory.tool';
import { TokenBudgetTool } from './token-budget.tool';

@Module({
  imports: [PrismaModule, MarketModule],
  providers: [
    AgentToolRegistry,
    ContextPlannerService,
    PortfolioContextTool,
    MarketEdgeTool,
    TradeSimulationTool,
    RiskBudgetTool,
    DecisionMemoryTool,
    TokenBudgetTool,
  ],
  exports: [AgentToolRegistry, ContextPlannerService],
})
export class AgentToolsModule {}
