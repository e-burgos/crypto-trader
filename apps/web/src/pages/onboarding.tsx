import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Sun,
  Moon,
  TestTube2,
} from 'lucide-react';
import { Button, Input } from '@crypto-trader/ui';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { useThemeStore } from '../store/theme.store';
import { useAuthStore } from '../store/auth.store';
import i18n from '../lib/i18n';

// ── Step Types ────────────────────────────────────────────────────────────────
type TradingMode = 'LIVE' | 'SANDBOX' | 'TESTNET';
type LLMProvider =
  | 'CLAUDE'
  | 'OPENAI'
  | 'GROQ'
  | 'GEMINI'
  | 'MISTRAL'
  | 'TOGETHER';

interface OnboardingState {
  // Step 1: Binance Keys (Live)
  binanceApiKey: string;
  binanceApiSecret: string;
  skipBinance: boolean;
  // Step 1: Binance Keys (Testnet)
  binanceTestnetApiKey: string;
  binanceTestnetApiSecret: string;
  skipTestnet: boolean;
  // Step 2: LLM Provider
  llmProvider: LLMProvider;
  llmApiKeys: Record<string, string>;
  llmModels: Record<string, string>;
  // Step 3: Trading Mode
  mode: TradingMode;
  initialCapital: string;
  initialCapitalUsdc: string;
}

const LLM_PROVIDERS: {
  value: LLMProvider;
  label: string;
  models: string[];
  helpLink: string;
  helpLinkText: string;
}[] = [
  {
    value: 'CLAUDE',
    label: 'Anthropic Claude',
    models: [
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-haiku-20240307',
    ],
    helpLink: 'https://console.anthropic.com/',
    helpLinkText: 'console.anthropic.com',
  },
  {
    value: 'OPENAI',
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini'],
    helpLink: 'https://platform.openai.com/api-keys',
    helpLinkText: 'platform.openai.com',
  },
  {
    value: 'GROQ',
    label: 'Groq',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    helpLink: 'https://console.groq.com/keys',
    helpLinkText: 'console.groq.com',
  },
  {
    value: 'GEMINI',
    label: 'Google Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    helpLink: 'https://aistudio.google.com/apikey',
    helpLinkText: 'aistudio.google.com',
  },
  {
    value: 'MISTRAL',
    label: 'Mistral AI',
    models: [
      'mistral-small-latest',
      'mistral-medium-latest',
      'mistral-large-latest',
    ],
    helpLink: 'https://console.mistral.ai/api-keys/',
    helpLinkText: 'console.mistral.ai',
  },
  {
    value: 'TOGETHER',
    label: 'Together AI',
    models: [
      'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
      'meta-llama/Llama-4-Scout-17B-16E-Instruct',
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    ],
    helpLink: 'https://api.together.xyz/settings/api-keys',
    helpLinkText: 'api.together.xyz',
  },
];

const BINANCE_API_URL = 'https://www.binance.com/en/my/settings/api-management';
const BINANCE_TESTNET_URL = 'https://testnet.binance.vision/';

// ── Step Components ───────────────────────────────────────────────────────────
function StepBinance({
  state,
  onChange,
}: {
  state: OnboardingState;
  onChange: (s: Partial<OnboardingState>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-600 dark:text-amber-400">
        <strong>{t('onboarding.binanceTip')}:</strong>{' '}
        {t('onboarding.binanceTipText')}
      </div>

      {/* ── Live keys ── */}
      {!state.skipBinance && (
        <>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('onboarding.binanceApiKey')}
            </label>
            <input
              type="text"
              value={state.binanceApiKey}
              onChange={(e) => onChange({ binanceApiKey: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              placeholder={t('onboarding.binanceApiKeyPlaceholder')}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('onboarding.binanceApiSecret')}
            </label>
            <Input
              type="password"
              value={state.binanceApiSecret}
              onChange={(e) => onChange({ binanceApiSecret: e.target.value })}
              placeholder={t('onboarding.binanceApiSecretPlaceholder')}
            />
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p>{t('onboarding.binanceHelpText')}</p>
            <a
              href={BINANCE_API_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
            >
              {t('onboarding.binanceHelpLinkText')}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
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
        {t('onboarding.skipBinance')}
      </button>

      {/* ── Testnet keys ── */}
      <div className="border-t border-border/50 pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('settings.binanceTestnetKeys')}
        </p>
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-xs text-sky-600 dark:text-sky-400 mb-3">
          {t('settings.binanceTestnetTip')}
        </div>

        {!state.skipTestnet && (
          <>
            <div className="mb-3">
              <label className="mb-1.5 block text-sm font-medium">
                {t('settings.binanceTestnetApiKey')}
              </label>
              <input
                type="text"
                value={state.binanceTestnetApiKey}
                onChange={(e) =>
                  onChange({ binanceTestnetApiKey: e.target.value })
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Testnet API Key"
              />
            </div>
            <div className="mb-3">
              <label className="mb-1.5 block text-sm font-medium">
                {t('settings.binanceTestnetApiSecret')}
              </label>
              <Input
                type="password"
                value={state.binanceTestnetApiSecret}
                onChange={(e) =>
                  onChange({ binanceTestnetApiSecret: e.target.value })
                }
                placeholder="Testnet API Secret"
              />
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1 mb-3">
              <p>
                Get free testnet keys at testnet.binance.vision (no real money).
              </p>
              <a
                href={BINANCE_TESTNET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
              >
                testnet.binance.vision
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => onChange({ skipTestnet: !state.skipTestnet })}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <div
            className={cn(
              'h-4 w-4 rounded border-2 transition-colors',
              state.skipTestnet ? 'border-primary bg-primary' : 'border-border',
            )}
          />
          {t('onboarding.skipTestnet')}
        </button>
      </div>
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
  const { t } = useTranslation();
  const provider =
    LLM_PROVIDERS.find((p) => p.value === state.llmProvider) ||
    LLM_PROVIDERS[0];

  const currentKey = state.llmApiKeys[state.llmProvider] ?? '';
  const filledCount = Object.values(state.llmApiKeys).filter(
    (k) => k.length > 0,
  ).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('onboarding.aiProviderSubtitle')}
      </p>

      <div className="grid grid-cols-3 gap-3">
        {LLM_PROVIDERS.map((p) => {
          const hasKey = !!state.llmApiKeys[p.value]?.length;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() =>
                onChange({
                  llmProvider: p.value as LLMProvider,
                  llmModels: {
                    ...state.llmModels,
                    [p.value]: state.llmModels[p.value] || p.models[0],
                  },
                })
              }
              className={cn(
                'relative rounded-lg border p-3 text-center text-sm font-medium transition-colors',
                state.llmProvider === p.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/40',
              )}
            >
              {p.label}
              {hasKey && (
                <CheckCircle className="absolute top-1 right-1 h-3.5 w-3.5 text-emerald-500" />
              )}
            </button>
          );
        })}
      </div>

      {filledCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('onboarding.keysConfigured', {
            defaultValue: '{{count}} proveedor(es) configurado(s)',
            count: filledCount,
          })}
        </p>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t('onboarding.apiKey')} — {provider.label}
        </label>
        <Input
          type="password"
          value={currentKey}
          onChange={(e) =>
            onChange({
              llmApiKeys: {
                ...state.llmApiKeys,
                [state.llmProvider]: e.target.value,
              },
            })
          }
          required
          placeholder={t('onboarding.apiKeyPlaceholder', {
            provider: provider.label,
          })}
        />
        <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground flex items-center justify-between gap-2">
          <span>{t('onboarding.apiKeyHelp')}</span>
          <a
            href={provider.helpLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline font-medium shrink-0"
          >
            {provider.helpLinkText}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
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
  const { t } = useTranslation();
  const hasBinanceKeys =
    !state.skipBinance && !!state.binanceApiKey && !!state.binanceApiSecret;
  const hasTestnetKeys =
    !state.skipTestnet &&
    !!state.binanceTestnetApiKey &&
    !!state.binanceTestnetApiSecret;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Always show SANDBOX */}
        <button
          type="button"
          onClick={() => onChange({ mode: 'SANDBOX' })}
          className={cn(
            'rounded-xl border p-5 text-left transition-all',
            state.mode === 'SANDBOX'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/40',
          )}
        >
          <div className="mb-1 font-semibold">
            {t('onboarding.sandboxTitle')}
          </div>
          <div className="text-xs text-muted-foreground">
            {t('onboarding.sandboxDesc')}
          </div>
          <div className="mt-2 text-xs font-medium text-emerald-500">
            {t('onboarding.sandboxRecommended')}
          </div>
        </button>

        {/* Show TESTNET only if Testnet keys were provided */}
        {hasTestnetKeys ? (
          <button
            type="button"
            onClick={() => onChange({ mode: 'TESTNET' })}
            className={cn(
              'rounded-xl border p-5 text-left transition-all',
              state.mode === 'TESTNET'
                ? 'border-sky-500 bg-sky-500/5'
                : 'border-border hover:border-sky-500/40',
            )}
          >
            <div className="mb-1 flex items-center gap-1.5 font-semibold">
              <TestTube2 className="h-4 w-4 text-sky-400" />
              {t('onboarding.testnetTitle')}
            </div>
            <div className="text-xs text-muted-foreground">
              {t('onboarding.testnetDesc')}
            </div>
            <div className="mt-2 text-xs font-medium text-sky-400">
              {t('onboarding.testnetRecommended')}
            </div>
          </button>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-5 opacity-40">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-muted-foreground">
              <TestTube2 className="h-4 w-4" />
              {t('onboarding.testnetTitle')}
            </div>
            <div className="text-xs text-muted-foreground">
              {t('onboarding.testnetRequiresKeys')}
            </div>
          </div>
        )}

        {/* Show LIVE only if Binance keys were provided */}
        {hasBinanceKeys ? (
          <button
            type="button"
            onClick={() => onChange({ mode: 'LIVE' })}
            className={cn(
              'rounded-xl border p-5 text-left transition-all',
              state.mode === 'LIVE'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40',
            )}
          >
            <div className="mb-1 font-semibold">
              {t('onboarding.liveTitle')}
            </div>
            <div className="text-xs text-muted-foreground">
              {t('onboarding.liveDesc')}
            </div>
          </button>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-5 opacity-50">
            <div className="mb-1 font-semibold text-muted-foreground">
              {t('onboarding.liveTitle')}
            </div>
            <div className="text-xs text-muted-foreground">
              {t('onboarding.liveRequiresBinance')}
            </div>
          </div>
        )}
      </div>

      {state.mode === 'SANDBOX' && (
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('onboarding.initialCapitalUsdt', {
                defaultValue: 'Capital inicial (USDT)',
              })}
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
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('onboarding.initialCapitalUsdc', {
                defaultValue: 'Capital inicial (USDC)',
              })}
            </label>
            <input
              type="number"
              min="10"
              step="10"
              value={state.initialCapitalUsdc}
              onChange={(e) => onChange({ initialCapitalUsdc: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="10000"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('onboarding.initialCapitalNote')}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Onboarding Wizard ─────────────────────────────────────────────────────────
export function OnboardingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const STEPS = t('onboarding.steps', { returnObjects: true }) as string[];
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [state, setState] = useState<OnboardingState>({
    binanceApiKey: '',
    binanceApiSecret: '',
    skipBinance: true,
    binanceTestnetApiKey: '',
    binanceTestnetApiSecret: '',
    skipTestnet: true,
    llmProvider: 'CLAUDE',
    llmApiKeys: {},
    llmModels: {},
    mode: 'SANDBOX',
    initialCapital: '1000',
    initialCapitalUsdc: '10000',
  });

  function update(patch: Partial<OnboardingState>) {
    setState((s) => {
      const next = { ...s, ...patch };
      // If Binance keys are cleared/skipped, force SANDBOX mode
      const hasBinanceKeys =
        !next.skipBinance && !!next.binanceApiKey && !!next.binanceApiSecret;
      const hasTestnetKeys =
        !next.skipTestnet &&
        !!next.binanceTestnetApiKey &&
        !!next.binanceTestnetApiSecret;
      if (!hasBinanceKeys && next.mode === 'LIVE') {
        next.mode = 'SANDBOX';
      }
      if (!hasTestnetKeys && next.mode === 'TESTNET') {
        next.mode = 'SANDBOX';
      }
      return next;
    });
  }

  function canNext(): boolean {
    if (step === 0)
      return (
        state.skipBinance || (!!state.binanceApiKey && !!state.binanceApiSecret)
      );
    if (step === 1)
      return Object.values(state.llmApiKeys).some((k) => k.length > 0);
    if (state.mode === 'SANDBOX')
      return !!state.initialCapital && Number(state.initialCapital) >= 10;
    return true; // LIVE mode — capital field not shown
  }

  async function handleFinish() {
    setIsLoading(true);
    setError('');
    try {
      // Save Binance live keys if provided
      if (!state.skipBinance && state.binanceApiKey) {
        await api.post('/users/me/binance-keys', {
          apiKey: state.binanceApiKey,
          apiSecret: state.binanceApiSecret,
        });
      }

      // Save Binance testnet keys if provided
      if (!state.skipTestnet && state.binanceTestnetApiKey) {
        await api.post('/users/me/binance-keys/testnet', {
          apiKey: state.binanceTestnetApiKey,
          apiSecret: state.binanceTestnetApiSecret,
        });
      }

      // Save all LLM keys that were provided
      const keysToSave = Object.entries(state.llmApiKeys).filter(
        ([, key]) => key.length > 0,
      );
      for (const [provider, apiKey] of keysToSave) {
        await api.post('/users/me/llm-keys', {
          provider,
          apiKey,
          selectedModel: state.llmModels[provider] || undefined,
        });
      }

      // Create initial trading config with safe defaults
      await api
        .put('/trading/config', {
          asset: 'BTC',
          pair: 'USDT',
          mode: state.mode,
          buyThreshold: 70,
          sellThreshold: 65,
          stopLossPct: 0.02,
          takeProfitPct: 0.04,
          maxTradePct: 0.1,
          maxConcurrentPositions: 3,
          minIntervalMinutes: 60,
        })
        .catch(() => null); // Non-blocking — user can configure later

      // Initialize sandbox wallets with user-chosen capital
      if (state.mode === 'SANDBOX') {
        await api
          .post('/trading/sandbox-wallet/init', {
            capitalUsdt: Number(state.initialCapital) || 10_000,
            capitalUsdc: Number(state.initialCapitalUsdc) || 10_000,
          })
          .catch(() => null);
      }

      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(
        (err as { message?: string })?.message || t('onboarding.setupFailed'),
      );
      setIsLoading(false);
    }
  }

  const { theme, toggle: toggleTheme } = useThemeStore();
  const { user } = useAuthStore();
  const lang = i18n.language;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Minimal top bar */}
      <header className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-end gap-2 px-4 sm:px-6">
          {/* Language toggle */}
          <button
            onClick={() => i18n.changeLanguage(lang === 'en' ? 'es' : 'en')}
            className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            aria-label="Toggle language"
          >
            {lang === 'en' ? 'ES' : 'EN'}
          </button>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          {/* User avatar */}
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary"
            title={user?.email}
          >
            {user?.email?.charAt(0).toUpperCase() ?? 'U'}
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12 pt-24">
        <div className="w-full max-w-xl">
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

          <div className="onboarding-glow-border shadow-lg">
            <div className="rounded-xl bg-card p-8">
              <h2 className="mb-1 text-lg font-bold">{STEPS[step]}</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                {t('onboarding.stepOf', {
                  step: step + 1,
                  total: STEPS.length,
                })}
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
                    <ChevronLeft className="h-4 w-4 mr-1" />{' '}
                    {t('onboarding.back')}
                  </Button>
                ) : (
                  <div />
                )}

                {step < STEPS.length - 1 ? (
                  <Button
                    onClick={() => setStep(step + 1)}
                    disabled={!canNext()}
                  >
                    {t('onboarding.continue')}{' '}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleFinish}
                    disabled={isLoading || !canNext()}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t('onboarding.startTrading')
                    )}
                  </Button>
                )}
              </div>
            </div>
            {/* end card inner */}
          </div>
          {/* end glow wrapper */}

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {t('onboarding.encryptionNote')}
          </p>
        </div>
      </div>
    </div>
  );
}
