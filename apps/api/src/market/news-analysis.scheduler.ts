import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { MarketService } from './market.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrchestratorService } from '../orchestrator/orchestrator.service';

const TICK_MS = 60 * 1000; // check every 1 minute

/**
 * Runs keyword-based news analysis for each user on their configured interval.
 * Uses a 1-minute tick to respect per-user intervalMinutes settings.
 */
@Injectable()
export class NewsAnalysisScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NewsAnalysisScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly marketService: MarketService,
    private readonly prisma: PrismaService,
    private readonly orchestratorService: OrchestratorService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.logger.log('News analysis scheduler started (1-min tick)');
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick() {
    try {
      const configs = await this.prisma.newsConfig.findMany();
      const now = Date.now();

      for (const cfg of configs) {
        const intervalMs = (cfg.intervalMinutes ?? 30) * 60 * 1000;
        const latest = await this.prisma.newsAnalysis.findFirst({
          where: { userId: cfg.userId },
          orderBy: { analyzedAt: 'desc' },
          select: { analyzedAt: true },
        });

        const lastRun = latest?.analyzedAt?.getTime() ?? 0;
        const due = now - lastRun >= intervalMs;

        if (due) {
          try {
            const analysis = await this.marketService.runKeywordAnalysis(
              cfg.userId,
            );
            this.logger.debug(`Keyword analysis run for user ${cfg.userId}`);

            // Enrich high-relevance news via OrchestratorService (Spec 28 Phase A)
            await this.enrichHighScoreNews(cfg.userId, analysis.id);
          } catch (err) {
            this.logger.warn(
              `Keyword analysis failed for user ${cfg.userId}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }
    } catch (err) {
      this.logger.error(
        `Scheduler tick error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Runs orchestrated news enrichment (SIGMA + CIPHER in parallel) for all
   * headlines in the given analysis that have score > 0.5 (positive sentiment).
   * Results are persisted back to the NewsAnalysis record.
   */
  private async enrichHighScoreNews(
    userId: string,
    analysisId: string,
  ): Promise<void> {
    const analysis = await this.prisma.newsAnalysis.findUnique({
      where: { id: analysisId },
      select: { score: true, headlines: true },
    });
    if (!analysis) return;

    // Only enrich when overall score > 50 (newsCount-scaled score)
    if (analysis.score <= 50) return;

    const headlines = analysis.headlines as Array<{
      id: string;
      headline: string;
      summary?: string | null;
    }>;
    if (!headlines?.length) return;

    // Enrich only the top 3 headlines to limit LLM cost
    const topHeadlines = headlines.slice(0, 3);

    try {
      const enrichments = await Promise.allSettled(
        topHeadlines.map((h) =>
          this.orchestratorService.enrichNews(
            { id: h.id, headline: h.headline, summary: h.summary },
            userId,
          ),
        ),
      );

      const avgRelevance =
        enrichments
          .filter((r) => r.status === 'fulfilled')
          .reduce(
            (sum, r) =>
              sum + (r.status === 'fulfilled' ? r.value.technicalRelevance : 0),
            0,
          ) / Math.max(enrichments.filter((r) => r.status === 'fulfilled').length, 1);

      const allTags = enrichments
        .filter((r) => r.status === 'fulfilled')
        .flatMap((r) =>
          r.status === 'fulfilled' ? r.value.orchestratedTags : [],
        );

      const ecosystemSummary = enrichments
        .filter((r) => r.status === 'fulfilled' && r.value.ecosystemImpact !== 'none')
        .map((r) => (r.status === 'fulfilled' ? r.value.ecosystemImpact : ''))
        .join(' | ');

      await this.prisma.newsAnalysis.update({
        where: { id: analysisId },
        data: {
          technicalRelevance: avgRelevance,
          ecosystemImpact: ecosystemSummary || null,
          orchestratedTags: allTags as any,
        },
      });

      this.logger.debug(
        `News enriched for user=${userId} analysis=${analysisId} relevance=${avgRelevance.toFixed(2)}`,
      );
    } catch (err) {
      this.logger.warn(
        `News enrichment failed for user=${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
