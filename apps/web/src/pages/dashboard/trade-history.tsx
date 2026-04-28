import { useState } from 'react';
import { Eye, History, List, TrendingUp, TrendingDown } from 'lucide-react';
import { useTradeHistory, type Trade } from '../../hooks/use-analytics';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { usePlatformMode } from '../../hooks/use-user';
import { DataTable, type DataTableColumn, Tabs } from '@crypto-trader/ui';
import { TradeDetailModal } from '../../components/trade-history';

type FilterType = 'ALL' | 'BUY' | 'SELL';

// ── Trade History Page ───────────────────────────────────────────────────────

export function TradeHistoryPage() {
  const { t } = useTranslation();
  const { mode: platformMode } = usePlatformMode();
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const { data: trades = [], isLoading } = useTradeHistory(100, platformMode);

  const filtered = trades.filter((tr) => {
    if (filter === 'ALL') return true;
    if (filter === 'BUY') return tr.type === 'BUY';
    if (filter === 'SELL') return tr.type === 'SELL';
    return true;
  });

  const FILTERS: { value: FilterType; label: string; icon: React.ReactNode }[] =
    [
      {
        value: 'ALL',
        label: t('tradeHistory.all'),
        icon: <List className="h-3.5 w-3.5" />,
      },
      {
        value: 'BUY',
        label: t('tradeHistory.buys'),
        icon: <TrendingUp className="h-3.5 w-3.5" />,
      },
      {
        value: 'SELL',
        label: t('tradeHistory.sells'),
        icon: <TrendingDown className="h-3.5 w-3.5" />,
      },
    ];

  const columns: DataTableColumn<Trade>[] = [
    {
      key: 'type',
      header: t('tradeHistory.type'),
      render: (tr) => (
        <span
          className={cn(
            'rounded px-2 py-0.5 text-xs font-bold',
            tr.type === 'BUY'
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-red-500/10 text-red-500',
          )}
        >
          {tr.type}
        </span>
      ),
    },
    {
      key: 'pair',
      header: t('tradeHistory.pair'),
      render: (tr) => (
        <span className="font-mono">{tr.position?.pair || '—'}</span>
      ),
    },
    {
      key: 'price',
      header: t('tradeHistory.price'),
      align: 'right',
      render: (tr) => (
        <span className="font-mono">${tr.price.toLocaleString()}</span>
      ),
    },
    {
      key: 'qty',
      header: t('tradeHistory.qty'),
      align: 'right',
      render: (tr) => <span className="font-mono">{tr.quantity}</span>,
    },
    {
      key: 'total',
      header: t('tradeHistory.total'),
      align: 'right',
      render: (tr) => (
        <span className="font-mono font-semibold">
          $
          {(tr.price * tr.quantity).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: 'fee',
      header: t('tradeHistory.fee'),
      align: 'right',
      render: (tr) => (
        <span className="font-mono text-amber-500">${tr.fee.toFixed(4)}</span>
      ),
    },
    {
      key: 'time',
      header: t('tradeHistory.time'),
      render: (tr) => (
        <span className="text-muted-foreground">
          {new Date(tr.executedAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'mode',
      header: t('tradeHistory.mode'),
      render: (tr) => (
        <span
          className={cn(
            'rounded px-2 py-0.5 text-xs font-semibold',
            tr.mode === 'LIVE'
              ? 'bg-red-500/10 text-red-500'
              : tr.mode === 'TESTNET'
                ? 'bg-sky-500/10 text-sky-400'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {tr.mode}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('common.action', { defaultValue: 'Action' }),
      align: 'right' as const,
      render: (tr) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTrade(tr);
            }}
            className="inline-flex items-center gap-1 rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
            title={t('tradeHistory.detail')}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('sidebar.tradeHistory')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('tradeHistory.trades', { count: filtered.length })}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <Tabs
          tabs={FILTERS.map(({ value, label, icon }) => ({
            value,
            label,
            icon,
          }))}
          value={filter}
          onChange={(v) => setFilter(v as FilterType)}
          border
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(tr) => tr.id}
        isLoading={isLoading}
        emptyMessage={t('tradeHistory.noTrades')}
        rowClassName="trade-row"
        onRowClick={(tr) => setSelectedTrade(tr)}
      />

      {selectedTrade && (
        <TradeDetailModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
        />
      )}
    </div>
  );
}
