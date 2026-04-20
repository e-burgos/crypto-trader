import { useState, useMemo, useCallback } from 'react';
import { Bot, Activity, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import type { TradingConfig, AgentStatus } from '../../hooks/use-trading';
import type { AgentDecision } from '../../hooks/use-analytics';
import { useCountdown } from './helpers';
import { AgentCurrentStateModal } from './agent-state-modal';

export function AgentCountdownCard({
  config,
  lastDecision,
  nextRunAt: serverNextRunAt,
}: {
  config: TradingConfig;
  lastDecision: AgentDecision | null;
  nextRunAt: number | null;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

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

  const handleViewState = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['analytics', 'decisions'] });
    queryClient.invalidateQueries({ queryKey: ['trading', 'status'] });
    setShowStateModal(true);
  }, [queryClient]);

  const modeColor =
    config.mode === 'TESTNET'
      ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
      : config.mode === 'SANDBOX'
        ? 'text-muted-foreground bg-muted/30 border-border'
        : 'text-red-400 bg-red-500/10 border-red-500/20';

  return (
    <>
      <div className="min-w-0 rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
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

        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-1000',
              isPast ? 'bg-emerald-400' : 'bg-primary',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

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

        <button
          onClick={handleViewState}
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

export function NextDecisionBanner({
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
