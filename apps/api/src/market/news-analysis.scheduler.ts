import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { MarketService } from './market.service';
import { PrismaService } from '../prisma/prisma.service';

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
            await this.marketService.runKeywordAnalysis(cfg.userId);
            this.logger.debug(`Keyword analysis run for user ${cfg.userId}`);
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
}
