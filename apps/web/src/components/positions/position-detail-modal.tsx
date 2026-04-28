import {
  TrendingUp,
  TrendingDown,
  Minus,
  Briefcase,
  SlidersHorizontal,
  List,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { TradingPosition } from '../../hooks/use-trading';
import { TabModal, DataTable, type DataTableColumn } from '@crypto-trader/ui';

export function PositionDetailModal({
  position,
  onClose,
}: {
  position: TradingPosition;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const cfg = position.config;
  const trades = position.trades ?? [];
  const isProfit = (position.pnl ?? 0) >= 0;
  const quoteCurrency = position.pair.replace(position.asset, '') || 'USDT';
  const baseCurrency = position.asset;

  const pnlColor =
    position.pnl == null
      ? 'text-muted-foreground'
      : position.pnl > 0
        ? 'text-emerald-500'
        : position.pnl < 0
          ? 'text-red-500'
          : 'text-muted-foreground';

  const badgeClassName =
    position.mode === 'LIVE'
      ? 'text-red-500 bg-red-500/10 border-red-500/20'
      : position.mode === 'TESTNET'
        ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
        : 'text-muted-foreground bg-muted/30 border-border';

  function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div className="flex items-center justify-between gap-4">
        <dt className="text-sm text-muted-foreground shrink-0">{label}</dt>
        <dd className="text-sm font-mono text-right">{value}</dd>
      </div>
    );
  }

  const positionContent = (
    <dl className="space-y-2.5">
      <Row
        label={t('positions.modal.entryPrice')}
        value={`${position.entryPrice.toFixed(8)} ${quoteCurrency}`}
      />
      {position.exitPrice != null && (
        <Row
          label={t('positions.modal.exitPrice')}
          value={`${position.exitPrice.toFixed(8)} ${quoteCurrency}`}
        />
      )}
      <Row
        label={t('positions.modal.quantity')}
        value={`${position.quantity.toFixed(8)} ${baseCurrency}`}
      />
      <Row
        label={t('positions.modal.fees')}
        value={
          <span className="text-amber-500">
            {position.fees.toFixed(8)} {quoteCurrency}
          </span>
        }
      />
      {position.pnl != null && (
        <Row
          label={t('positions.modal.pnl')}
          value={
            <span
              className={cn(
                'font-bold flex items-center gap-1 justify-end',
                pnlColor,
              )}
            >
              {position.pnl > 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : position.pnl < 0 ? (
                <TrendingDown className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
              {isProfit ? '+' : ''}
              {position.pnl.toFixed(8)} {quoteCurrency}
            </span>
          }
        />
      )}
      <Row
        label={t('positions.modal.entryAt')}
        value={new Date(position.entryAt).toLocaleString()}
      />
      {position.exitAt && (
        <Row
          label={t('positions.modal.exitAt')}
          value={new Date(position.exitAt).toLocaleString()}
        />
      )}
    </dl>
  );

  const configContent = cfg ? (
    <dl className="space-y-2.5">
      <Row
        label={t('positions.modal.stopLoss')}
        value={
          <span className="text-red-400 font-semibold flex items-center gap-1.5">
            {(cfg.stopLossPct * 100).toFixed(1)}%
            <span className="text-xs font-normal text-muted-foreground">
              → {(position.entryPrice * (1 - cfg.stopLossPct)).toFixed(8)}{' '}
              {quoteCurrency}
            </span>
          </span>
        }
      />
      <Row
        label={t('positions.modal.takeProfit')}
        value={
          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
            {(cfg.takeProfitPct * 100).toFixed(1)}%
            <span className="text-xs font-normal text-muted-foreground">
              → {(position.entryPrice * (1 + cfg.takeProfitPct)).toFixed(8)}{' '}
              {quoteCurrency}
            </span>
          </span>
        }
      />
      <Row
        label={t('positions.modal.maxTrade')}
        value={
          <span className="flex items-center gap-1.5">
            {(cfg.maxTradePct * 100).toFixed(1)}%
            <span className="text-xs font-normal text-muted-foreground">
              → {(position.entryPrice * position.quantity).toFixed(8)}{' '}
              {quoteCurrency}
            </span>
          </span>
        }
      />
      <Row
        label={t('positions.modal.buyThreshold')}
        value={`${cfg.buyThreshold}%`}
      />
      <Row
        label={t('positions.modal.sellThreshold')}
        value={`${cfg.sellThreshold}%`}
      />
      <Row
        label={t('positions.modal.maxPositions')}
        value={cfg.maxConcurrentPositions}
      />
      <Row
        label={t('positions.modal.minInterval')}
        value={`${cfg.minIntervalMinutes} min`}
      />
      {cfg.orderPriceOffsetPct !== 0 && (
        <Row
          label={t('positions.modal.priceOffset')}
          value={`${(cfg.orderPriceOffsetPct * 100).toFixed(2)}%`}
        />
      )}
    </dl>
  ) : (
    <p className="text-sm text-muted-foreground">
      {t('positions.modal.noConfig', {
        defaultValue: 'Sin configuración disponible.',
      })}
    </p>
  );

  type PositionTrade = NonNullable<TradingPosition['trades']>[number];

  const tradeColumns: DataTableColumn<PositionTrade>[] = [
    {
      key: 'type',
      header: t('positions.modal.tradeType'),
      render: (tr) => (
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-bold',
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
      key: 'price',
      header: t('positions.modal.tradePrice'),
      align: 'right',
      render: (tr) => (
        <span className="font-mono">
          $
          {tr.price.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: t('positions.modal.tradeQty'),
      align: 'right',
      render: (tr) => (
        <span className="font-mono">{tr.quantity.toFixed(6)}</span>
      ),
    },
    {
      key: 'fee',
      header: t('positions.modal.tradeFee'),
      align: 'right',
      render: (tr) => (
        <span className="font-mono text-amber-500">${tr.fee.toFixed(4)}</span>
      ),
    },
    {
      key: 'executedAt',
      header: t('positions.modal.tradeAt'),
      align: 'right',
      render: (tr) => (
        <span className="text-muted-foreground">
          {new Date(tr.executedAt).toLocaleString()}
        </span>
      ),
    },
  ];

  const tradesContent = (
    <DataTable
      columns={tradeColumns}
      data={trades}
      rowKey={(tr) => tr.id}
      emptyMessage={t('positions.modal.noTrades')}
    />
  );

  return (
    <TabModal
      icon={Briefcase}
      title={t('positions.modal.title')}
      subtitle={`${position.asset}/${position.pair} · ${position.status}`}
      badgeHeader={position.mode}
      badgeHeaderClassName={badgeClassName}
      tabs={[
        {
          icon: Briefcase,
          name: t('positions.modal.sectionPosition'),
          content: positionContent,
        },
        {
          icon: SlidersHorizontal,
          name: 'Config',
          content: configContent,
        },
        {
          icon: List,
          name: 'Trades',
          content: tradesContent,
        },
      ]}
      closeLabel={t('common.close')}
      onClose={onClose}
    />
  );
}
