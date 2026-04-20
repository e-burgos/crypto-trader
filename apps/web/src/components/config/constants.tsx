import {
  Shield,
  Zap,
  TrendingUp,
  Target,
  Clock,
  ListChecks,
  Bot,
  Brain,
} from 'lucide-react';
import { InfoTooltip } from '@crypto-trader/ui';
import { cn } from '../../lib/utils';
import {
  type TradingMode,
  type TradingAsset,
  type TradingPair,
  type IntervalMode,
  type RiskProfile,
} from '../../hooks/use-trading';
import { PRESETS } from '@crypto-trader/ui';

// ── Fallback LLM providers (used when dynamic API is unavailable) ─────────

export interface LLMProviderOption {
  value: string;
  label: string;
  models: string[];
}

export const LLM_PROVIDERS: LLMProviderOption[] = [
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
  {
    value: 'OPENROUTER',
    label: 'OpenRouter',
    models: [
      'anthropic/claude-sonnet-4.6',
      'google/gemini-3-flash-preview',
      'anthropic/claude-opus-4.6',
      'deepseek/deepseek-v3.2',
      'google/gemini-2.5-flash-lite',
      'openrouter/elephant-alpha',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'google/gemma-4-31b-it:free',
    ],
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConfigForm {
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

export const DEFAULT_FORM: ConfigForm = {
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

// ── Slider components ─────────────────────────────────────────────────────────

export function SliderField({
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

export type StepId =
  | 'preset'
  | 'identity'
  | 'aiModel'
  | 'thresholds'
  | 'risk'
  | 'timing'
  | 'review';

export const STEPS: { id: StepId; icon: typeof Bot }[] = [
  { id: 'preset', icon: Zap },
  { id: 'identity', icon: Bot },
  { id: 'aiModel', icon: Brain },
  { id: 'thresholds', icon: Target },
  { id: 'risk', icon: Shield },
  { id: 'timing', icon: Clock },
  { id: 'review', icon: ListChecks },
];

export const PRESET_META: {
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

export function StepperSlider({
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
