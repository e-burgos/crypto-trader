import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, Square, Loader2, X, Pencil, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { Button } from '@crypto-trader/ui';
import type { TradingConfig } from '../../hooks/use-trading';
import { useUpdateConfig } from '../../hooks/use-trading';

export function AgentDetailModal({
  cfg,
  isRunning,
  onClose,
  onStart,
  onStop,
}: {
  cfg: TradingConfig;
  isRunning: boolean;
  onClose: () => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const { t } = useTranslation();
  const { mutate: updateConfig, isPending: isSavingName } = useUpdateConfig();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(cfg.name || '');

  function saveName() {
    updateConfig(
      { id: cfg.id, data: { name: nameValue } },
      { onSuccess: () => setEditingName(false) },
    );
  }

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: t('trading.asset'), value: `${cfg.asset} / ${cfg.pair}` },
    { label: t('trading.mode'), value: cfg.mode },
    {
      label: t('trading.buyThreshold'),
      value: `${cfg.buyThreshold.toFixed(0)}%`,
    },
    {
      label: t('trading.sellThreshold'),
      value: `${cfg.sellThreshold.toFixed(0)}%`,
    },
    {
      label: t('trading.stopLoss'),
      value: (
        <span className="text-red-400">
          {(cfg.stopLossPct * 100).toFixed(1)}%
        </span>
      ),
    },
    {
      label: t('trading.takeProfit'),
      value: (
        <span className="text-emerald-400">
          {(cfg.takeProfitPct * 100).toFixed(1)}%
        </span>
      ),
    },
    {
      label: t('trading.maxTrade'),
      value: `${(cfg.maxTradePct * 100).toFixed(0)}%`,
    },
    {
      label: t('trading.maxConcurrent'),
      value: cfg.maxConcurrentPositions,
    },
    {
      label: t('trading.minInterval'),
      value: `${cfg.minIntervalMinutes} min`,
    },
    {
      label: t('trading.orderPriceOffset'),
      value: (
        <span
          className={
            cfg.orderPriceOffsetPct < 0
              ? 'text-emerald-400'
              : cfg.orderPriceOffsetPct > 0
                ? 'text-amber-400'
                : 'text-muted-foreground'
          }
        >
          {cfg.orderPriceOffsetPct > 0 ? '+' : ''}
          {(cfg.orderPriceOffsetPct * 100).toFixed(1)}%
        </span>
      ),
    },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      <div
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex-1 min-w-0 pr-4">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  maxLength={50}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  className="flex-1 rounded-md border border-primary/50 bg-background px-2 py-1 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  type="button"
                  onClick={saveName}
                  disabled={isSavingName}
                  className="rounded p-1 text-emerald-500 hover:bg-emerald-500/10"
                >
                  {isSavingName ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group">
                <h2 className="font-bold truncate">
                  {cfg.name ? cfg.name : `${cfg.asset}/${cfg.pair}`}
                </h2>
                <button
                  type="button"
                  title={t('trading.agentName')}
                  onClick={() => setEditingName(true)}
                  className="rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {cfg.asset}/{cfg.pair} · {cfg.mode}
            </p>
            <span
              className={cn(
                'mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                isRunning
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isRunning ? 'bg-emerald-500' : 'bg-muted-foreground',
                )}
              />
              {isRunning ? t('common.running') : t('common.stopped')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <dl className="space-y-2">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2"
              >
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="text-xs font-semibold">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4">
          {isRunning ? (
            <Button
              variant="ghost"
              className="w-full gap-2 text-red-500 hover:text-red-600"
              onClick={() => {
                onStop();
                onClose();
              }}
            >
              <Square className="h-4 w-4" />
              {t('trading.stopAgent')}
            </Button>
          ) : (
            <Button
              className="w-full gap-2"
              onClick={() => {
                onStart();
                onClose();
              }}
            >
              <Play className="h-4 w-4" />
              {t('trading.startAgent')}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
