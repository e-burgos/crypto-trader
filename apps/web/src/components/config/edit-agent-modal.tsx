import { useState } from 'react';
import {
  Loader2,
  TestTube2,
  Info,
  Pencil,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Target,
  DollarSign,
  Wallet,
  Repeat2,
  Clock,
  ArrowUpDown,
  Bot,
  SlidersHorizontal,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { TabModal } from '@crypto-trader/ui';
import type { TradingConfig } from '../../hooks/use-trading';
import {
  useUpdateConfig,
  type TradingConfigDto,
  type TradingMode,
  type IntervalMode,
} from '../../hooks/use-trading';
import { useTestnetBinanceKeyStatus } from '../../hooks/use-user';
import { type ConfigForm, StepperSlider } from './constants';

export function EditAgentModal({
  cfg,
  onClose,
}: {
  cfg: TradingConfig;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { mutate: updateConfig, isPending } = useUpdateConfig();
  const { data: testnetKeyStatus } = useTestnetBinanceKeyStatus();
  const hasTestnetKeys = testnetKeyStatus?.hasKeys ?? false;

  const toForm = (c: TradingConfig): ConfigForm => ({
    name: c.name ?? '',
    asset: c.asset,
    pair: c.pair,
    mode: c.mode,
    buyThreshold: String(c.buyThreshold),
    sellThreshold: String(c.sellThreshold),
    stopLossPct: String((c.stopLossPct * 100).toFixed(1)),
    takeProfitPct: String((c.takeProfitPct * 100).toFixed(1)),
    minProfitPct: String((c.minProfitPct * 100).toFixed(1)),
    maxTradePct: String((c.maxTradePct * 100).toFixed(0)),
    maxConcurrentPositions: String(c.maxConcurrentPositions),
    intervalMode: c.intervalMode,
    minIntervalMinutes: String(c.minIntervalMinutes),
    orderPriceOffsetPct: String((c.orderPriceOffsetPct * 100).toFixed(1)),
    riskProfile: c.riskProfile ?? 'MODERATE',
  });

  const [form, setForm] = useState<ConfigForm>(() => toForm(cfg));

  function update(patch: Partial<ConfigForm>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function handleSave() {
    const dto: Partial<TradingConfigDto> = {
      name: form.name || undefined,
      buyThreshold: parseFloat(form.buyThreshold),
      sellThreshold: parseFloat(form.sellThreshold),
      stopLossPct: parseFloat(form.stopLossPct) / 100,
      takeProfitPct: parseFloat(form.takeProfitPct) / 100,
      minProfitPct: parseFloat(form.minProfitPct) / 100,
      maxTradePct: parseFloat(form.maxTradePct) / 100,
      maxConcurrentPositions: parseInt(form.maxConcurrentPositions),
      intervalMode: form.intervalMode,
      minIntervalMinutes: parseInt(form.minIntervalMinutes),
      orderPriceOffsetPct: parseFloat(form.orderPriceOffsetPct) / 100,
      riskProfile: form.riskProfile,
    };
    updateConfig({ id: cfg.id, data: dto }, { onSuccess: onClose });
  }

  const content = (
    <div className="space-y-4">
      {/* Name */}
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <label className="mb-1 block text-sm font-semibold">
          {t('trading.agentName')}
        </label>
        <input
          type="text"
          maxLength={50}
          value={form.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder={t('trading.agentNamePlaceholder')}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Mode (read-only) */}
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <label className="mb-1 block text-sm font-semibold">
          {t('trading.mode')}
        </label>
        <div className="mt-2.5 flex gap-2">
          {(['SANDBOX', 'TESTNET', 'LIVE'] as TradingMode[]).map((m) => (
            <button
              key={m}
              type="button"
              disabled
              className={cn(
                'flex-1 rounded-lg border py-2 text-xs font-bold transition-colors cursor-not-allowed',
                form.mode === m
                  ? m === 'LIVE'
                    ? 'border-red-500 bg-red-500/10 text-red-400'
                    : m === 'TESTNET'
                      ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                      : 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground opacity-40',
              )}
            >
              {m === 'TESTNET' ? (
                <span className="flex items-center justify-center gap-1">
                  <TestTube2 className="h-3 w-3" />
                  Testnet
                </span>
              ) : m === 'SANDBOX' ? (
                t('trading.sandbox')
              ) : (
                t('trading.live')
              )}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t(
            'config.editModal.modeReadonly',
            'El modo se asigna desde la configuración global al crear el agente.',
          )}
        </p>
      </div>

      {/* AI Model — info */}
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">
            {t('config.editModal.aiModel')}
          </p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t(
            'config.editModal.aiModelNote',
            'El modelo IA lo gestiona SIGMA desde Configuración → Agentes.',
          )}
        </p>
      </div>

      {/* Thresholds */}
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
        <p className="text-sm font-semibold">
          {t('trading.decisionThresholds')}
        </p>
        <StepperSlider
          icon={TrendingUp}
          label={t('trading.buyThreshold')}
          hint={t('tooltips.buyThreshold')}
          value={form.buyThreshold}
          min={50}
          max={95}
          onChange={(v) => update({ buyThreshold: v })}
        />
        <StepperSlider
          icon={TrendingDown}
          label={t('trading.sellThreshold')}
          hint={t('tooltips.sellThreshold')}
          value={form.sellThreshold}
          min={50}
          max={95}
          onChange={(v) => update({ sellThreshold: v })}
        />
      </div>

      {/* Risk */}
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
        <p className="text-sm font-semibold">{t('trading.riskManagement')}</p>
        <StepperSlider
          icon={ShieldAlert}
          label={t('trading.stopLoss')}
          hint={t('tooltips.stopLoss')}
          value={form.stopLossPct}
          min={0.5}
          max={20}
          step={0.5}
          onChange={(v) => update({ stopLossPct: v })}
        />
        <StepperSlider
          icon={Target}
          label={t('trading.takeProfit')}
          hint={t('tooltips.takeProfit')}
          value={form.takeProfitPct}
          min={0.5}
          max={50}
          step={0.5}
          onChange={(v) => update({ takeProfitPct: v })}
        />
        <StepperSlider
          icon={DollarSign}
          label={t('trading.minProfit')}
          hint={t('tooltips.minProfit')}
          value={form.minProfitPct}
          min={0}
          max={5}
          step={0.1}
          onChange={(v) => update({ minProfitPct: v })}
        />
        <StepperSlider
          icon={Wallet}
          label={t('trading.maxTrade')}
          hint={t('tooltips.maxTrade')}
          value={form.maxTradePct}
          min={1}
          max={50}
          onChange={(v) => update({ maxTradePct: v })}
        />
      </div>

      {/* Timing */}
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
        <p className="text-sm font-semibold">{t('trading.timing')}</p>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Repeat2 className="h-3.5 w-3.5" />
            {t('trading.maxConcurrent')}
          </label>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 5, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => update({ maxConcurrentPositions: String(n) })}
                className={cn(
                  'flex-1 min-w-[3rem] rounded-lg border py-2 text-sm font-bold transition-colors',
                  form.maxConcurrentPositions === String(n)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/30',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {t('trading.minInterval')}
          </label>
          <div className="flex gap-2 mb-2">
            {(['AGENT', 'CUSTOM'] as IntervalMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => update({ intervalMode: m })}
                className={cn(
                  'flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors',
                  form.intervalMode === m
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/30',
                )}
              >
                <span className="flex items-center justify-center gap-1.5">
                  {m === 'AGENT' ? (
                    <Bot className="h-3.5 w-3.5" />
                  ) : (
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                  )}
                  {m === 'AGENT'
                    ? t('trading.intervalModeAgent')
                    : t('trading.intervalModeCustom')}
                </span>
              </button>
            ))}
          </div>
          {form.intervalMode === 'AGENT' ? (
            <p className="text-xs text-muted-foreground rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
              {t('trading.intervalModeAgentHint')}
            </p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {[5, 15, 30, 60, 120].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => update({ minIntervalMinutes: String(n) })}
                  className={cn(
                    'flex-1 min-w-[3rem] rounded-lg border py-2 text-xs font-bold transition-colors',
                    form.minIntervalMinutes === String(n)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30',
                  )}
                >
                  {n}m
                </button>
              ))}
            </div>
          )}
        </div>

        <StepperSlider
          icon={ArrowUpDown}
          label={t('trading.orderPriceOffset')}
          hint={t('tooltips.orderPriceOffset')}
          value={form.orderPriceOffsetPct}
          min={-5}
          max={5}
          step={0.5}
          signed={true}
          onChange={(v) => update({ orderPriceOffsetPct: v })}
        />
      </div>
    </div>
  );

  return (
    <TabModal
      icon={Pencil}
      title={t('config.editModal.title')}
      subtitle={`${cfg.asset}/${cfg.pair} · ${cfg.mode}`}
      content={content}
      successButton={{
        label: isPending ? t('common.saving') : t('common.save'),
        onClick: handleSave,
      }}
      closeButton={{
        label: t('common.cancel'),
        onClick: onClose,
      }}
      onClose={onClose}
    />
  );
}
