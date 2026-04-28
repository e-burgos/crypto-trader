import { useState } from 'react';
import {
  Save,
  Loader2,
  Check,
  Bot,
  TrendingUp,
  TrendingDown,
  Shield,
  Target,
  DollarSign,
  Wallet,
  Repeat2,
  Clock,
  ArrowUpDown,
  SlidersHorizontal,
  ShieldAlert,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { PRESETS, TabModal } from '@crypto-trader/ui';
import {
  useCreateConfig,
  type TradingConfigDto,
  type TradingMode,
  type TradingAsset,
  type TradingPair,
  type IntervalMode,
} from '../../hooks/use-trading';
import {
  type ConfigForm,
  DEFAULT_FORM,
  STEPS,
  type StepId,
  PRESET_META,
  StepperSlider,
} from './constants';

export function NewAgentStepperModal({
  onClose,
  onCreated,
  defaultMode = 'SANDBOX',
}: {
  onClose: () => void;
  onCreated: () => void;
  defaultMode?: TradingMode;
}) {
  const { t } = useTranslation();
  const [stepIdx, setStepIdx] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState<
    keyof typeof PRESETS | null
  >('balanced');
  const [form, setForm] = useState<ConfigForm>({
    ...DEFAULT_FORM,
    ...PRESETS.balanced,
    mode: defaultMode,
  });
  const { mutate: createConfig, isPending } = useCreateConfig();

  const totalSteps = STEPS.length;
  const currentStep = STEPS[stepIdx].id;
  const isLastStep = stepIdx === totalSteps - 1;

  function update(patch: Partial<ConfigForm>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function applyPreset(key: keyof typeof PRESETS) {
    setSelectedPreset(key);
    setForm((f) => ({ ...f, ...PRESETS[key] }));
  }

  function handleSubmit() {
    const dto: TradingConfigDto = {
      name: form.name || undefined,
      asset: form.asset,
      pair: form.pair,
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
    };
    createConfig(dto, { onSuccess: onCreated });
  }

  const STEP_META: Record<StepId, { title: string; subtitle: string }> = {
    preset: {
      title: t('config.stepper.stepPreset'),
      subtitle: t('config.stepper.stepPresetHint'),
    },
    identity: {
      title: t('config.stepper.stepIdentity'),
      subtitle: t('config.stepper.stepIdentityHint'),
    },
    thresholds: {
      title: t('config.stepper.stepThresholds'),
      subtitle: t('config.stepper.stepThresholdsHint'),
    },
    risk: {
      title: t('config.stepper.stepRisk'),
      subtitle: t('config.stepper.stepRiskHint'),
    },
    timing: {
      title: t('config.stepper.stepTiming'),
      subtitle: t('config.stepper.stepTimingHint'),
    },
    review: {
      title: t('config.stepper.stepReview'),
      subtitle: t('config.stepper.stepReviewHint'),
    },
  };

  const meta = STEP_META[currentStep];

  const content = (
    <div className="space-y-4">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 pb-3 border-b border-border/50">
        {STEPS.map((s, i) => {
          const StepIcon = s.icon;
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <button
              key={s.id}
              onClick={() => i < stepIdx && setStepIdx(i)}
              disabled={i > stepIdx}
              className={cn(
                'flex items-center justify-center rounded-full transition-all duration-200',
                active
                  ? 'h-7 w-7 bg-primary text-primary-foreground shadow-md'
                  : done
                    ? 'h-6 w-6 bg-primary/20 text-primary cursor-pointer hover:bg-primary/30'
                    : 'h-5 w-5 bg-muted text-muted-foreground/40 cursor-not-allowed',
              )}
            >
              {done ? (
                <Check className="h-3 w-3" />
              ) : (
                <StepIcon
                  className={cn(active ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5')}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* STEP: PRESET */}
      {currentStep === 'preset' && (
        <div className="space-y-3">
          {PRESET_META.map((pm) => {
            const PresetIcon = pm.icon;
            const preset = PRESETS[pm.key];
            const isSelected = selectedPreset === pm.key;
            return (
              <button
                key={pm.key}
                type="button"
                onClick={() => applyPreset(pm.key)}
                className={cn(
                  'w-full rounded-xl border p-4 text-left transition-all',
                  isSelected
                    ? cn(pm.border, pm.bg, 'ring-1 ring-inset', pm.border)
                    : 'border-border hover:border-primary/30 hover:bg-muted/30',
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                      pm.bg,
                      pm.border,
                    )}
                  >
                    <PresetIcon className={cn('h-4 w-4', pm.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('text-sm font-bold', pm.color)}>
                        {t(`config.guide.preset.${pm.key}`)}
                      </span>
                      {isSelected && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                      {t(`config.guide.preset.${pm.key}Desc`)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground/80">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {t('trading.buyThreshold')}:{' '}
                        <strong>{preset.buyThreshold}%</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Stop Loss: <strong>{preset.stopLossPct}%</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        Take Profit: <strong>{preset.takeProfitPct}%</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Intervalo:{' '}
                        <strong>{preset.minIntervalMinutes} min</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* STEP: IDENTITY */}
      {currentStep === 'identity' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <label className="mb-1 block text-sm font-semibold">
              {t('trading.agentName')}
            </label>
            <p className="mb-2.5 text-xs text-muted-foreground">
              {t('config.stepper.nameHint')}
            </p>
            <input
              type="text"
              maxLength={50}
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder={t('trading.agentNamePlaceholder')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <p className="mb-3 text-sm font-semibold">{t('trading.market')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t('trading.asset')}
                </label>
                <div className="flex gap-2">
                  {(['BTC', 'ETH'] as TradingAsset[]).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => update({ asset: a })}
                      className={cn(
                        'flex-1 rounded-lg border py-2.5 text-sm font-bold transition-colors',
                        form.asset === a
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/40',
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t('trading.pair')}
                </label>
                <div className="flex gap-2">
                  {(['USDT', 'USDC'] as TradingPair[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => update({ pair: p })}
                      className={cn(
                        'flex-1 rounded-lg border py-2.5 text-sm font-bold transition-colors',
                        form.pair === p
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/40',
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <label className="mb-1 block text-sm font-semibold">
              {t('trading.mode')}
            </label>
            <p className="mb-3 text-xs text-muted-foreground">
              {t(
                'config.stepper.modeAutoConfigured',
                'El modo se configura automaticamente segun el modo de operacion global seleccionado en el header.',
              )}
            </p>
            <div
              className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-3',
                form.mode === 'LIVE'
                  ? 'border-red-500/40 bg-red-500/10 text-red-400'
                  : form.mode === 'TESTNET'
                    ? 'border-sky-500/40 bg-sky-500/10 text-sky-400'
                    : 'border-primary/40 bg-primary/10 text-primary',
              )}
            >
              <span className="text-sm font-bold">{form.mode}</span>
              <span className="text-xs opacity-70">
                {form.mode === 'SANDBOX'
                  ? t('config.stepper.modeSandboxSub')
                  : form.mode === 'TESTNET'
                    ? t('config.stepper.modeTestnetSub')
                    : t('config.stepper.modeLiveSub')}
              </span>
            </div>
            {form.mode === 'LIVE' && (
              <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
                {t('trading.realFundsWarning')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* STEP: THRESHOLDS */}
      {currentStep === 'thresholds' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-primary/5 p-3.5">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('config.stepper.thresholdsCallout')}
            </p>
          </div>
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
      )}

      {/* STEP: RISK */}
      {currentStep === 'risk' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('config.stepper.riskCallout')}
            </p>
          </div>
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
      )}

      {/* STEP: TIMING */}
      {currentStep === 'timing' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <label className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
              <Repeat2 className="h-4 w-4 text-muted-foreground" />
              {t('trading.maxConcurrent')}
            </label>
            <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
              {t('tooltips.maxPositions')}
            </p>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 5, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => update({ maxConcurrentPositions: String(n) })}
                  className={cn(
                    'flex-1 min-w-[3rem] rounded-lg border py-2.5 text-sm font-bold transition-colors',
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
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <label className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {t('trading.minInterval')}
            </label>
            <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
              {t('tooltips.minInterval')}
            </p>
            <div className="flex gap-2 mb-3">
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
              <div>
                <p className="mb-2 text-xs text-muted-foreground">
                  {t('config.stepper.customIntervalHint')}
                </p>
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
      )}

      {/* STEP: REVIEW */}
      {currentStep === 'review' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 border border-primary/20">
                <Bot className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold">
                  {form.name || `${form.asset}/${form.pair}`}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {form.asset}/{form.pair} ·{' '}
                  <span
                    className={cn(
                      'font-semibold',
                      form.mode === 'LIVE'
                        ? 'text-red-400'
                        : form.mode === 'TESTNET'
                          ? 'text-sky-400'
                          : 'text-primary',
                    )}
                  >
                    {form.mode}
                  </span>
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: t('trading.buyThreshold'),
                value: `${form.buyThreshold}%`,
                color: 'text-emerald-400',
              },
              {
                label: t('trading.sellThreshold'),
                value: `${form.sellThreshold}%`,
                color: 'text-sky-400',
              },
              {
                label: t('trading.stopLoss'),
                value: `${form.stopLossPct}%`,
                color: 'text-red-400',
              },
              {
                label: t('trading.takeProfit'),
                value: `${form.takeProfitPct}%`,
                color: 'text-emerald-400',
              },
              {
                label: t('trading.minProfit'),
                value: `${form.minProfitPct}%`,
                color: 'text-foreground',
              },
              {
                label: t('trading.maxTrade'),
                value: `${form.maxTradePct}%`,
                color: 'text-foreground',
              },
              {
                label: t('trading.maxConcurrent'),
                value: form.maxConcurrentPositions,
                color: 'text-foreground',
              },
              {
                label: t('trading.minInterval'),
                value:
                  form.intervalMode === 'AGENT'
                    ? 'Auto'
                    : `${form.minIntervalMinutes} min`,
                color: 'text-foreground',
              },
              {
                label: t('trading.orderPriceOffset'),
                value: `${parseFloat(form.orderPriceOffsetPct) > 0 ? '+' : ''}${form.orderPriceOffsetPct}%`,
                color:
                  parseFloat(form.orderPriceOffsetPct) < 0
                    ? 'text-emerald-400'
                    : parseFloat(form.orderPriceOffsetPct) > 0
                      ? 'text-amber-400'
                      : 'text-muted-foreground',
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="flex flex-col rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
              >
                <span className="text-[10px] text-muted-foreground">
                  {label}
                </span>
                <span className={cn('text-sm font-bold tabular-nums', color)}>
                  {value}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {t('config.stepper.reviewNote')}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <TabModal
      icon={Bot}
      title={meta.title}
      subtitle={meta.subtitle}
      badgeHeader={`${stepIdx + 1}/${totalSteps}`}
      content={content}
      successButton={{
        label: isPending
          ? t('common.saving')
          : isLastStep
            ? t('config.stepper.create')
            : t('config.stepper.next'),
        onClick: isLastStep ? handleSubmit : () => setStepIdx((s) => s + 1),
      }}
      closeButton={{
        label: stepIdx === 0 ? t('common.cancel') : t('config.stepper.back'),
        onClick: stepIdx === 0 ? onClose : () => setStepIdx((s) => s - 1),
      }}
      onClose={onClose}
    />
  );
}
