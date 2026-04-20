import { useTranslation } from 'react-i18next';
import { TestTube2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { type OnboardingState } from './types';

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
