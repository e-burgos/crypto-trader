import { useTranslation } from 'react-i18next';
import { CheckCircle, ExternalLink, TestTube2 } from 'lucide-react';
import { Input } from '@crypto-trader/ui';
import { cn } from '../../lib/utils';

export type TradingMode = 'LIVE' | 'SANDBOX' | 'TESTNET';
export type LLMProvider =
  | 'CLAUDE'
  | 'OPENAI'
  | 'GROQ'
  | 'GEMINI'
  | 'MISTRAL'
  | 'TOGETHER';

export interface OnboardingState {
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

export const LLM_PROVIDERS: {
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
export function StepBinance({
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

export function StepLLM({
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

export function StepMode({
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
