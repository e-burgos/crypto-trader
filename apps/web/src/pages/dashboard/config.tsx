import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Save,
  Play,
  Square,
  Loader2,
  BookOpen,
  X,
  Eye,
  TestTube2,
  Trash2,
  Pencil,
  Check,
  ChevronRight,
  ChevronLeft,
  Plus,
  Shield,
  Zap,
  TrendingUp,
  Target,
  Clock,
  ListChecks,
  Bot,
  Brain,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TradingConfig } from '../../hooks/use-trading';
import {
  Button,
  InfoTooltip,
  Select,
  type SelectOption,
} from '@crypto-trader/ui';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  useTradingConfigs,
  useCreateConfig,
  useUpdateConfig,
  useDeleteConfig,
  useStartAgent,
  useStopAgent,
  useAgentStatus,
  type TradingConfigDto,
  type TradingMode,
  type TradingAsset,
  type TradingPair,
  type IntervalMode,
  type RiskProfile,
} from '../../hooks/use-trading';
import {
  useTestnetBinanceKeyStatus,
  usePlatformMode,
  useLLMKeys,
} from '../../hooks/use-user';
import { StrategyPresets, PRESETS } from '@crypto-trader/ui';
import { DynamicModelSelect } from '../../containers/settings/dynamic-model-select';

// ── Fallback LLM providers (used when dynamic API is unavailable) ─────────

interface LLMProviderOption {
  value: string;
  label: string;
  models: string[];
}

const LLM_PROVIDERS: LLMProviderOption[] = [
  {
    value: 'CLAUDE',
    label: 'Claude (Anthropic)',
    models: [
      'claude-sonnet-4-20250514',
      'claude-opus-4-5',
      'claude-3-5-sonnet-20241022',
    ],
  },
  { value: 'OPENAI', label: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o'] },
  {
    value: 'GROQ',
    label: 'Groq (Llama)',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  },
  {
    value: 'GEMINI',
    label: 'Google Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  },
  {
    value: 'MISTRAL',
    label: 'Mistral AI',
    models: [
      'mistral-small-latest',
      'mistral-medium-latest',
      'mistral-large-latest',
    ],
  },
  {
    value: 'TOGETHER',
    label: 'Together AI',
    models: [
      'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    ],
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConfigForm {
  name: string;
  asset: TradingAsset;
  pair: TradingPair;
  mode: TradingMode;
  buyThreshold: string;
  sellThreshold: string;
  stopLossPct: string;
  takeProfitPct: string;
  minProfitPct: string;
  maxTradePct: string;
  maxConcurrentPositions: string;
  intervalMode: IntervalMode;
  minIntervalMinutes: string;
  orderPriceOffsetPct: string;
  riskProfile: RiskProfile;
  primaryProvider: string;
  primaryModel: string;
  fallbackProvider: string;
  fallbackModel: string;
}

const DEFAULT_FORM: ConfigForm = {
  name: '',
  asset: 'BTC',
  pair: 'USDT',
  mode: 'SANDBOX',
  intervalMode: 'AGENT',
  riskProfile: 'MODERATE',
  primaryProvider: '',
  primaryModel: '',
  fallbackProvider: '',
  fallbackModel: '',
  ...PRESETS.balanced,
};

// ── SliderField ───────────────────────────────────────────────────────────────

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '%',
  signed = false,
  onChange,
  tooltip,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  signed?: boolean;
  onChange: (v: string) => void;
  tooltip?: string;
}) {
  const num = parseFloat(value);
  const displayValue = signed && num > 0 ? `+${value}` : value;
  const valueColor =
    signed && num < 0
      ? 'text-emerald-400'
      : signed && num > 0
        ? 'text-amber-400'
        : 'text-primary';

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <label className="text-sm font-medium">{label}</label>
        {tooltip && <InfoTooltip text={tooltip} />}
        <span className={cn('ml-auto text-sm font-bold', valueColor)}>
          {displayValue}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {signed && min > 0 ? '+' : ''}
          {min}
          {unit}
        </span>
        <span>
          {signed && max > 0 ? '+' : ''}
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}

// ── Agent Detail Modal ───────────────────────────────────────────────────────

function AgentDetailModal({
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

  const providerLabel = cfg.primaryProvider
    ? (LLM_PROVIDERS.find((p) => p.value === cfg.primaryProvider)?.label ??
      cfg.primaryProvider)
    : null;
  const fallbackLabel = cfg.fallbackProvider
    ? (LLM_PROVIDERS.find((p) => p.value === cfg.fallbackProvider)?.label ??
      cfg.fallbackProvider)
    : null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop — fully opaque so the form behind is not visible */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex-1 min-w-0 pr-4">
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

          {/* AI Model info */}
          {(providerLabel || fallbackLabel) && (
            <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Brain className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold">
                  {t('config.editModal.aiModel')}
                </span>
              </div>
              {providerLabel && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {t('config.stepper.primaryLabel')}
                  </span>
                  <span className="text-[11px] font-semibold">
                    {providerLabel}
                    {cfg.primaryModel ? ` · ${cfg.primaryModel}` : ''}
                  </span>
                </div>
              )}
              {fallbackLabel && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {t('config.stepper.fallbackLabel')}
                  </span>
                  <span className="text-[11px] font-semibold">
                    {fallbackLabel}
                    {cfg.fallbackModel ? ` · ${cfg.fallbackModel}` : ''}
                  </span>
                </div>
              )}
            </div>
          )}
          {!providerLabel && !fallbackLabel && (
            <p className="mt-3 text-[10px] text-muted-foreground/70 italic text-center">
              {t('config.stepper.autoSuggestion')}
            </p>
          )}
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

// ── New Agent Stepper Modal ────────────────────────────────────────────────────

type StepId =
  | 'preset'
  | 'identity'
  | 'aiModel'
  | 'thresholds'
  | 'risk'
  | 'timing'
  | 'review';

const STEPS: { id: StepId; icon: typeof Bot }[] = [
  { id: 'preset', icon: Zap },
  { id: 'identity', icon: Bot },
  { id: 'aiModel', icon: Brain },
  { id: 'thresholds', icon: Target },
  { id: 'risk', icon: Shield },
  { id: 'timing', icon: Clock },
  { id: 'review', icon: ListChecks },
];

const PRESET_META: {
  key: keyof typeof PRESETS;
  icon: typeof Shield;
  color: string;
  border: string;
  bg: string;
}[] = [
  {
    key: 'conservative',
    icon: Shield,
    color: 'text-sky-400',
    border: 'border-sky-500/30',
    bg: 'bg-sky-500/5',
  },
  {
    key: 'balanced',
    icon: TrendingUp,
    color: 'text-primary',
    border: 'border-primary/30',
    bg: 'bg-primary/5',
  },
  {
    key: 'aggressive',
    icon: Zap,
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
  },
];

function StepperSlider({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  unit = '%',
  signed = false,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  signed?: boolean;
  onChange: (v: string) => void;
}) {
  const num = parseFloat(value);
  const displayValue = signed && num > 0 ? `+${value}` : value;
  const valueColor =
    signed && num < 0
      ? 'text-emerald-400'
      : signed && num > 0
        ? 'text-amber-400'
        : 'text-primary';

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className={cn('text-lg font-bold tabular-nums', valueColor)}>
          {displayValue}
          {unit}
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
        {hint}
      </p>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>
          {signed && min > 0 ? '+' : ''}
          {min}
          {unit}
        </span>
        <span>
          {signed && max > 0 ? '+' : ''}
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}

function NewAgentStepperModal({
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

  const totalSteps = STEPS.length;
  const currentStep = STEPS[stepIdx].id;

  // Close on Escape
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

  function applyPreset(key: keyof typeof PRESETS) {
    setSelectedPreset(key);
    setForm((f) => ({ ...f, ...PRESETS[key] }));
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
      primaryProvider: form.primaryProvider || undefined,
      primaryModel: form.primaryModel || undefined,
      fallbackProvider: form.fallbackProvider || undefined,
      fallbackModel: form.fallbackModel || undefined,
    };
    createConfig(dto, { onSuccess: onCreated });
  }

  const isLastStep = stepIdx === totalSteps - 1;

  const STEP_META: Record<StepId, { title: string; subtitle: string }> = {
    preset: {
      title: t('config.stepper.stepPreset'),
      subtitle: t('config.stepper.stepPresetHint'),
    },
    identity: {
      title: t('config.stepper.stepIdentity'),
      subtitle: t('config.stepper.stepIdentityHint'),
    },
    aiModel: {
      title: t('config.stepper.stepAiModel'),
      subtitle: t('config.stepper.stepAiModelHint'),
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

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full sm:max-w-lg max-h-[96dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-border bg-muted/20">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {t('config.stepper.title')} · {stepIdx + 1}/{totalSteps}
              </span>
            </div>
            <h2 className="text-base font-bold leading-tight">{meta.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {meta.subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 mt-0.5 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="shrink-0 flex items-center justify-center gap-1.5 px-5 py-3 bg-muted/10 border-b border-border/50">
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

        {/* Step content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ── STEP: PRESET ── */}
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
                          <span>
                            📈 {t('trading.buyThreshold')}:{' '}
                            <strong>{preset.buyThreshold}%</strong>
                          </span>
                          <span>
                            🛡️ Stop Loss: <strong>{preset.stopLossPct}%</strong>
                          </span>
                          <span>
                            🎯 Take Profit:{' '}
                            <strong>{preset.takeProfitPct}%</strong>
                          </span>
                          <span>
                            ⏱️ Intervalo:{' '}
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

          {/* ── STEP: IDENTITY ── */}
          {currentStep === 'identity' && (
            <div className="space-y-4">
              {/* Name */}
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

              {/* Asset + Pair */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="mb-3 text-sm font-semibold">
                  {t('trading.market')}
                </p>
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

              {/* Mode (auto-configured from platform mode — read-only) */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <label className="mb-1 block text-sm font-semibold">
                  {t('trading.mode')}
                </label>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t(
                    'config.stepper.modeAutoConfigured',
                    'El modo se configura automáticamente según el modo de operación global seleccionado en el header.',
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

          {/* ── STEP: AI MODEL ── */}
          {currentStep === 'aiModel' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-primary/5 p-3.5">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  🧠 {t('config.stepper.aiModelCallout')}
                </p>
              </div>

              {activeProviderOptions.length === 0 ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="text-xs text-amber-400">
                    {t('config.stepper.noActiveProviders')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Primary */}
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Brain className="h-3.5 w-3.5 text-primary" />
                      <p className="text-sm font-semibold">
                        {t('config.stepper.primaryLlm')}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('config.stepper.primaryLlmHint')}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Select
                        label={t('config.stepper.primaryLabel')}
                        options={[
                          { value: '', label: t('config.stepper.autoSelect') },
                          ...activeProviderOptions,
                        ]}
                        value={form.primaryProvider}
                        onChange={(v) => handleProviderChange('primary', v)}
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

                  {/* Fallback */}
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-sm font-semibold">
                        {t('config.stepper.fallbackLlm')}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('config.stepper.fallbackLlmHint')}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Select
                        label={t('config.stepper.fallbackLabel')}
                        options={[
                          { value: '', label: t('config.stepper.noFallback') },
                          ...activeProviderOptions,
                        ]}
                        value={form.fallbackProvider}
                        onChange={(v) => handleProviderChange('fallback', v)}
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

                  {!form.primaryProvider && !form.fallbackProvider && (
                    <p className="text-[10px] text-muted-foreground/70 italic text-center">
                      💡 {t('config.stepper.autoSuggestion')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP: THRESHOLDS ── */}
          {currentStep === 'thresholds' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-primary/5 p-3.5">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  💡 {t('config.stepper.thresholdsCallout')}
                </p>
              </div>
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
          )}

          {/* ── STEP: RISK ── */}
          {currentStep === 'risk' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  🛡️ {t('config.stepper.riskCallout')}
                </p>
              </div>
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
          )}

          {/* ── STEP: TIMING ── */}
          {currentStep === 'timing' && (
            <div className="space-y-4">
              {/* Max concurrent */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <label className="mb-1 block text-sm font-semibold">
                  🔁 {t('trading.maxConcurrent')}
                </label>
                <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
                  {t('tooltips.maxPositions')}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 5, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        update({ maxConcurrentPositions: String(n) })
                      }
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

              {/* Interval mode */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <label className="mb-1 block text-sm font-semibold">
                  ⏱️ {t('trading.minInterval')}
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
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">
                      {t('config.stepper.customIntervalHint')}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {[5, 15, 30, 60, 120].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() =>
                            update({ minIntervalMinutes: String(n) })
                          }
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

              {/* Price offset */}
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
          )}

          {/* ── STEP: REVIEW ── */}
          {currentStep === 'review' && (
            <div className="space-y-4">
              {/* Summary header */}
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
                    <span
                      className={cn('text-sm font-bold tabular-nums', color)}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {/* AI Model review */}
              {(form.primaryProvider || form.fallbackProvider) && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Brain className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold">
                      {t('config.stepper.aiModelReview')}
                    </span>
                  </div>
                  {form.primaryProvider && (
                    <p className="text-[11px] text-muted-foreground">
                      {t('config.stepper.primaryLabel')}:{' '}
                      <span className="font-semibold text-foreground">
                        {LLM_PROVIDERS.find(
                          (p) => p.value === form.primaryProvider,
                        )?.label ?? form.primaryProvider}
                      </span>
                      {form.primaryModel && (
                        <>
                          {' '}
                          ·{' '}
                          <span className="font-medium text-foreground">
                            {form.primaryModel}
                          </span>
                        </>
                      )}
                    </p>
                  )}
                  {form.fallbackProvider && (
                    <p className="text-[11px] text-muted-foreground">
                      {t('config.stepper.fallbackLabel')}:{' '}
                      <span className="font-semibold text-foreground">
                        {LLM_PROVIDERS.find(
                          (p) => p.value === form.fallbackProvider,
                        )?.label ?? form.fallbackProvider}
                      </span>
                      {form.fallbackModel && (
                        <>
                          {' '}
                          ·{' '}
                          <span className="font-medium text-foreground">
                            {form.fallbackModel}
                          </span>
                        </>
                      )}
                    </p>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                {t('config.stepper.reviewNote')}
              </p>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border px-5 py-4 bg-muted/10">
          <button
            type="button"
            onClick={stepIdx === 0 ? onClose : () => setStepIdx((s) => s - 1)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {stepIdx === 0 ? t('common.cancel') : t('config.stepper.back')}
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={isLastStep ? handleSubmit : () => setStepIdx((s) => s + 1)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-bold transition-all',
              isLastStep
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md'
                : 'border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20',
            )}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.saving')}
              </>
            ) : isLastStep ? (
              <>
                <Save className="h-4 w-4" />
                {t('config.stepper.create')}
              </>
            ) : (
              <>
                {t('config.stepper.next')}
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Edit Agent Modal ──────────────────────────────────────────────────────────

function EditAgentModal({
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
                {/* Primary */}
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

                {/* Fallback */}
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

            {/* Max concurrent */}
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

            {/* Interval mode */}
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

            {/* Price offset */}
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

// ── DeleteAgentModal ──────────────────────────────────────────────────────────

function DeleteAgentModal({
  cfg,
  onClose,
}: {
  cfg: TradingConfig;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { mutate: deleteConfig, isPending } = useDeleteConfig();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleConfirm() {
    deleteConfig(cfg.id, { onSuccess: onClose });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
              <Trash2 className="h-4 w-4" />
            </div>
            <h2 className="font-bold">{t('config.deleteModal.title')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('config.deleteModal.body')}
          </p>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="font-semibold text-sm">
              {cfg.name || `${cfg.asset}/${cfg.pair}`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {cfg.mode} · {cfg.asset}/{cfg.pair}
            </p>
          </div>
          <p className="text-xs text-red-500/80">
            {t('config.deleteModal.warning')}
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 transition-colors disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {isPending ? t('common.deleting') : t('config.deleteModal.confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ConfigPage() {
  const { t } = useTranslation();
  const { mode: platformMode } = usePlatformMode();
  const [selectedConfig, setSelectedConfig] = useState<TradingConfig | null>(
    null,
  );
  const [editingConfig, setEditingConfig] = useState<TradingConfig | null>(
    null,
  );
  const [deletingConfig, setDeletingConfig] = useState<TradingConfig | null>(
    null,
  );
  const [stepperOpen, setStepperOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { mutate: startAgent } = useStartAgent();
  const { mutate: stopAgent } = useStopAgent();
  const { data: configs = [], isLoading } = useTradingConfigs();
  useAgentStatus();

  // Solo mostrar agentes del modo activo
  const modeConfigs = configs.filter((c) => {
    if (platformMode === 'SANDBOX') return c.mode === 'SANDBOX';
    return c.mode === platformMode;
  });

  useGSAP(
    () => {
      gsap.fromTo(
        '.config-card',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, stagger: 0.08, duration: 0.4, ease: 'power2.out' },
      );
    },
    { scope: containerRef },
  );

  function getAgentIsRunning(configId: string) {
    return modeConfigs.find((c) => c.id === configId)?.isRunning ?? false;
  }

  return (
    <div ref={containerRef} className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="config-card flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('sidebar.config')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('trading.configSubtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStepperOpen(true)}
          className="shrink-0 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary/20 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          {t('config.stepper.openStepper')}
        </button>
      </div>

      {/* Docs callout */}
      <div className="config-card flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
        <BookOpen className="h-5 w-5 shrink-0 text-primary" />
        <p className="flex-1 text-sm text-muted-foreground">
          {t('config.docsCallout')}
        </p>
        <div className="flex gap-2">
          <Link
            to="/help#agent-flow"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            {t('config.docsCalloutGuide')}
          </Link>
          <Link
            to="/help#config-concepts-thresholds"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {t('config.docsCalloutConcepts')}
          </Link>
        </div>
      </div>

      {/* Agents list */}
      <div className="config-card rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">{t('trading.activeAgents')}</h2>
          {modeConfigs.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {modeConfigs.length}{' '}
              {modeConfigs.length === 1
                ? t('config.agentSingular')
                : t('config.agentPlural')}
            </span>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-muted/50"
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && modeConfigs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 px-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted/30">
              <Bot className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">
                {t('trading.noConfigs')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('config.noConfigsHint')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStepperOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-5 py-2.5 text-sm font-bold text-primary hover:bg-primary/20 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t('config.stepper.openStepper')}
            </button>
          </div>
        )}

        {/* Agent cards */}
        {!isLoading && modeConfigs.length > 0 && (
          <div className="divide-y divide-border">
            {modeConfigs.map((cfg) => {
              const isRunning = getAgentIsRunning(cfg.id);
              const modeColor =
                cfg.mode === 'TESTNET'
                  ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
                  : cfg.mode === 'LIVE'
                    ? 'text-red-400 bg-red-500/10 border-red-500/20'
                    : 'text-muted-foreground bg-muted/30 border-border';

              return (
                <div
                  key={cfg.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors"
                >
                  {/* Status dot */}
                  <div
                    className={cn(
                      'shrink-0 h-2.5 w-2.5 rounded-full',
                      isRunning
                        ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                        : 'bg-muted-foreground/30',
                    )}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold truncate">
                        {cfg.name || `${cfg.asset}/${cfg.pair}`}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                          modeColor,
                        )}
                      >
                        {cfg.mode}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          isRunning
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {isRunning ? t('common.running') : t('common.stopped')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {cfg.name ? `${cfg.asset}/${cfg.pair} · ` : ''}
                      SL {(cfg.stopLossPct * 100).toFixed(1)}% · TP{' '}
                      {(cfg.takeProfitPct * 100).toFixed(1)}% · Compra{' '}
                      {cfg.buyThreshold}%
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-1">
                    {/* Start / Stop */}
                    {isRunning ? (
                      <button
                        type="button"
                        title={t('trading.stopAgent')}
                        onClick={() => stopAgent(cfg.id)}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Square className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title={t('trading.startAgent')}
                        onClick={() => startAgent(cfg.id)}
                        className="rounded-lg p-2 text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}

                    {/* View detail */}
                    <button
                      type="button"
                      title={t('config.viewDetail')}
                      onClick={() => setSelectedConfig(cfg)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      title={t('config.editModal.title')}
                      onClick={() => setEditingConfig(cfg)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      title={t('trading.deleteConfig')}
                      onClick={() => setDeletingConfig(cfg)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stepper Modal */}
      {stepperOpen && (
        <NewAgentStepperModal
          onClose={() => setStepperOpen(false)}
          onCreated={() => setStepperOpen(false)}
          defaultMode={platformMode}
        />
      )}

      {/* Edit Modal */}
      {editingConfig && (
        <EditAgentModal
          cfg={editingConfig}
          onClose={() => setEditingConfig(null)}
        />
      )}

      {/* Delete Modal */}
      {deletingConfig && (
        <DeleteAgentModal
          cfg={deletingConfig}
          onClose={() => setDeletingConfig(null)}
        />
      )}

      {/* Detail Modal */}
      {selectedConfig && (
        <AgentDetailModal
          cfg={selectedConfig}
          isRunning={getAgentIsRunning(selectedConfig.id)}
          onClose={() => setSelectedConfig(null)}
          onStart={() => startAgent(selectedConfig.id)}
          onStop={() => stopAgent(selectedConfig.id)}
        />
      )}
    </div>
  );
}
