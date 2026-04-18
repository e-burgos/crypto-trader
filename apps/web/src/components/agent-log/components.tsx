import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  MessageSquare,
  TrendingDown,
  Minus,
  ShoppingCart,
  Target,
  ChevronDown,
  ChevronUp,
  X,
  Cpu,
  Settings2,
  BarChart3,
  Newspaper,
  TrendingUp,
  Zap,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  type AgentDecision,
  type AgentDecisionIndicators,
} from '../../hooks/use-analytics';
import { useCountdown } from '../bot-analysis';

// ── Color maps ────────────────────────────────────────────────────────────────

export const DECISION_COLOR: Record<string, string> = {
  BUY: 'text-emerald-500',
  SELL: 'text-red-500',
  HOLD: 'text-amber-500',
  CLOSE: 'text-blue-500',
};

export const DECISION_BG: Record<string, string> = {
  BUY: 'bg-emerald-500/10',
  SELL: 'bg-red-500/10',
  HOLD: 'bg-amber-500/10',
  CLOSE: 'bg-blue-500/10',
};

export const DECISION_BORDER: Record<string, string> = {
  BUY: 'border-emerald-500/20',
  SELL: 'border-red-500/20',
  HOLD: 'border-amber-500/20',
  CLOSE: 'border-blue-500/20',
};

export const DECISION_ICON: Record<string, typeof TrendingDown> = {
  BUY: ShoppingCart,
  SELL: TrendingDown,
  CLOSE: Target,
  HOLD: Minus,
};

export type DecisionFilter = 'ALL' | 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
export type AssetFilter = 'ALL' | string;
export type AgentFilter = 'ALL' | string;
export const DECISION_FILTERS: DecisionFilter[] = [
  'ALL',
  'BUY',
  'SELL',
  'HOLD',
  'CLOSE',
];

// ── Confidence Bar ────────────────────────────────────────────────────────────

export function ConfidenceBar({
  value,
  color,
}: {
  value: number;
  color: string;
}) {
  const { t } = useTranslation();
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {t('botAnalysis.confidence')}
        </span>
        <span className={cn('text-sm font-bold tabular-nums', color)}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            pct >= 70
              ? 'bg-emerald-500'
              : pct >= 50
                ? 'bg-amber-500'
                : 'bg-red-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Indicator Panel ───────────────────────────────────────────────────────────

export function IndicatorPanel({
  indicators,
}: {
  indicators: AgentDecisionIndicators;
}) {
  const rows = [
    {
      label: 'RSI',
      value: indicators.rsi?.value?.toFixed(1) ?? '—',
      sub: indicators.rsi?.signal,
    },
    {
      label: 'MACD',
      value: indicators.macd?.macd?.toFixed(4) ?? '—',
      sub: indicators.macd?.crossover,
    },
    { label: 'EMA9', value: indicators.emaCross?.ema9?.toFixed(2) ?? '—' },
    { label: 'EMA21', value: indicators.emaCross?.ema21?.toFixed(2) ?? '—' },
    {
      label: 'BB Upper',
      value: indicators.bollingerBands?.upper?.toFixed(2) ?? '—',
    },
    {
      label: 'BB Lower',
      value: indicators.bollingerBands?.lower?.toFixed(2) ?? '—',
    },
    {
      label: 'Volume',
      value: indicators.volume?.current?.toFixed(0) ?? '—',
      sub: indicators.volume?.signal,
    },
  ];
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
      <div className="mb-2 flex items-center gap-1.5">
        <ListChecks className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Indicators
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-2"
          >
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-mono font-semibold tabular-nums">
              {r.value}
              {r.sub && (
                <span className="ml-1 text-muted-foreground font-normal">
                  ({r.sub})
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── News Headlines Panel ──────────────────────────────────────────────────────

export const SENTIMENT_COLOR: Record<string, string> = {
  POSITIVE: 'text-emerald-400',
  NEGATIVE: 'text-red-400',
  NEUTRAL: 'text-muted-foreground',
};

export function NewsHeadlinesPanel({
  headlines,
}: {
  headlines: Array<{ headline: string; sentiment: string; source?: string }>;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
      <div className="mb-2 flex items-center gap-1.5">
        <MessageSquare className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          News context
        </span>
      </div>
      <div className="space-y-1.5">
        {headlines.map((h, i) => (
          <div key={i} className="flex items-start gap-2">
            <span
              className={cn(
                'mt-0.5 shrink-0 text-[10px] font-bold uppercase',
                SENTIMENT_COLOR[h.sentiment] ?? 'text-muted-foreground',
              )}
            >
              {h.sentiment.slice(0, 3)}
            </span>
            <p className="text-[11px] leading-snug text-foreground/80">
              {h.headline}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Agent Decision Card ───────────────────────────────────────────────────────

export function AgentDecisionCard({
  decision,
  isLast,
  isFirst = false,
  onOpenDetail,
}: {
  decision: AgentDecision;
  isLast: boolean;
  isFirst?: boolean;
  onOpenDetail: (d: AgentDecision) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const color = DECISION_COLOR[decision.decision] ?? 'text-amber-500';
  const bg = DECISION_BG[decision.decision] ?? 'bg-amber-500/10';
  const border = DECISION_BORDER[decision.decision] ?? 'border-amber-500/20';
  const Icon = DECISION_ICON[decision.decision] ?? Minus;
  const hasExtra = !!(decision.indicators || decision.newsHeadlines?.length);

  const nextDecisionTargetMs = useMemo(() => {
    if (!isFirst || !decision.waitMinutes || decision.waitMinutes <= 0)
      return null;
    return (
      new Date(decision.createdAt).getTime() + decision.waitMinutes * 60_000
    );
  }, [isFirst, decision.createdAt, decision.waitMinutes]);

  const countdown = useCountdown(nextDecisionTargetMs);

  return (
    <div className="decision-card relative flex gap-4">
      {/* Timeline spine */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm',
            bg,
            color,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        {!isLast && (
          <div className="mt-1 w-px flex-1 bg-border/60 min-h-[1rem]" />
        )}
      </div>

      {/* Card */}
      <div
        className={cn(
          'mb-4 flex-1 rounded-xl border bg-card overflow-hidden',
          border,
        )}
      >
        <div
          className={cn(
            'flex items-center justify-between px-4 py-2.5',
            bg.replace('/10', '/5'),
          )}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'text-xs font-bold uppercase tracking-wider',
                color,
              )}
            >
              {decision.decision}
            </span>
            <span className="text-sm font-bold text-foreground">
              {decision.asset} / {decision.pair}
            </span>
            {decision.configName && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {decision.configName}
              </span>
            )}
            {decision.mode && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-semibold',
                  decision.mode === 'SANDBOX'
                    ? 'bg-muted text-muted-foreground'
                    : decision.mode === 'TESTNET'
                      ? 'bg-sky-500/10 text-sky-400'
                      : 'bg-red-500/10 text-red-400',
                )}
              >
                {decision.mode}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {new Date(decision.createdAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">
          <ConfidenceBar value={decision.confidence} color={color} />

          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t('botAnalysis.justification')}
              </span>
            </div>
            <p className="text-[12px] leading-relaxed text-foreground/85">
              {decision.reasoning}
            </p>
          </div>

          {decision.waitMinutes && decision.waitMinutes > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">
                  {t('botAnalysis.waitMinutes', {
                    count: decision.waitMinutes,
                  })}
                </span>
              </div>
              {countdown !== null ? (
                <span className="font-mono text-xs font-bold text-primary tabular-nums">
                  {countdown}
                </span>
              ) : isFirst && decision.waitMinutes > 0 ? (
                <span className="text-[10px] text-emerald-400 font-semibold">
                  Ready
                </span>
              ) : null}
            </div>
          )}

          {hasExtra && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-[11px] font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Filter className="h-3 w-3" />
                {expanded ? 'Hide details' : 'Show indicator snapshot & news'}
              </div>
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          {/* Ver detalle completo */}
          <button
            onClick={() => onOpenDetail(decision)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/50 bg-primary/5 px-3 py-2 text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Ver detalle completo
          </button>

          {expanded && decision.indicators && (
            <IndicatorPanel indicators={decision.indicators} />
          )}
          {expanded &&
            decision.newsHeadlines &&
            decision.newsHeadlines.length > 0 && (
              <NewsHeadlinesPanel headlines={decision.newsHeadlines} />
            )}
        </div>
      </div>
    </div>
  );
}

// ── Decision Detail Modal ─────────────────────────────────────────────────────

export type ModalTab = 'input' | 'output' | 'config' | 'provider';
export const MODAL_TABS: { id: ModalTab; label: string; icon: typeof Cpu }[] = [
  { id: 'input', label: 'Entrada', icon: BarChart3 },
  { id: 'output', label: 'Salida', icon: TrendingUp },
  { id: 'config', label: 'Config Bot', icon: Settings2 },
  { id: 'provider', label: 'Proveedor', icon: Cpu },
];

export function DetailRow({
  label,
  value,
  mono = false,
  accent,
}: {
  label: string;
  value: React.ReactNode;
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

export function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: typeof Cpu;
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

export function DecisionDetailModal({
  decision,
  onClose,
}: {
  decision: AgentDecision;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<ModalTab>('input');
  const color = DECISION_COLOR[decision.decision] ?? 'text-amber-500';
  const bg = DECISION_BG[decision.decision] ?? 'bg-amber-500/10';
  const border = DECISION_BORDER[decision.decision] ?? 'border-amber-500/20';
  const Icon = DECISION_ICON[decision.decision] ?? Minus;
  const cfg = decision.configDetails;

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ind = decision.indicators;
  const news = decision.newsHeadlines ?? [];

  return createPortal(
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Sheet */}
      <div className="relative w-full sm:max-w-xl max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className={cn(
            'flex items-center justify-between px-4 py-3 shrink-0',
            bg.replace('/10', '/8'),
          )}
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full',
                bg,
                color,
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-xs font-extrabold uppercase tracking-wider',
                    color,
                  )}
                >
                  {decision.decision}
                </span>
                <span className="text-sm font-bold text-foreground">
                  {decision.asset}/{decision.pair}
                </span>
                {decision.mode && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold',
                      decision.mode === 'SANDBOX'
                        ? 'bg-muted text-muted-foreground'
                        : decision.mode === 'TESTNET'
                          ? 'bg-sky-500/10 text-sky-400'
                          : 'bg-red-500/10 text-red-400',
                    )}
                  >
                    {decision.mode}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {new Date(decision.createdAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
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
          {MODAL_TABS.map(({ id, label, icon: TabIcon }) => (
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
          {/* ── INPUT TAB ── */}
          {tab === 'input' && (
            <>
              {/* Market snapshot */}
              {ind && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <SectionTitle icon={BarChart3} title="Snapshot de mercado" />
                  <div className="space-y-0">
                    {ind.rsi && (
                      <>
                        <DetailRow
                          label="RSI"
                          value={ind.rsi.value.toFixed(2)}
                          mono
                        />
                        <DetailRow label="RSI Signal" value={ind.rsi.signal} />
                      </>
                    )}
                    {ind.macd && (
                      <>
                        <DetailRow
                          label="MACD"
                          value={ind.macd.macd.toFixed(5)}
                          mono
                        />
                        <DetailRow
                          label="MACD Signal"
                          value={ind.macd.signal.toFixed(5)}
                          mono
                        />
                        <DetailRow
                          label="MACD Histogram"
                          value={ind.macd.histogram.toFixed(5)}
                          mono
                        />
                        <DetailRow
                          label="MACD Crossover"
                          value={ind.macd.crossover}
                        />
                      </>
                    )}
                    {ind.emaCross && (
                      <>
                        <DetailRow
                          label="EMA 9"
                          value={ind.emaCross.ema9.toFixed(4)}
                          mono
                        />
                        <DetailRow
                          label="EMA 21"
                          value={ind.emaCross.ema21.toFixed(4)}
                          mono
                        />
                        <DetailRow
                          label="EMA 200"
                          value={ind.emaCross.ema200.toFixed(4)}
                          mono
                        />
                        <DetailRow
                          label="EMA Trend"
                          value={ind.emaCross.trend}
                        />
                      </>
                    )}
                    {ind.bollingerBands && (
                      <>
                        <DetailRow
                          label="BB Upper"
                          value={ind.bollingerBands.upper.toFixed(4)}
                          mono
                        />
                        <DetailRow
                          label="BB Middle"
                          value={ind.bollingerBands.middle.toFixed(4)}
                          mono
                        />
                        <DetailRow
                          label="BB Lower"
                          value={ind.bollingerBands.lower.toFixed(4)}
                          mono
                        />
                        <DetailRow
                          label="BB Bandwidth"
                          value={ind.bollingerBands.bandwidth.toFixed(4)}
                          mono
                        />
                        <DetailRow
                          label="BB Position"
                          value={ind.bollingerBands.position}
                        />
                      </>
                    )}
                    {ind.volume && (
                      <>
                        <DetailRow
                          label="Volume (actual)"
                          value={ind.volume.current.toFixed(0)}
                          mono
                        />
                        <DetailRow
                          label="Volume (promedio)"
                          value={ind.volume.average.toFixed(0)}
                          mono
                        />
                        <DetailRow
                          label="Volume Ratio"
                          value={ind.volume.ratio.toFixed(3)}
                          mono
                        />
                        <DetailRow
                          label="Volume Signal"
                          value={ind.volume.signal}
                        />
                      </>
                    )}
                    {ind.supportResistance && (
                      <>
                        <DetailRow
                          label="Soportes"
                          value={
                            ind.supportResistance.support
                              .map((s) => s.toFixed(2))
                              .join(' · ') || '—'
                          }
                          mono
                        />
                        <DetailRow
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
              )}

              {/* News context */}
              {news.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <SectionTitle icon={Newspaper} title="Noticias procesadas" />
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
              )}

              {!ind && news.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-[12px] text-muted-foreground">
                  Sin datos de entrada almacenados para esta decisión.
                </div>
              )}
            </>
          )}

          {/* ── OUTPUT TAB ── */}
          {tab === 'output' && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <SectionTitle
                icon={TrendingUp}
                title="Resultado de la decisión"
              />
              <div className="mb-4">
                <div
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl px-4 py-2',
                    bg,
                    border,
                    'border',
                  )}
                >
                  <Icon className={cn('h-5 w-5', color)} />
                  <span
                    className={cn(
                      'text-base font-extrabold uppercase tracking-wide',
                      color,
                    )}
                  >
                    {decision.decision}
                  </span>
                </div>
              </div>
              <div className="space-y-0 mb-4">
                <DetailRow
                  label="Confianza"
                  value={`${Math.round(decision.confidence * 100)}%`}
                  mono
                  accent={
                    decision.confidence >= 0.7
                      ? 'text-emerald-400'
                      : decision.confidence >= 0.5
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }
                />
                {decision.waitMinutes != null && decision.waitMinutes > 0 && (
                  <DetailRow
                    label="Espera sugerida"
                    value={`${decision.waitMinutes} min`}
                    mono
                  />
                )}
                <DetailRow
                  label="Generada el"
                  value={new Date(decision.createdAt).toLocaleString(
                    undefined,
                    {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    },
                  )}
                />
                {decision.configName && (
                  <DetailRow label="Agente" value={decision.configName} />
                )}
                {decision.mode && (
                  <DetailRow label="Modo" value={decision.mode} />
                )}
              </div>

              {/* Confidence bar detail */}
              <div className="rounded-lg border border-border/50 bg-card p-3">
                <SectionTitle icon={Zap} title="Justificación LLM" />
                <p className="text-[12px] leading-relaxed text-foreground/85 whitespace-pre-wrap">
                  {decision.reasoning}
                </p>
              </div>
            </div>
          )}

          {/* ── CONFIG TAB ── */}
          {tab === 'config' && (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <SectionTitle icon={ShieldCheck} title="Modo de operación" />
                <div className="space-y-0">
                  <DetailRow label="Modo" value={decision.mode ?? '—'} />
                  <DetailRow
                    label="Par"
                    value={`${decision.asset}/${decision.pair}`}
                  />
                  {decision.configName && (
                    <DetailRow
                      label="Nombre del bot"
                      value={decision.configName}
                    />
                  )}
                  {decision.configId && (
                    <DetailRow
                      label="Config ID"
                      value={decision.configId.slice(0, 16) + '…'}
                      mono
                    />
                  )}
                </div>
              </div>

              {cfg ? (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <SectionTitle icon={Settings2} title="Parámetros del bot" />
                  <div className="space-y-0">
                    <DetailRow
                      label="Umbral compra"
                      value={`${cfg.buyThreshold}%`}
                      mono
                    />
                    <DetailRow
                      label="Umbral venta"
                      value={`${cfg.sellThreshold}%`}
                      mono
                    />
                    <DetailRow
                      label="Stop Loss"
                      value={`${(cfg.stopLossPct * 100).toFixed(2)}%`}
                      mono
                    />
                    <DetailRow
                      label="Take Profit"
                      value={`${(cfg.takeProfitPct * 100).toFixed(2)}%`}
                      mono
                    />
                    <DetailRow
                      label="Beneficio mínimo"
                      value={`${(cfg.minProfitPct * 100).toFixed(2)}%`}
                      mono
                    />
                    <DetailRow
                      label="Max. capital / operación"
                      value={`${(cfg.maxTradePct * 100).toFixed(0)}%`}
                      mono
                    />
                    <DetailRow
                      label="Posiciones simultáneas"
                      value={String(cfg.maxConcurrentPositions)}
                      mono
                    />
                    <DetailRow
                      label="Intervalo mínimo"
                      value={`${cfg.minIntervalMinutes} min`}
                      mono
                    />
                    <DetailRow
                      label="Modo intervalo"
                      value={cfg.intervalMode}
                    />
                    {cfg.orderPriceOffsetPct !== 0 && (
                      <DetailRow
                        label="Offset precio orden"
                        value={`${(cfg.orderPriceOffsetPct * 100).toFixed(2)}%`}
                        mono
                      />
                    )}
                    <DetailRow
                      label="Estado"
                      value={cfg.isRunning ? 'Activo' : 'Detenido'}
                      accent={
                        cfg.isRunning
                          ? 'text-emerald-400'
                          : 'text-muted-foreground'
                      }
                    />
                    <DetailRow
                      label="Config creada"
                      value={new Date(cfg.createdAt).toLocaleDateString()}
                    />
                    <DetailRow
                      label="Última actualización"
                      value={new Date(cfg.updatedAt).toLocaleDateString()}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-[12px] text-muted-foreground">
                  Configuración del bot no disponible para esta decisión.
                </div>
              )}
            </>
          )}

          {/* ── PROVIDER TAB ── */}
          {tab === 'provider' && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <SectionTitle icon={Cpu} title="Proveedor LLM activo" />
              {decision.llmProvider || decision.llmModel ? (
                <div className="space-y-0">
                  {decision.llmProvider && (
                    <DetailRow label="Proveedor" value={decision.llmProvider} />
                  )}
                  {decision.llmModel && (
                    <DetailRow label="Modelo" value={decision.llmModel} mono />
                  )}
                  <DetailRow
                    label="Procesada"
                    value={new Date(decision.createdAt).toLocaleString(
                      undefined,
                      {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      },
                    )}
                  />
                </div>
              ) : (
                <div className="space-y-0">
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    El proveedor y modelo LLM corresponden al configurado
                    activamente en tu cuenta al momento de ejecutar esta
                    decisión.
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ExternalLink className="h-3 w-3" />
                    <span>
                      Configura tu proveedor LLM en Ajustes → Integraciones.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-4 py-3 flex items-center justify-between bg-muted/10">
          <span className="text-[10px] text-muted-foreground font-mono">
            ID: {decision.id.slice(0, 20)}…
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

// ── Page ──────────────────────────────────────────────────────────────────────
