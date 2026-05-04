import {
  Activity,
  Newspaper,
  Cpu,
  Layers,
  History as HistoryIcon,
  ListChecks,
  Globe,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { InfoCard } from '@crypto-trader/ui';
import type { InfoCardColumn, InfoCardFooterTag } from '@crypto-trader/ui';
import type { EnrichedMarketSnapshot } from '@crypto-trader/shared';
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
  enrichedSnapshot,
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
  enrichedSnapshot?: EnrichedMarketSnapshot;
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
              color: hasSigma
                ? 'text-violet-400'
                : hasAi
                  ? 'text-violet-400'
                  : 'text-sky-400',
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
            ...(enrichedSnapshot?.fearGreed
              ? [
                  {
                    label: t('botAnalysis.inputSourcesFearGreed'),
                    value: `${enrichedSnapshot.fearGreed.value}/100 — ${enrichedSnapshot.fearGreed.classification}`,
                    color:
                      enrichedSnapshot.fearGreed.value <= 25
                        ? 'text-red-400'
                        : enrichedSnapshot.fearGreed.value >= 75
                          ? 'text-emerald-400'
                          : 'text-amber-400',
                  },
                ]
              : []),
          ]
        : [
            {
              label: t('botAnalysis.inputNewsEnabled'),
              value: t('botAnalysis.inputNewsEnabledNo'),
              color: 'text-muted-foreground',
            },
          ],
    },
    // Macro Context group — only shown if any macro data available (CIPHER)
    ...(enrichedSnapshot?.globalMarket ||
    enrichedSnapshot?.defiHealth ||
    enrichedSnapshot?.tokenUnlocks
      ? [
          {
            group: t('botAnalysis.inputGroupMacro'),
            items: (() => {
              const items: {
                label: string;
                value: string;
                color?: string;
              }[] = [];
              if (enrichedSnapshot?.globalMarket) {
                const gm = enrichedSnapshot.globalMarket;
                items.push({
                  label: t('botAnalysis.inputSourcesGlobal'),
                  value: `BTC dom: ${gm.btcDominance.toFixed(1)}%${gm.marketCapChange24h != null ? ` · MCap ${gm.marketCapChange24h >= 0 ? '+' : ''}${gm.marketCapChange24h.toFixed(1)}%` : ''}`,
                });
              }
              if (enrichedSnapshot?.defiHealth) {
                const dh = enrichedSnapshot.defiHealth;
                items.push({
                  label: t('botAnalysis.inputSourcesDefi'),
                  value: `TVL ${dh.tvlChange24h >= 0 ? '+' : ''}${dh.tvlChange24h.toFixed(1)}%`,
                  color:
                    dh.tvlChange24h >= 2
                      ? 'text-emerald-400'
                      : dh.tvlChange24h <= -2
                        ? 'text-red-400'
                        : 'text-muted-foreground',
                });
              }
              if (
                enrichedSnapshot?.tokenUnlocks &&
                enrichedSnapshot.tokenUnlocks.length > 0
              ) {
                items.push({
                  label: t('botAnalysis.inputSourcesUnlocks'),
                  value: `${enrichedSnapshot.tokenUnlocks.length} upcoming`,
                });
              }
              return items;
            })(),
          },
        ]
      : []),
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
    [t('botAnalysis.inputGroupSources')]: {
      icon: Globe,
      accent: 'text-blue-400',
      bar: 'bg-blue-500',
    },
    [t('botAnalysis.inputGroupMacro')]: {
      icon: Globe,
      accent: 'text-indigo-400',
      bar: 'bg-indigo-500',
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
    <InfoCard
      icon={<ListChecks className="h-3.5 w-3.5 text-primary" />}
      title={t('botAnalysis.inputSummaryTitle')}
      subtitle={t('botAnalysis.inputSummarySubtitle')}
      headerRight={
        runningAgents.length > 0 ? (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[10px] font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {t('botAnalysis.inputAgentRunning', {
              count: runningAgents.length,
            })}
          </span>
        ) : undefined
      }
      columns={rows.map((group) => {
        const meta = GROUP_META[group.group] ?? {
          icon: Layers,
          accent: 'bg-muted',
          accentText: 'text-muted-foreground',
        };
        const GroupIcon = meta.icon;
        return {
          key: group.group,
          label: group.group,
          icon: <GroupIcon className="h-3 w-3" />,
          accent: meta.bar,
          accentText: meta.accent,
          items: group.items.map((item) => ({
            label: item.label,
            value: item.value,
            color: item.color,
          })),
        } satisfies InfoCardColumn;
      })}
      footerLabel={
        opp.warnings.length > 0 || opp.action !== 'WAIT'
          ? t('botAnalysis.inputRiskZone')
          : undefined
      }
      footerTags={(() => {
        const tags: InfoCardFooterTag[] = [];

        // Sources status tags
        if (enrichedSnapshot && enrichedSnapshot.activeSources.length > 0) {
          tags.push({
            label: t('botAnalysis.inputSourcesActive', {
              count: enrichedSnapshot.activeSources.length,
            }),
            icon: <Globe className="h-3 w-3 text-emerald-400" />,
            className:
              'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400',
            tooltip: enrichedSnapshot.activeSources.join(', '),
          });
        }
        if (enrichedSnapshot && enrichedSnapshot.failedSources.length > 0) {
          tags.push({
            label: `${t('botAnalysis.inputSourcesFailed', { count: enrichedSnapshot.failedSources.length })}`,
            icon: <span className="text-yellow-500">⚠</span>,
            className:
              'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400',
            tooltip: enrichedSnapshot.failedSources.join(', '),
          });
        }

        // Derivatives tag (AEGIS risk context)
        if (enrichedSnapshot?.derivatives) {
          const d = enrichedSnapshot.derivatives;
          tags.push({
            label: `${t('botAnalysis.inputSourcesDerivatives')}: FR ${(d.fundingRate * 100).toFixed(3)}% · L/S ${d.longShortRatio.toFixed(2)}`,
            className:
              d.fundingRate > 0.01
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : d.fundingRate < -0.01
                  ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                  : 'bg-muted/40 border border-border/50 text-muted-foreground',
          });
        }

        // Risk tags
        if (opp.action !== 'WAIT') {
          tags.push({
            label: `Entry $${fmtPrice(opp.entryPrice)}`,
            className:
              'bg-muted/40 border border-border/50 font-mono text-muted-foreground',
          });
          tags.push({
            label: `SL $${fmtPrice(opp.stopLoss)}`,
            className:
              'bg-red-500/10 border border-red-500/20 font-mono text-red-400',
          });
          tags.push({
            label: `TP $${fmtPrice(opp.takeProfit)}`,
            className:
              'bg-emerald-500/10 border border-emerald-500/20 font-mono text-emerald-400',
          });
        }
        opp.warnings.forEach((w) => {
          tags.push({
            label: w,
            icon: <span className="text-amber-500">⚠</span>,
            className:
              'bg-amber-500/10 border border-amber-500/20 text-amber-400',
          });
        });
        return tags.length > 0 ? tags : undefined;
      })()}
      className="analysis-section"
    />
  );
}
