import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLLMProviderModels, type LLMModel } from '../../hooks/use-llm';
import { Select, type SelectOption } from '@crypto-trader/ui';
import { Cpu, Loader2, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { OpenRouterModelSelect } from './openrouter-model-select';

// ── Component ───────────────────────────────────────────────────────────────

interface DynamicModelSelectProps {
  provider: string;
  value: string;
  onChange: (model: string) => void;
  fallbackModels: string[];
  label?: string;
  className?: string;
}

export function DynamicModelSelect({
  provider,
  value,
  onChange,
  fallbackModels,
  label,
  className = '',
}: DynamicModelSelectProps) {
  const { t } = useTranslation();
  const isOpenRouter = provider === 'OPENROUTER';

  // For non-OpenRouter providers, fetch models from the provider-specific endpoint
  const {
    data: models,
    isLoading,
    isError,
  } = useLLMProviderModels(provider, !isOpenRouter);
  const [showAll, setShowAll] = useState(false);

  // Delegate to dedicated OpenRouter component for rich filtering
  if (isOpenRouter) {
    return (
      <OpenRouterModelSelect
        value={value}
        onChange={onChange}
        label={label}
        className={className}
        compact
      />
    );
  }

  const autoOption: SelectOption = {
    value: '',
    label: t('config.stepper.autoSelect'),
    icon: <Sparkles className="h-3.5 w-3.5 text-primary" />,
  };

  const allModels = !isLoading && !isError && models?.length ? models : null;

  // Build all options, excluding deprecated
  const allOptions: (SelectOption & {
    _recommended?: boolean;
  })[] = allModels
    ? allModels
        .filter((m) => !m.deprecated)
        .map((m: LLMModel) => ({
          value: m.id,
          label: m.label ?? m.id,
          description: m.contextWindow
            ? `${(m.contextWindow / 1000).toFixed(0)}K ctx`
            : undefined,
          icon: <Cpu className="h-3.5 w-3.5 text-muted-foreground" />,
          disabled: false,
          _recommended: m.recommended,
        }))
    : fallbackModels.map((m) => ({
        value: m,
        label: m,
        icon: <Cpu className="h-3.5 w-3.5 text-muted-foreground" />,
      }));

  const hasRecommended = allOptions.some((o) => o._recommended);

  // Auto-expand if saved model isn't in recommended
  useEffect(() => {
    if (
      value &&
      allOptions.some((o) => o.value === value) &&
      hasRecommended &&
      !allOptions.some(
        (o) => o.value === value && o._recommended && !o.disabled,
      )
    ) {
      setShowAll(true);
    }
  }, [value, allModels]);

  // Apply filtering
  const filteredModels = showAll
    ? allOptions
    : allOptions.filter(
        (o) => !o.disabled && (!hasRecommended || o._recommended),
      );

  const options: SelectOption[] = [autoOption, ...filteredModels];

  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <Select
          options={fallbackModels.map((m) => ({ value: m, label: m }))}
          value={value}
          onChange={onChange}
          label={label}
          disabled
        />
        <Loader2 className="absolute right-10 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Recommended/all toggle
  const badgeButton = hasRecommended ? (
    <button
      type="button"
      onClick={() => setShowAll(!showAll)}
      className={cn(
        'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
        showAll
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          : 'bg-primary/10 border-primary/30 text-primary',
      )}
    >
      {showAll
        ? t('settings.modelFilter.all', { defaultValue: 'Todos' })
        : t('settings.modelFilter.recommended', {
            defaultValue: 'Recomendados',
          })}
    </button>
  ) : null;

  const valueInOptions = options.some((o) => o.value === value);
  const valueExistsInAll = allOptions.some((o) => o.value === value);
  // Only add as custom option if the model doesn't exist in the provider's model list at all
  const effectiveOptions: SelectOption[] =
    value && !valueInOptions && !valueExistsInAll
      ? [
          ...options,
          {
            value,
            label: value,
            icon: <Cpu className="h-3.5 w-3.5 text-amber-400" />,
          },
        ]
      : options;
  const effectiveValue = value || '';

  return (
    <div className={className}>
      <Select
        options={effectiveOptions}
        value={effectiveValue}
        onChange={onChange}
        label={label}
        labelExtra={badgeButton}
        placeholder="Select model..."
        searchable
        searchPlaceholder={t('settings.modelFilter.searchPlaceholder', {
          defaultValue: 'Search model...',
        })}
      />
      {showAll && (
        <p className="mt-1 text-[10px] text-amber-400">
          ⚠️{' '}
          {t('settings.modelFilter.warning', {
            defaultValue:
              'Algunos modelos no están optimizados para análisis financiero',
          })}
        </p>
      )}
    </div>
  );
}
