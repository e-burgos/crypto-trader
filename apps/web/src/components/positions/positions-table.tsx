import { useMemo } from 'react';
import { TrendingUp, TrendingDown, X, Eye } from 'lucide-react';
import {
  InfoTooltip,
  DataTable,
  type DataTableColumn,
} from '@crypto-trader/ui';
import { cn } from '../../lib/utils';
import { TradingPosition } from '../../hooks/use-trading';
import { LivePnlCell } from './live-pnl-cell';

export function PositionsTable({
  positions,
  tab,
  t,
  onDetail,
  onClose,
}: {
  positions: TradingPosition[];
  tab: 'OPEN' | 'CLOSED';
  t: (key: string, opts?: Record<string, unknown>) => string;
  onDetail: (pos: TradingPosition) => void;
  onClose: (pos: TradingPosition) => void;
}) {
  const columns: DataTableColumn<TradingPosition>[] = useMemo(
    () => [
      {
        key: 'asset',
        header: t('trading.asset'),
        render: (pos) => (
          <span className="font-semibold">
            {pos.asset}/{pos.pair}
          </span>
        ),
      },
      {
        key: 'mode',
        header: t('trading.mode'),
        render: (pos) => (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-semibold',
              pos.mode === 'LIVE'
                ? 'bg-red-500/10 text-red-500'
                : pos.mode === 'TESTNET'
                  ? 'bg-sky-500/10 text-sky-400'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {pos.mode}
          </span>
        ),
      },
      {
        key: 'entryPrice',
        header: t('positions.entryPrice'),
        align: 'right' as const,
        render: (pos) => (
          <span className="font-mono">
            $
            {pos.entryPrice.toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
          </span>
        ),
      },
      {
        key: 'exitPrice',
        header: t('positions.exitPrice', { defaultValue: 'Exit Price' }),
        align: 'right' as const,
        show: tab === 'CLOSED',
        render: (pos) => (
          <span className="font-mono">
            {pos.exitPrice != null
              ? `$${pos.exitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
              : '—'}
          </span>
        ),
      },
      {
        key: 'qty',
        header: t('tradeHistory.qty'),
        align: 'right' as const,
        render: (pos) => (
          <span className="font-mono">{pos.quantity.toFixed(6)}</span>
        ),
      },
      {
        key: 'pnl',
        header: (
          <span className="flex items-center justify-end gap-1">
            {t('common.pnl')}
            <InfoTooltip
              text={
                tab === 'OPEN'
                  ? t('tooltips.pnlOpen')
                  : t('tooltips.pnlClosed', {
                      defaultValue: 'Realised P&L after fees',
                    })
              }
              side="left"
            />
          </span>
        ),
        align: 'right' as const,
        render: (pos) => {
          if (tab === 'OPEN') return <LivePnlCell pos={pos} />;
          if (pos.pnl == null)
            return <span className="text-muted-foreground text-xs">—</span>;
          const isProfit = pos.pnl >= 0;
          return (
            <span
              className={cn(
                'inline-flex items-center gap-1 font-mono font-semibold',
                isProfit ? 'text-emerald-400' : 'text-red-400',
              )}
            >
              {isProfit ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {isProfit ? '+' : ''}
              {pos.pnl.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              USDT
            </span>
          );
        },
      },
      {
        key: 'date',
        header:
          tab === 'CLOSED'
            ? t('positions.closed', { defaultValue: 'Closed' })
            : t('positions.opened'),
        align: 'right' as const,
        render: (pos) => (
          <span className="text-muted-foreground">
            {tab === 'CLOSED' && pos.exitAt
              ? new Date(pos.exitAt).toLocaleDateString()
              : new Date(pos.entryAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        key: 'actions',
        header: t('common.action', { defaultValue: 'Action' }),
        align: 'right' as const,
        render: (pos) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDetail(pos);
              }}
              className="inline-flex items-center gap-1 rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
              title={t('tradeHistory.detail')}
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            {tab === 'OPEN' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(pos);
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
                  'bg-red-500/10 text-red-400 ring-1 ring-red-500/20',
                  'hover:bg-red-500/20 hover:ring-red-500/40 active:scale-95',
                )}
              >
                <X className="h-3 w-3" />
                {t('positions.close', { defaultValue: 'Close' })}
              </button>
            )}
          </div>
        ),
      },
    ],
    [tab, t, onDetail, onClose],
  );

  return (
    <DataTable
      columns={columns}
      data={positions}
      rowKey={(pos) => pos.id}
      rowClassName="position-row"
      onRowClick={(pos) => onDetail(pos)}
    />
  );
}
