import { Activity, Newspaper, Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OverallSignal } from '../../hooks/use-market';
import type { AgentDecision } from '../../hooks/use-analytics';
import {
  SIGNAL_COLOR,
  SIGNAL_BG,
  DECISION_COLOR,
  DECISION_BG,
} from './constants';
import { useTimeAgo } from './helpers';
import { StatusCard } from './status-card';

export function CombinedScoreBanner({
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
