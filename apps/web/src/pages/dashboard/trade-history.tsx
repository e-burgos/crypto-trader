import { useState } from 'react';
import { Filter } from 'lucide-react';
import { useTradeHistory, type Trade } from '../../hooks/use-analytics';
import { cn } from '../../lib/utils';

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
    { value: 'ALL', label: 'All' },
    { value: 'BUY', label: 'Buys' },
    { value: 'SELL', label: 'Sells' },
    { value: 'LIVE', label: 'Live' },
    { value: 'PAPER', label: 'Paper' },
  ];

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trade History</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} trades</p>
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
              {['Type', 'Pair', 'Price', 'Qty', 'Fee', 'Time', 'Mode'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Loading trades...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No trades yet. Start a trading agent to see history.</td></tr>
            ) : (
              filtered.map((t) => <TradeRow key={t.id} trade={t} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
