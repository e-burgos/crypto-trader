import { useState } from 'react';
import { Filter } from 'lucide-react';
import { useTradeHistory, type Trade } from '../../hooks/use-analytics';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';

type FilterType = 'ALL' | 'BUY' | 'SELL' | 'LIVE' | 'PAPER';

function TradeRow({ trade }: { trade: Trade }) {
  const isBuy = trade.type === 'BUY';
  return (
    <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 text-sm">
        <span className={cn('rounded px-2 py-0.5 text-xs font-bold', isBuy ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500')}>
          {trade.type}
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-mono">{trade.position?.pair || '—'}</td>
      <td className="px-4 py-3 text-sm font-mono">${trade.price.toLocaleString()}</td>
      <td className="px-4 py-3 text-sm font-mono">{trade.quantity}</td>
      <td className="px-4 py-3 text-sm font-mono text-muted-foreground">${trade.fee.toFixed(4)}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {new Date(trade.executedAt).toLocaleString()}
      </td>
      <td className="px-4 py-3 text-sm">
        <span className={cn('rounded px-2 py-0.5 text-xs', trade.mode === 'LIVE' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
          {trade.mode}
        </span>
      </td>
    </tr>
  );
}

export function TradeHistoryPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterType>('ALL');
  const { data: trades = [], isLoading } = useTradeHistory(100);

  const filtered = trades.filter((t) => {
    if (filter === 'ALL') return true;
    if (filter === 'BUY') return t.type === 'BUY';
    if (filter === 'SELL') return t.type === 'SELL';
    if (filter === 'LIVE') return t.mode === 'LIVE';
    if (filter === 'PAPER') return t.mode === 'PAPER';
    return true;
  });

  const FILTERS: { value: FilterType; label: string }[] = [
    { value: 'ALL', label: t('tradeHistory.all') },
    { value: 'BUY', label: t('tradeHistory.buys') },
    { value: 'SELL', label: t('tradeHistory.sells') },
    { value: 'LIVE', label: t('tradeHistory.live') },
    { value: 'PAPER', label: t('tradeHistory.paper') },
  ];

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('sidebar.tradeHistory')}</h1>
          <p className="text-sm text-muted-foreground">{t('tradeHistory.trades', { count: filtered.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-1">
            {FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  filter === value ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {[t('tradeHistory.type'), t('tradeHistory.pair'), t('tradeHistory.price'), t('tradeHistory.qty'), t('tradeHistory.fee'), t('tradeHistory.time'), t('tradeHistory.mode')].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{t('tradeHistory.loading')}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{t('tradeHistory.noTrades')}</td></tr>
            ) : (
              filtered.map((t) => <TradeRow key={t.id} trade={t} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
