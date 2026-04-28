import {
  Activity,
  Zap,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  BarChart2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import {
  deriveOverallSignal,
  deriveOpportunity,
  type MarketSnapshot,
} from '../../hooks/use-market';
import { SIGNAL_COLOR, SIGNAL_BG } from './constants';
import { fmtPrice } from './helpers';

export function TechnicalSummary({
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
      <div className="flex items-center flex-col sm:flex-row gap-2 px-4 py-3 border-b border-border bg-muted/20">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('botAnalysis.technicalAnalysis')}
        </span>
        <div className="sm:ml-auto flex items-center gap-2">
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
