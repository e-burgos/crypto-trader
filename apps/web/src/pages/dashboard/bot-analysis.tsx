import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTranslation } from 'react-i18next';
import {
  Brain,
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Zap,
  Bot,
  Newspaper,
  Activity,
  ShieldAlert,
  ChevronRight,
  CircleDot,
  MessageSquare,
  BarChart2,
  Sparkles,
  Database,
  Settings,
  Cpu,
  Layers,
  ListChecks,
  History as HistoryIcon,
  Timer,
  X,
  ShieldCheck,
  BarChart3,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  useMarketSnapshot,
  deriveOpportunity,
  deriveOverallSignal,
  useMarketNews,
  useNewsConfig,
  useNewsAnalysis,
  MARKET_SYMBOLS,
  type OverallSignal,
  type MarketSnapshot,
  type NewsItem,
} from '../../hooks/use-market';
import {
  useAgentDecisions,
  type AgentDecision,
  type AgentDecisionConfigDetails,
} from '../../hooks/use-analytics';
import {
  useTradingConfigs,
  useAgentStatus,
  type TradingConfig,
  type AgentStatus,
} from '../../hooks/use-trading';
import { useBinanceTicker } from '../../hooks/use-binance-ticker';
import { usePlatformMode } from '../../hooks/use-user';

gsap.registerPlugin(useGSAP);

// ── Color maps ────────────────────────────────────────────────────────────────

const SIGNAL_COLOR: Record<OverallSignal, string> = {
  BUY: 'text-emerald-500',
  SELL: 'text-red-500',
  HOLD: 'text-sky-400',
  NEUTRAL: 'text-amber-500',
};

const SIGNAL_BG: Record<OverallSignal, string> = {
  BUY: 'bg-emerald-500/10 border-emerald-500/25',
  SELL: 'bg-red-500/10 border-red-500/25',
  HOLD: 'bg-sky-500/10 border-sky-500/25',
  NEUTRAL: 'bg-amber-500/10 border-amber-500/25',
};

const DECISION_COLOR: Record<string, string> = {
  BUY: 'text-emerald-500',
  SELL: 'text-red-500',
  HOLD: 'text-amber-500',
  CLOSE: 'text-blue-500',
};

const DECISION_BG: Record<string, string> = {
  BUY: 'bg-emerald-500/10',
  SELL: 'bg-red-500/10',
  HOLD: 'bg-amber-500/10',
  CLOSE: 'bg-blue-500/10',
};

const SENTIMENT_COLOR: Record<string, string> = {
  POSITIVE: 'text-emerald-400',
  NEGATIVE: 'text-red-400',
  NEUTRAL: 'text-muted-foreground',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function useTimeAgo() {
  const { t } = useTranslation();
  return (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return t('botAnalysis.timeNow');
    if (mins < 60) return t('botAnalysis.timeMin', { count: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t('botAnalysis.timeHour', { count: hrs });
    return t('botAnalysis.timeDay', { count: Math.floor(hrs / 24) });
  };
}

function fmt(n: number, decimals = 2) {
  return (
    n?.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) ?? '—'
  );
}

function fmtPrice(n: number) {
  return n?.toLocaleString('en-US', { maximumFractionDigits: 0 }) ?? '—';
}

// ── Status Card ───────────────────────────────────────────────────────────────

function StatusCard({
  icon: Icon,
  label,
  value,
  sub,
  valueColor,
  bg,
}: {
  icon: typeof Brain;
  label: string;
  value: string;
  sub: string;
  valueColor: string;
  bg: string;
}) {
  return (
    <div
      className={cn(
        'status-card rounded-xl border p-4 flex items-center gap-4',
        bg,
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background/50">
        <Icon className={cn('h-5 w-5', valueColor)} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">
          {label}
        </p>
        <p className={cn('text-base font-bold leading-tight', valueColor)}>
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
      </div>
    </div>
  );
}

// ── Technical Summary (Analysis tab) ─────────────────────────────────────────

function TechnicalSummary({
  snapshot,
  livePrice,
}: {
  snapshot: MarketSnapshot;
  livePrice: number;
}) {
  const { t } = useTranslation();
  const { signal, score, reasons } = deriveOverallSignal(snapshot);
  const opp = deriveOpportunity(snapshot, livePrice);
  const cfg = { color: SIGNAL_COLOR[signal], bg: SIGNAL_BG[signal] };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('botAnalysis.technicalAnalysis')}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold border',
              cfg.color,
              cfg.bg,
            )}
          >
            <Zap className="h-3 w-3" />
            {t(`botAnalysis.signal${signal}` as Parameters<typeof t>[0])}
          </span>
          <Link
            to="/dashboard/market#indicators"
            className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/60 transition-colors"
            title={t('botAnalysis.viewIndicators')}
          >
            <BarChart2 className="h-3 w-3" />
            {t('botAnalysis.viewIndicators')}
          </Link>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
              {t('botAnalysis.confluenceScore')}
            </span>
            <span className={cn('text-sm font-bold', cfg.color)}>
              {score > 0 ? '+' : ''}
              {score} / 8
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                signal === 'BUY'
                  ? 'bg-emerald-500'
                  : signal === 'SELL'
                    ? 'bg-red-500'
                    : signal === 'HOLD'
                      ? 'bg-sky-400'
                      : 'bg-amber-500',
              )}
              style={{
                width: `${Math.min(100, (Math.abs(score) / 8) * 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          {opp.checks.map((check) => (
            <div
              key={check.label}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs',
                check.ok
                  ? 'bg-emerald-500/[0.08] border border-emerald-500/15'
                  : 'bg-red-500/[0.08] border border-red-500/15',
              )}
            >
              {check.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
              )}
              <span className="w-16 shrink-0 font-semibold text-muted-foreground">
                {check.label}
              </span>
              <span
                className={cn(
                  'truncate flex-1',
                  check.ok ? 'text-foreground/80' : 'text-muted-foreground/60',
                )}
              >
                {check.value}
              </span>
              {check.weight === 'strong' && (
                <span className="shrink-0 text-[9px] font-bold text-primary/50 uppercase">
                  {t('botAnalysis.strong')}
                </span>
              )}
            </div>
          ))}
        </div>

        {opp.action !== 'WAIT' && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="rounded-lg bg-muted/30 border border-border/40 px-2 py-2 text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5">
                {t('botAnalysis.entry')}
              </p>
              <p className="text-xs font-bold font-mono">
                ${fmtPrice(opp.entryPrice)}
              </p>
            </div>
            <div className="rounded-lg bg-red-500/[0.08] border border-red-500/15 px-2 py-2 text-center">
              <p className="text-[10px] text-red-400/70 mb-0.5">
                {t('botAnalysis.stopLoss')}
              </p>
              <p className="text-xs font-bold font-mono text-red-400">
                ${fmtPrice(opp.stopLoss)}
              </p>
            </div>
            <div className="rounded-lg bg-emerald-500/[0.08] border border-emerald-500/15 px-2 py-2 text-center">
              <p className="text-[10px] text-emerald-400/70 mb-0.5">
                {t('botAnalysis.takeProfit')}
              </p>
              <p className="text-xs font-bold font-mono text-emerald-400">
                ${fmtPrice(opp.takeProfit)}
              </p>
            </div>
          </div>
        )}

        {opp.warnings.length > 0 && (
          <div className="space-y-1">
            {opp.warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg bg-amber-500/[0.08] border border-amber-500/15 px-3 py-1.5"
              >
                <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
                <span className="text-[11px] text-amber-300/80">{w}</span>
              </div>
            ))}
          </div>
        )}

        {reasons.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              {t('botAnalysis.detectedFactors')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {reasons.map((r) => (
                <span
                  key={r}
                  className="rounded-full bg-muted/50 border border-border/50 px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── News Sentiment Panel ──────────────────────────────────────────────────────

const AI_VALID_MS = 12 * 60 * 60 * 1000;

function NewsSentimentPanel({ news }: { news: NewsItem[] }) {
  const { t } = useTranslation();
  const { data: config } = useNewsConfig();
  const { data: analysis } = useNewsAnalysis();

  const hasAi = !!(
    analysis?.aiAnalyzedAt &&
    Date.now() - new Date(analysis.aiAnalyzedAt).getTime() < AI_VALID_MS
  );

  // Use AI counts when recent AI analysis exists, else keyword counts
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

  // Build override map for AI-reclassified headlines
  const aiMap = new Map((analysis?.aiHeadlines ?? []).map((a) => [a.id, a]));

  // Use analysis.headlines (full list) when available, fallback to news prop
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
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20 shrink-0">
        <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('botAnalysis.newsSentimentTitle')}
        </span>
        {/* Analysis method badge */}
        {analysis ? (
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
                <Sparkles className="h-2.5 w-2.5" /> IA activa
              </>
            ) : (
              <>
                <Database className="h-2.5 w-2.5" /> Keyword
              </>
            )}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
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
          {/* Configure button */}
          <Link
            to="/dashboard/settings?tab=news"
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
                to="/dashboard/settings?tab=news"
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

// ── Next Decision Countdown ───────────────────────────────────────────────────

/**
 * Returns a "MM:SS" string while time remains, or null when the target has passed.
 * Returns '--:--' when targetMs is null (no countdown applicable).
 */
export function useCountdown(targetMs: number | null): string | null {
  const [remaining, setRemaining] = useState<number>(
    targetMs ? Math.max(0, targetMs - Date.now()) : 0,
  );

  useEffect(() => {
    if (!targetMs) return;
    const tick = () => setRemaining(Math.max(0, targetMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (!targetMs) return '--:--';
  if (remaining <= 0) return null;
  const totalSec = Math.floor(remaining / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Agent Current State Modal ─────────────────────────────────────────────────

type StateModalTab = 'estado' | 'indicadores' | 'noticias' | 'config';

const STATE_MODAL_TABS: {
  id: StateModalTab;
  label: string;
  icon: typeof Activity;
}[] = [
  { id: 'estado', label: 'Estado', icon: Activity },
  { id: 'indicadores', label: 'Indicadores', icon: BarChart3 },
  { id: 'noticias', label: 'Noticias', icon: Newspaper },
  { id: 'config', label: 'Config', icon: Settings },
];

function StateDetailRow({
  label,
  value,
  mono = false,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">
        {label}
      </span>
      <span
        className={cn(
          'text-[12px] font-semibold text-right',
          mono && 'font-mono tabular-nums',
          accent ?? 'text-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function StateSectionTitle({
  icon: Icon,
  title,
}: {
  icon: typeof Activity;
  title: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </span>
    </div>
  );
}

function AgentCurrentStateModal({
  config,
  lastDecision,
  onClose,
}: {
  config: TradingConfig;
  lastDecision: AgentDecision | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<StateModalTab>('estado');
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const modeColor =
    config.mode === 'TESTNET'
      ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
      : config.mode === 'SANDBOX'
        ? 'text-muted-foreground bg-muted/30 border-border'
        : 'text-red-400 bg-red-500/10 border-red-500/20';

  const lastDec = lastDecision;
  const ind = lastDec?.indicators;
  const news = lastDec?.newsHeadlines ?? [];
  const cfg: AgentDecisionConfigDetails | null | undefined =
    lastDec?.configDetails;

  const decColor =
    lastDec?.decision === 'BUY'
      ? 'text-emerald-400'
      : lastDec?.decision === 'SELL'
        ? 'text-red-400'
        : 'text-sky-400';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full sm:max-w-xl max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-primary/5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 border border-primary/20">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  {config.name || `${config.asset}/${config.pair}`}
                </span>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                    modeColor,
                  )}
                >
                  {config.mode}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {config.asset}/{config.pair} · {t('botAnalysis.currentState')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-border bg-muted/20">
          {STATE_MODAL_TABS.map(({ id, label, icon: TabIcon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold uppercase tracking-wide transition-all',
                tab === id
                  ? 'border-b-2 border-primary text-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <TabIcon className="h-3 w-3 shrink-0" />
              <span className="hidden sm:block">{label}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* ── ESTADO TAB ── */}
          {tab === 'estado' && (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <StateSectionTitle icon={Activity} title="Estado del agente" />
                <div className="space-y-0">
                  <StateDetailRow
                    label="Agente"
                    value={config.name || `${config.asset}/${config.pair}`}
                  />
                  <StateDetailRow
                    label="Par"
                    value={`${config.asset}/${config.pair}`}
                  />
                  <StateDetailRow label="Modo" value={config.mode} />
                  <StateDetailRow
                    label="Estado"
                    value={config.isActive ? 'Activo' : 'Detenido'}
                    accent={
                      config.isActive
                        ? 'text-emerald-400'
                        : 'text-muted-foreground'
                    }
                  />
                  <StateDetailRow
                    label="Intervalo mínimo"
                    value={`${config.minIntervalMinutes} min`}
                    mono
                  />
                  <StateDetailRow
                    label="Modo intervalo"
                    value={config.intervalMode}
                  />
                </div>
              </div>

              {lastDec ? (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <StateSectionTitle icon={Clock} title="Última decisión" />
                  <div className="space-y-0">
                    <StateDetailRow
                      label="Decisión"
                      value={lastDec.decision}
                      accent={decColor}
                    />
                    <StateDetailRow
                      label="Confianza"
                      value={`${Math.round(lastDec.confidence * 100)}%`}
                      mono
                      accent={
                        lastDec.confidence >= 0.7
                          ? 'text-emerald-400'
                          : lastDec.confidence >= 0.5
                            ? 'text-amber-400'
                            : 'text-red-400'
                      }
                    />
                    {lastDec.waitMinutes != null && lastDec.waitMinutes > 0 && (
                      <StateDetailRow
                        label="Espera solicitada"
                        value={`${lastDec.waitMinutes} min`}
                        mono
                      />
                    )}
                    <StateDetailRow
                      label="Generada el"
                      value={new Date(lastDec.createdAt).toLocaleString(
                        undefined,
                        {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        },
                      )}
                    />
                    {lastDec.llmProvider && (
                      <StateDetailRow
                        label="Proveedor LLM"
                        value={lastDec.llmProvider}
                      />
                    )}
                    {lastDec.llmModel && (
                      <StateDetailRow
                        label="Modelo"
                        value={lastDec.llmModel}
                        mono
                      />
                    )}
                  </div>

                  <div className="mt-3 rounded-lg border border-border/50 bg-card p-3">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {t('botAnalysis.justification')}
                      </span>
                    </div>
                    <p className="text-[12px] leading-relaxed text-foreground/85 whitespace-pre-wrap">
                      {lastDec.reasoning}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <Bot className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-[12px] text-muted-foreground">
                    {t('botAnalysis.noDecisionsYet')}
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── INDICADORES TAB ── */}
          {tab === 'indicadores' && (
            <>
              {ind ? (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <StateSectionTitle
                    icon={BarChart3}
                    title="Snapshot de mercado"
                  />
                  <div className="space-y-0">
                    {ind.rsi && (
                      <>
                        <StateDetailRow
                          label="RSI"
                          value={ind.rsi.value.toFixed(2)}
                          mono
                        />
                        <StateDetailRow
                          label="RSI Signal"
                          value={ind.rsi.signal}
                        />
                      </>
                    )}
                    {ind.macd && (
                      <>
                        <StateDetailRow
                          label="MACD"
                          value={ind.macd.macd.toFixed(5)}
                          mono
                        />
                        <StateDetailRow
                          label="MACD Signal"
                          value={ind.macd.signal.toFixed(5)}
                          mono
                        />
                        <StateDetailRow
                          label="Histograma"
                          value={ind.macd.histogram.toFixed(5)}
                          mono
                        />
                        <StateDetailRow
                          label="Cruce MACD"
                          value={ind.macd.crossover}
                        />
                      </>
                    )}
                    {ind.emaCross && (
                      <>
                        <StateDetailRow
                          label="EMA 9"
                          value={ind.emaCross.ema9.toFixed(4)}
                          mono
                        />
                        <StateDetailRow
                          label="EMA 21"
                          value={ind.emaCross.ema21.toFixed(4)}
                          mono
                        />
                        <StateDetailRow
                          label="EMA 200"
                          value={ind.emaCross.ema200.toFixed(4)}
                          mono
                        />
                        <StateDetailRow
                          label="Tendencia EMA"
                          value={ind.emaCross.trend}
                        />
                      </>
                    )}
                    {ind.bollingerBands && (
                      <>
                        <StateDetailRow
                          label="BB Superior"
                          value={ind.bollingerBands.upper.toFixed(4)}
                          mono
                        />
                        <StateDetailRow
                          label="BB Media"
                          value={ind.bollingerBands.middle.toFixed(4)}
                          mono
                        />
                        <StateDetailRow
                          label="BB Inferior"
                          value={ind.bollingerBands.lower.toFixed(4)}
                          mono
                        />
                        <StateDetailRow
                          label="BB Bandwidth"
                          value={ind.bollingerBands.bandwidth.toFixed(4)}
                          mono
                        />
                        <StateDetailRow
                          label="Posición en BB"
                          value={ind.bollingerBands.position}
                        />
                      </>
                    )}
                    {ind.volume && (
                      <>
                        <StateDetailRow
                          label="Volumen actual"
                          value={ind.volume.current.toFixed(0)}
                          mono
                        />
                        <StateDetailRow
                          label="Volumen promedio"
                          value={ind.volume.average.toFixed(0)}
                          mono
                        />
                        <StateDetailRow
                          label="Ratio de volumen"
                          value={ind.volume.ratio.toFixed(3)}
                          mono
                        />
                        <StateDetailRow
                          label="Señal de volumen"
                          value={ind.volume.signal}
                        />
                      </>
                    )}
                    {ind.supportResistance && (
                      <>
                        <StateDetailRow
                          label="Soportes"
                          value={
                            ind.supportResistance.support
                              .map((s) => s.toFixed(2))
                              .join(' · ') || '—'
                          }
                          mono
                        />
                        <StateDetailRow
                          label="Resistencias"
                          value={
                            ind.supportResistance.resistance
                              .map((r) => r.toFixed(2))
                              .join(' · ') || '—'
                          }
                          mono
                        />
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-[12px] text-muted-foreground">
                  Sin indicadores almacenados para la última decisión.
                </div>
              )}
            </>
          )}

          {/* ── NOTICIAS TAB ── */}
          {tab === 'noticias' && (
            <>
              {news.length > 0 ? (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <StateSectionTitle
                    icon={Newspaper}
                    title="Noticias procesadas"
                  />
                  <div className="space-y-2">
                    {news.map((h, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-border/50 bg-card p-2.5"
                      >
                        <div className="flex items-start gap-2 mb-1">
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase',
                              h.sentiment === 'POSITIVE'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : h.sentiment === 'NEGATIVE'
                                  ? 'bg-red-500/15 text-red-400'
                                  : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {h.sentiment.slice(0, 3)}
                          </span>
                          <p className="text-[11px] leading-snug text-foreground/85 font-medium">
                            {h.headline}
                          </p>
                        </div>
                        {h.summary && (
                          <p className="text-[10px] text-muted-foreground leading-relaxed pl-7">
                            {h.summary}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 pl-7">
                          <span className="text-[10px] text-muted-foreground/60">
                            {h.source}
                          </span>
                          {h.author && (
                            <span className="text-[10px] text-muted-foreground/60">
                              · {h.author}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-[12px] text-muted-foreground">
                  Sin noticias almacenadas para la última decisión.
                </div>
              )}
            </>
          )}

          {/* ── CONFIG TAB ── */}
          {tab === 'config' && (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <StateSectionTitle
                  icon={ShieldCheck}
                  title="Parámetros activos"
                />
                <div className="space-y-0">
                  <StateDetailRow
                    label="Umbral compra"
                    value={`${config.buyThreshold}%`}
                    mono
                  />
                  <StateDetailRow
                    label="Umbral venta"
                    value={`${config.sellThreshold}%`}
                    mono
                  />
                  <StateDetailRow
                    label="Stop Loss"
                    value={`${(config.stopLossPct * 100).toFixed(2)}%`}
                    mono
                  />
                  <StateDetailRow
                    label="Take Profit"
                    value={`${(config.takeProfitPct * 100).toFixed(2)}%`}
                    mono
                  />
                  <StateDetailRow
                    label="Beneficio mínimo"
                    value={`${(config.minProfitPct * 100).toFixed(2)}%`}
                    mono
                  />
                  <StateDetailRow
                    label="Max. capital / operación"
                    value={`${(config.maxTradePct * 100).toFixed(0)}%`}
                    mono
                  />
                  <StateDetailRow
                    label="Posiciones simultáneas"
                    value={String(config.maxConcurrentPositions)}
                    mono
                  />
                  <StateDetailRow
                    label="Intervalo mínimo"
                    value={`${config.minIntervalMinutes} min`}
                    mono
                  />
                  <StateDetailRow
                    label="Modo intervalo"
                    value={config.intervalMode}
                  />
                  {config.orderPriceOffsetPct !== 0 && (
                    <StateDetailRow
                      label="Offset precio orden"
                      value={`${(config.orderPriceOffsetPct * 100).toFixed(2)}%`}
                      mono
                    />
                  )}
                </div>
              </div>

              {cfg && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <StateSectionTitle
                    icon={HistoryIcon}
                    title="Config usada en última decisión"
                  />
                  <div className="space-y-0">
                    <StateDetailRow
                      label="Umbral compra"
                      value={`${cfg.buyThreshold}%`}
                      mono
                    />
                    <StateDetailRow
                      label="Umbral venta"
                      value={`${cfg.sellThreshold}%`}
                      mono
                    />
                    <StateDetailRow
                      label="Stop Loss"
                      value={`${(cfg.stopLossPct * 100).toFixed(2)}%`}
                      mono
                    />
                    <StateDetailRow
                      label="Take Profit"
                      value={`${(cfg.takeProfitPct * 100).toFixed(2)}%`}
                      mono
                    />
                    <StateDetailRow
                      label="Config actualizada"
                      value={new Date(cfg.updatedAt).toLocaleDateString()}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-4 py-3 flex items-center justify-between bg-muted/10">
          <span className="text-[10px] text-muted-foreground font-mono">
            {config.id.slice(0, 20)}…
          </span>
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Agent Countdown Card ──────────────────────────────────────────────────────

function AgentCountdownCard({
  config,
  lastDecision,
  nextRunAt: serverNextRunAt,
}: {
  config: TradingConfig;
  lastDecision: AgentDecision | null;
  nextRunAt: number | null;
}) {
  const { t } = useTranslation();

  // Prefer the real nextRunAt from the Bull job (via /trading/status).
  // Fallback to computing from lastDecision if the server didn't provide it.
  const nextCycleAt = useMemo(() => {
    if (serverNextRunAt) return serverNextRunAt;
    if (!lastDecision) return null;
    const wait = lastDecision.waitMinutes ?? config.minIntervalMinutes ?? 30;
    return new Date(lastDecision.createdAt).getTime() + wait * 60_000;
  }, [serverNextRunAt, lastDecision, config.minIntervalMinutes]);

  const countdown = useCountdown(nextCycleAt);
  const isPast = nextCycleAt !== null && nextCycleAt <= Date.now();
  const progress = useMemo(() => {
    if (!nextCycleAt) return 0;
    if (serverNextRunAt) {
      // When using real job timing, estimate progress from last decision or last 15min window
      const start = lastDecision
        ? new Date(lastDecision.createdAt).getTime()
        : nextCycleAt - 15 * 60_000;
      const total = nextCycleAt - start;
      if (total <= 0) return 100;
      const elapsed = Date.now() - start;
      return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
    }
    if (!lastDecision) return 0;
    const wait =
      (lastDecision.waitMinutes ?? config.minIntervalMinutes ?? 30) * 60_000;
    const elapsed = Date.now() - new Date(lastDecision.createdAt).getTime();
    return Math.min(100, Math.round((elapsed / wait) * 100));
  }, [nextCycleAt, serverNextRunAt, lastDecision, config.minIntervalMinutes]);

  const [showStateModal, setShowStateModal] = useState(false);

  const modeColor =
    config.mode === 'TESTNET'
      ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
      : config.mode === 'SANDBOX'
        ? 'text-muted-foreground bg-muted/30 border-border'
        : 'text-red-400 bg-red-500/10 border-red-500/20';

  return (
    <>
      <div className="min-w-0 rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                  modeColor,
                )}
              >
                {config.mode}
              </span>
              <span className="text-[10px] font-semibold text-foreground/70 truncate">
                {config.asset}/{config.pair}
              </span>
            </div>
            {config.name && (
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                {config.name}
              </p>
            )}
          </div>
        </div>

        {/* Countdown */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {isPast
              ? t('botAnalysis.nextDecisionNow')
              : t('botAnalysis.nextDecisionIn')}
          </span>
          <span
            className={cn(
              'font-mono text-xl font-bold tabular-nums tracking-tight',
              isPast || countdown === null
                ? 'animate-pulse text-emerald-400'
                : 'text-foreground',
            )}
          >
            {isPast || countdown === null
              ? t('botAnalysis.nextDecisionAnalyzing')
              : countdown}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-1000',
              isPast ? 'bg-emerald-400' : 'bg-primary',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Last decision */}
        {lastDecision && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
            <span>{t('botAnalysis.lastDecisionLabel')}</span>
            <span
              className={cn(
                'font-semibold',
                lastDecision.decision === 'BUY'
                  ? 'text-emerald-400'
                  : lastDecision.decision === 'SELL'
                    ? 'text-red-400'
                    : 'text-sky-400',
              )}
            >
              {lastDecision.decision}{' '}
              {Math.round(lastDecision.confidence * 100)}%
            </span>
          </div>
        )}

        {/* Ver Estado Actual button */}
        <button
          onClick={() => setShowStateModal(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors"
        >
          <Activity className="h-3 w-3" />
          {t('botAnalysis.viewCurrentState')}
        </button>
      </div>

      {showStateModal && (
        <AgentCurrentStateModal
          config={config}
          lastDecision={lastDecision}
          onClose={() => setShowStateModal(false)}
        />
      )}
    </>
  );
}

function NextDecisionBanner({
  configs,
  agentStatuses,
  decisions,
}: {
  configs: TradingConfig[];
  agentStatuses: AgentStatus[];
  decisions: AgentDecision[];
}) {
  const { t } = useTranslation();
  const runningConfigs = configs.filter((c) =>
    agentStatuses.some(
      (s) => s.asset === c.asset && s.pair === c.pair && s.isRunning,
    ),
  );

  if (runningConfigs.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Timer className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wide text-foreground/80">
          {t('botAnalysis.nextDecisionTitle')}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {t('botAnalysis.inputAgentRunning', { count: runningConfigs.length })}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {runningConfigs.map((cfg) => {
          const lastDec =
            decisions.find(
              (d) =>
                d.asset === cfg.asset &&
                d.pair === cfg.pair &&
                (d.configId === cfg.id || !d.configId),
            ) ?? null;
          const status = agentStatuses.find(
            (s) => s.asset === cfg.asset && s.pair === cfg.pair && s.isRunning,
          );
          return (
            <AgentCountdownCard
              key={cfg.id}
              config={cfg}
              lastDecision={lastDec}
              nextRunAt={status?.nextRunAt ?? null}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Agent Input Summary ───────────────────────────────────────────────────────

function AgentInputSummary({
  snapshot,
  livePrice,
  newsAnalysis,
  hasAi,
  botNewsEnabled,
  newsWeight,
  agentStatuses,
  recentDecisions,
}: {
  snapshot: MarketSnapshot;
  livePrice: number;
  newsAnalysis: NewsAnalysisData;
  hasAi: boolean;
  botNewsEnabled: boolean;
  newsWeight: number;
  agentStatuses: AgentStatus[];
  recentDecisions: AgentDecision[];
}) {
  const { t } = useTranslation();
  const { signal, score } = deriveOverallSignal(snapshot);
  const opp = deriveOpportunity(snapshot, livePrice);

  const runningAgents = agentStatuses.filter((s) => s.isRunning);

  const rows: {
    group: string;
    items: { label: string; value: string; color?: string }[];
  }[] = [
    {
      group: t('botAnalysis.inputGroupPrice'),
      items: [
        {
          label: t('botAnalysis.inputCurrentPrice'),
          value: `$${fmtPrice(livePrice)}`,
        },
        {
          label: t('botAnalysis.inputChange24h'),
          value: `${snapshot.change24h >= 0 ? '+' : ''}${snapshot.change24h.toFixed(2)}%`,
          color: snapshot.change24h >= 0 ? 'text-emerald-400' : 'text-red-400',
        },
        {
          label: t('botAnalysis.inputTechSignal'),
          value: `${signal} (${score > 0 ? '+' : ''}${score}/8)`,
          color:
            signal === 'BUY'
              ? 'text-emerald-400'
              : signal === 'SELL'
                ? 'text-red-400'
                : signal === 'HOLD'
                  ? 'text-sky-400'
                  : 'text-amber-400',
        },
      ],
    },
    {
      group: t('botAnalysis.inputGroupIndicators'),
      items: [
        {
          label: 'RSI',
          value: `${fmt(snapshot.rsi.value, 1)} — ${snapshot.rsi.signal}`,
        },
        {
          label: 'MACD',
          value: `${snapshot.macd.crossover} · hist ${fmt(snapshot.macd.histogram, 2)}`,
        },
        {
          label: 'EMA',
          value: `${snapshot.emaCross.trend} (9>${snapshot.emaCross.ema9 > snapshot.emaCross.ema21 ? '' : '!>'}21)`,
        },
        {
          label: 'Bollinger',
          value: `${snapshot.bollingerBands.position} (BW: ${fmt(snapshot.bollingerBands.bandwidth, 0)})`,
        },
        {
          label: t('botAnalysis.inputVolume'),
          value: `${snapshot.volume.signal} (×${fmt(snapshot.volume.ratio, 2)})`,
        },
        {
          label: t('botAnalysis.inputSupportResistance'),
          value: `S: $${fmtPrice(snapshot.supportResistance.support[0] ?? 0)} / R: $${fmtPrice(snapshot.supportResistance.resistance[0] ?? 0)}`,
        },
      ],
    },
    {
      group: t('botAnalysis.inputGroupNews'),
      items: botNewsEnabled
        ? [
            {
              label: t('botAnalysis.inputNewsEnabled'),
              value: t('botAnalysis.inputNewsEnabledYes', {
                weight: newsWeight,
              }),
              color: 'text-emerald-400',
            },
            {
              label: t('botAnalysis.inputAnalysisMethod'),
              value: hasAi ? '✦ IA' : '⊟ Keyword',
              color: hasAi ? 'text-violet-400' : 'text-sky-400',
            },
            {
              label: t('botAnalysis.inputNewsSentiment'),
              value: `${newsAnalysis.overall} (score ${Number(newsAnalysis.score) >= 0 ? '+' : ''}${typeof newsAnalysis.score === 'number' ? newsAnalysis.score.toFixed(2) : newsAnalysis.score})`,
              color:
                newsAnalysis.overall === 'POSITIVE'
                  ? 'text-emerald-400'
                  : newsAnalysis.overall === 'NEGATIVE'
                    ? 'text-red-400'
                    : 'text-amber-400',
            },
            {
              label: t('botAnalysis.inputNewsDistribution'),
              value: `${newsAnalysis.positive}↑ / ${newsAnalysis.neutral}→ / ${newsAnalysis.negative}↓`,
            },
          ]
        : [
            {
              label: t('botAnalysis.inputNewsEnabled'),
              value: t('botAnalysis.inputNewsEnabledNo'),
              color: 'text-muted-foreground',
            },
          ],
    },
    {
      group: t('botAnalysis.inputGroupHistory'),
      items:
        recentDecisions.slice(0, 5).length > 0
          ? recentDecisions.slice(0, 5).map((d) => ({
              label: new Date(d.createdAt).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              }),
              value: `${d.decision} ${Math.round(d.confidence * 100)}%`,
              color:
                d.decision === 'BUY'
                  ? 'text-emerald-400'
                  : d.decision === 'SELL'
                    ? 'text-red-400'
                    : d.decision === 'HOLD'
                      ? 'text-sky-400'
                      : 'text-amber-400',
            }))
          : [{ label: t('botAnalysis.inputHistoryEmpty'), value: '—' }],
    },
  ];

  const GROUP_META: Record<
    string,
    { icon: React.ElementType; accent: string; bar: string }
  > = {
    [t('botAnalysis.inputGroupPrice')]: {
      icon: Cpu,
      accent: 'text-primary',
      bar: 'bg-primary',
    },
    [t('botAnalysis.inputGroupIndicators')]: {
      icon: Activity,
      accent: 'text-violet-400',
      bar: 'bg-violet-500',
    },
    [t('botAnalysis.inputGroupNews')]: {
      icon: Newspaper,
      accent: 'text-sky-400',
      bar: 'bg-sky-500',
    },
    [t('botAnalysis.inputGroupConfig')]: {
      icon: Layers,
      accent: 'text-amber-400',
      bar: 'bg-amber-500',
    },
    [t('botAnalysis.inputGroupHistory')]: {
      icon: HistoryIcon,
      accent: 'text-rose-400',
      bar: 'bg-rose-500',
    },
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden analysis-section">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/20">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
          <ListChecks className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wide text-foreground/80">
            {t('botAnalysis.inputSummaryTitle')}
          </span>
          <span className="text-[10px] text-muted-foreground/50 leading-tight">
            {t('botAnalysis.inputSummarySubtitle')}
          </span>
        </div>
        {runningAgents.length > 0 && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[10px] font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {t('botAnalysis.inputAgentRunning', {
              count: runningAgents.length,
            })}
          </span>
        )}
      </div>

      {/* Groups grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/30">
        {rows.map((group) => {
          const meta = GROUP_META[group.group] ?? {
            icon: Layers,
            accent: 'text-muted-foreground',
            bar: 'bg-muted',
          };
          const GroupIcon = meta.icon;
          return (
            <div key={group.group} className="p-4 flex flex-col gap-3">
              {/* Group header */}
              <div className="flex items-center gap-2">
                <div
                  className={cn('h-4 w-0.5 rounded-full opacity-70', meta.bar)}
                />
                <GroupIcon className={cn('h-3 w-3', meta.accent)} />
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-wider',
                    meta.accent,
                  )}
                >
                  {group.group}
                </span>
              </div>

              {/* Items */}
              <div className="space-y-2.5">
                {group.items.map((item, idx) => (
                  <div
                    key={`${item.label}-${idx}`}
                    className="flex items-start justify-between gap-3"
                  >
                    <span className="text-[11px] text-muted-foreground/60 shrink-0 leading-tight">
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        'text-[11px] font-semibold text-right font-mono leading-tight',
                        item.color ?? 'text-foreground/85',
                      )}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Risk zone footer */}
      {(opp.warnings.length > 0 || opp.action !== 'WAIT') && (
        <div className="px-5 py-3 border-t border-border/40 bg-muted/10 flex flex-wrap gap-2 items-center">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold mr-1">
            {t('botAnalysis.inputRiskZone')}
          </span>
          {opp.action !== 'WAIT' && (
            <>
              <span className="rounded-full bg-muted/40 border border-border/50 px-2.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                Entry ${fmtPrice(opp.entryPrice)}
              </span>
              <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 text-[10px] font-mono text-red-400">
                SL ${fmtPrice(opp.stopLoss)}
              </span>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-mono text-emerald-400">
                TP ${fmtPrice(opp.takeProfit)}
              </span>
            </>
          )}
          {opp.warnings.map((w, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[10px] text-amber-400"
            >
              <span className="text-amber-500">⚠</span> {w}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// helper type to pass computed news values
interface NewsAnalysisData {
  positive: number;
  negative: number;
  neutral: number;
  score: number | string;
  overall: string;
}

// ── Combined Score Banner ─────────────────────────────────────────────────────

function CombinedScoreBanner({
  techSignal,
  techScore,
  sentimentScore,
  lastDecision,
}: {
  techSignal: OverallSignal;
  techScore: number;
  sentimentScore: number;
  lastDecision: AgentDecision | null;
}) {
  const { t } = useTranslation();
  const timeAgo = useTimeAgo();

  const sentimentLabel =
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

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatusCard
        icon={Activity}
        label={t('botAnalysis.techSignal')}
        value={t(`botAnalysis.signal${techSignal}` as Parameters<typeof t>[0])}
        sub={t('botAnalysis.scoreOf', {
          score: `${techScore > 0 ? '+' : ''}${techScore}`,
        })}
        valueColor={SIGNAL_COLOR[techSignal]}
        bg={SIGNAL_BG[techSignal]}
      />
      <StatusCard
        icon={Newspaper}
        label={t('botAnalysis.newsSentiment')}
        value={sentimentLabel}
        sub={t('botAnalysis.sentimentScoreLabel', {
          score: `${sentimentScore > 0 ? '+' : ''}${sentimentScore}`,
        })}
        valueColor={sentimentColor}
        bg={
          sentimentScore > 15
            ? 'bg-emerald-500/10 border-emerald-500/25'
            : sentimentScore < -15
              ? 'bg-red-500/10 border-red-500/25'
              : 'bg-amber-500/10 border-amber-500/25'
        }
      />
      <StatusCard
        icon={Bot}
        label={t('botAnalysis.lastDecision')}
        value={
          lastDecision
            ? `${lastDecision.decision} · ${Math.round(lastDecision.confidence * 100)}%`
            : t('botAnalysis.noData')
        }
        sub={
          lastDecision
            ? `${lastDecision.asset}/${lastDecision.pair} — ${timeAgo(lastDecision.createdAt)}`
            : t('botAnalysis.startAgent')
        }
        valueColor={
          lastDecision
            ? (DECISION_COLOR[lastDecision.decision] ?? 'text-muted-foreground')
            : 'text-muted-foreground'
        }
        bg={
          lastDecision
            ? `${DECISION_BG[lastDecision.decision] ?? 'bg-muted/20'} border-border`
            : 'bg-muted/10 border-border'
        }
      />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

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
  const pageHasAi = !!(
    pageAnalysis?.aiAnalyzedAt &&
    Date.now() - new Date(pageAnalysis.aiAnalyzedAt).getTime() < AI_VALID_MS
  );
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
        <div className="flex rounded-lg border border-border bg-muted/30 overflow-hidden text-xs font-semibold">
          {MARKET_SYMBOLS.map((m) => (
            <button
              key={m.symbol}
              onClick={() => setSymbol(m.symbol)}
              className={cn(
                'px-3 py-2 transition-colors',
                symbol === m.symbol
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
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
            <NewsSentimentPanel news={newsItems} />
          </div>
          <AgentInputSummary
            snapshot={snapshot}
            livePrice={livePrice}
            newsAnalysis={newsAnalysisData}
            hasAi={pageHasAi}
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
