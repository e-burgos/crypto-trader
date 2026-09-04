import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { EntryOrderWire } from '@crypto-trader/shared';
import { KeyValueRow, SectionTitle, Spinner } from '@crypto-trader/ui';
import { useRestingEntries } from '../../../hooks/use-entry-orders';
import { EntryOrderStatusBadge } from './entry-order-status-badge';
import { entryOrderModeLabelKey, resolveEntryOrderMode } from './entry-order-labels';

interface AgentRestingEntriesProps {
  configId: string;
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function renderLevel(entry: EntryOrderWire, t: TFunction) {
  const mode = resolveEntryOrderMode(entry.entryMode);
  const lines = [formatUsd(entry.limitPrice)];

  if (mode === 'OCO') {
    if (entry.trailingDeltaBips !== null) {
      lines.push(t('positions.entries.level.trailing', { bips: entry.trailingDeltaBips }));
    } else if (entry.stopPrice !== null && entry.stopLimitPrice !== null) {
      lines.push(
        t('positions.entries.level.stopPair', {
          stop: formatUsd(entry.stopPrice),
          stopLimit: formatUsd(entry.stopLimitPrice),
        }),
      );
    }
  }

  return (
    <div className="text-right">
      {lines.map((line, index) => (
        <div key={index} className={index === 0 ? 'font-mono' : 'text-[11px] text-muted-foreground'}>
          {line}
        </div>
      ))}
    </div>
  );
}

function AgentRestingEntryBlock({ entry }: { entry: EntryOrderWire }) {
  const { t } = useTranslation();
  const mode = resolveEntryOrderMode(entry.entryMode);

  return (
    <div className="space-y-1 rounded-lg bg-muted/30 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{t(entryOrderModeLabelKey(mode))}</span>
        <EntryOrderStatusBadge status={entry.status} />
      </div>
      <div className="divide-y divide-border/50">
        <KeyValueRow label={t('positions.entries.agentDetail.level')} value={renderLevel(entry, t)} />
        <KeyValueRow label={t('tradeHistory.qty')} value={entry.quantity.toFixed(6)} mono />
        <KeyValueRow
          label={t('positions.entries.agentDetail.notional')}
          value={formatUsd(entry.plannedNotionalUsd)}
          mono
        />
        <KeyValueRow
          label={t('positions.entries.agentDetail.expiresAt')}
          value={new Date(entry.expiresAt).toLocaleString()}
          mono
        />
      </div>
    </div>
  );
}

export function AgentRestingEntries({ configId }: AgentRestingEntriesProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useRestingEntries(configId);
  const entries = data?.items ?? [];

  return (
    <div className="space-y-2">
      <SectionTitle title={t('positions.entries.agentDetail.title')} size="sm" />
      {isLoading ? (
        <div className="flex justify-center py-3">
          <Spinner size="sm" />
        </div>
      ) : entries.length === 0 ? (
        <p className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {t('positions.entries.agentDetail.none')}
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <AgentRestingEntryBlock key={entry.id} entry={entry} />
          ))}
        </div>
      )}
      <Link
        to={`/dashboard/positions?tab=entries&configId=${encodeURIComponent(configId)}`}
        className="block text-xs font-medium text-primary hover:underline"
      >
        {t('positions.entries.agentDetail.viewAll')}
      </Link>
    </div>
  );
}

export type { AgentRestingEntriesProps };
