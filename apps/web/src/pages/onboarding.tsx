import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { api } from '../lib/api';

// ── Step Types ────────────────────────────────────────────────────────────────
type TradingMode = 'LIVE' | 'SANDBOX';
type LLMProvider = 'CLAUDE' | 'OPENAI' | 'GROQ';

interface OnboardingState {
  // Step 1: Binance Keys
  binanceApiKey: string;
  binanceApiSecret: string;
  skipBinance: boolean;
  // Step 2: LLM Provider
  llmProvider: LLMProvider;
  llmApiKey: string;
  llmModel: string;
  // Step 3: Trading Mode
  mode: TradingMode;
  initialCapital: string;
}

const STEPS = ['Connect Exchange', 'AI Provider', 'Trading Mode'];

const LLM_PROVIDERS: { value: LLMProvider; label: string; models: string[] }[] =
  [
    {
      value: 'CLAUDE',
      label: 'Anthropic Claude',
      models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
    },
    {
      value: 'OPENAI',
      label: 'OpenAI',
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    },
    {
      value: 'GROQ',
      label: 'Groq',
      models: ['llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
    },
  ];

// ── Step Components ───────────────────────────────────────────────────────────
function StepBinance({
  state,
  onChange,
}: {
  state: OnboardingState;
  onChange: (s: Partial<OnboardingState>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-600 dark:text-amber-400">
        <strong>Tip:</strong> You can skip this step and use Sandbox mode
        to practice risk-free.
      </div>

      {!state.skipBinance && (
        <>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Binance API Key
            </label>
            <input
              type="text"
              value={state.binanceApiKey}
              onChange={(e) => onChange({ binanceApiKey: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Your Binance API key"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Binance API Secret
            </label>
            <input
              type="password"
              value={state.binanceApiSecret}
              onChange={(e) => onChange({ binanceApiSecret: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Your Binance API secret"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Create a read+trade (no withdrawal) API key in Binance account
            settings.
          </p>
        </>
      )}

      <button
        type="button"
        onClick={() => onChange({ skipBinance: !state.skipBinance })}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <div
          className={cn(
            'h-4 w-4 rounded border-2 transition-colors',
            state.skipBinance ? 'border-primary bg-primary' : 'border-border',
          )}
        />
        Skip for now — use Sandbox Trading
      </button>
    </div>
  );
}

function StepLLM({
  state,
  onChange,
}: {
  state: OnboardingState;
  onChange: (s: Partial<OnboardingState>) => void;
}) {
  const provider =
    LLM_PROVIDERS.find((p) => p.value === state.llmProvider) ||
    LLM_PROVIDERS[0];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose the AI provider that will power your trading agent.
      </p>

      <div className="grid grid-cols-3 gap-3">
        {LLM_PROVIDERS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() =>
              onChange({ llmProvider: p.value, llmModel: p.models[0] })
            }
            className={cn(
              'rounded-lg border p-3 text-center text-sm font-medium transition-colors',
              state.llmProvider === p.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-primary/40',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Model</label>
        <select
          value={state.llmModel}
          onChange={(e) => onChange({ llmModel: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
        >
          {provider.models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">API Key</label>
        <input
          type="password"
          value={state.llmApiKey}
          onChange={(e) => onChange({ llmApiKey: e.target.value })}
          required
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
          placeholder={`Your ${provider.label} API key`}
        />
      </div>
    </div>
  );
}

function StepMode({
  state,
  onChange,
}: {
  state: OnboardingState;
  onChange: (s: Partial<OnboardingState>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {(['SANDBOX', 'LIVE'] as TradingMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange({ mode })}
            className={cn(
              'rounded-xl border p-5 text-left transition-all',
              state.mode === mode
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40',
            )}
          >
            <div className="mb-1 font-semibold">
              {mode === 'SANDBOX' ? 'Sandbox Trading' : 'Live Trading'}
            </div>
            <div className="text-xs text-muted-foreground">
              {mode === 'SANDBOX'
                ? 'Simulate trades risk-free. The agent uses real logic but no real money.'
                : 'Trade with real funds. Requires Binance API keys.'}
            </div>
            {mode === 'SANDBOX' && (
              <div className="mt-2 text-xs font-medium text-emerald-500">
                Recommended for beginners
              </div>
            )}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Initial Capital (USDT) {state.mode === 'SANDBOX' ? '— simulated' : ''}
        </label>
        <input
          type="number"
          min="10"
          step="10"
          value={state.initialCapital}
          onChange={(e) => onChange({ initialCapital: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="1000"
        />
      </div>
    </div>
  );
}

// ── Onboarding Wizard ─────────────────────────────────────────────────────────
export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [state, setState] = useState<OnboardingState>({
    binanceApiKey: '',
    binanceApiSecret: '',
    skipBinance: true,
    llmProvider: 'CLAUDE',
    llmApiKey: '',
    llmModel: 'claude-3-5-sonnet-20241022',
    mode: 'SANDBOX',
    initialCapital: '1000',
  });

  function update(patch: Partial<OnboardingState>) {
    setState((s) => ({ ...s, ...patch }));
  }

  function canNext(): boolean {
    if (step === 0)
      return (
        state.skipBinance || (!!state.binanceApiKey && !!state.binanceApiSecret)
      );
    if (step === 1) return !!state.llmApiKey;
    return !!state.initialCapital;
  }

  async function handleFinish() {
    setIsLoading(true);
    setError('');
    try {
      // Save Binance keys if provided
      if (!state.skipBinance && state.binanceApiKey) {
        await api.post('/users/me/binance-keys', {
          apiKey: state.binanceApiKey,
          apiSecret: state.binanceApiSecret,
        });
      }

      // Save LLM key
      await api.post('/users/me/llm-keys', {
        provider: state.llmProvider,
        apiKey: state.llmApiKey,
        selectedModel: state.llmModel,
      });

      // Create initial trading config with safe defaults
      await api.put('/trading/config', {
        asset: 'BTC',
        pair: 'USDT',
        mode: state.mode,
        buyThreshold: 70,
        sellThreshold: 65,
        stopLossPct: 2,
        takeProfitPct: 4,
        maxTradePct: 0.1,
        maxConcurrentPositions: 3,
        minIntervalMinutes: 60,
      }).catch(() => null); // Non-blocking — user can configure later

      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(
        (err as { message?: string })?.message ||
          'Setup failed. Please try again.',
      );
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  i < step
                    ? 'bg-primary text-primary-foreground'
                    : i === step
                      ? 'border-2 border-primary text-primary'
                      : 'border-2 border-border text-muted-foreground',
                )}
              >
                {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  'text-sm hidden sm:block',
                  i === step ? 'font-medium' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && <div className="h-px w-8 bg-border" />}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <h2 className="mb-1 text-lg font-bold">{STEPS[step]}</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-500">
              {error}
            </div>
          )}

          {step === 0 && <StepBinance state={state} onChange={update} />}
          {step === 1 && <StepLLM state={state} onChange={update} />}
          {step === 2 && <StepMode state={state} onChange={update} />}

          <div className="mt-8 flex items-center justify-between">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            ) : (
              <div />
            )}

            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={isLoading || !canNext()}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Start Trading'
                )}
              </Button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          All API keys are encrypted with AES-256-GCM before storage.
        </p>
      </div>
    </div>
  );
}
