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
import type { SigmaSentiment } from '../bot-analysis';

type AnalysisTab = 'ai' | 'keyword';

export function AnalysisSummaryCard({
  analysis,
  newsConfig,
  onRunKeyword,
  isRunningKeyword,
  onRunAi,
  isRunningAi,
  sigmaSentiment,
  sigmaTimestamp,
}: {
  analysis: NewsAnalysis | null | undefined;
  newsConfig: import('../../hooks/use-market').NewsConfig | undefined;
  onRunKeyword: () => void;
  isRunningKeyword: boolean;
  onRunAi: () => void;
  isRunningAi: boolean;
  sigmaSentiment?: SigmaSentiment | null;
  sigmaTimestamp?: string | null;
}) {
  const { t } = useTranslation();
  const hasAi = !!analysis?.aiAnalyzedAt;

  // Derive effective SIGMA from AI analysis when available; fall back to agent decision sigma
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

  const hasSigma = !!effectiveSigma;
  const hasAnyAi = hasSigma || hasAi;

  const [activeTab, setActiveTab] = useState<AnalysisTab>(
    hasAnyAi ? 'ai' : 'keyword',
  );
  const effectiveTab = hasAnyAi ? activeTab : 'keyword';

  // Keyword data
  const kwPositive = analysis?.positiveCount ?? 0;
  const kwNegative = analysis?.negativeCount ?? 0;
  const kwNeutral = analysis?.neutralCount ?? 0;
  const kwTotal = kwPositive + kwNegative + kwNeutral;
  const kwScore = analysis?.score ?? 0;
  const kwOverall = analysis?.overallSentiment ?? 'NEUTRAL';

  // AI data (from manual AI analysis or A2→DB)
  const aiPositive = analysis?.aiPositiveCount ?? 0;
  const aiNegative = analysis?.aiNegativeCount ?? 0;
  const aiNeutral = analysis?.aiNeutralCount ?? 0;
  const aiTotal = aiPositive + aiNegative + aiNeutral;
  const aiScore = analysis?.aiScore ?? 0;
  const rawAiOverall = (
    analysis?.aiOverallSentiment ?? 'NEUTRAL'
  ).toUpperCase();
  const aiOverall =
    rawAiOverall === 'POSITIVE' || rawAiOverall === 'BULLISH'
      ? 'BULLISH'
      : rawAiOverall === 'NEGATIVE' || rawAiOverall === 'BEARISH'
        ? 'BEARISH'
        : 'NEUTRAL';

  // SIGMA overall (used within the AI tab)
  const sigmaImpact = effectiveSigma?.impact ?? 'neutral';
  const sigmaScore = effectiveSigma?.sentiment ?? 0;
  const sigmaOverall =
    sigmaImpact === 'positive'
      ? 'BULLISH'
      : sigmaImpact === 'negative'
        ? 'BEARISH'
        : 'NEUTRAL';

  // For the AI tab, prefer SIGMA overall if available, else AI overall
  const aiTabOverall = hasSigma ? sigmaOverall : aiOverall;

  const displayOverall = effectiveTab === 'ai' ? aiTabOverall : kwOverall;

  const overallColor =
    displayOverall === 'BULLISH'
      ? 'text-emerald-400'
      : displayOverall === 'BEARISH'
        ? 'text-red-400'
        : 'text-amber-400';
  const overallBg =
    displayOverall === 'BULLISH'
      ? 'bg-emerald-500/10 border-emerald-500/25'
      : displayOverall === 'BEARISH'
        ? 'bg-red-500/10 border-red-500/25'
        : 'bg-amber-500/10 border-amber-500/25';

  // Reclassifications: AI (SIGMA-influenced) vs keyword
  const aiMap = new Map((analysis?.aiHeadlines ?? []).map((a) => [a.id, a]));
  const kwHeadlines = analysis?.headlines ?? [];
  const changed = kwHeadlines.filter((h) => {
    const ai = aiMap.get(h.id);
    return ai && ai.sentiment !== h.sentiment;
  });

  return (
    <div className="rounded-2xl border border-border bg-card mb-6">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/20">
        <Brain className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">
          {t('news.sentimentSummary')}
        </span>
        {effectiveTab === 'ai' && hasAnyAi && (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary">
            <Sparkles className="h-3 w-3" />
            IA
          </span>
        )}
        <span
          className={cn(
            'ml-auto rounded-full border px-3 py-0.5 text-xs font-bold',
            overallColor,
            overallBg,
          )}
        >
          {displayOverall === 'BULLISH'
            ? t('news.bullish')
            : displayOverall === 'BEARISH'
              ? t('news.bearish')
              : t('news.neutral')}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Tabs: IA | Keyword */}
        {(hasAnyAi || analysis) && (
          <div className="flex gap-1 rounded-lg border border-border bg-muted/20 p-0.5 w-fit">
            {hasAnyAi && (
              <button
                onClick={() => setActiveTab('ai')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                  effectiveTab === 'ai'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Sparkles className="h-3 w-3 text-primary shrink-0" />
                {t('news.lastAiAnalysis')}
                {(sigmaTimestamp || analysis?.aiAnalyzedAt) && (
                  <span className="text-[10px] text-muted-foreground/70 ml-1">
                    {timeAgo(sigmaTimestamp ?? analysis!.aiAnalyzedAt!)}
                  </span>
                )}
              </button>
            )}
            {analysis && (
              <button
                onClick={() => setActiveTab('keyword')}
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
            )}
          </div>
        )}

        {/* ── IA Tab Content (SIGMA + AI analysis combined) ── */}
        {effectiveTab === 'ai' && hasAnyAi && (
          <>
            {/* SIGMA insight block */}
            {hasSigma && (
              <div
                className={cn(
                  'rounded-lg border p-3 space-y-1.5',
                  effectiveSigma.impact === 'positive'
                    ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
                    : effectiveSigma.impact === 'negative'
                      ? 'border-red-500/20 bg-red-500/[0.06]'
                      : 'border-amber-500/20 bg-amber-500/[0.06]',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Brain className="h-3 w-3 text-violet-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-violet-400">
                    {t('botAnalysis.sigmaTitle')}
                  </span>
                  <span
                    className={cn(
                      'ml-1 text-[10px] font-semibold',
                      effectiveSigma.impact === 'positive'
                        ? 'text-emerald-400'
                        : effectiveSigma.impact === 'negative'
                          ? 'text-red-400'
                          : 'text-amber-400',
                    )}
                  >
                    {effectiveSigma.impact === 'positive'
                      ? t('botAnalysis.sigmaImpactPositive')
                      : effectiveSigma.impact === 'negative'
                        ? t('botAnalysis.sigmaImpactNegative')
                        : t('botAnalysis.sigmaImpactNeutral')}
                  </span>
                  {effectiveSigma.cached && (
                    <span className="ml-auto inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/60">
                      <RefreshCw className="h-2.5 w-2.5" />
                      {t('botAnalysis.sigmaCached')}
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-foreground/80">
                  {effectiveSigma.reasoning}
                </p>
                <div className="text-right">
                  <span
                    className={cn(
                      'text-[10px] font-mono font-bold',
                      sigmaScore > 0
                        ? 'text-emerald-400'
                        : sigmaScore < 0
                          ? 'text-red-400'
                          : 'text-amber-400',
                    )}
                  >
                    Score: {sigmaScore > 0 ? '+' : ''}
                    {typeof sigmaScore === 'number'
                      ? sigmaScore.toFixed(2)
                      : sigmaScore}
                  </span>
                </div>
              </div>
            )}

            {/* AI headline counts (from manual AI or A2→DB) */}
            {hasAi && aiTotal > 0 && (
              <div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                    <span className="font-semibold text-emerald-400">
                      {t('news.positiveCount', { count: aiPositive })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Minus className="h-3 w-3 text-amber-400" />
                    <span className="text-amber-400">
                      {t('news.neutralCount', { count: aiNeutral })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-red-400" />
                    <span className="font-semibold text-red-400">
                      {t('news.negativeCount', { count: aiNegative })}
                    </span>
                  </div>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                  {aiPositive > 0 && (
                    <div
                      className="h-full bg-emerald-500 transition-all duration-700"
                      style={{
                        width: `${aiTotal ? (aiPositive / aiTotal) * 100 : 0}%`,
                      }}
                    />
                  )}
                  {aiNeutral > 0 && (
                    <div
                      className="h-full bg-amber-500/50 transition-all duration-700"
                      style={{
                        width: `${aiTotal ? (aiNeutral / aiTotal) * 100 : 0}%`,
                      }}
                    />
                  )}
                  {aiNegative > 0 && (
                    <div
                      className="h-full bg-red-500 transition-all duration-700"
                      style={{
                        width: `${aiTotal ? (aiNegative / aiTotal) * 100 : 0}%`,
                      }}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[11px]">
                  <span className="text-muted-foreground">
                    {t('news.newsAnalyzed', { count: aiTotal })}
                  </span>
                  <span
                    className={cn(
                      'font-bold',
                      aiOverall === 'BULLISH'
                        ? 'text-emerald-400'
                        : aiOverall === 'BEARISH'
                          ? 'text-red-400'
                          : 'text-amber-400',
                    )}
                  >
                    Score: {aiScore > 0 ? '+' : ''}
                    {aiScore}
                  </span>
                </div>
                {analysis?.aiSummary && (
                  <p className="mt-2 text-[11px] text-muted-foreground/70 leading-relaxed">
                    {analysis.aiSummary}
                  </p>
                )}
              </div>
            )}

            {/* AI reclassifications vs keyword */}
            {changed.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t('news.sigmaReclassifications', { count: changed.length })}
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
          </>
        )}

        {/* ── Keyword Tab Content ── */}
        {effectiveTab === 'keyword' && analysis && (
          <>
            <div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                  <span className="font-semibold text-emerald-400">
                    {t('news.positiveCount', { count: kwPositive })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Minus className="h-3 w-3 text-amber-400" />
                  <span className="text-amber-400">
                    {t('news.neutralCount', { count: kwNeutral })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-red-400" />
                  <span className="font-semibold text-red-400">
                    {t('news.negativeCount', { count: kwNegative })}
                  </span>
                </div>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                {kwPositive > 0 && (
                  <div
                    className="h-full bg-emerald-500 transition-all duration-700"
                    style={{
                      width: `${kwTotal ? (kwPositive / kwTotal) * 100 : 0}%`,
                    }}
                  />
                )}
                {kwNeutral > 0 && (
                  <div
                    className="h-full bg-amber-500/50 transition-all duration-700"
                    style={{
                      width: `${kwTotal ? (kwNeutral / kwTotal) * 100 : 0}%`,
                    }}
                  />
                )}
                {kwNegative > 0 && (
                  <div
                    className="h-full bg-red-500 transition-all duration-700"
                    style={{
                      width: `${kwTotal ? (kwNegative / kwTotal) * 100 : 0}%`,
                    }}
                  />
                )}
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[11px]">
                <span className="text-muted-foreground">
                  {t('news.newsAnalyzed', { count: kwTotal })}
                </span>
                <span
                  className={cn(
                    'font-bold',
                    kwOverall === 'BULLISH'
                      ? 'text-emerald-400'
                      : kwOverall === 'BEARISH'
                        ? 'text-red-400'
                        : 'text-amber-400',
                  )}
                >
                  Score: {kwScore > 0 ? '+' : ''}
                  {kwScore}
                </span>
              </div>
              {kwTotal > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground/70 leading-relaxed">
                  {t('news.keywordSummary', {
                    positive: kwPositive,
                    negative: kwNegative,
                    neutral: kwNeutral,
                    score: `${kwScore > 0 ? '+' : ''}${kwScore}`,
                    total: kwTotal,
                    overall:
                      kwOverall === 'BULLISH'
                        ? t('news.bullish')
                        : kwOverall === 'BEARISH'
                          ? t('news.bearish')
                          : t('news.neutral'),
                  })}
                </p>
              )}
            </div>
          </>
        )}

        {/* No analysis fallback */}
        {!analysis && !hasSigma && (
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

        {/* Action buttons */}
        {(analysis || hasSigma) && (
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

            <button
              onClick={() => onRunAi()}
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
                  {t('news.updateAiAnalysis')}
                </>
              )}
            </button>

            <a
              href="/dashboard/settings/news"
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              {t('news.configure')}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
