import { useState } from 'react';
import { Pencil, Check, Loader2, Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TabModal } from '@crypto-trader/ui';
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

  const content = (
    <div className="space-y-4">
      {/* Editable name */}
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
          <span className="font-semibold text-sm">
            {cfg.name ? cfg.name : `${cfg.asset}/${cfg.pair}`}
          </span>
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

      {/* Rows */}
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
  );

  return (
    <TabModal
      icon={Bot}
      title={cfg.name || `${cfg.asset}/${cfg.pair}`}
      subtitle={`${cfg.asset}/${cfg.pair} · ${cfg.mode}`}
      badgeHeader={isRunning ? t('common.running') : t('common.stopped')}
      badgeHeaderClassName={
        isRunning
          ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
          : 'text-muted-foreground bg-muted/30 border-border'
      }
      content={content}
      successButton={
        isRunning
          ? {
              label: t('trading.stopAgent'),
              onClick: () => {
                onStop();
                onClose();
              },
            }
          : {
              label: t('trading.startAgent'),
              onClick: () => {
                onStart();
                onClose();
              },
            }
      }
      closeLabel={t('common.close')}
      onClose={onClose}
    />
  );
}
