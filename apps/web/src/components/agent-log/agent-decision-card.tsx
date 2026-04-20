import { useState, useMemo } from 'react';
import {
  Clock,
  MessageSquare,
  Minus,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { type AgentDecision } from '../../hooks/use-analytics';
import { useCountdown } from '../bot-analysis';
import {
  DECISION_COLOR,
  DECISION_BG,
  DECISION_BORDER,
  DECISION_ICON,
} from './constants';
import { ConfidenceBar } from './confidence-bar';
import { IndicatorPanel } from './indicator-panel';
import { NewsHeadlinesPanel } from './news-headlines-panel';

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
                {expanded
                  ? t('agentLog.hideDetails')
                  : t('agentLog.showDetails')}
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
