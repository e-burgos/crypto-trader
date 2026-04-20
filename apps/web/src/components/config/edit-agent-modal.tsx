import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Save, Loader2, X, TestTube2, Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { Select } from '@crypto-trader/ui';
import type { TradingConfig } from '../../hooks/use-trading';
import {
  useUpdateConfig,
  type TradingConfigDto,
  type TradingMode,
  type IntervalMode,
} from '../../hooks/use-trading';
import { useTestnetBinanceKeyStatus, useLLMKeys } from '../../hooks/use-user';
import { DynamicModelSelect } from '../../containers/settings/dynamic-model-select';
import { LLM_PROVIDERS, type ConfigForm, StepperSlider } from './constants';

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
  const { data: llmKeys = [] } = useLLMKeys();

  const activeProviders = LLM_PROVIDERS.filter((p) =>
    llmKeys.some((k) => k.provider === p.value && k.isActive),
  );
  const activeProviderOptions = activeProviders.map((p) => ({
    value: p.value,
    label: p.label,
  }));

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
    primaryProvider: c.primaryProvider ?? '',
    primaryModel: c.primaryModel ?? '',
    fallbackProvider: c.fallbackProvider ?? '',
    fallbackModel: c.fallbackModel ?? '',
  });

  const [form, setForm] = useState<ConfigForm>(() => toForm(cfg));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function update(patch: Partial<ConfigForm>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function handleProviderChange(
    role: 'primary' | 'fallback',
    provider: string,
  ) {
    if (role === 'primary') {
      update({ primaryProvider: provider, primaryModel: '' });
    } else {
      update({ fallbackProvider: provider, fallbackModel: '' });
    }
  }

  function handleSave() {
    const dto: Partial<TradingConfigDto> = {
      name: form.name || undefined,
      mode: form.mode,
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
      primaryProvider: form.primaryProvider || undefined,
      primaryModel: form.primaryModel || undefined,
      fallbackProvider: form.fallbackProvider || undefined,
      fallbackModel: form.fallbackModel || undefined,
    };
    updateConfig({ id: cfg.id, data: dto }, { onSuccess: onClose });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full sm:max-w-lg max-h-[96dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
          <div>
            <h2 className="text-base font-bold">
              {t('config.editModal.title')}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {cfg.asset}/{cfg.pair} · {cfg.mode}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
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

          {/* Mode */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <label className="mb-1 block text-sm font-semibold">
              {t('trading.mode')}
            </label>
            <div className="mt-2.5 flex gap-2">
              {(['SANDBOX', 'TESTNET', 'LIVE'] as TradingMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => update({ mode: m })}
                  className={cn(
                    'flex-1 rounded-lg border py-2 text-xs font-bold transition-colors',
                    form.mode === m
                      ? m === 'LIVE'
                        ? 'border-red-500 bg-red-500/10 text-red-400'
                        : m === 'TESTNET'
                          ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                          : 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30',
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
            {form.mode === 'LIVE' && (
              <p className="mt-2 text-xs text-red-400">
                ⚠️ {t('trading.realFundsWarning')}
              </p>
            )}
            {form.mode === 'TESTNET' && !hasTestnetKeys && (
              <p className="mt-2 text-xs text-sky-400">
                {t('onboarding.testnetRequiresKeys')}
              </p>
            )}
          </div>

          {/* AI Model */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">
                {t('config.editModal.aiModel')}
              </p>
            </div>

            {activeProviderOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t('config.stepper.noActiveProviders')}
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Select
                      options={[
                        { value: '', label: t('config.stepper.autoSelect') },
                        ...activeProviderOptions,
                      ]}
                      value={form.primaryProvider}
                      onChange={(v) => handleProviderChange('primary', v)}
                      label={t('config.stepper.primaryLabel')}
                    />
                    {form.primaryProvider && (
                      <DynamicModelSelect
                        provider={form.primaryProvider}
                        value={form.primaryModel}
                        onChange={(m) => update({ primaryModel: m })}
                        label={t('settings.model')}
                        fallbackModels={
                          LLM_PROVIDERS.find(
                            (p) => p.value === form.primaryProvider,
                          )?.models ?? []
                        }
                      />
                    )}
                  </div>
                </div>

                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Select
                      options={[
                        { value: '', label: t('config.stepper.noFallback') },
                        ...activeProviderOptions,
                      ]}
                      value={form.fallbackProvider}
                      onChange={(v) => handleProviderChange('fallback', v)}
                      label={t('config.stepper.fallbackLabel')}
                    />
                    {form.fallbackProvider && (
                      <DynamicModelSelect
                        provider={form.fallbackProvider}
                        value={form.fallbackModel}
                        onChange={(m) => update({ fallbackModel: m })}
                        label={t('settings.model')}
                        fallbackModels={
                          LLM_PROVIDERS.find(
                            (p) => p.value === form.fallbackProvider,
                          )?.models ?? []
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Thresholds */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
            <p className="text-sm font-semibold">
              {t('trading.decisionThresholds')}
            </p>
            <StepperSlider
              label={`📈 ${t('trading.buyThreshold')}`}
              hint={t('tooltips.buyThreshold')}
              value={form.buyThreshold}
              min={50}
              max={95}
              onChange={(v) => update({ buyThreshold: v })}
            />
            <StepperSlider
              label={`📉 ${t('trading.sellThreshold')}`}
              hint={t('tooltips.sellThreshold')}
              value={form.sellThreshold}
              min={50}
              max={95}
              onChange={(v) => update({ sellThreshold: v })}
            />
          </div>

          {/* Risk */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
            <p className="text-sm font-semibold">
              {t('trading.riskManagement')}
            </p>
            <StepperSlider
              label={`🔴 ${t('trading.stopLoss')}`}
              hint={t('tooltips.stopLoss')}
              value={form.stopLossPct}
              min={0.5}
              max={20}
              step={0.5}
              onChange={(v) => update({ stopLossPct: v })}
            />
            <StepperSlider
              label={`🟢 ${t('trading.takeProfit')}`}
              hint={t('tooltips.takeProfit')}
              value={form.takeProfitPct}
              min={0.5}
              max={50}
              step={0.5}
              onChange={(v) => update({ takeProfitPct: v })}
            />
            <StepperSlider
              label={`💰 ${t('trading.minProfit')}`}
              hint={t('tooltips.minProfit')}
              value={form.minProfitPct}
              min={0}
              max={5}
              step={0.1}
              onChange={(v) => update({ minProfitPct: v })}
            />
            <StepperSlider
              label={`💼 ${t('trading.maxTrade')}`}
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
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                🔁 {t('trading.maxConcurrent')}
              </label>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 5, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      update({ maxConcurrentPositions: String(n) })
                    }
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
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                ⏱️ {t('trading.minInterval')}
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
                    {m === 'AGENT'
                      ? `🤖 ${t('trading.intervalModeAgent')}`
                      : `✏️ ${t('trading.intervalModeCustom')}`}
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
              label={`📊 ${t('trading.orderPriceOffset')}`}
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

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border px-5 py-4 bg-muted/10">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 shadow-sm transition-all disabled:opacity-60"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.saving')}
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {t('common.save')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
