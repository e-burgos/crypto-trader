import { useRef, useState, useEffect, useMemo } from 'react';
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  X,
  AlertTriangle,
  Wifi,
  Eye,
  Minus,
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
import { usePlatformMode } from '../../hooks/use-user';
import { InfoTooltip } from '../../components/ui/info-tooltip';
import {
  DataTable,
  type DataTableColumn,
} from '../../components/ui/data-table';

const PAGE_SIZE = 20;

type StatusTab = 'OPEN' | 'CLOSED';

// ── Position Detail Modal ───────────────────────────────────────────────────
function PositionDetailModal({
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
        {/* Header */}
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

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {/* ── Position ── */}
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

          {/* ── Config ── */}
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

          {/* ── Trades ── */}
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
  const prices = useMarketStore((s) => s.prices);
  const symbol = `${position.asset}${position.pair}`;
  const currentPrice = prices[symbol]?.price;
  const quoteCurrency = position.pair.replace(position.asset, '') || 'USDT';
  const baseCurrency = position.asset;

  const FEE_PCT = 0.001; // 0.1% Binance taker fee
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
        {/* Header */}
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

        {/* Info card */}
        <div className="mb-5 rounded-xl border border-border overflow-hidden text-sm">
          {/* Asset + prices */}
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

          {/* Fees */}
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

          {/* Estimated P&L */}
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

// ── Positions Table (uses DataTable) ─────────────────────────────────────────

function PositionsTable({
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

export function PositionsPage() {
  const { t } = useTranslation();
  const { mode: platformMode } = usePlatformMode();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<StatusTab>('OPEN');
  const [confirmPos, setConfirmPos] = useState<TradingPosition | null>(null);
  const [detailPos, setDetailPos] = useState<TradingPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = usePositions(page, PAGE_SIZE, tab);
  const closePosition = useClosePosition();

  // Resetear página al cambiar modo global
  useEffect(() => {
    setPage(1);
  }, [platformMode]);

  const allPositions = data?.positions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Filtrar posiciones por modo global activo
  const positions = allPositions.filter((p) => {
    return p.mode === platformMode;
  });

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
      const rows = gsap.utils.toArray<Element>(
        '.position-row',
        containerRef.current,
      );
      if (!rows.length) return;
      gsap.fromTo(
        rows,
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
        <PositionsTable
          positions={positions}
          tab={tab}
          t={t}
          onDetail={setDetailPos}
          onClose={setConfirmPos}
        />
      )}

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

      {confirmPos && (
        <CloseConfirmDialog
          position={confirmPos}
          onConfirm={handleConfirmClose}
          onCancel={() => setConfirmPos(null)}
          isLoading={closePosition.isPending}
        />
      )}

      {detailPos && (
        <PositionDetailModal
          position={detailPos}
          onClose={() => setDetailPos(null)}
        />
      )}
    </div>
  );
}
