import { useState, useEffect } from 'react';
import { Filter, Eye, X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useTradeHistory, type Trade } from '../../hooks/use-analytics';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { usePlatformMode } from '../../hooks/use-user';

type FilterType =
  | 'ALL'
  | 'BUY'
  | 'SELL'
  | 'LIVE'
  | 'TESTNET'
  | 'SANDBOX'
  | 'PAPER';

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
  const pos = trade.position;
  const cfg = pos?.config;
  const asset =
    pos?.asset ?? trade.pair?.replace(/USDT|BTC|ETH|BNB|BUSD/, '') ?? '';
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
        className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">
              {t('tradeHistory.modal.title')}
            </h2>
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
          {/* ── Trade ── */}
          <dl className="space-y-2.5">
            <SectionLabel>Trade</SectionLabel>
            <Row
              label={t('tradeHistory.modal.asset')}
              value={pos?.asset || '—'}
            />
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
              <SectionLabel>
                {t('tradeHistory.modal.sectionPosition')}
              </SectionLabel>
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
              <SectionLabel>
                {t('tradeHistory.modal.sectionConfig')}
              </SectionLabel>
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

        {/* Footer note */}
        <div className="px-6 py-3 border-t border-border shrink-0">
          <p className="text-xs text-muted-foreground">
            {t('tradeHistory.modal.feeExplain', {
              fee: trade.fee.toFixed(4),
              total: totalValue.toFixed(2),
            })}
          </p>
        </div>
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
        $
        {totalValue.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
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
  const { mode: platformMode } = usePlatformMode();
  const [filter, setFilter] = useState<FilterType>(() => platformMode);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const { data: trades = [], isLoading } = useTradeHistory(100);

  // Sincronizar filtro con el modo global cuando cambia
  useEffect(() => {
    setFilter(platformMode);
  }, [platformMode]);

  const filtered = trades.filter((tr) => {
    if (filter === 'ALL') return true;
    if (filter === 'BUY') return tr.type === 'BUY';
    if (filter === 'SELL') return tr.type === 'SELL';
    if (filter === 'LIVE') return tr.mode === 'LIVE';
    if (filter === 'TESTNET') return tr.mode === 'TESTNET';
    if (filter === 'SANDBOX')
      return tr.mode === 'SANDBOX' || tr.mode === 'PAPER';
    if (filter === 'PAPER') return tr.mode === 'PAPER';
    return true;
  });

  const FILTERS: { value: FilterType; label: string }[] = [
    { value: 'ALL', label: t('tradeHistory.all') },
    { value: 'BUY', label: t('tradeHistory.buys') },
    { value: 'SELL', label: t('tradeHistory.sells') },
    { value: 'SANDBOX', label: 'Sandbox' },
    { value: 'TESTNET', label: 'Testnet' },
    { value: 'LIVE', label: t('tradeHistory.live') },
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
