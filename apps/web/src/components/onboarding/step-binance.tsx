import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { Input } from '@crypto-trader/ui';
import { cn } from '../../lib/utils';
import { type OnboardingState } from './types';

const BINANCE_API_URL = 'https://www.binance.com/en/my/settings/api-management';
const BINANCE_TESTNET_URL = 'https://testnet.binance.vision/';

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
                placeholder={t('settings.binanceTestnetApiKey', {
                  defaultValue: 'Testnet API Key',
                })}
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
                placeholder={t('settings.binanceTestnetApiSecretPlaceholder', {
                  defaultValue: 'Testnet API Secret',
                })}
              />
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1 mb-3">
              <p>
                {t('onboarding.testnetKeysHint', {
                  defaultValue:
                    'Get free testnet keys at testnet.binance.vision (no real money).',
                })}
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
