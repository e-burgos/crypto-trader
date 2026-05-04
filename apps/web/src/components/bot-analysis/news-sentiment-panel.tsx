import {
  Newspaper,
  Bot,
  Sparkles,
  Database,
  Settings,
  CircleDot,
  ChevronRight,
  Brain,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { AgentVerdictCard } from '@crypto-trader/ui';
import {
  useNewsConfig,
  useNewsAnalysis,
  type NewsItem,
} from '../../hooks/use-market';
import { SENTIMENT_COLOR } from './constants';

import type { EnrichedMarketSnapshot } from '@crypto-trader/shared';

export interface SigmaSentiment {
  sentiment: number;
  impact: string;
  reasoning: string;
  cached?: boolean;
}

export function NewsSentimentPanel({
  news,
  sigmaSentiment,
  enrichedSnapshot,
}: {
  news: NewsItem[];
  sigmaSentiment?: SigmaSentiment | null;
  enrichedSnapshot?: EnrichedMarketSnapshot;
}) {
  const { t } = useTranslation();
  const { data: config } = useNewsConfig();
  const { data: analysis } = useNewsAnalysis();

  const hasAi = !!analysis?.aiAnalyzedAt;

  // Derive SIGMA from AI analysis when available; fall back to agent decision sigma
  const effectiveSigma: SigmaSentiment | null = hasAi
    ? {
        sentiment: analysis?.aiScore ?? 0,
        impact:
          analysis?.aiOverallSentiment === 'POSITIVE' ||
          analysis?.aiOverallSentiment === 'BULLISH'
            ? 'positive'
            : analysis?.aiOverallSentiment === 'NEGATIVE' ||
                analysis?.aiOverallSentiment === 'BEARISH'
              ? 'negative'
              : 'neutral',
        reasoning: analysis?.aiSummary ?? '',
      }
    : (sigmaSentiment ?? null);

  const positive = hasAi
    ? (analysis?.aiPositiveCount ?? 0)
    : (analysis?.positiveCount ?? 0);
  const negative = hasAi
    ? (analysis?.aiNegativeCount ?? 0)
    : (analysis?.negativeCount ?? 0);
  const neutral = hasAi
    ? (analysis?.aiNeutralCount ?? 0)
    : (analysis?.neutralCount ?? 0);
  const score = hasAi ? (analysis?.aiScore ?? 0) : (analysis?.score ?? 0);
  const overall = hasAi
    ? (analysis?.aiOverallSentiment ?? 'NEUTRAL')
    : (analysis?.overallSentiment ?? 'NEUTRAL');

  const aiMap = new Map((analysis?.aiHeadlines ?? []).map((a) => [a.id, a]));

  const displayNews: NewsItem[] = analysis?.headlines?.length
    ? analysis.headlines.map((h) => ({
        id: h.id,
        source: h.source ?? '',
        headline: h.headline,
        url: '',
        summary: h.summary ?? undefined,
        author: h.author ?? undefined,
        sentiment: (hasAi
          ? (aiMap.get(h.id)?.sentiment ?? h.sentiment)
          : h.sentiment) as NewsItem['sentiment'],
        publishedAt: h.publishedAt,
      }))
    : news;

  const total = positive + negative + neutral;

  const sentimentScore =
    total > 0 ? Math.round(((positive - negative) / total) * 100) : 0;
  const overallLabel =
    sentimentScore > 15
      ? t('botAnalysis.sentimentBull')
      : sentimentScore < -15
        ? t('botAnalysis.sentimentBear')
        : t('botAnalysis.sentimentNeutral');
  const sentimentColor =
    sentimentScore > 15
      ? 'text-emerald-400'
      : sentimentScore < -15
        ? 'text-red-400'
        : 'text-amber-400';

  const overallColor =
    overall === 'POSITIVE'
      ? 'text-emerald-400'
      : overall === 'NEGATIVE'
        ? 'text-red-400'
        : 'text-amber-400';

  const overallBg =
    overall === 'POSITIVE'
      ? 'bg-emerald-500/10 border-emerald-500/25'
      : overall === 'NEGATIVE'
        ? 'bg-red-500/10 border-red-500/25'
        : 'bg-amber-500/10 border-amber-500/25';

  const botEnabled = config?.botEnabled ?? false;
  const newsWeight = config?.newsWeight ?? 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center flex-col sm:flex-row gap-2 px-4 py-3 border-b border-border bg-muted/20 shrink-0">
        <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('botAnalysis.newsSentimentTitle')}
        </span>
        <div className="sm:ml-auto flex items-center gap-2">
          {effectiveSigma ? (
            <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border bg-violet-500/10 text-violet-400 border-violet-500/20">
              <Brain className="h-2.5 w-2.5" /> SIGMA
            </span>
          ) : analysis ? (
            <span
              className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border',
                hasAi
                  ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                  : 'bg-sky-500/10 text-sky-400 border-sky-500/20',
              )}
            >
              {hasAi ? (
                <>
                  <Sparkles className="h-2.5 w-2.5" />{' '}
                  {t('botAnalysis.badgeAi')}
                </>
              ) : (
                <>
                  <Database className="h-2.5 w-2.5" /> Keyword
                </>
              )}
            </span>
          ) : null}
          {total > 0 && (
            <span
              className={cn(
                'flex items-center gap-1 rounded-full px-3 py-0.5 text-[11px] font-bold border',
                overallColor,
                overallBg,
              )}
            >
              {overallLabel}
            </span>
          )}
          <Link
            to="/dashboard/settings/news"
            className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/60 transition-colors"
            title={t('botAnalysis.configureNews')}
          >
            <Settings className="h-3 w-3" />
            {t('botAnalysis.configureNews')}
          </Link>
        </div>
      </div>

      {/* Bot config status banner */}
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-2 border-b border-border/60 text-[11px]',
          config
            ? botEnabled
              ? 'bg-emerald-500/[0.06]'
              : 'bg-amber-500/[0.06]'
            : 'bg-muted/20',
        )}
      >
        <Bot
          className={cn(
            'h-3 w-3 shrink-0',
            config
              ? botEnabled
                ? 'text-emerald-400'
                : 'text-amber-500/70'
              : 'text-muted-foreground/30',
          )}
        />
        {config ? (
          botEnabled ? (
            <>
              <span className="text-emerald-400 font-semibold">
                {t('botAnalysis.newsUsedByBot')}
              </span>
              {hasAi && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
                  <Sparkles className="h-2.5 w-2.5" />
                  {t('botAnalysis.aiAnalysisActive', {
                    defaultValue: 'IA',
                  })}
                </span>
              )}
              <span className="ml-auto flex items-center gap-1 text-muted-foreground/70">
                <span className="font-mono font-bold text-emerald-400/80">
                  {newsWeight}%
                </span>
                <span>{t('botAnalysis.newsWeightLabel')}</span>
              </span>
            </>
          ) : (
            <>
              <span className="text-amber-500/80 font-medium">
                {t('botAnalysis.newsNotUsedByBot')}
              </span>
              <Link
                to="/dashboard/settings/news"
                className="ml-auto text-[10px] text-primary hover:underline font-semibold"
              >
                {t('botAnalysis.configureNews')}
              </Link>
            </>
          )
        ) : (
          <span className="text-muted-foreground/40 italic">
            {t('botAnalysis.loadingConfig')}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-hidden flex flex-col">
        {total > 0 && (
          <div className="shrink-0">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
              <span className="text-emerald-400 font-semibold">
                {t('botAnalysis.positiveNews', { count: positive })}
              </span>
              <span className="text-amber-400">
                {t('botAnalysis.neutralNews', { count: neutral })}
              </span>
              <span className="text-red-400 font-semibold">
                {t('botAnalysis.negativeNews', { count: negative })}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${total ? (positive / total) * 100 : 0}%` }}
              />
              <div
                className="h-full bg-amber-500/60 transition-all"
                style={{ width: `${total ? (neutral / total) * 100 : 0}%` }}
              />
              <div
                className="h-full bg-red-500 transition-all"
                style={{ width: `${total ? (negative / total) * 100 : 0}%` }}
              />
            </div>
            <div className="mt-1 text-right">
              <span className={cn('text-[11px] font-bold', sentimentColor)}>
                {t('botAnalysis.scoreLabel')}: {score > 0 ? '+' : ''}
                {typeof score === 'number' ? score.toFixed(2) : score}
              </span>
            </div>
          </div>
        )}

        {/* Enriched sentiment sources (Fear & Greed + Predictions) */}
        {(enrichedSnapshot?.fearGreed ||
          (enrichedSnapshot?.predictions &&
            enrichedSnapshot.predictions.length > 0)) && (
          <div className="shrink-0 flex flex-wrap gap-2">
            {enrichedSnapshot?.fearGreed && (
              <div
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px]',
                  enrichedSnapshot.fearGreed.value <= 25
                    ? 'border-red-500/20 bg-red-500/[0.06]'
                    : enrichedSnapshot.fearGreed.value >= 75
                      ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
                      : 'border-amber-500/20 bg-amber-500/[0.06]',
                )}
              >
                <span className="text-muted-foreground font-medium">
                  {t('botAnalysis.inputSourcesFearGreed')}:
                </span>
                <span
                  className={cn(
                    'font-bold',
                    enrichedSnapshot.fearGreed.value <= 25
                      ? 'text-red-400'
                      : enrichedSnapshot.fearGreed.value >= 75
                        ? 'text-emerald-400'
                        : 'text-amber-400',
                  )}
                >
                  {enrichedSnapshot.fearGreed.value}/100 —{' '}
                  {enrichedSnapshot.fearGreed.classification}
                </span>
              </div>
            )}
            {enrichedSnapshot?.predictions &&
              enrichedSnapshot.predictions.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/[0.06] px-3 py-2 text-[11px]">
                  <span className="text-muted-foreground font-medium">
                    {t('botAnalysis.inputSourcesPredictions')}:
                  </span>
                  <span className="font-bold text-indigo-400">
                    {enrichedSnapshot.predictions.length}{' '}
                    {t('botAnalysis.predictionMarkets')}
                  </span>
                </div>
              )}
          </div>
        )}

        {/* SIGMA AI Conclusion */}
        {effectiveSigma && (
          <AgentVerdictCard
            verdict={{
              agentId: 'sigma-sentiment',
              task: 'news_sentiment',
              summary: effectiveSigma.reasoning,
              cached: effectiveSigma.cached,
            }}
            agentMeta={{
              label: t('botAnalysis.sigmaTitle'),
              subtitle: effectiveSigma.impact === 'positive'
                ? t('botAnalysis.sigmaImpactPositive')
                : effectiveSigma.impact === 'negative'
                  ? t('botAnalysis.sigmaImpactNegative')
                  : t('botAnalysis.sigmaImpactNeutral'),
              icon: <Brain className="h-3 w-3" />,
              color: effectiveSigma.impact === 'positive'
                ? 'text-emerald-400'
                : effectiveSigma.impact === 'negative'
                  ? 'text-red-400'
                  : 'text-amber-400',
              bgColor: effectiveSigma.impact === 'positive'
                ? 'bg-emerald-500/10'
                : effectiveSigma.impact === 'negative'
                  ? 'bg-red-500/10'
                  : 'bg-amber-500/10',
            }}
            taskLabel={`Score: ${effectiveSigma.sentiment > 0 ? '+' : ''}${typeof effectiveSigma.sentiment === 'number' ? effectiveSigma.sentiment.toFixed(2) : effectiveSigma.sentiment}`}
            formattedSummary={effectiveSigma.reasoning}
            showCachedBadge={!!effectiveSigma.cached}
            cachedLabel={t('botAnalysis.sigmaCached')}
            showMoreLabel={t('common.more', 'Más')}
            showLessLabel={t('common.less', 'Menos')}
            className={cn(
              'shrink-0 !h-auto',
              effectiveSigma.impact === 'positive'
                ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
                : effectiveSigma.impact === 'negative'
                  ? 'border-red-500/20 bg-red-500/[0.06]'
                  : 'border-amber-500/20 bg-amber-500/[0.06]',
            )}
          />
        )}

        <div
          className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0"
          style={{ maxHeight: '320px' }}
        >
          {displayNews.map((item) => (
            <a
              key={item.id}
              href={item.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-muted/40 transition-colors group"
            >
              <CircleDot
                className={cn(
                  'h-3 w-3 mt-0.5 shrink-0',
                  SENTIMENT_COLOR[item.sentiment],
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground/85 line-clamp-2 group-hover:text-foreground transition-colors leading-snug">
                  {item.headline}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground/60">
                    {item.source}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-semibold',
                      SENTIMENT_COLOR[item.sentiment],
                    )}
                  >
                    {item.sentiment === 'POSITIVE'
                      ? '↑'
                      : item.sentiment === 'NEGATIVE'
                        ? '↓'
                        : '→'}{' '}
                    {item.sentiment}
                  </span>
                  {hasAi &&
                    aiMap.has(item.id) &&
                    aiMap.get(item.id)?.sentiment !==
                      analysis?.headlines?.find((h) => h.id === item.id)
                        ?.sentiment && (
                      <span className="text-[9px] text-violet-400 font-semibold">
                        IA
                      </span>
                    )}
                </div>
              </div>
              {item.url && (
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors mt-0.5" />
              )}
            </a>
          ))}
        </div>

        {displayNews.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Newspaper className="h-6 w-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">
              {t('botAnalysis.loadingNews')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
