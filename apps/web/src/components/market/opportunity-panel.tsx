import {
  TrendingDown,
  ShoppingCart,
  Clock,
  Zap,
  ShieldAlert,
  Target,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import type { OpportunityAnalysis } from '../../hooks/use-market';
import type { IndicatorKey } from '@crypto-trader/ui';
import { InfoButton } from './constants';

export function OpportunityPanel({
  opp,
  onOpenInfo,
}: {
  opp: OpportunityAnalysis;
  onOpenInfo?: (k: IndicatorKey) => void;
}) {
  const { t } = useTranslation();
  const actionConfig = {
    BUY: {
      label: t('market.opportunity.buyNow'),
      sublabel: t('market.opportunity.buyDetected'),
      icon: ShoppingCart,
      color: 'text-emerald-400',
      bg: 'from-emerald-500/15 to-emerald-500/5',
      border: 'border-emerald-500/30',
      ring: 'shadow-[0_0_24px_hsl(142_71%_45%/0.15)]',
      barColor: 'bg-emerald-500',
    },
    SELL: {
      label: t('market.opportunity.sellNow'),
      sublabel: t('market.opportunity.sellDetected'),
      icon: TrendingDown,
      color: 'text-red-400',
      bg: 'from-red-500/15 to-red-500/5',
      border: 'border-red-500/30',
      ring: 'shadow-[0_0_24px_hsl(0_84%_60%/0.15)]',
      barColor: 'bg-red-500',
    },
    WAIT: {
      label: t('market.opportunity.waitSignal'),
      sublabel: t('market.opportunity.noConfluence'),
      icon: Clock,
      color: 'text-amber-400',
      bg: 'from-amber-500/10 to-amber-500/5',
      border: 'border-amber-500/20',
      ring: '',
      barColor: 'bg-amber-500',
    },
  }[opp.action];

  const ActionIcon = actionConfig.icon;

  return (
    <div
      className={cn(
        'rounded-2xl border bg-gradient-to-br p-5 space-y-4',
        actionConfig.bg,
        actionConfig.border,
        actionConfig.ring,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              opp.action === 'BUY'
                ? 'bg-emerald-500/20'
                : opp.action === 'SELL'
                  ? 'bg-red-500/20'
                  : 'bg-amber-500/15',
            )}
          >
            <ActionIcon className={cn('h-6 w-6', actionConfig.color)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-lg font-bold tracking-wide',
                  actionConfig.color,
                )}
              >
                {actionConfig.label}
              </span>
              {/* Confidence badge */}
              <span
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold',
                  opp.action === 'BUY'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : opp.action === 'SELL'
                      ? 'bg-red-500/20 text-red-400'
                      : opp.scoreBias >= 0
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-orange-500/15 text-orange-400',
                )}
              >
                <Zap className="h-3 w-3" />
                {opp.action !== 'WAIT'
                  ? t('market.opportunity.confirmed', { pct: opp.confidence })
                  : opp.scoreBias > 0
                    ? t('market.opportunity.bullish', { pct: opp.confidence })
                    : opp.scoreBias < 0
                      ? t('market.opportunity.bearish', { pct: opp.confidence })
                      : t('market.opportunity.signal', { pct: opp.confidence })}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {opp.summary}
            </p>
          </div>
        </div>

        {/* Confidence bar + info */}
        <div className="shrink-0 text-right hidden sm:flex sm:flex-col sm:items-end gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
              {opp.action !== 'WAIT'
                ? t('market.opportunity.confidence')
                : opp.scoreBias >= 0
                  ? t('market.opportunity.bullishSignal')
                  : t('market.opportunity.bearishSignal')}
            </p>
            <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  actionConfig.barColor,
                )}
                style={{ width: `${opp.confidence}%` }}
              />
            </div>
            <p className={cn('text-sm font-bold mt-1', actionConfig.color)}>
              {opp.confidence}%
            </p>
          </div>
          {onOpenInfo && (
            <InfoButton indicatorKey="opportunity" onOpen={onOpenInfo} />
          )}
        </div>
      </div>

      {/* Price levels */}
      {opp.action !== 'WAIT' && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-background/40 border border-border/40 px-3 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {t('market.opportunity.entry')}
            </p>
            <p className="text-sm font-bold font-mono">
              $
              {opp.entryPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t('market.opportunity.currentPrice')}
            </p>
          </div>
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-red-400/70 mb-1">
              Stop Loss
            </p>
            <p className="text-sm font-bold font-mono text-red-400">
              $
              {opp.stopLoss.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </p>
            <p className="text-[10px] text-red-400/60">
              -
              {(
                (Math.abs(opp.entryPrice - opp.stopLoss) / opp.entryPrice) *
                100
              ).toFixed(1)}
              %
            </p>
          </div>
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-1">
              Take Profit
            </p>
            <p className="text-sm font-bold font-mono text-emerald-400">
              $
              {opp.takeProfit.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </p>
            <p className="text-[10px] text-emerald-400/60">
              +
              {(
                (Math.abs(opp.takeProfit - opp.entryPrice) / opp.entryPrice) *
                100
              ).toFixed(1)}
              %
            </p>
          </div>
        </div>
      )}

      {/* R/R ratio */}
      {opp.action !== 'WAIT' && opp.riskReward > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Target className="h-3.5 w-3.5 shrink-0" />
          <span>{t('market.opportunity.riskReward')}:</span>
          <span
            className={cn(
              'font-bold',
              opp.riskReward >= 1.5 ? 'text-emerald-400' : 'text-amber-400',
            )}
          >
            1:{opp.riskReward}
          </span>
          {opp.riskReward < 1.5 && (
            <span className="text-amber-400/70">
              ({t('market.opportunity.minRecommended')})
            </span>
          )}
        </div>
      )}

      {/* Indicator checks */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          {t('market.opportunity.indicatorChecklist')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {opp.checks.map((check) => (
            <div
              key={check.label}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs',
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
              <span className="font-semibold text-muted-foreground w-14 shrink-0">
                {check.label}
              </span>
              <span
                className={cn(
                  'truncate',
                  check.ok ? 'text-foreground/80' : 'text-muted-foreground/60',
                )}
              >
                {check.value}
              </span>
              {check.weight === 'strong' && (
                <span className="ml-auto shrink-0 text-[9px] font-bold text-primary/60 uppercase">
                  {t('market.opportunity.strong')}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {opp.warnings.length > 0 && (
        <div className="space-y-1">
          {opp.warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg bg-amber-500/8 border border-amber-500/15 px-3 py-1.5"
            >
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
              <span className="text-xs text-amber-300/80">{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
        * {t('market.opportunity.disclaimer')}
      </p>
    </div>
  );
}
