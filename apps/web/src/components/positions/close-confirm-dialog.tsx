import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Button } from '@crypto-trader/ui';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { TradingPosition } from '../../hooks/use-trading';
import { useMarketStore } from '../../store/market.store';

export function CloseConfirmDialog({
  position,
  onConfirm,
  onCancel,
  isLoading,
}: {
  position: TradingPosition;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const prices = useMarketStore((s) => s.prices);
  const symbol = `${position.asset}${position.pair}`;
  const currentPrice = prices[symbol]?.price;
  const quoteCurrency = position.pair.replace(position.asset, '') || 'USDT';
  const baseCurrency = position.asset;

  const FEE_PCT = 0.001;
  const exitFee =
    currentPrice != null ? currentPrice * position.quantity * FEE_PCT : null;
  const netPnl =
    currentPrice != null && exitFee != null
      ? (currentPrice - position.entryPrice) * position.quantity -
        position.fees -
        exitFee
      : null;
  const isProfit = netPnl != null && netPnl >= 0;

  function InfoRow({
    label,
    value,
    valueClass,
  }: {
    label: string;
    value: React.ReactNode;
    valueClass?: string;
  }) {
    return (
      <div className="grid grid-cols-2 gap-2 items-center">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn('text-xs font-mono text-right', valueClass)}>
          {value}
        </span>
      </div>
    );
  }

  return (
    <div className="fixed p-4 inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 ring-1 ring-red-500/30">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {t('positions.confirmCloseTitle')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('positions.confirmCloseDesc')}
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-border overflow-hidden text-sm">
          <div className="bg-muted/30 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t('trading.asset')}
              </span>
              <span className="font-bold tracking-wide">
                {position.asset}
                <span className="text-muted-foreground font-normal">
                  /{position.pair}
                </span>
              </span>
            </div>
            <InfoRow
              label={t('tradeHistory.qty')}
              value={
                <>
                  {position.quantity.toFixed(8)}{' '}
                  <span className="text-muted-foreground">{baseCurrency}</span>
                </>
              }
            />
            <InfoRow
              label={t('positions.entryPrice')}
              value={
                <>
                  {position.entryPrice.toFixed(8)}{' '}
                  <span className="text-muted-foreground">{quoteCurrency}</span>
                </>
              }
            />
            {currentPrice != null && (
              <InfoRow
                label={t('positions.confirmClose.currentPrice')}
                value={
                  <>
                    {currentPrice.toFixed(8)}{' '}
                    <span className="text-muted-foreground">
                      {quoteCurrency}
                    </span>
                  </>
                }
              />
            )}
          </div>

          <div className="border-t border-border/40 bg-muted/10 px-4 py-3 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-bold">
              {t('positions.confirmClose.feesSection')}
            </p>
            <InfoRow
              label={t('positions.confirmClose.entryFee')}
              value={
                <>
                  {position.fees.toFixed(8)}{' '}
                  <span className="text-amber-400/60">{quoteCurrency}</span>
                </>
              }
              valueClass="text-amber-500"
            />
            {exitFee != null && (
              <InfoRow
                label={t('positions.confirmClose.exitFee')}
                value={
                  <>
                    ~{exitFee.toFixed(8)}{' '}
                    <span className="text-amber-400/60">{quoteCurrency}</span>
                  </>
                }
                valueClass="text-amber-500"
              />
            )}
          </div>

          {netPnl != null && (
            <div
              className={cn(
                'border-t border-border/40 px-4 py-3 flex items-center justify-between',
                isProfit ? 'bg-emerald-500/5' : 'bg-red-500/5',
              )}
            >
              <span className="text-xs font-medium text-muted-foreground">
                {t('positions.confirmClose.estimatedPnl')}
              </span>
              <span
                className={cn(
                  'flex items-center gap-1 font-mono font-bold',
                  isProfit ? 'text-emerald-400' : 'text-red-400',
                )}
              >
                {isProfit ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {isProfit ? '+' : ''}
                {netPnl.toFixed(8)}
                <span className="text-xs font-normal opacity-70">
                  {quoteCurrency}
                </span>
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={onCancel}
            disabled={isLoading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'flex flex-1 items-center justify-center px-4 py-2 text-sm font-semibold transition-all',
              'bg-red-500 text-white hover:bg-red-600 active:scale-95',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {isLoading ? t('common.loading') : t('positions.closeNow')}
          </Button>
        </div>
      </div>
    </div>
  );
}
