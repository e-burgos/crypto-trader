import { useState } from 'react';
import { Filter, Eye, X } from 'lucide-react';
import { useTradeHistory, type Trade } from '../../hooks/use-analytics';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';

type FilterType = 'ALL' | 'BUY' | 'SELL' | 'LIVE' | 'PAPER';

// ── Trade Detail Modal ───────────────────────────────────────────────────────
function TradeDetailModal({
  trade,
  onClose,
}: {
  trade: Trade;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const isBuy = trade.type === 'BUY';
  const totalValue = trade.price * trade.quantity;

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: t('tradeHistory.type'),
      value: (
        <span
          className={cn(
            'rounded px-2 py-0.5 text-xs font-bold',
            isBuy
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-red-500/10 text-red-500',
          )}
        >
          {trade.type}
        </span>
      ),
    },
    {
      label: t('tradeHistory.modal.asset'),
      value: trade.position?.asset || '—',
    },
    {
      label: t('tradeHistory.pair'),
      value: trade.position?.pair || '—',
    },
    {
      label: t('tradeHistory.price'),
      value: `$${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      label: t('tradeHistory.qty'),
      value: trade.quantity.toFixed(8),
    },
    {
      label: t('tradeHistory.total'),
      value: (
        <span className="font-semibold">
          ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      label: t('tradeHistory.fee'),
      value: (
        <span className="text-amber-500">
          ${trade.fee.toFixed(4)}{' '}
          <span className="text-xs text-muted-foreground font-normal">
            ({t('tradeHistory.modal.feeNote')})
          </span>
        </span>
      ),
    },
    {
      label: t('tradeHistory.mode'),
      value: (
        <span
          className={cn(
            'rounded px-2 py-0.5 text-xs',
            trade.mode === 'LIVE'
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {trade.mode}
        </span>
      ),
    },
    {
      label: t('tradeHistory.modal.executedAt'),
      value: new Date(trade.executedAt).toLocaleString(),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t('tradeHistory.modal.title')}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Detail rows */}
        <dl className="space-y-3">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground shrink-0">{label}</dt>
              <dd className="text-sm font-mono text-right">{value}</dd>
            </div>
          ))}
        </dl>

        {/* Note */}
        <p className="mt-5 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {t('tradeHistory.modal.feeExplain', {
            fee: trade.fee.toFixed(4),
            total: totalValue.toFixed(2),
          })}
        </p>
      </div>
    </div>
  );
}

// ── Trade Row ────────────────────────────────────────────────────────────────
function TradeRow({
  trade,
  onDetail,
}: {
  trade: Trade;
  onDetail: (trade: Trade) => void;
}) {
  const { t } = useTranslation();
  const isBuy = trade.type === 'BUY';
  const totalValue = trade.price * trade.quantity;

  return (
    <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors group">
      <td className="px-4 py-3 text-sm">
        <span
          className={cn(
            'rounded px-2 py-0.5 text-xs font-bold',
            isBuy
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-red-500/10 text-red-500',
          )}
        >
          {trade.type}
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-mono">
        {trade.position?.pair || '—'}
      </td>
      <td className="px-4 py-3 text-sm font-mono">
        ${trade.price.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-sm font-mono">{trade.quantity}</td>
      <td className="px-4 py-3 text-sm font-mono font-semibold">
        ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="px-4 py-3 text-sm font-mono text-amber-500">
        ${trade.fee.toFixed(4)}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {new Date(trade.executedAt).toLocaleString()}
      </td>
      <td className="px-4 py-3 text-sm">
        <span
          className={cn(
            'rounded px-2 py-0.5 text-xs',
            trade.mode === 'LIVE'
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {trade.mode}
        </span>
      </td>
      <td className="px-4 py-3 text-sm">
        <button
          onClick={() => onDetail(trade)}
          className="rounded-lg p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-primary/10 hover:text-primary transition-all"
          title={t('tradeHistory.detail')}
        >
          <Eye className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

export function TradeHistoryPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const { data: trades = [], isLoading } = useTradeHistory(100);

  const filtered = trades.filter((tr) => {
    if (filter === 'ALL') return true;
    if (filter === 'BUY') return tr.type === 'BUY';
    if (filter === 'SELL') return tr.type === 'SELL';
    if (filter === 'LIVE') return tr.mode === 'LIVE';
    if (filter === 'PAPER') return tr.mode === 'PAPER';
    return true;
  });

  const FILTERS: { value: FilterType; label: string }[] = [
    { value: 'ALL', label: t('tradeHistory.all') },
    { value: 'BUY', label: t('tradeHistory.buys') },
    { value: 'SELL', label: t('tradeHistory.sells') },
    { value: 'LIVE', label: t('tradeHistory.live') },
    { value: 'PAPER', label: t('tradeHistory.paper') },
  ];

  const COLUMNS = [
    t('tradeHistory.type'),
    t('tradeHistory.pair'),
    t('tradeHistory.price'),
    t('tradeHistory.qty'),
    t('tradeHistory.total'),
    t('tradeHistory.fee'),
    t('tradeHistory.time'),
    t('tradeHistory.mode'),
    '',
  ];

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('sidebar.tradeHistory')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('tradeHistory.trades', { count: filtered.length })}
          </p>
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
                  filter === value
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground hover:text-foreground',
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
              {COLUMNS.map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  {t('tradeHistory.loading')}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  {t('tradeHistory.noTrades')}
                </td>
              </tr>
            ) : (
              filtered.map((tr) => (
                <TradeRow key={tr.id} trade={tr} onDetail={setSelectedTrade} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedTrade && (
        <TradeDetailModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
        />
      )}
    </div>
  );
}
