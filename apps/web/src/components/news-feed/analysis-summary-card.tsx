import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Sparkles,
  RefreshCw,
  XCircle,
  Hash,
  Settings,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { type NewsAnalysis } from '../../hooks/use-market';
import { timeAgo, SENTIMENT_CONFIG } from './news-utils';

export function AnalysisSummaryCard({
  analysis,
  newsConfig,
  onRunKeyword,
  isRunningKeyword,
  onRunAi,
  isRunningAi,
}: {
  analysis: NewsAnalysis | null | undefined;
  newsConfig: import('../../hooks/use-market').NewsConfig | undefined;
  onRunKeyword: () => void;
  isRunningKeyword: boolean;
  onRunAi: (provider: string, model: string) => void;
  isRunningAi: boolean;
}) {
  const { t } = useTranslation();
  const hasAiProvider = !!(
    newsConfig?.primaryProvider && newsConfig?.primaryModel
  );

  const hasAiAnalysis = !!analysis?.aiAnalyzedAt;
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'ai' | 'keyword'>(
    'ai',
  );
  const effectiveTab = hasAiAnalysis ? activeAnalysisTab : 'keyword';

  const kwPositive = analysis?.positiveCount ?? 0;
  const kwNegative = analysis?.negativeCount ?? 0;
  const kwNeutral = analysis?.neutralCount ?? 0;
  const kwScore = analysis?.score ?? 0;
  const kwOverall = analysis?.overallSentiment ?? 'NEUTRAL';
  const kwSummary = analysis?.summary;

  const aiPositive = analysis?.aiPositiveCount ?? 0;
  const aiNegative = analysis?.aiNegativeCount ?? 0;
  const aiNeutral = analysis?.aiNeutralCount ?? 0;
  const aiScore = analysis?.aiScore ?? 0;
  const aiOverall = analysis?.aiOverallSentiment ?? 'NEUTRAL';
  const aiSummary = analysis?.aiSummary;

  const positive = effectiveTab === 'ai' ? aiPositive : kwPositive;
  const negative = effectiveTab === 'ai' ? aiNegative : kwNegative;
  const neutral = effectiveTab === 'ai' ? aiNeutral : kwNeutral;
  const total = positive + negative + neutral;
  const score = effectiveTab === 'ai' ? aiScore : kwScore;
  const overall = effectiveTab === 'ai' ? aiOverall : kwOverall;
  const summary = effectiveTab === 'ai' ? aiSummary : kwSummary;

  const overallColor =
    overall === 'BULLISH'
      ? 'text-emerald-400'
      : overall === 'BEARISH'
        ? 'text-red-400'
        : 'text-amber-400';
  const overallBg =
    overall === 'BULLISH'
      ? 'bg-emerald-500/10 border-emerald-500/25'
      : overall === 'BEARISH'
        ? 'bg-red-500/10 border-red-500/25'
        : 'bg-amber-500/10 border-amber-500/25';

  const aiMap = new Map((analysis?.aiHeadlines ?? []).map((a) => [a.id, a]));
  const changed = (analysis?.headlines ?? []).filter((h) => {
    const ai = aiMap.get(h.id);
    return ai && ai.sentiment !== h.sentiment;
  });

  return (
    <div className="rounded-2xl border border-border bg-card mb-6">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/20">
        <Brain className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">
          {t('news.sentimentSummary')}
        </span>
        {hasAiAnalysis && effectiveTab === 'ai' && (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary">
            <Sparkles className="h-3 w-3" />
            {t('news.aiActive')}
          </span>
        )}
        <span
          className={cn(
            'ml-auto rounded-full border px-3 py-0.5 text-xs font-bold',
            overallColor,
            overallBg,
          )}
        >
          {overall === 'BULLISH'
            ? t('news.bullish')
            : overall === 'BEARISH'
              ? t('news.bearish')
              : t('news.neutral')}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {analysis ? (
          <>
            {hasAiAnalysis && (
              <div className="flex gap-1 rounded-lg border border-border bg-muted/20 p-0.5 w-fit">
                <button
                  onClick={() => setActiveAnalysisTab('ai')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                    effectiveTab === 'ai'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Sparkles className="h-3 w-3 text-primary shrink-0" />
                  {t('news.lastAiAnalysis')}
                  <span className="text-[10px] text-muted-foreground/70 ml-1">
                    {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */}
                    {timeAgo(analysis.aiAnalyzedAt!)}
                  </span>
                </button>
                <button
                  onClick={() => setActiveAnalysisTab('keyword')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                    effectiveTab === 'keyword'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Hash className="h-3 w-3 shrink-0" />
                  {t('news.lastKeywordAnalysis')}
                  <span className="text-[10px] text-muted-foreground/70 ml-1">
                    {timeAgo(analysis.analyzedAt)}
                  </span>
                </button>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                  <span className="font-semibold text-emerald-400">
                    {t('news.positiveCount', { count: positive })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Minus className="h-3 w-3 text-amber-400" />
                  <span className="text-amber-400">
                    {t('news.neutralCount', { count: neutral })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-red-400" />
                  <span className="font-semibold text-red-400">
                    {t('news.negativeCount', { count: negative })}
                  </span>
                </div>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                {positive > 0 && (
                  <div
                    className="h-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${(positive / total) * 100}%` }}
                  />
                )}
                {neutral > 0 && (
                  <div
                    className="h-full bg-amber-500/50 transition-all duration-700"
                    style={{ width: `${(neutral / total) * 100}%` }}
                  />
                )}
                {negative > 0 && (
                  <div
                    className="h-full bg-red-500 transition-all duration-700"
                    style={{ width: `${(negative / total) * 100}%` }}
                  />
                )}
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[11px]">
                <span className="text-muted-foreground">
                  {t('news.newsAnalyzed', { count: total })}
                </span>
                <span className={cn('font-bold', overallColor)}>
                  Score: {score > 0 ? '+' : ''}
                  {score}
                </span>
              </div>
              {summary && (
                <p className="mt-2 text-[11px] text-muted-foreground/70 leading-relaxed">
                  {summary}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              {t('news.noAnalysis')}
            </p>
            <button
              onClick={onRunKeyword}
              disabled={isRunningKeyword}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {isRunningKeyword ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {t('news.generateAnalysis')}
            </button>
          </div>
        )}

        {analysis && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onRunKeyword}
              disabled={isRunningKeyword}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunningKeyword ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Hash className="h-3.5 w-3.5" />
              )}
              {t('news.keywordAnalysis')}
            </button>

            {hasAiProvider ? (
              <button
                onClick={() =>
                  onRunAi(
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    newsConfig!.primaryProvider!,
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    newsConfig!.primaryModel!,
                  )
                }
                disabled={isRunningAi}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunningAi ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    {t('news.analyzing')}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    {t('news.aiAnalysis')}
                  </>
                )}
              </button>
            ) : (
              <a
                href="/dashboard/settings/news"
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20"
              >
                <Settings className="h-3.5 w-3.5" />
                {t('news.configureAiAnalysis')}
              </a>
            )}
          </div>
        )}

        {effectiveTab === 'ai' && changed.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('news.aiReclassifications', { count: changed.length })}
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {changed.map((n) => {
                const ai = aiMap.get(n.id);
                if (!ai) return null;
                return (
                  <div
                    key={n.id}
                    className="flex items-center gap-2 rounded-lg bg-muted/30 border border-border/50 px-3 py-2"
                  >
                    <XCircle className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                    <span
                      className={cn(
                        'text-[10px] font-bold uppercase shrink-0',
                        SENTIMENT_CONFIG[
                          n.sentiment as keyof typeof SENTIMENT_CONFIG
                        ]?.color ?? 'text-muted-foreground',
                      )}
                    >
                      {n.sentiment.slice(0, 3)}
                    </span>
                    <span className="text-muted-foreground/40 text-[10px] shrink-0">
                      →
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-bold uppercase shrink-0',
                        SENTIMENT_CONFIG[
                          ai.sentiment as keyof typeof SENTIMENT_CONFIG
                        ]?.color ?? 'text-muted-foreground',
                      )}
                    >
                      {ai.sentiment.slice(0, 3)}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate flex-1">
                      {n.headline}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
