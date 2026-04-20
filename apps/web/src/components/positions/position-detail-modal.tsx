import { TrendingUp, TrendingDown, Minus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { TradingPosition } from '../../hooks/use-trading';

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">
              {t('positions.modal.title')}
            </h2>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                position.mode === 'LIVE'
                  ? 'bg-red-500/10 text-red-500'
                  : position.mode === 'TESTNET'
                    ? 'bg-sky-500/10 text-sky-400'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {position.mode}
            </span>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                position.status === 'OPEN'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {position.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <dl className="space-y-2.5">
            <SectionLabel>{t('positions.modal.sectionPosition')}</SectionLabel>
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

          {cfg && (
            <dl className="space-y-2.5 border-t border-border pt-3">
              <SectionLabel>{t('positions.modal.sectionConfig')}</SectionLabel>
              <Row
                label={t('positions.modal.stopLoss')}
                value={
                  <span className="text-red-400 font-semibold flex items-center gap-1.5">
                    {(cfg.stopLossPct * 100).toFixed(1)}%
                    <span className="text-xs font-normal text-muted-foreground">
                      →{' '}
                      {(position.entryPrice * (1 - cfg.stopLossPct)).toFixed(8)}{' '}
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
                      →{' '}
                      {(position.entryPrice * (1 + cfg.takeProfitPct)).toFixed(
                        8,
                      )}{' '}
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
          )}

          <div className="border-t border-border pt-3">
            <SectionLabel>{t('positions.modal.sectionTrades')}</SectionLabel>
            {trades.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-2">
                {t('positions.modal.noTrades')}
              </p>
            ) : (
              <div className="mt-2 rounded-xl border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="border-b border-border bg-muted/30">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        {t('positions.modal.tradeType')}
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        {t('positions.modal.tradePrice')}
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        {t('positions.modal.tradeQty')}
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        {t('positions.modal.tradeFee')}
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        {t('positions.modal.tradeAt')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((tr) => (
                      <tr
                        key={tr.id}
                        className="border-b border-border/40 last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-3 py-2">
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
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          $
                          {tr.price.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {tr.quantity.toFixed(6)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-amber-500">
                          ${tr.fee.toFixed(4)}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {new Date(tr.executedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
