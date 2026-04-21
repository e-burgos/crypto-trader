import {
  Activity,
  Newspaper,
  Cpu,
  Layers,
  History as HistoryIcon,
  ListChecks,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import {
  deriveOverallSignal,
  deriveOpportunity,
  type MarketSnapshot,
} from '../../hooks/use-market';
import type { AgentDecision } from '../../hooks/use-analytics';
import type { AgentStatus } from '../../hooks/use-trading';
import type { NewsAnalysisData } from './constants';
import { fmt, fmtPrice } from './helpers';

export function AgentInputSummary({
  snapshot,
  livePrice,
  newsAnalysis,
  hasAi,
  hasSigma,
  botNewsEnabled,
  newsWeight,
  agentStatuses,
  recentDecisions,
}: {
  snapshot: MarketSnapshot;
  livePrice: number;
  newsAnalysis: NewsAnalysisData;
  hasAi: boolean;
  hasSigma?: boolean;
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
              value: hasSigma ? '⚡ SIGMA' : hasAi ? '✦ IA' : '⊟ Keyword',
              color: hasSigma ? 'text-violet-400' : hasAi ? 'text-violet-400' : 'text-sky-400',
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
