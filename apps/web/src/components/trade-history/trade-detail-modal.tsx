import { TrendingUp, TrendingDown, Minus, Receipt } from 'lucide-react';
import type { Trade } from '../../hooks/use-analytics';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { TabModal } from '@crypto-trader/ui';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-sm text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-sm font-mono text-right">{value}</dd>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-bold pt-1 pb-0.5">
      {children}
    </p>
  );
}

export function TradeDetailModal({
  trade,
  onClose,
}: {
  trade: Trade;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const isBuy = trade.type === 'BUY';
  const totalValue = trade.price * trade.quantity;
  const pos = trade.position;
  const cfg = pos?.config;
  const asset =
    pos?.asset ??
    (trade as { pair?: string }).pair?.replace(/USDT|BTC|ETH|BNB|BUSD/, '') ??
    '';
  const quoteCurrency = pos?.pair ? pos.pair.replace(pos.asset, '') : 'USDT';
  const baseCurrency = pos?.asset ?? asset;

  const pnlColor =
    pos?.pnl == null
      ? 'text-muted-foreground'
      : pos.pnl > 0
        ? 'text-emerald-500'
        : pos.pnl < 0
          ? 'text-red-500'
          : 'text-muted-foreground';

  const statusColor =
    pos?.status === 'OPEN'
      ? 'bg-primary/10 text-primary'
      : 'bg-muted text-muted-foreground';

  const badgeClassName = isBuy
    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    : 'bg-red-500/10 text-red-500 border-red-500/20';

  const bodyContent = (
    <div className="space-y-4">
      {/* ── Trade ── */}
      <dl className="space-y-2.5">
        <SectionLabel>Trade</SectionLabel>
        <Row label={t('tradeHistory.modal.asset')} value={pos?.asset || '—'} />
        <Row label={t('tradeHistory.pair')} value={pos?.pair || '—'} />
        <Row
          label={t('tradeHistory.price')}
          value={`${trade.price.toFixed(8)} ${quoteCurrency}`}
        />
        <Row
          label={t('tradeHistory.qty')}
          value={`${trade.quantity.toFixed(8)} ${baseCurrency}`}
        />
        <Row
          label={t('tradeHistory.total')}
          value={
            <span className="font-semibold">
              {totalValue.toFixed(8)} {quoteCurrency}
            </span>
          }
        />
        <Row
          label={t('tradeHistory.fee')}
          value={
            <span className="text-amber-500">
              {trade.fee.toFixed(8)} {quoteCurrency}{' '}
              <span className="text-xs text-muted-foreground font-normal">
                ({t('tradeHistory.modal.feeNote')})
              </span>
            </span>
          }
        />
        <Row
          label={t('tradeHistory.mode')}
          value={
            <span
              className={cn(
                'rounded px-2 py-0.5 text-xs font-semibold',
                trade.mode === 'LIVE'
                  ? 'bg-red-500/10 text-red-500'
                  : trade.mode === 'TESTNET'
                    ? 'bg-sky-500/10 text-sky-400'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {trade.mode}
            </span>
          }
        />
        <Row
          label={t('tradeHistory.modal.executedAt')}
          value={new Date(trade.executedAt).toLocaleString()}
        />
      </dl>

      {/* ── Position ── */}
      {pos && (
        <dl className="space-y-2.5 border-t border-border pt-3">
          <SectionLabel>{t('tradeHistory.modal.sectionPosition')}</SectionLabel>
          <Row
            label={t('tradeHistory.modal.positionStatus')}
            value={
              <span
                className={cn(
                  'rounded px-2 py-0.5 text-xs font-medium',
                  statusColor,
                )}
              >
                {pos.status}
              </span>
            }
          />
          <Row
            label={t('tradeHistory.modal.entryPrice')}
            value={`${pos.entryPrice.toFixed(8)} ${quoteCurrency}`}
          />
          {pos.exitPrice != null && (
            <Row
              label={t('tradeHistory.modal.exitPrice')}
              value={`${pos.exitPrice.toFixed(8)} ${quoteCurrency}`}
            />
          )}
          {pos.pnl != null && (
            <Row
              label={t('tradeHistory.modal.positionPnl')}
              value={
                <span
                  className={cn(
                    'font-bold flex items-center gap-1 justify-end',
                    pnlColor,
                  )}
                >
                  {pos.pnl > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : pos.pnl < 0 ? (
                    <TrendingDown className="h-3.5 w-3.5" />
                  ) : (
                    <Minus className="h-3.5 w-3.5" />
                  )}
                  {pos.pnl > 0 ? '+' : ''}
                  {pos.pnl.toFixed(8)} {quoteCurrency}
                </span>
              }
            />
          )}
          <Row
            label={t('tradeHistory.modal.positionFees')}
            value={`${pos.fees.toFixed(8)} ${quoteCurrency}`}
          />
          <Row
            label={t('tradeHistory.modal.entryAt')}
            value={new Date(pos.entryAt).toLocaleString()}
          />
          {pos.exitAt && (
            <Row
              label={t('tradeHistory.modal.exitAt')}
              value={new Date(pos.exitAt).toLocaleString()}
            />
          )}
        </dl>
      )}

      {/* ── Config ── */}
      {cfg && (
        <dl className="space-y-2.5 border-t border-border pt-3">
          <SectionLabel>{t('tradeHistory.modal.sectionConfig')}</SectionLabel>
          <Row
            label={t('tradeHistory.modal.stopLoss')}
            value={
              <span className="text-red-400 font-semibold flex items-center gap-1.5">
                {(cfg.stopLossPct * 100).toFixed(1)}%
                <span className="text-xs font-normal text-muted-foreground">
                  → {(pos.entryPrice * (1 - cfg.stopLossPct)).toFixed(8)}{' '}
                  {quoteCurrency}
                </span>
              </span>
            }
          />
          <Row
            label={t('tradeHistory.modal.takeProfit')}
            value={
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                {(cfg.takeProfitPct * 100).toFixed(1)}%
                <span className="text-xs font-normal text-muted-foreground">
                  → {(pos.entryPrice * (1 + cfg.takeProfitPct)).toFixed(8)}{' '}
                  {quoteCurrency}
                </span>
              </span>
            }
          />
          <Row
            label={t('tradeHistory.modal.maxTrade')}
            value={
              <span className="flex items-center gap-1.5">
                {(cfg.maxTradePct * 100).toFixed(1)}%
                <span className="text-xs font-normal text-muted-foreground">
                  → {(pos.entryPrice * trade.quantity).toFixed(8)}{' '}
                  {quoteCurrency}
                </span>
              </span>
            }
          />
          <Row
            label={t('tradeHistory.modal.buyThreshold')}
            value={`${cfg.buyThreshold}%`}
          />
          <Row
            label={t('tradeHistory.modal.sellThreshold')}
            value={`${cfg.sellThreshold}%`}
          />
          <Row
            label={t('tradeHistory.modal.minInterval')}
            value={`${cfg.minIntervalMinutes} min`}
          />
          {cfg.orderPriceOffsetPct !== 0 && (
            <Row
              label={t('tradeHistory.modal.priceOffset')}
              value={`${(cfg.orderPriceOffsetPct * 100).toFixed(2)}%`}
            />
          )}
        </dl>
      )}
    </div>
  );

  return (
    <TabModal
      icon={Receipt}
      title={t('tradeHistory.modal.title')}
      subtitle={pos ? `${pos.asset}/${pos.pair}` : undefined}
      badgeHeader={trade.type}
      badgeHeaderClassName={badgeClassName}
      content={bodyContent}
      footerLabel={t('tradeHistory.modal.feeExplain', {
        fee: trade.fee.toFixed(4),
        total: totalValue.toFixed(2),
      })}
      onClose={onClose}
    />
  );
}
