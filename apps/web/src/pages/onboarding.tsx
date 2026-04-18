import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@crypto-trader/ui';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import {
  StepBinance,
  StepLLM,
  StepMode,
  type OnboardingState,
} from '../components/onboarding';

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
