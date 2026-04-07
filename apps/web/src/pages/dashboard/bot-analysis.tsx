import { useState, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  Brain,
  TrendingDown,
  Minus,
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Zap,
  Bot,
  Newspaper,
  Activity,
  ShoppingCart,
  ShieldAlert,
  Target,
  ChevronRight,
  CircleDot,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useMarketSnapshot,
  deriveOpportunity,
  deriveOverallSignal,
  useMarketNews,
  MARKET_SYMBOLS,
  type OverallSignal,
  type MarketSnapshot,
  type NewsItem,
} from '../../hooks/use-market';
import {
  useAgentDecisions,
  type AgentDecision,
} from '../../hooks/use-analytics';
import { useBinanceTicker } from '../../hooks/use-binance-ticker';

gsap.registerPlugin(useGSAP);

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const SIGNAL_LABEL: Record<OverallSignal, string> = {
  BUY: 'COMPRAR',
  SELL: 'VENDER',
  HOLD: 'MANTENER',
  NEUTRAL: 'NEUTRAL',
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
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

// ── Technical Summary ─────────────────────────────────────────────────────────

function TechnicalSummary({
  snapshot,
  livePrice,
}: {
  snapshot: MarketSnapshot;
  livePrice: number;
}) {
  const { signal, score, reasons } = deriveOverallSignal(snapshot);
  const opp = deriveOpportunity(snapshot, livePrice);
  const cfg = { color: SIGNAL_COLOR[signal], bg: SIGNAL_BG[signal] };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Análisis Técnico
        </span>
        <span
          className={cn(
            'ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold border',
            cfg.color,
            cfg.bg,
          )}
        >
          <Zap className="h-3 w-3" />
          {SIGNAL_LABEL[signal]}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Score bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Puntaje de confluencia
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

        {/* Indicator checklist */}
        <div className="space-y-1.5">
          {opp.checks.map((check) => (
            <div
              key={check.label}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs',
                check.ok
                  ? 'bg-emerald-500/8 border border-emerald-500/15'
                  : 'bg-red-500/8 border border-red-500/15',
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
                  fuerte
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Price levels (only for BUY/SELL) */}
        {opp.action !== 'WAIT' && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="rounded-lg bg-muted/30 border border-border/40 px-2 py-2 text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5">
                Entrada
              </p>
              <p className="text-xs font-bold font-mono">
                $
                {opp.entryPrice.toLocaleString('en-US', {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
            <div className="rounded-lg bg-red-500/8 border border-red-500/15 px-2 py-2 text-center">
              <p className="text-[10px] text-red-400/70 mb-0.5">Stop Loss</p>
              <p className="text-xs font-bold font-mono text-red-400">
                $
                {opp.stopLoss.toLocaleString('en-US', {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
            <div className="rounded-lg bg-emerald-500/8 border border-emerald-500/15 px-2 py-2 text-center">
              <p className="text-[10px] text-emerald-400/70 mb-0.5">
                Take Profit
              </p>
              <p className="text-xs font-bold font-mono text-emerald-400">
                $
                {opp.takeProfit.toLocaleString('en-US', {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
          </div>
        )}

        {/* Warnings */}
        {opp.warnings.length > 0 && (
          <div className="space-y-1">
            {opp.warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg bg-amber-500/8 border border-amber-500/15 px-3 py-1.5"
              >
                <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
                <span className="text-[11px] text-amber-300/80">{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Reasons */}
        {reasons.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Factores detectados
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

function NewsSentimentPanel({ news }: { news: NewsItem[] }) {
  const positive = news.filter((n) => n.sentiment === 'POSITIVE').length;
  const negative = news.filter((n) => n.sentiment === 'NEGATIVE').length;
  const neutral = news.filter((n) => n.sentiment === 'NEUTRAL').length;
  const total = news.length;
  const sentimentScore =
    total > 0 ? Math.round(((positive - negative) / total) * 100) : 0;
  const overallSentiment =
    sentimentScore > 15
      ? 'Alcista'
      : sentimentScore < -15
        ? 'Bajista'
        : 'Neutral';
  const sentimentColor =
    sentimentScore > 15
      ? 'text-emerald-400'
      : sentimentScore < -15
        ? 'text-red-400'
        : 'text-amber-400';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
        <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sentimiento de Noticias
        </span>
        {total > 0 && (
          <span className={cn('ml-auto text-xs font-bold', sentimentColor)}>
            {overallSentiment}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Sentiment bar */}
        {total > 0 && (
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
              <span className="text-emerald-400 font-semibold">
                {positive} positivas
              </span>
              <span className="text-amber-400">{neutral} neutras</span>
              <span className="text-red-400 font-semibold">
                {negative} negativas
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(positive / total) * 100}%` }}
              />
              <div
                className="h-full bg-amber-500/60 transition-all"
                style={{ width: `${(neutral / total) * 100}%` }}
              />
              <div
                className="h-full bg-red-500 transition-all"
                style={{ width: `${(negative / total) * 100}%` }}
              />
            </div>
            <div className="mt-1 text-right">
              <span className={cn('text-[11px] font-bold', sentimentColor)}>
                Score: {sentimentScore > 0 ? '+' : ''}
                {sentimentScore}
              </span>
            </div>
          </div>
        )}

        {/* Latest news list */}
        <div className="space-y-1.5">
          {news.slice(0, 6).map((item) => (
            <a
              key={item.id}
              href={item.url}
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
                        : '→'}
                    {item.sentiment}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors mt-0.5" />
            </a>
          ))}
        </div>

        {news.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Newspaper className="h-6 w-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">Cargando noticias…</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Decision History ──────────────────────────────────────────────────────────

function DecisionTimeline({ decisions }: { decisions: AgentDecision[] }) {
  if (decisions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <Bot className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Sin decisiones del agente todavía.
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Inicia un agente de trading para ver el historial de razonamiento
          aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {decisions.map((d, idx) => {
        const color = DECISION_COLOR[d.decision] ?? 'text-muted-foreground';
        const bg = DECISION_BG[d.decision] ?? 'bg-muted/20';
        const DecIcon =
          d.decision === 'BUY'
            ? ShoppingCart
            : d.decision === 'SELL'
              ? TrendingDown
              : d.decision === 'CLOSE'
                ? Target
                : Minus;

        return (
          <div key={d.id} className="decision-row flex gap-3">
            {/* Timeline */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm',
                  bg,
                  color,
                )}
              >
                <DecIcon className="h-3.5 w-3.5" />
              </div>
              {idx < decisions.length - 1 && (
                <div className="mt-1 w-px flex-1 bg-border/50 min-h-[16px]" />
              )}
            </div>

            {/* Card */}
            <div className="mb-3 flex-1 rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      'text-xs font-bold uppercase tracking-wide',
                      color,
                    )}
                  >
                    {d.decision}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {d.asset}/{d.pair}
                  </span>
                  <span
                    className={cn(
                      'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
                      bg,
                      color,
                    )}
                  >
                    <Zap className="h-2.5 w-2.5" />
                    {Math.round(d.confidence * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                  <Clock className="h-3 w-3" />
                  {timeAgo(d.createdAt)}
                </div>
              </div>

              {/* Confidence bar */}
              <div className="h-1 rounded-full bg-muted overflow-hidden mb-2.5">
                <div
                  className={cn(
                    'h-full rounded-full',
                    color.replace('text-', 'bg-'),
                  )}
                  style={{ width: `${Math.round(d.confidence * 100)}%` }}
                />
              </div>

              {/* Reasoning */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                {d.reasoning}
              </p>

              {d.waitMinutes && d.waitMinutes > 0 && (
                <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground/60">
                  <Clock className="h-3 w-3" />
                  Esperar {d.waitMinutes} min antes de la próxima acción
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
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
  // Combined score: tech (weighted 60%) + news sentiment (40%)
  const combined = Math.round(techScore * 0.6 + sentimentScore * 0.04);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {/* Technical signal */}
      <StatusCard
        icon={Activity}
        label="Señal Técnica"
        value={SIGNAL_LABEL[techSignal]}
        sub={`Score ${techScore > 0 ? '+' : ''}${techScore} de 8 indicadores`}
        valueColor={SIGNAL_COLOR[techSignal]}
        bg={SIGNAL_BG[techSignal]}
      />

      {/* News sentiment */}
      <StatusCard
        icon={Newspaper}
        label="Sentimiento Noticias"
        value={
          sentimentScore > 15
            ? 'Alcista'
            : sentimentScore < -15
              ? 'Bajista'
              : 'Neutral'
        }
        sub={`Score ${sentimentScore > 0 ? '+' : ''}${sentimentScore} en noticias recientes`}
        valueColor={
          sentimentScore > 15
            ? 'text-emerald-400'
            : sentimentScore < -15
              ? 'text-red-400'
              : 'text-amber-400'
        }
        bg={
          sentimentScore > 15
            ? 'bg-emerald-500/10 border-emerald-500/25'
            : sentimentScore < -15
              ? 'bg-red-500/10 border-red-500/25'
              : 'bg-amber-500/10 border-amber-500/25'
        }
      />

      {/* Last AI decision */}
      <StatusCard
        icon={Bot}
        label="Última Decisión IA"
        value={
          lastDecision
            ? `${lastDecision.decision} · ${Math.round(lastDecision.confidence * 100)}%`
            : 'Sin datos'
        }
        sub={
          lastDecision
            ? `${lastDecision.asset}/${lastDecision.pair} — hace ${timeAgo(lastDecision.createdAt)}`
            : 'Inicia un agente para ver datos'
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

  useGSAP(
    () => {
      gsap.fromTo(
        '.status-card',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, stagger: 0.07, duration: 0.45, ease: 'power2.out' },
      );
      gsap.fromTo(
        '.analysis-section',
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
      gsap.fromTo(
        '.decision-row',
        { opacity: 0, x: -8 },
        {
          opacity: 1,
          x: 0,
          stagger: 0.06,
          duration: 0.4,
          ease: 'power2.out',
          delay: 0.4,
        },
      );
    },
    { scope: containerRef, dependencies: [snapshot] },
  );

  const livePrice = ticker?.lastPrice ?? snapshot?.currentPrice ?? 0;

  // Compute derived values
  const techResult = snapshot ? deriveOverallSignal(snapshot) : null;
  const techSignal: OverallSignal = techResult?.signal ?? 'NEUTRAL';
  const techScore = techResult?.score ?? 0;

  const positive = newsItems.filter((n) => n.sentiment === 'POSITIVE').length;
  const negative = newsItems.filter((n) => n.sentiment === 'NEGATIVE').length;
  const total = newsItems.length;
  const sentimentScore =
    total > 0 ? Math.round(((positive - negative) / total) * 100) : 0;

  const lastDecision = decisions[0] ?? null;

  const updatedLabel = dataUpdatedAt
    ? `hace ${Math.round((Date.now() - dataUpdatedAt) / 60_000)}min`
    : '';

  return (
    <div ref={containerRef} className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Análisis del Bot
          </h1>
          <p className="text-sm text-muted-foreground">
            Razonamiento técnico, sentimiento de noticias e historial de
            decisiones de la IA
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Symbol selector */}
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

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')}
            />
            {updatedLabel || 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-10 text-center gap-3">
          <AlertCircle className="h-7 w-7 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No se pudieron cargar los datos de mercado. Verificando conexión…
          </p>
        </div>
      )}

      {/* Content (when data loaded) */}
      {snapshot && !isLoading && (
        <>
          {/* Status row */}
          <CombinedScoreBanner
            techSignal={techSignal}
            techScore={techScore}
            sentimentScore={sentimentScore}
            lastDecision={lastDecision}
          />

          {/* Main grid */}
          <div className="grid gap-4 lg:grid-cols-2 analysis-section">
            <TechnicalSummary snapshot={snapshot} livePrice={livePrice} />
            <NewsSentimentPanel news={newsItems} />
          </div>

          {/* Decision history */}
          <div className="analysis-section">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Historial de Decisiones del Agente
              </h2>
              {decisions.length > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {decisions.length} registros
                </span>
              )}
            </div>
            <DecisionTimeline decisions={decisions} />
          </div>
        </>
      )}
    </div>
  );
}
