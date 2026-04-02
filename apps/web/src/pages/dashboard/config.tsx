import { useState, useRef } from 'react';
import { Save, Play, Square, Loader2 } from 'lucide-react';
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
}

const DEFAULT_FORM: ConfigForm = {
  asset: 'BTC',
  pair: 'USDT',
  mode: 'SANDBOX',
  buyThreshold: '70',
  sellThreshold: '65',
  stopLossPct: '2',
  takeProfitPct: '4',
  maxTradePct: '10',
  maxConcurrentPositions: '3',
  minIntervalMinutes: '60',
};

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  tooltip,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step?: number;
  onChange: (v: string) => void;
  tooltip?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <label className="text-sm font-medium">{label}</label>
        {tooltip && <InfoTooltip text={tooltip} />}
        <span className="ml-auto text-sm font-bold text-primary">{value}%</span>
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
        <span>{min}%</span>
        <span>{max}%</span>
      </div>
    </div>
  );
}

export function ConfigPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState<ConfigForm>(DEFAULT_FORM);
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dto: TradingConfigDto = {
      asset: form.asset,
      pair: form.pair,
      mode: form.mode,
      buyThreshold: parseFloat(form.buyThreshold),
      sellThreshold: parseFloat(form.sellThreshold),
      stopLossPct: parseFloat(form.stopLossPct),
      takeProfitPct: parseFloat(form.takeProfitPct),
      maxTradePct: parseFloat(form.maxTradePct) / 100,
      maxConcurrentPositions: parseInt(form.maxConcurrentPositions),
      minIntervalMinutes: parseInt(form.minIntervalMinutes),
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
    <div ref={containerRef} className="p-6">
      <div className="config-card mb-6">
        <h1 className="text-2xl font-bold">{t('sidebar.config')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('trading.configSubtitle')}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="config-card lg:col-span-2 space-y-5"
        >
          {/* Market section */}
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
                      {m === 'SANDBOX'
                        ? t('trading.sandbox')
                        : t('trading.live')}
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

          {/* Thresholds */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-semibold">
              {t('trading.decisionThresholds')}
            </h2>
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
            <h2 className="mb-4 font-semibold">
              {t('trading.riskManagement')}
            </h2>
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

          {/* Timing */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-semibold">{t('trading.timing')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <label className="text-sm font-medium">
                    {t('trading.maxConcurrent')}
                  </label>
                  <InfoTooltip text={t('tooltips.maxPositions')} />
                </div>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.maxConcurrentPositions}
                  onChange={(e) =>
                    update({ maxConcurrentPositions: e.target.value })
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <label className="text-sm font-medium">
                    {t('trading.minInterval')}
                  </label>
                  <InfoTooltip text={t('tooltips.minInterval')} />
                </div>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={form.minIntervalMinutes}
                  onChange={(e) =>
                    update({ minIntervalMinutes: e.target.value })
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t('trading.saveConfig')}
          </Button>
        </form>

        {/* Active Agents Panel */}
        <div className="config-card space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-semibold">{t('trading.activeAgents')}</h2>
            {configs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('trading.noConfigs')}
              </p>
            ) : (
              <ul className="space-y-3">
                {configs.map((cfg) => {
                  const isRunning = getAgentIsRunning(cfg.asset, cfg.pair);
                  return (
                    <li
                      key={cfg.id}
                      className="rounded-lg border border-border p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-medium text-sm">
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
                          {isRunning
                            ? t('common.running')
                            : t('common.stopped')}
                        </span>
                      </div>
                      <div className="mb-2 text-xs text-muted-foreground">
                        {cfg.mode} · SL {cfg.stopLossPct}% · TP{' '}
                        {cfg.takeProfitPct}%
                      </div>
                      {isRunning ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full gap-1.5 text-red-500 hover:text-red-600"
                          onClick={() =>
                            stopAgent({ asset: cfg.asset, pair: cfg.pair })
                          }
                        >
                          <Square className="h-3 w-3" />
                          {t('trading.stopAgent')}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full gap-1.5"
                          onClick={() =>
                            startAgent({ asset: cfg.asset, pair: cfg.pair })
                          }
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
