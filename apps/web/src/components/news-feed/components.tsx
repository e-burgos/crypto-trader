import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Sparkles,
  RefreshCw,
  XCircle,
  X,
  Calendar,
  User,
  Globe,
  Settings,
  Hash,
  ExternalLink,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import {
  type NewsItem,
  type NewsAnalysis,
  type AiHeadline,
} from '../../hooks/use-market';

export type SentimentFilter = 'ALL' | 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

export const NEWS_COUNTS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function sourceLabel(source: string): string {
  if (source === 'coingecko') return 'CoinGecko';
  if (source === 'cryptopanic') return 'CryptoPanic';
  if (source === 'newsdata') return 'NewsData';
  if (source.startsWith('rss:')) {
    const name = source.replace('rss:', '');
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  if (source.startsWith('reddit:')) return `r/${source.replace('reddit:', '')}`;
  return source;
}

export const SENTIMENT_CONFIG: Record<
  NewsItem['sentiment'],
  {
    label: string;
    icon: typeof TrendingUp;
    color: string;
    bg: string;
    border: string;
  }
> = {
  POSITIVE: {
    label: 'Positivo',
    icon: TrendingUp,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  NEGATIVE: {
    label: 'Negativo',
    icon: TrendingDown,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
  NEUTRAL: {
    label: 'Neutral',
    icon: Minus,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    border: 'border-border',
  },
};

// ── Analysis Summary Card (DB-driven) ────────────────────────────────────────

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
  const hasAiProvider = !!(
    newsConfig?.primaryProvider && newsConfig?.primaryModel
  );

  // ── Analysis tabs
  const hasAiAnalysis = !!analysis?.aiAnalyzedAt;
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'ai' | 'keyword'>(
    'ai',
  );
  const effectiveTab = hasAiAnalysis ? activeAnalysisTab : 'keyword';

  // Keyword data
  const kwPositive = analysis?.positiveCount ?? 0;
  const kwNegative = analysis?.negativeCount ?? 0;
  const kwNeutral = analysis?.neutralCount ?? 0;
  const kwScore = analysis?.score ?? 0;
  const kwOverall = analysis?.overallSentiment ?? 'NEUTRAL';
  const kwSummary = analysis?.summary;

  // AI data
  const aiPositive = analysis?.aiPositiveCount ?? 0;
  const aiNegative = analysis?.aiNegativeCount ?? 0;
  const aiNeutral = analysis?.aiNeutralCount ?? 0;
  const aiScore = analysis?.aiScore ?? 0;
  const aiOverall = analysis?.aiOverallSentiment ?? 'NEUTRAL';
  const aiSummary = analysis?.aiSummary;

  // Active tab values
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

  // Reclassifications
  const aiMap = new Map((analysis?.aiHeadlines ?? []).map((a) => [a.id, a]));
  const changed = (analysis?.headlines ?? []).filter((h) => {
    const ai = aiMap.get(h.id);
    return ai && ai.sentiment !== h.sentiment;
  });

  return (
    <div className="rounded-2xl border border-border bg-card mb-6">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/20">
        <Brain className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Resumen de Sentimiento</span>
        {hasAiAnalysis && effectiveTab === 'ai' && (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary">
            <Sparkles className="h-3 w-3" />
            IA activa
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
            ? 'Alcista'
            : overall === 'BEARISH'
              ? 'Bajista'
              : 'Neutral'}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Analysis tabs */}
        {analysis ? (
          <>
            {/* Tab switcher — only if AI analysis exists */}
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
                  Último análisis IA
                  <span className="text-[10px] text-muted-foreground/70 ml-1">
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
                  Último análisis Keyword
                  <span className="text-[10px] text-muted-foreground/70 ml-1">
                    {timeAgo(analysis.analyzedAt)}
                  </span>
                </button>
              </div>
            )}

            {/* Sentiment bar */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                  <span className="font-semibold text-emerald-400">
                    {positive} positivas
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Minus className="h-3 w-3 text-amber-400" />
                  <span className="text-amber-400">{neutral} neutrales</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-red-400" />
                  <span className="font-semibold text-red-400">
                    {negative} negativas
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
                  {total} noticias analizadas
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
              No hay análisis guardado aún.
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
              Generar análisis
            </button>
          </div>
        )}

        {/* Action buttons */}
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
              Análisis Keyword
            </button>

            {hasAiProvider ? (
              <button
                onClick={() =>
                  onRunAi(
                    newsConfig!.primaryProvider!,
                    newsConfig!.primaryModel!,
                  )
                }
                disabled={isRunningAi}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunningAi ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Analizando…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Análisis IA
                  </>
                )}
              </button>
            ) : (
              <a
                href="/dashboard/settings?tab=news"
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20"
              >
                <Settings className="h-3.5 w-3.5" />
                Configurar Análisis IA
              </a>
            )}
          </div>
        )}

        {/* Reclassification diff */}
        {effectiveTab === 'ai' && changed.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {changed.length} reclasificaciones por IA
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

// ── News Detail Modal ─────────────────────────────────────────────────────────

export function NewsDetailModal({
  item,
  aiResult,
  onClose,
}: {
  item: NewsItem;
  aiResult?: AiHeadline;
  onClose: () => void;
}) {
  const effectiveSentiment: NewsItem['sentiment'] =
    (aiResult?.sentiment as NewsItem['sentiment']) ?? item.sentiment;
  const s = SENTIMENT_CONFIG[effectiveSentiment];
  const SentimentIcon = s.icon;
  const changed = aiResult && aiResult.sentiment !== item.sentiment;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-card border border-border max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border shrink-0">
          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-muted-foreground truncate flex-1">
            {sourceLabel(item.source)}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
            <Calendar className="h-3 w-3" />
            {timeAgo(item.publishedAt)}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-muted transition-colors ml-1 shrink-0"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Sentiment badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border',
                s.bg,
                s.color,
                s.border,
              )}
            >
              <SentimentIcon className="h-3.5 w-3.5" />
              {s.label}
            </span>
            {changed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-1 text-[11px] font-semibold text-primary">
                <Sparkles className="h-3 w-3" />
                Reclasificado por IA
              </span>
            )}
          </div>

          {/* Headline */}
          <h2 className="text-base font-bold leading-snug">{item.headline}</h2>

          {/* Summary */}
          {item.summary && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Resumen
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.summary}
              </p>
            </div>
          )}

          {/* No content fallback */}
          {!item.summary && (
            <p className="text-[12px] text-muted-foreground/50 italic">
              Esta fuente no provee resumen. Hacé clic en "Ver artículo" para
              leer el contenido completo.
            </p>
          )}

          {/* AI reasoning */}
          {aiResult?.reasoning && (
            <div className="rounded-xl bg-primary/5 border border-primary/15 p-3.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Brain className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-semibold text-primary">
                  Análisis de IA
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {aiResult.reasoning}
              </p>
            </div>
          )}

          {/* Author */}
          {item.author && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span>{item.author}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Ver artículo completo
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── News Card ─────────────────────────────────────────────────────────────────

export function NewsCard({
  item,
  aiResult,
  onOpen,
}: {
  item: NewsItem;
  aiResult?: AiHeadline;
  onOpen: () => void;
}) {
  const effectiveSentiment: NewsItem['sentiment'] =
    (aiResult?.sentiment as NewsItem['sentiment']) ?? item.sentiment;
  const s = SENTIMENT_CONFIG[effectiveSentiment];
  const SentimentIcon = s.icon;
  const changed = aiResult && aiResult.sentiment !== item.sentiment;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className="news-card group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 cursor-pointer"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border',
              s.bg,
              s.color,
              s.border,
            )}
          >
            <SentimentIcon className="h-3 w-3" />
            {s.label}
          </span>
          {changed && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              IA
            </span>
          )}
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Abrir en nueva pestaña"
          className="shrink-0"
        >
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
        </a>
      </div>

      <p className="mb-2 line-clamp-3 text-sm font-medium leading-snug">
        {item.headline}
      </p>

      {item.summary && !aiResult?.reasoning && (
        <p className="mb-2 line-clamp-2 text-[11px] text-muted-foreground/60 leading-snug">
          {item.summary}
        </p>
      )}

      {aiResult?.reasoning && (
        <p className="mb-2 line-clamp-2 text-[11px] text-muted-foreground/70 italic leading-snug border-l-2 border-primary/20 pl-2">
          {aiResult.reasoning}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate">{sourceLabel(item.source)}</span>
        <span className="shrink-0">{timeAgo(item.publishedAt)}</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
