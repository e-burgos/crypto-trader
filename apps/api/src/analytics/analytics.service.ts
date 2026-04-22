import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TradingMode } from '../../generated/prisma/enums';

function modeFilter(mode?: TradingMode) {
  if (!mode) return {};
  return { mode };
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPortfolioSummary(userId: string, mode?: TradingMode) {
    const mf = modeFilter(mode);
    const [openPositions, closedPositions, tradingConfigs] = await Promise.all([
      this.prisma.position.findMany({
        where: { userId, status: 'OPEN', ...mf },
        select: {
          asset: true,
          pair: true,
          entryPrice: true,
          quantity: true,
          mode: true,
        },
      }),
      this.prisma.position.findMany({
        where: { userId, status: 'CLOSED', ...mf },
        select: { pnl: true, fees: true, mode: true },
      }),
      this.prisma.tradingConfig.findMany({
        where: { userId, ...mf },
        select: { asset: true, pair: true, mode: true, isRunning: true },
      }),
    ]);

    const realizedPnl = closedPositions.reduce(
      (acc, p) => acc + (p.pnl ?? 0),
      0,
    );

    const totalFees = closedPositions.reduce(
      (acc, p) => acc + (p.fees ?? 0),
      0,
    );

    return {
      openPositions: openPositions.length,
      closedPositions: closedPositions.length,
      realizedPnl,
      totalFees,
      netPnl: realizedPnl - totalFees,
      activeConfigs: tradingConfigs.filter((c) => c.isRunning).length,
    };
  }

  async getTradeHistory(userId: string, limit = 50, mode?: TradingMode) {
    return this.prisma.trade.findMany({
      where: { userId, ...modeFilter(mode) },
      orderBy: { executedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        price: true,
        quantity: true,
        fee: true,
        executedAt: true,
        mode: true,
        position: {
          select: {
            asset: true,
            pair: true,
            entryPrice: true,
            exitPrice: true,
            pnl: true,
            fees: true,
            status: true,
            entryAt: true,
            exitAt: true,
            config: {
              select: {
                stopLossPct: true,
                takeProfitPct: true,
                maxTradePct: true,
                buyThreshold: true,
                sellThreshold: true,
                minIntervalMinutes: true,
                orderPriceOffsetPct: true,
              },
            },
          },
        },
      },
    });
  }

  async getAgentDecisionHistory(
    userId: string,
    limit = 20,
    mode?: TradingMode,
  ) {
    const mf = modeFilter(mode);
    const [decisions, activeLlm] = await Promise.all([
      this.prisma.agentDecision.findMany({
        where: { userId, ...mf },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          asset: true,
          pair: true,
          decision: true,
          confidence: true,
          reasoning: true,
          waitMinutes: true,
          configId: true,
          configName: true,
          mode: true,
          createdAt: true,
          indicators: true,
          newsHeadlines: true,
          metadata: true,
        },
      }),
      this.prisma.lLMCredential.findFirst({
        where: { userId, isActive: true },
        select: { provider: true, selectedModel: true },
      }),
    ]);

    // Fetch full TradingConfig for all unique configIds
    const configIds = [
      ...new Set(
        decisions.filter((d) => d.configId).map((d) => d.configId as string),
      ),
    ];

    const configs = configIds.length
      ? await this.prisma.tradingConfig.findMany({
          where: { id: { in: configIds } },
          select: {
            id: true,
            name: true,
            mode: true,
            asset: true,
            pair: true,
            buyThreshold: true,
            sellThreshold: true,
            stopLossPct: true,
            takeProfitPct: true,
            minProfitPct: true,
            maxTradePct: true,
            maxConcurrentPositions: true,
            minIntervalMinutes: true,
            intervalMode: true,
            orderPriceOffsetPct: true,
            isRunning: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      : [];

    const configMap = new Map(configs.map((c) => [c.id, c]));

    return decisions.map((d) => {
      const cfg = d.configId ? configMap.get(d.configId) : undefined;

      // Extract SIGMA news_sentiment from orchestration metadata
      let sigmaSentiment: {
        sentiment: number;
        impact: string;
        reasoning: string;
        cached?: boolean;
      } | null = null;
      if (d.metadata) {
        const meta = d.metadata as {
          subAgentResults?: Array<{
            task: string;
            output: string;
            cached?: boolean;
          }>;
        };
        const sigmaResult = meta.subAgentResults?.find(
          (r) => r.task === 'news_sentiment',
        );
        if (sigmaResult?.output && sigmaResult.output !== '{}') {
          try {
            const cleaned = sigmaResult.output
              .replace(/```(?:json)?\s*/gi, '')
              .trim();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let parsed: any;
            try {
              parsed = JSON.parse(cleaned);
            } catch {
              const match = cleaned.match(/\{[\s\S]*\}/);
              parsed = match ? JSON.parse(match[0]) : null;
            }
            if (parsed) {
              sigmaSentiment = {
                ...parsed,
                cached: sigmaResult.cached ?? false,
              };
            }
          } catch {
            /* ignore parse errors */
          }
        }
      }

      return {
        ...d,
        metadata: undefined, // don't leak raw metadata to frontend
        sigmaSentiment,
        mode: d.mode ?? cfg?.mode ?? null,
        configName: d.configName ?? cfg?.name ?? null,
        configDetails: cfg
          ? {
              buyThreshold: cfg.buyThreshold,
              sellThreshold: cfg.sellThreshold,
              stopLossPct: cfg.stopLossPct,
              takeProfitPct: cfg.takeProfitPct,
              minProfitPct: cfg.minProfitPct,
              maxTradePct: cfg.maxTradePct,
              maxConcurrentPositions: cfg.maxConcurrentPositions,
              minIntervalMinutes: cfg.minIntervalMinutes,
              intervalMode: cfg.intervalMode,
              orderPriceOffsetPct: cfg.orderPriceOffsetPct,
              isRunning: cfg.isRunning,
              createdAt: cfg.createdAt,
              updatedAt: cfg.updatedAt,
            }
          : null,
        llmProvider: activeLlm?.provider ?? null,
        llmModel: activeLlm?.selectedModel ?? null,
      };
    });
  }

  async getSummary(userId: string, mode?: TradingMode) {
    const closedPositions = await this.prisma.position.findMany({
      where: { userId, status: 'CLOSED', ...modeFilter(mode) },
      select: {
        pnl: true,
        asset: true,
        pair: true,
        exitAt: true,
        entryAt: true,
      },
    });

    const totalTrades = closedPositions.length;
    if (totalTrades === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        avgPnl: 0,
        totalPnl: 0,
        bestTrade: null,
        worstTrade: null,
        currentDrawdown: 0,
        sharpeRatio: 0,
      };
    }

    const pnls = closedPositions.map((p) => p.pnl ?? 0);
    const wins = pnls.filter((p) => p > 0).length;
    const totalPnl = pnls.reduce((a, b) => a + b, 0);
    const avgPnl = totalPnl / totalTrades;
    const winRate = (wins / totalTrades) * 100;

    const positionsWithPnl = closedPositions.filter((p) => p.pnl != null);
    const bestTradePos =
      positionsWithPnl.length > 0
        ? positionsWithPnl.reduce((a, b) =>
            (a.pnl ?? 0) > (b.pnl ?? 0) ? a : b,
          )
        : null;
    const worstTradePos =
      positionsWithPnl.length > 1
        ? positionsWithPnl.reduce((a, b) =>
            (a.pnl ?? 0) < (b.pnl ?? 0) ? a : b,
          )
        : null;

    // Drawdown: peak–trough of cumulative P&L
    let peak = 0;
    let cumulative = 0;
    let maxDrawdown = 0;
    for (const pnl of pnls) {
      cumulative += pnl;
      if (cumulative > peak) peak = cumulative;
      const dd = peak > 0 ? (peak - cumulative) / peak : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // Sharpe ratio: group by day, compute daily returns
    const dailyMap = new Map<string, number>();
    for (const pos of closedPositions) {
      const day = (pos.exitAt ?? pos.entryAt).toISOString().slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + (pos.pnl ?? 0));
    }
    const dailyReturns = Array.from(dailyMap.values());
    let sharpeRatio = 0;
    if (dailyReturns.length > 1) {
      const mean =
        dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
      const variance =
        dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
        dailyReturns.length;
      const stdDev = Math.sqrt(variance);
      sharpeRatio = stdDev > 0 ? (mean / stdDev) * Math.sqrt(365) : 0;
    }

    return {
      totalTrades,
      winRate: Math.round(winRate * 100) / 100,
      avgPnl: Math.round(avgPnl * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      bestTrade: bestTradePos
        ? {
            pnl: bestTradePos.pnl,
            asset: bestTradePos.asset,
            pair: bestTradePos.pair,
            executedAt: bestTradePos.exitAt,
          }
        : null,
      worstTrade: worstTradePos
        ? {
            pnl: worstTradePos.pnl,
            asset: worstTradePos.asset,
            pair: worstTradePos.pair,
            executedAt: worstTradePos.exitAt,
          }
        : null,
      currentDrawdown: Math.round(maxDrawdown * 10000) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    };
  }

  async getPnlChart(userId: string, mode?: TradingMode) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const positions = await this.prisma.position.findMany({
      where: {
        userId,
        status: 'CLOSED',
        exitAt: { gte: thirtyDaysAgo },
        ...modeFilter(mode),
      },
      select: { pnl: true, exitAt: true },
      orderBy: { exitAt: 'asc' },
    });

    const dailyMap = new Map<string, number>();
    for (const pos of positions) {
      const day = (pos.exitAt ?? new Date()).toISOString().slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + (pos.pnl ?? 0));
    }

    return Array.from(dailyMap.entries()).map(([date, pnl]) => ({
      date,
      pnl: Math.round(pnl * 100) / 100,
    }));
  }

  async getAssetBreakdown(userId: string, mode?: TradingMode) {
    const positions = await this.prisma.position.findMany({
      where: { userId, status: 'CLOSED', ...modeFilter(mode) },
      select: { asset: true, pnl: true },
    });

    const assetMap = new Map<
      string,
      { totalPnl: number; trades: number; wins: number }
    >();
    for (const pos of positions) {
      const key = pos.asset;
      const current = assetMap.get(key) ?? { totalPnl: 0, trades: 0, wins: 0 };
      current.totalPnl += pos.pnl ?? 0;
      current.trades += 1;
      if ((pos.pnl ?? 0) > 0) current.wins += 1;
      assetMap.set(key, current);
    }

    return Array.from(assetMap.entries()).map(([asset, data]) => ({
      asset,
      totalPnl: Math.round(data.totalPnl * 100) / 100,
      trades: data.trades,
      winRate:
        data.trades > 0
          ? Math.round((data.wins / data.trades) * 10000) / 100
          : 0,
    }));
  }
}
