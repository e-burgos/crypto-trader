import { useTranslation } from 'react-i18next';
import { CheckCircle, ExternalLink, Star } from 'lucide-react';
import { Input } from '@crypto-trader/ui';
import { cn } from '../../lib/utils';
import { type OnboardingState, type LLMProvider, LLM_PROVIDERS } from './types';

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

      <div className="space-y-3">
        {/* OpenRouter - Recommended */}
        {(() => {
          const or = LLM_PROVIDERS[0]; // OPENROUTER
          const hasKey = !!state.llmApiKeys[or.value]?.length;
          return (
            <button
              key={or.value}
              type="button"
              onClick={() =>
                onChange({
                  llmProvider: or.value as LLMProvider,
                  llmModels: {
                    ...state.llmModels,
                    [or.value]: state.llmModels[or.value] || or.models[0],
                  },
                })
              }
              className={cn(
                'relative flex w-full items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-semibold transition-colors',
                state.llmProvider === or.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-primary/30 bg-primary/5 hover:border-primary/50',
              )}
            >
              <Star className="h-4 w-4" />
              {or.label}
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                {t('settings.openrouter.recommended', {
                  defaultValue: 'Recommended',
                })}
              </span>
              {hasKey && (
                <CheckCircle className="absolute top-1 right-1 h-3.5 w-3.5 text-emerald-500" />
              )}
            </button>
          );
        })()}

        <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex-1 border-t border-border" />
          <span>
            {t('common.or', { defaultValue: 'or use a direct provider' })}
          </span>
          <div className="flex-1 border-t border-border" />
        </div>

        {/* Other providers */}
        <div className="grid grid-cols-3 gap-3">
          {LLM_PROVIDERS.filter((p) => p.value !== 'OPENROUTER').map((p) => {
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
