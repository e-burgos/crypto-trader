import { useState, FormEvent } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

type TradingMode = 'LIVE' | 'PAPER';

interface ConfigForm {
  asset: string;
  pair: string;
  mode: TradingMode;
  capitalUsdt: string;
  maxPositionPct: string;
  stopLossPct: string;
  takeProfitPct: string;
  maxDailyLossPct: string;
  agentIntervalMinutes: string;
}

const DEFAULT_FORM: ConfigForm = {
  asset: 'BTC',
  pair: 'BTCUSDT',
  mode: 'PAPER',
  capitalUsdt: '1000',
  maxPositionPct: '10',
  stopLossPct: '2',
  takeProfitPct: '4',
  maxDailyLossPct: '5',
  agentIntervalMinutes: '60',
};

const PAIRS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'ADAUSDT',
  'DOTUSDT',
  'AVAXUSDT',
];

export function ConfigPage() {
  const [form, setForm] = useState<ConfigForm>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(false);

  function update(patch: Partial<ConfigForm>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.post('/trading-config', {
        asset: form.asset,
        pair: form.pair,
        mode: form.mode,
        capitalUsdt: parseFloat(form.capitalUsdt),
        maxPositionPct: parseFloat(form.maxPositionPct) / 100,
        stopLossPct: parseFloat(form.stopLossPct) / 100,
        takeProfitPct: parseFloat(form.takeProfitPct) / 100,
        maxDailyLossPct: parseFloat(form.maxDailyLossPct) / 100,
        agentIntervalMinutes: parseInt(form.agentIntervalMinutes),
      });
      toast.success('Trading configuration saved');
    } catch (err: unknown) {
      toast.error(
        (err as { message?: string })?.message || 'Failed to save config',
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Trading Configuration</h1>
        <p className="text-sm text-muted-foreground">
          Set up your AI trading agent parameters
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {/* Trading Pair */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Market</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Trading Pair
              </label>
              <select
                value={form.pair}
                onChange={(e) =>
                  update({
                    pair: e.target.value,
                    asset: e.target.value.replace('USDT', ''),
                  })
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              >
                {PAIRS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Mode</label>
              <div className="flex gap-2">
                {(['PAPER', 'LIVE'] as TradingMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => update({ mode: m })}
                    className={cn(
                      'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                      form.mode === m
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/40',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Capital & Risk */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Capital & Risk Management</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { key: 'capitalUsdt', label: 'Capital (USDT)', suffix: '$' },
              {
                key: 'maxPositionPct',
                label: 'Max Position Size',
                suffix: '%',
              },
              { key: 'stopLossPct', label: 'Stop Loss', suffix: '%' },
              { key: 'takeProfitPct', label: 'Take Profit', suffix: '%' },
              { key: 'maxDailyLossPct', label: 'Max Daily Loss', suffix: '%' },
              {
                key: 'agentIntervalMinutes',
                label: 'Agent Interval',
                suffix: 'min',
              },
            ].map(({ key, label, suffix }) => (
              <div key={key}>
                <label className="mb-1.5 block text-sm font-medium">
                  {label}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form[key as keyof ConfigForm]}
                    onChange={(e) =>
                      update({ [key]: e.target.value } as Partial<ConfigForm>)
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">
                    {suffix}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" className="gap-2" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Configuration
        </Button>
      </form>
    </div>
  );
}
