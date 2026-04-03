import { useRef, useState, useEffect } from 'react';
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  X,
  AlertTriangle,
  Wifi,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTranslation } from 'react-i18next';
import {
  usePositions,
  useClosePosition,
  TradingPosition,
} from '../../hooks/use-trading';
import { useLivePrices, calcUnrealizedPnl } from '../../hooks/use-live-prices';
import { useMarketStore } from '../../store/market.store';
import { InfoTooltip } from '../../components/ui/info-tooltip';

const PAGE_SIZE = 20;

type StatusTab = 'OPEN' | 'CLOSED';

// ── Confirm dialog ──────────────────────────────────────────────────────────
function CloseConfirmDialog({
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 ring-1 ring-red-500/30">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {t('positions.confirmCloseTitle', {
                defaultValue: 'Close position?',
              })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('positions.confirmCloseDesc', {
                defaultValue:
                  'This will execute a market SELL order and cannot be undone.',
              })}
            </p>
          </div>
        </div>
        <div className="mb-5 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('trading.asset')}</span>
            <span className="font-semibold">
              {position.asset}/{position.pair}
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">
              {t('tradeHistory.qty')}
            </span>
            <span className="font-mono">{position.quantity.toFixed(6)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">
              {t('positions.entryPrice')}
            </span>
            <span className="font-mono">
              $
              {position.entryPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={onCancel}
            disabled={isLoading}
          >
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'flex flex-1 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-all',
              'bg-red-500 text-white hover:bg-red-600 active:scale-95',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {isLoading
              ? t('common.loading', { defaultValue: 'Closing…' })
              : t('positions.closeNow', { defaultValue: 'Close now' })}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Live P&L cell ─────────────────────────────────────────────────────────
function LivePnlCell({ pos }: { pos: TradingPosition }) {
  const { t } = useTranslation();
  const prices = useMarketStore((s) => s.prices);
  const symbol = `${pos.asset}${pos.pair}`;
  const currentPrice = prices[symbol]?.price;
  const pnl = calcUnrealizedPnl(
    pos.entryPrice,
    pos.quantity,
    pos.fees,
    currentPrice,
  );
  const cellRef = useRef<HTMLSpanElement>(null);
  const prevPnl = useRef<number | null>(null);

  useEffect(() => {
    if (pnl == null || cellRef.current == null) return;
    if (prevPnl.current != null && prevPnl.current !== pnl) {
      const up = pnl > prevPnl.current;
      gsap.fromTo(
        cellRef.current,
        {
          backgroundColor: up
            ? 'rgba(52,211,153,0.25)'
            : 'rgba(248,113,113,0.25)',
        },
        { backgroundColor: 'transparent', duration: 0.8, ease: 'power2.out' },
      );
    }
    prevPnl.current = pnl;
  }, [pnl]);

  if (pnl == null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60">
        <Wifi className="h-3 w-3 animate-pulse" />
        {t('positions.loadingPrice', { defaultValue: 'Loading…' })}
      </span>
    );
  }

  const isProfit = pnl >= 0;
  const pct = (pnl / (pos.entryPrice * pos.quantity)) * 100;

  return (
    <span
      ref={cellRef}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold transition-colors',
        isProfit ? 'text-emerald-400' : 'text-red-400',
      )}
    >
      {isProfit ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {isProfit ? '+' : ''}
      {pnl.toFixed(2)} {pos.pair}
      <span
        className={cn(
          'opacity-70',
          isProfit ? 'text-emerald-400' : 'text-red-400',
        )}
      >
        ({isProfit ? '+' : ''}
        {pct.toFixed(2)}%)
      </span>
    </span>
  );
}

export function PositionsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<StatusTab>('OPEN');
  const [confirmPos, setConfirmPos] = useState<TradingPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = usePositions(page, PAGE_SIZE, tab);
  const closePosition = useClosePosition();
  const positions = data?.positions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Collect unique symbols from open positions and keep prices fresh
  const openSymbols =
    tab === 'OPEN'
      ? [...new Set(positions.map((p) => `${p.asset}${p.pair}`))]
      : [];
  useLivePrices(openSymbols);

  const handleTabChange = (next: StatusTab) => {
    setTab(next);
    setPage(1);
  };

  const handleConfirmClose = () => {
    if (!confirmPos) return;
    closePosition.mutate(confirmPos.id, {
      onSettled: () => setConfirmPos(null),
    });
  };

  useGSAP(
    () => {
      if (isLoading) return;
      gsap.fromTo(
        '.position-row',
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, stagger: 0.04, duration: 0.35, ease: 'power2.out' },
      );
    },
    { scope: containerRef, dependencies: [isLoading, page, tab] },
  );

  return (
    <div ref={containerRef} className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('sidebar.positions')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('positions.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
        {(['OPEN', 'CLOSED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => handleTabChange(s)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              tab === s
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {s === 'OPEN'
              ? t('positions.tabOpen', { defaultValue: 'Open' })
              : t('positions.tabClosed', { defaultValue: 'Closed' })}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : positions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <Briefcase className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">{t('common.empty')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('positions.noPositionsHint')}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('trading.asset')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('trading.mode')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    {t('positions.entryPrice')}
                  </th>
                  {tab === 'CLOSED' && (
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      {t('positions.exitPrice', { defaultValue: 'Exit Price' })}
                    </th>
                  )}
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    {t('tradeHistory.qty')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
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
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    {tab === 'CLOSED'
                      ? t('positions.closed', { defaultValue: 'Closed' })
                      : t('positions.opened')}
                  </th>
                  {tab === 'OPEN' && (
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      {t('common.action', { defaultValue: 'Action' })}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => {
                  const isProfit = (pos.pnl ?? 0) >= 0;
                  return (
                    <tr
                      key={pos.id}
                      className="position-row border-b border-border/50 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold">
                        {pos.asset}/{pos.pair}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-semibold',
                            pos.mode === 'LIVE'
                              ? 'bg-red-500/10 text-red-500'
                              : 'bg-blue-500/10 text-blue-500',
                          )}
                        >
                          {pos.mode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        $
                        {pos.entryPrice.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      {tab === 'CLOSED' && (
                        <td className="px-4 py-3 text-right font-mono">
                          {pos.exitPrice != null
                            ? `$${pos.exitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                            : '—'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right font-mono">
                        {pos.quantity.toFixed(6)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {tab === 'OPEN' ? (
                          <LivePnlCell pos={pos} />
                        ) : pos.pnl != null ? (
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
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {tab === 'CLOSED' && pos.exitAt
                          ? new Date(pos.exitAt).toLocaleDateString()
                          : new Date(pos.entryAt).toLocaleDateString()}
                      </td>
                      {tab === 'OPEN' && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setConfirmPos(pos)}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
                              'bg-red-500/10 text-red-400 ring-1 ring-red-500/20',
                              'hover:bg-red-500/20 hover:ring-red-500/40 active:scale-95',
                            )}
                          >
                            <X className="h-3 w-3" />
                            {t('positions.close', { defaultValue: 'Close' })}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {confirmPos && (
        <CloseConfirmDialog
          position={confirmPos}
          onConfirm={handleConfirmClose}
          onCancel={() => setConfirmPos(null)}
          isLoading={closePosition.isPending}
        />
      )}
    </div>
  );
}
