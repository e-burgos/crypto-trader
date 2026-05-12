import { Injectable, Logger } from '@nestjs/common';
import { AgentToolName } from '../../../generated/prisma/enums';
import { MarketService } from '../../market/market.service';
import { AgentTool, AgentToolInput, AgentToolOutput } from './agent-tool.interface';

@Injectable()
export class MarketEdgeTool implements AgentTool {
  readonly name = AgentToolName.MARKET_EDGE;
  private readonly logger = new Logger(MarketEdgeTool.name);

  constructor(private readonly marketService: MarketService) {}

  async execute(input: AgentToolInput): Promise<AgentToolOutput> {
    const symbol = input.pair ?? input.asset ?? 'BTC';

    try {
      const snapshot = await this.marketService.buildEnrichedSnapshot(
        input.userId,
        symbol,
      );

      const data: Record<string, unknown> = {
        symbol: snapshot.symbol,
        currentPrice: snapshot.currentPrice,
        change24h: snapshot.change24h,
        fearGreed: snapshot.fearGreed,
        technicalSignals: snapshot.technicalSignals,
        activeSources: snapshot.activeSources,
        failedSources: snapshot.failedSources,
        snapshotBuildTimeMs: snapshot.snapshotBuildTimeMs,
      };

      const tokenEstimate = Math.ceil(JSON.stringify(data).length / 4);

      return {
        data,
        tokenEstimate,
        freshnessMs: snapshot.snapshotBuildTimeMs ?? 0,
      };
    } catch (err) {
      this.logger.warn(
        `MarketEdgeTool failed for ${symbol}: ${(err as Error).message}`,
      );

      const data: Record<string, unknown> = {
        symbol,
        status: 'unavailable',
        error: (err as Error).message,
      };

      return { data, tokenEstimate: 20, freshnessMs: 0 };
    }
  }
}
