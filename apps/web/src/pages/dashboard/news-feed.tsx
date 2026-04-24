import { useRef, useState } from 'react';
import { Newspaper, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTranslation } from 'react-i18next';
import {
  useMarketNews,
  useNewsAnalysis,
  useNewsConfig,
  useRunKeywordAnalysis,
  useRunAiAnalysis,
  type NewsItem,
} from '../../hooks/use-market';
import { useAgentDecisions } from '../../hooks/use-analytics';
import { usePlatformMode } from '../../hooks/use-user';
import { toast } from 'sonner';
import {
  AnalysisSummaryCard,
  NewsDetailModal,
  NewsCard,
  type SentimentFilter,
} from '../../components/news-feed';
import type { SigmaSentiment } from '../../components/bot-analysis';

gsap.registerPlugin(useGSAP);

export function NewsFeedPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<SentimentFilter>('ALL');
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  const { data: config } = useNewsConfig();
  const { data: analysis } = useNewsAnalysis();
  const { data: news = [], isLoading } = useMarketNews(config?.newsCount ?? 15);
  const runKeyword = useRunKeywordAnalysis();
  const runAi = useRunAiAnalysis();

  // SIGMA sentiment from recent agent decisions
  const { mode: platformMode } = usePlatformMode();
  const { data: decisions = [] } = useAgentDecisions(10);
  const latestSigma: SigmaSentiment | null = (() => {
    const modeFiltered = decisions.filter((d) => {
      if (platformMode === 'SANDBOX') return d.mode === 'SANDBOX';
      return d.mode === platformMode;
    });
    for (const d of modeFiltered) {
      if (d.sigmaSentiment) return d.sigmaSentiment;
    }
    return null;
  })();

  // Timestamp of the decision that carried the SIGMA sentiment
  const sigmaTimestamp: string | null = (() => {
    const modeFiltered = decisions.filter((d) => {
      if (platformMode === 'SANDBOX') return d.mode === 'SANDBOX';
      return d.mode === platformMode;
    });
    for (const d of modeFiltered) {
      if (d.sigmaSentiment) return d.createdAt;
    }
    return null;
  })();

  // Build AI overlay map from persisted analysis
  const hasValidAi = !!analysis?.aiAnalyzedAt;
  const aiMap = new Map((analysis?.aiHeadlines ?? []).map((a) => [a.id, a]));

  const effectiveNews = news.map((n) => ({
    ...n,
    sentiment:
      ((hasValidAi ? aiMap.get(n.id)?.sentiment : undefined) as
        | 'POSITIVE'
        | 'NEGATIVE'
        | 'NEUTRAL'
        | undefined) ?? n.sentiment,
  }));

  const filtered =
    filter === 'ALL'
      ? effectiveNews
      : effectiveNews.filter((n) => n.sentiment === filter);

  const handleRunKeyword = () => {
    runKeyword.mutate(undefined, {
      onSuccess: () => toast.success(t('news.keywordAnalysisComplete')),
      onError: () => toast.error(t('news.keywordAnalysisError')),
    });
  };

  const handleRunAi = () => {
    runAi.mutate(undefined, {
      onSuccess: () => toast.success(t('news.aiAnalysisComplete')),
      onError: (err: unknown) => {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err !== null && 'message' in err
              ? String((err as { message: unknown }).message)
              : String(err);
        toast.error(`${t('news.aiAnalysisError')}: ${msg}`);
      },
    });
  };

  useGSAP(
    () => {
      if (isLoading) return;
      gsap.fromTo(
        '.news-card',
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, stagger: 0.05, duration: 0.4, ease: 'power2.out' },
      );
    },
    { scope: containerRef, dependencies: [isLoading, filter, analysis?.id] },
  );

  return (
    <div ref={containerRef} className="p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center gap-4 justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">{t('sidebar.news')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t('news.subtitle')}</p>
        </div>
      </div>

      {/* Analysis Summary + SIGMA */}
      <AnalysisSummaryCard
        analysis={analysis}
        newsConfig={config}
        onRunKeyword={handleRunKeyword}
        isRunningKeyword={runKeyword.isPending}
        onRunAi={handleRunAi}
        isRunningAi={runAi.isPending}
        sigmaSentiment={latestSigma}
        sigmaTimestamp={sigmaTimestamp}
      />

      {/* Filters — between summary card and news grid */}
      <div className="mb-6 flex gap-1 rounded-xl border border-border bg-muted/30 p-1 w-full">
        {(['ALL', 'POSITIVE', 'NEGATIVE', 'NEUTRAL'] as SentimentFilter[]).map(
          (s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'rounded-lg px-4 py-1.5 text-sm font-medium w-full transition-colors',
                filter === s
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s === 'ALL'
                ? t('news.all')
                : s === 'POSITIVE'
                  ? t('news.positive')
                  : s === 'NEGATIVE'
                    ? t('news.negative')
                    : t('news.neutral')}
            </button>
          ),
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {t('common.empty')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            {t('news.apiKeyRequired')}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <NewsCard
              key={item.id}
              item={item}
              aiResult={hasValidAi ? aiMap.get(item.id) : undefined}
              onOpen={() => setSelectedNews(item)}
            />
          ))}
        </div>
      )}

      {selectedNews && (
        <NewsDetailModal
          item={selectedNews}
          aiResult={hasValidAi ? aiMap.get(selectedNews.id) : undefined}
          onClose={() => setSelectedNews(null)}
        />
      )}
    </div>
  );
}
