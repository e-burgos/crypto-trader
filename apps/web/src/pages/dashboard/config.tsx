import { useState, useRef } from 'react';
import {
  Save,
  Play,
  Square,
  Loader2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { InfoTooltip } from '../../components/ui/info-tooltip';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  useTradingConfigs,
  useUpsertConfig,
  useStartAgent,
  useStopAgent,
  useAgentStatus,
  type TradingConfigDto,
  type TradingMode,
  type TradingAsset,
  type TradingPair,
} from '../../hooks/use-trading';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConfigForm {
  asset: TradingAsset;
  pair: TradingPair;
  mode: TradingMode;
  buyThreshold: string;
  sellThreshold: string;
  stopLossPct: string;
  takeProfitPct: string;
  maxTradePct: string;
  maxConcurrentPositions: string;
  minIntervalMinutes: string;
  orderPriceOffsetPct: string;
}

// ── Strategy Presets ──────────────────────────────────────────────────────────

const PRESETS: Record<
  'conservative' | 'balanced' | 'aggressive',
  Omit<ConfigForm, 'asset' | 'pair' | 'mode'>
> = {
  conservative: {
    buyThreshold: '85',
    sellThreshold: '80',
    stopLossPct: '2',
    takeProfitPct: '3',
    maxTradePct: '5',
    maxConcurrentPositions: '1',
    minIntervalMinutes: '120',
    orderPriceOffsetPct: '-1',
  },
  balanced: {
    buyThreshold: '72',
    sellThreshold: '68',
    stopLossPct: '3',
    takeProfitPct: '5',
    maxTradePct: '10',
    maxConcurrentPositions: '3',
    minIntervalMinutes: '60',
    orderPriceOffsetPct: '0',
  },
  aggressive: {
    buyThreshold: '60',
    sellThreshold: '55',
    stopLossPct: '5',
    takeProfitPct: '10',
    maxTradePct: '20',
    maxConcurrentPositions: '5',
    minIntervalMinutes: '30',
    orderPriceOffsetPct: '1',
  },
};

const DEFAULT_FORM: ConfigForm = {
  asset: 'BTC',
  pair: 'USDT',
  mode: 'SANDBOX',
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
          {displayValue}{unit}
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
        <span>{signed && min > 0 ? '+' : ''}{min}{unit}</span>
        <span>{signed && max > 0 ? '+' : ''}{max}{unit}</span>
      </div>
    </div>
  );
}

// ── Decision Flow Diagram ─────────────────────────────────────────────────────

function DecisionFlowDiagram() {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-[560px] items-stretch gap-2">
        {/* Sources */}
        <div className="flex flex-col justify-center gap-2">
          {[
            { icon: '📡', label: t('config.guide.sourceMarket'), sub: '200 candles · RSI · MACD · BB' },
            { icon: '📰', label: t('config.guide.sourceNews'), sub: t('config.guide.sourceNewsSub') },
            { icon: '📊', label: t('config.guide.sourceTrades'), sub: t('config.guide.sourceTradesSub') },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2"
            >
              <div className="text-xs font-semibold text-blue-400">{s.icon} {s.label}</div>
              <div className="text-[10px] text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center text-muted-foreground/50">
          <ArrowRight className="h-5 w-5" />
        </div>

        {/* LLM */}
        <div className="flex items-center">
          <div className="rounded-xl border-2 border-purple-500/40 bg-purple-500/10 px-4 py-4 text-center w-36">
            <div className="text-2xl mb-1">🧠</div>
            <div className="text-xs font-bold text-purple-300">{t('config.guide.llmLabel')}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">Claude · GPT-4o · Groq</div>
            <div className="mt-2 rounded-md bg-purple-500/20 px-2 py-1">
              <div className="text-[10px] text-purple-300 font-semibold">{t('config.guide.confidence')}</div>
              <div className="text-xs font-bold text-purple-200">0 – 100%</div>
            </div>
          </div>
        </div>

        <div className="flex items-center text-muted-foreground/50">
          <ArrowRight className="h-5 w-5" />
        </div>

        {/* Decision Logic */}
        <div className="flex items-center">
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 w-52">
            <div className="mb-2 text-xs font-bold text-yellow-400">
              ⚙️ {t('config.guide.decisionLogic')}
            </div>
            <div className="space-y-1.5 text-[10px]">
              {[
                { cond: 'Score ≥ buyThreshold', out: 'BUY', color: 'text-emerald-400' },
                { cond: 'SL threshold hit', out: 'STOP LOSS', color: 'text-orange-400' },
                { cond: 'TP threshold hit', out: 'TAKE PROFIT', color: 'text-blue-400' },
                { cond: t('config.guide.otherwise'), out: 'HOLD ⏳', color: 'text-muted-foreground' },
              ].map((row) => (
                <div key={row.out} className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">{row.cond}</span>
                  <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />
                  <span className={cn('font-semibold', row.color)}>{row.out}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center text-muted-foreground/50">
          <ArrowRight className="h-5 w-5" />
        </div>

        {/* Outcomes */}
        <div className="flex flex-col justify-center gap-2">
          {[
            { color: 'emerald', icon: '✓', label: t('config.guide.outcomeBuy'), sub: t('config.guide.outcomeBuySub') },
            { color: 'orange', icon: '↓', label: t('config.guide.outcomeSL'), sub: t('config.guide.outcomeSLSub') },
            { color: 'slate', icon: '⏳', label: t('config.guide.outcomeHold'), sub: t('config.guide.outcomeHoldSub') },
          ].map((o) => (
            <div
              key={o.label}
              className={cn(
                'rounded-lg border px-3 py-2',
                o.color === 'emerald'
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : o.color === 'orange'
                    ? 'border-orange-500/30 bg-orange-500/5'
                    : 'border-border bg-muted/20',
              )}
            >
              <div
                className={cn(
                  'text-xs font-semibold',
                  o.color === 'emerald'
                    ? 'text-emerald-400'
                    : o.color === 'orange'
                      ? 'text-orange-400'
                      : 'text-muted-foreground',
                )}
              >
                {o.icon} {o.label}
              </div>
              <div className="text-[10px] text-muted-foreground">{o.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Parameter Reference Cards ─────────────────────────────────────────────────

function ParameterCards() {
  const { t } = useTranslation();

  const cards = [
    {
      title: t('config.guide.cardThresholds'),
      color: 'blue',
      icon: '🎯',
      content: (
        <div className="space-y-2 text-[11px]">
          <p className="text-muted-foreground">{t('config.guide.cardThresholdsDesc')}</p>
          <div className="rounded-md bg-muted/40 p-2 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">BUY:</span>
              <span className="text-emerald-400">score ≥ 72% → order</span>
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-muted-foreground">HOLD:</span>
              <span className="text-muted-foreground">score &lt; 72% → wait</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">💡 {t('config.guide.cardThresholdsTip')}</p>
        </div>
      ),
    },
    {
      title: t('config.guide.cardRisk'),
      color: 'red',
      icon: '🛡️',
      content: (
        <div className="space-y-2 text-[11px]">
          <p className="text-muted-foreground">{t('config.guide.cardRiskDesc')}</p>
          <div className="rounded-md bg-muted/40 p-2 text-xs">
            <div>
              <span className="text-red-400 font-semibold">Stop Loss 3%: </span>
              <span className="text-muted-foreground">{t('config.guide.slExample')}</span>
            </div>
            <div className="mt-0.5">
              <span className="text-emerald-400 font-semibold">Take Profit 5%: </span>
              <span className="text-muted-foreground">{t('config.guide.tpExample')}</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">💡 {t('config.guide.cardRiskTip')}</p>
        </div>
      ),
    },
    {
      title: t('config.guide.cardCapital'),
      color: 'purple',
      icon: '💰',
      content: (
        <div className="space-y-2 text-[11px]">
          <p className="text-muted-foreground">{t('config.guide.cardCapitalDesc')}</p>
          <div className="rounded-md bg-muted/40 p-2 text-xs">
            <div className="text-muted-foreground">{t('config.guide.capitalExample1')}</div>
            <div className="mt-0.5 text-purple-400 font-semibold">{t('config.guide.capitalExample2')}</div>
          </div>
          <p className="text-[10px] text-muted-foreground">💡 {t('config.guide.cardCapitalTip')}</p>
        </div>
      ),
    },
    {
      title: t('config.guide.cardTiming'),
      color: 'amber',
      icon: '⏱️',
      content: (
        <div className="space-y-2 text-[11px]">
          <p className="text-muted-foreground">{t('config.guide.cardTimingDesc')}</p>
          <div className="rounded-md bg-muted/40 p-2 text-xs space-y-0.5">
            <div className="text-amber-400 font-semibold">{t('config.guide.timingExample1')}</div>
            <div className="text-muted-foreground">{t('config.guide.timingExample2')}</div>
          </div>
          <p className="text-[10px] text-muted-foreground">💡 {t('config.guide.cardTimingTip')}</p>
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className={cn(
            'rounded-xl border p-3',
            card.color === 'blue'
              ? 'border-blue-500/20 bg-blue-500/5'
              : card.color === 'red'
                ? 'border-red-500/20 bg-red-500/5'
                : card.color === 'purple'
                  ? 'border-purple-500/20 bg-purple-500/5'
                  : 'border-amber-500/20 bg-amber-500/5',
          )}
        >
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-base">{card.icon}</span>
            <span className="text-xs font-bold">{card.title}</span>
          </div>
          {card.content}
        </div>
      ))}
    </div>
  );
}

// ── Strategy Preset Selector ──────────────────────────────────────────────────

function StrategyPresets({
  onApply,
}: {
  onApply: (preset: keyof typeof PRESETS) => void;
}) {
  const { t } = useTranslation();

  const presets: Array<{
    key: keyof typeof PRESETS;
    icon: React.ReactNode;
    colorClass: string;
    borderClass: string;
    textClass: string;
  }> = [
    {
      key: 'conservative',
      icon: <Shield className="h-5 w-5" />,
      colorClass: 'bg-blue-500/10 hover:bg-blue-500/15',
      borderClass: 'border-blue-500/30',
      textClass: 'text-blue-400',
    },
    {
      key: 'balanced',
      icon: <TrendingUp className="h-5 w-5" />,
      colorClass: 'bg-emerald-500/10 hover:bg-emerald-500/15',
      borderClass: 'border-emerald-500/30',
      textClass: 'text-emerald-400',
    },
    {
      key: 'aggressive',
      icon: <Zap className="h-5 w-5" />,
      colorClass: 'bg-red-500/10 hover:bg-red-500/15',
      borderClass: 'border-red-500/30',
      textClass: 'text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {presets.map((p) => {
        const preset = PRESETS[p.key];
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onApply(p.key)}
            className={cn(
              'rounded-xl border p-3 text-left transition-all',
              p.colorClass,
              p.borderClass,
            )}
          >
            <div className={cn('mb-1 flex items-center gap-1.5', p.textClass)}>
              {p.icon}
              <span className="text-sm font-bold">
                {t(`config.guide.preset.${p.key}`)}
              </span>
            </div>
            <p className="mb-2 text-[10px] text-muted-foreground">
              {t(`config.guide.preset.${p.key}Desc`)}
            </p>
            <div className="space-y-0.5 text-[10px] text-muted-foreground">
              <div className="flex justify-between">
                <span>{t('trading.buyThreshold')}</span>
                <span className="font-medium">{preset.buyThreshold}%</span>
              </div>
              <div className="flex justify-between">
                <span>{t('trading.stopLoss')}</span>
                <span className="font-medium">{preset.stopLossPct}%</span>
              </div>
              <div className="flex justify-between">
                <span>{t('trading.maxTrade')}</span>
                <span className="font-medium">{preset.maxTradePct}%</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Guide Panel ───────────────────────────────────────────────────────────────

function GuidePanel({
  onApplyPreset,
}: {
  onApplyPreset: (preset: keyof typeof PRESETS) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="config-card space-y-6 rounded-2xl border border-border bg-card p-6">
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
            1
          </span>
          {t('config.guide.flowTitle')}
        </h3>
        <DecisionFlowDiagram />
      </div>

      <hr className="border-border/50" />

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
            2
          </span>
          {t('config.guide.presetsTitle')}
        </h3>
        <StrategyPresets onApply={onApplyPreset} />
      </div>

      <hr className="border-border/50" />

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
            3
          </span>
          {t('config.guide.paramTitle')}
        </h3>
        <ParameterCards />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ConfigPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState<ConfigForm>(DEFAULT_FORM);
  const [showGuide, setShowGuide] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const { mutate: upsert, isPending } = useUpsertConfig();
  const { mutate: startAgent } = useStartAgent();
  const { mutate: stopAgent } = useStopAgent();
  const { data: configs = [] } = useTradingConfigs();
  const { data: agentStatuses = [] } = useAgentStatus();

  useGSAP(
    () => {
      gsap.fromTo(
        '.config-card',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, stagger: 0.1, duration: 0.5, ease: 'power2.out' },
      );
    },
    { scope: containerRef },
  );

  function update(patch: Partial<ConfigForm>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function applyPreset(key: keyof typeof PRESETS) {
    setForm((f) => ({ ...f, ...PRESETS[key] }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dto: TradingConfigDto = {
      asset: form.asset,
      pair: form.pair,
      mode: form.mode,
      buyThreshold: parseFloat(form.buyThreshold),
      sellThreshold: parseFloat(form.sellThreshold),
      stopLossPct: parseFloat(form.stopLossPct) / 100,
      takeProfitPct: parseFloat(form.takeProfitPct) / 100,
      maxTradePct: parseFloat(form.maxTradePct) / 100,
      maxConcurrentPositions: parseInt(form.maxConcurrentPositions),
      minIntervalMinutes: parseInt(form.minIntervalMinutes),
      orderPriceOffsetPct: parseFloat(form.orderPriceOffsetPct) / 100,
    };
    upsert(dto);
  }

  function getAgentIsRunning(asset: string, pair: string) {
    return (
      agentStatuses.find((s) => s.asset === asset && s.pair === pair)
        ?.isRunning ?? false
    );
  }

  return (
    <div ref={containerRef} className="p-6 space-y-6">
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
          onClick={() => setShowGuide((v) => !v)}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
            showGuide
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground',
          )}
        >
          <BookOpen className="h-4 w-4" />
          {showGuide ? t('config.hideGuide') : t('config.showGuide')}
          {showGuide ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Guide Panel */}
      {showGuide && <GuidePanel onApplyPreset={applyPreset} />}

      {/* Form + Agents */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <form onSubmit={handleSubmit} className="config-card lg:col-span-2 space-y-5">
          {/* Market */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-semibold">{t('trading.market')}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {t('trading.asset')}
                </label>
                <div className="flex gap-2">
                  {(['BTC', 'ETH'] as TradingAsset[]).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => update({ asset: a })}
                      className={cn(
                        'flex-1 rounded-lg border py-2 text-sm font-medium transition-colors',
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
                <label className="mb-1.5 block text-sm font-medium">
                  {t('trading.pair')}
                </label>
                <div className="flex gap-2">
                  {(['USDT', 'USDC'] as TradingPair[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => update({ pair: p })}
                      className={cn(
                        'flex-1 rounded-lg border py-2 text-sm font-medium transition-colors',
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
              <div>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <label className="text-sm font-medium">
                    {t('trading.mode')}
                  </label>
                  <InfoTooltip text={t('tooltips.sandboxMode')} />
                </div>
                <div className="flex gap-2">
                  {(['SANDBOX', 'LIVE'] as TradingMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => update({ mode: m })}
                      className={cn(
                        'flex-1 rounded-lg border py-2 text-sm font-medium transition-colors',
                        form.mode === m
                          ? m === 'LIVE'
                            ? 'border-red-500 bg-red-500/10 text-red-500'
                            : 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/40',
                      )}
                    >
                      {m === 'SANDBOX' ? t('trading.sandbox') : t('trading.live')}
                    </button>
                  ))}
                </div>
                {form.mode === 'LIVE' && (
                  <p className="mt-1.5 text-xs text-red-500">
                    {t('trading.realFundsWarning')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Decision Thresholds */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-semibold">{t('trading.decisionThresholds')}</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <SliderField
                label={t('trading.buyThreshold')}
                value={form.buyThreshold}
                min={50}
                max={95}
                onChange={(v) => update({ buyThreshold: v })}
                tooltip={t('tooltips.buyThreshold')}
              />
              <SliderField
                label={t('trading.sellThreshold')}
                value={form.sellThreshold}
                min={50}
                max={95}
                onChange={(v) => update({ sellThreshold: v })}
                tooltip={t('tooltips.sellThreshold')}
              />
            </div>
          </div>

          {/* Risk Management */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-semibold">{t('trading.riskManagement')}</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <SliderField
                label={t('trading.stopLoss')}
                value={form.stopLossPct}
                min={0.5}
                max={20}
                step={0.5}
                onChange={(v) => update({ stopLossPct: v })}
                tooltip={t('tooltips.stopLoss')}
              />
              <SliderField
                label={t('trading.takeProfit')}
                value={form.takeProfitPct}
                min={0.5}
                max={50}
                step={0.5}
                onChange={(v) => update({ takeProfitPct: v })}
                tooltip={t('tooltips.takeProfit')}
              />
              <SliderField
                label={t('trading.maxTrade')}
                value={form.maxTradePct}
                min={1}
                max={50}
                onChange={(v) => update({ maxTradePct: v })}
                tooltip={t('tooltips.maxTrade')}
              />
            </div>
          </div>

          {/* Order Execution Price */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-1 font-semibold">{t('trading.orderExecution')}</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              {t('trading.orderExecutionSub')}
            </p>
            <SliderField
              label={t('trading.orderPriceOffset')}
              value={form.orderPriceOffsetPct}
              min={-5}
              max={5}
              step={0.5}
              signed={true}
              onChange={(v) => update({ orderPriceOffsetPct: v })}
              tooltip={t('tooltips.orderPriceOffset')}
            />
            <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2 text-center">
                <div className="font-bold text-emerald-400">{t('trading.offsetNegative')}</div>
                <div className="mt-0.5 text-muted-foreground">{t('trading.offsetNegativeDesc')}</div>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-2 text-center">
                <div className="font-bold text-muted-foreground">0% ({t('trading.offsetZero')})</div>
                <div className="mt-0.5 text-muted-foreground">{t('trading.offsetZeroDesc')}</div>
              </div>
              <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-center">
                <div className="font-bold text-amber-400">{t('trading.offsetPositive')}</div>
                <div className="mt-0.5 text-muted-foreground">{t('trading.offsetPositiveDesc')}</div>
              </div>
            </div>
          </div>

          {/* Timing */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-semibold">{t('trading.timing')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <label className="text-sm font-medium">{t('trading.maxConcurrent')}</label>
                  <InfoTooltip text={t('tooltips.maxPositions')} />
                </div>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.maxConcurrentPositions}
                  onChange={(e) => update({ maxConcurrentPositions: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <label className="text-sm font-medium">{t('trading.minInterval')}</label>
                  <InfoTooltip text={t('tooltips.minInterval')} />
                </div>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={form.minIntervalMinutes}
                  onChange={(e) => update({ minIntervalMinutes: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t('trading.saveConfig')}
          </Button>
        </form>

        {/* Active Agents */}
        <div className="config-card space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-semibold">{t('trading.activeAgents')}</h2>
            {configs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('trading.noConfigs')}</p>
            ) : (
              <ul className="space-y-3">
                {configs.map((cfg) => {
                  const isRunning = getAgentIsRunning(cfg.asset, cfg.pair);
                  return (
                    <li key={cfg.id} className="rounded-lg border border-border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {cfg.asset}/{cfg.pair}
                        </span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-semibold',
                            isRunning
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {isRunning ? t('common.running') : t('common.stopped')}
                        </span>
                      </div>
                      <div className="mb-2 text-xs text-muted-foreground">
                        {cfg.mode} · SL {(cfg.stopLossPct * 100).toFixed(1)}% · TP{' '}
                        {(cfg.takeProfitPct * 100).toFixed(1)}%
                        {cfg.orderPriceOffsetPct !== 0 && (
                          <span className="ml-1">
                            · offset{' '}
                            <span
                              className={
                                cfg.orderPriceOffsetPct < 0
                                  ? 'text-emerald-400'
                                  : 'text-amber-400'
                              }
                            >
                              {cfg.orderPriceOffsetPct > 0 ? '+' : ''}
                              {(cfg.orderPriceOffsetPct * 100).toFixed(1)}%
                            </span>
                          </span>
                        )}
                      </div>
                      {isRunning ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full gap-1.5 text-red-500 hover:text-red-600"
                          onClick={() => stopAgent({ asset: cfg.asset, pair: cfg.pair })}
                        >
                          <Square className="h-3 w-3" />
                          {t('trading.stopAgent')}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full gap-1.5"
                          onClick={() => startAgent({ asset: cfg.asset, pair: cfg.pair })}
                        >
                          <Play className="h-3 w-3" />
                          {t('trading.startAgent')}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
