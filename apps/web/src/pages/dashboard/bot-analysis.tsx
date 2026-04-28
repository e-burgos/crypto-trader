import { useState, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTranslation } from 'react-i18next';
import { Brain, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Tabs } from '@crypto-trader/ui';
import {
  useMarketSnapshot,
  deriveOverallSignal,
  useMarketNews,
  useNewsConfig,
  useNewsAnalysis,
  MARKET_SYMBOLS,
  type OverallSignal,
} from '../../hooks/use-market';
import { useAgentDecisions } from '../../hooks/use-analytics';
import { useTradingConfigs, useAgentStatus } from '../../hooks/use-trading';
import { useBinanceTicker } from '../../hooks/use-binance-ticker';
import { usePlatformMode } from '../../hooks/use-user';
import {
  TechnicalSummary,
  NewsSentimentPanel,
  AgentInputSummary,
  CombinedScoreBanner,
  NextDecisionBanner,
  type NewsAnalysisData,
  type SigmaSentiment,
} from '../../components/bot-analysis';

gsap.registerPlugin(useGSAP);

export function BotAnalysisPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [symbol, setSymbol] = useState<string>('BTCUSDT');

  const {
    data: snapshot,
    isLoading,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useMarketSnapshot(symbol);
  const { ticker } = useBinanceTicker(symbol);
  const { data: newsItems = [] } = useMarketNews(30);
  const { data: decisions = [] } = useAgentDecisions(15);
  const { data: tradingConfigs = [] } = useTradingConfigs();
  const { data: agentStatuses = [] } = useAgentStatus();
  const { mode: platformMode } = usePlatformMode();

  // Filter to current platform mode
  const modeDecisions = decisions.filter((d) => {
    if (platformMode === 'SANDBOX') return d.mode === 'SANDBOX';
    return d.mode === platformMode;
  });
  const modeConfigs = tradingConfigs.filter((c) => {
    if (platformMode === 'SANDBOX') return c.mode === 'SANDBOX';
    return c.mode === platformMode;
  });

  useGSAP(
    () => {
      const scope = containerRef.current;

      const statusCards = gsap.utils.toArray<Element>('.status-card', scope);
      if (statusCards.length) {
        gsap.fromTo(
          statusCards,
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.07,
            duration: 0.45,
            ease: 'power2.out',
          },
        );
      }

      const analysisSections = gsap.utils.toArray<Element>(
        '.analysis-section',
        scope,
      );
      if (analysisSections.length) {
        gsap.fromTo(
          analysisSections,
          { opacity: 0, y: 16 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.1,
            duration: 0.5,
            ease: 'power2.out',
            delay: 0.2,
          },
        );
      }
    },
    { scope: containerRef, dependencies: [snapshot] },
  );

  const livePrice = ticker?.lastPrice ?? snapshot?.currentPrice ?? 0;
  const techResult = snapshot ? deriveOverallSignal(snapshot) : null;
  const techSignal: OverallSignal = techResult?.signal ?? 'NEUTRAL';
  const techScore = techResult?.score ?? 0;

  const { data: pageNewsConfig } = useNewsConfig();
  const { data: pageAnalysis } = useNewsAnalysis();
  const pageHasAi = !!pageAnalysis?.aiAnalyzedAt;
  const newsAnalysisData: NewsAnalysisData = {
    positive: pageHasAi
      ? (pageAnalysis?.aiPositiveCount ?? 0)
      : (pageAnalysis?.positiveCount ?? 0),
    negative: pageHasAi
      ? (pageAnalysis?.aiNegativeCount ?? 0)
      : (pageAnalysis?.negativeCount ?? 0),
    neutral: pageHasAi
      ? (pageAnalysis?.aiNeutralCount ?? 0)
      : (pageAnalysis?.neutralCount ?? 0),
    score: pageHasAi
      ? (pageAnalysis?.aiScore ?? 0)
      : (pageAnalysis?.score ?? 0),
    overall: pageHasAi
      ? (pageAnalysis?.aiOverallSentiment ?? 'NEUTRAL')
      : (pageAnalysis?.overallSentiment ?? 'NEUTRAL'),
  };

  const positive = newsItems.filter((n) => n.sentiment === 'POSITIVE').length;
  const negative = newsItems.filter((n) => n.sentiment === 'NEGATIVE').length;
  const total = newsItems.length;
  const sentimentScore =
    total > 0 ? Math.round(((positive - negative) / total) * 100) : 0;

  const lastDecision = modeDecisions[0] ?? null;

  // Extract latest SIGMA sentiment from any recent decision
  const latestSigma: SigmaSentiment | null = (() => {
    for (const d of modeDecisions) {
      if (d.sigmaSentiment) return d.sigmaSentiment;
    }
    return null;
  })();

  const updatedLabel = dataUpdatedAt
    ? t('botAnalysis.updatedAgo', {
        count: Math.round((Date.now() - dataUpdatedAt) / 60_000),
      })
    : '';

  return (
    <div ref={containerRef} className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          {t('botAnalysis.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('botAnalysis.subtitle')}
        </p>
      </div>

      {/* Symbol selector + refresh */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 sm:flex-none">
          <Tabs
            tabs={MARKET_SYMBOLS.map((m) => ({
              value: m.symbol,
              label: m.label,
            }))}
            value={symbol}
            onChange={setSymbol}
            border
          />
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-3 sm:py-3.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')}
          />
          {updatedLabel || t('botAnalysis.refresh')}
        </button>
      </div>

      {/* Content */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-10 text-center gap-3">
          <AlertCircle className="h-7 w-7 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {t('market.loadError')}
          </p>
        </div>
      )}
      {snapshot && !isLoading && (
        <>
          <CombinedScoreBanner
            techSignal={techSignal}
            techScore={techScore}
            sentimentScore={sentimentScore}
            lastDecision={lastDecision}
          />
          <NextDecisionBanner
            configs={modeConfigs}
            agentStatuses={agentStatuses}
            decisions={modeDecisions}
          />
          <div className="grid gap-4 lg:grid-cols-2 analysis-section">
            <TechnicalSummary snapshot={snapshot} livePrice={livePrice} />
            <NewsSentimentPanel news={newsItems} sigmaSentiment={latestSigma} />
          </div>
          <AgentInputSummary
            snapshot={snapshot}
            livePrice={livePrice}
            newsAnalysis={newsAnalysisData}
            hasAi={pageHasAi}
            hasSigma={!!latestSigma}
            botNewsEnabled={pageNewsConfig?.botEnabled ?? false}
            newsWeight={pageNewsConfig?.newsWeight ?? 0}
            agentStatuses={agentStatuses}
            recentDecisions={modeDecisions}
          />
        </>
      )}
    </div>
  );
}
