import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { AgentToolName, AgentId } from '../../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AgentTool,
  AgentToolInput,
  AgentToolOutput,
} from './agent-tool.interface';
import { PortfolioContextTool } from './portfolio-context.tool';
import { MarketEdgeTool } from './market-edge.tool';
import { TradeSimulationTool } from './trade-simulation.tool';
import { RiskBudgetTool } from './risk-budget.tool';
import { DecisionMemoryTool } from './decision-memory.tool';
import { TokenBudgetTool } from './token-budget.tool';

const TOOL_CACHE_TTL: Record<string, number> = {
  PORTFOLIO_CONTEXT: 30_000,
  MARKET_EDGE: 60_000,
  TRADE_SIMULATION: 0,
  RISK_BUDGET: 60_000,
  DECISION_MEMORY: 300_000,
  TOKEN_BUDGET: 60_000,
};

interface CacheEntry {
  output: AgentToolOutput;
  expiresAt: number;
}

@Injectable()
export class AgentToolRegistry implements OnModuleInit {
  private readonly logger = new Logger(AgentToolRegistry.name);
  private readonly tools = new Map<AgentToolName, AgentTool>();
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly portfolioContext: PortfolioContextTool,
    private readonly marketEdge: MarketEdgeTool,
    private readonly tradeSimulation: TradeSimulationTool,
    private readonly riskBudget: RiskBudgetTool,
    private readonly decisionMemory: DecisionMemoryTool,
    private readonly tokenBudget: TokenBudgetTool,
  ) {}

  onModuleInit() {
    this.register(AgentToolName.PORTFOLIO_CONTEXT, this.portfolioContext);
    this.register(AgentToolName.MARKET_EDGE, this.marketEdge);
    this.register(AgentToolName.TRADE_SIMULATION, this.tradeSimulation);
    this.register(AgentToolName.RISK_BUDGET, this.riskBudget);
    this.register(AgentToolName.DECISION_MEMORY, this.decisionMemory);
    this.register(AgentToolName.TOKEN_BUDGET, this.tokenBudget);
  }

  register(name: AgentToolName, tool: AgentTool): void {
    this.tools.set(name, tool);
  }

  get(name: AgentToolName): AgentTool | undefined {
    return this.tools.get(name);
  }

  getAll(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  async execute(
    name: AgentToolName,
    input: AgentToolInput,
  ): Promise<AgentToolOutput> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    const inputHash = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex')
      .slice(0, 16);

    // Check cache
    const ttl = TOOL_CACHE_TTL[name] ?? 0;
    if (ttl > 0) {
      const cacheKey = `${name}:${inputHash}`;
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.output;
      }
    }

    const start = Date.now();
    let output: AgentToolOutput;
    let status = 'SUCCESS';

    try {
      output = await tool.execute(input);
    } catch (err) {
      status = 'ERROR';
      const elapsed = Date.now() - start;
      await this.logInvocation(
        input,
        name,
        inputHash,
        null,
        status,
        elapsed,
        0,
      );
      throw err;
    }

    const elapsed = Date.now() - start;
    const outputHash = createHash('sha256')
      .update(JSON.stringify(output.data))
      .digest('hex')
      .slice(0, 16);

    // Store in cache
    if (ttl > 0) {
      const cacheKey = `${name}:${inputHash}`;
      this.cache.set(cacheKey, {
        output,
        expiresAt: Date.now() + ttl,
      });
    }

    // Log invocation (fire and forget)
    this.logInvocation(
      input,
      name,
      inputHash,
      outputHash,
      status,
      elapsed,
      output.tokenEstimate,
    ).catch((err) =>
      this.logger.warn(`Failed to log tool invocation: ${err.message}`),
    );

    return output;
  }

  private async logInvocation(
    input: AgentToolInput,
    toolName: AgentToolName,
    inputHash: string,
    outputHash: string | null,
    status: string,
    latencyMs: number,
    outputTokens: number,
  ): Promise<void> {
    await this.prisma.agentToolInvocation.create({
      data: {
        userId: input.userId,
        agentId: ((input.agentId as string) ?? 'orchestrator') as AgentId,
        toolName,
        inputHash,
        outputHash: outputHash ?? '',
        status,
        latencyMs,
        freshnessMs: 0,
        inputTokens: 0,
        outputTokens,
      },
    });
  }

  /** Visible for testing */
  clearCache(): void {
    this.cache.clear();
  }
}
