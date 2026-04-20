import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLLMProviderModels, type LLMModel } from '../../hooks/use-llm';
import { Select, type SelectOption } from '@crypto-trader/ui';
import { Cpu, Loader2, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

// ── OpenRouter category filters (driven by backend `categories` field) ──────

type ORCategory =
  | 'top-paid'
  | 'free'
  | 'all'
  | 'reasoning'
  | 'fast'
  | 'analytics';

const OR_CATEGORIES: { value: ORCategory; labelKey: string }[] = [
  { value: 'top-paid', labelKey: 'settings.orCategory.topPaid' },
  { value: 'free', labelKey: 'settings.orCategory.free' },
  { value: 'all', labelKey: 'settings.orCategory.all' },
  { value: 'reasoning', labelKey: 'settings.orCategory.reasoning' },
  { value: 'fast', labelKey: 'settings.orCategory.fast' },
  { value: 'analytics', labelKey: 'settings.orCategory.analytics' },
];

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
  const { data: models, isLoading, isError } = useLLMProviderModels(provider);
  const isOpenRouter = provider === 'OPENROUTER';
  const [category, setCategory] = useState<ORCategory>('top-paid');
  const [showAll, setShowAll] = useState(false);

  const autoOption: SelectOption = {
    value: '',
    label: t('config.stepper.autoSelect'),
    icon: <Sparkles className="h-3.5 w-3.5 text-primary" />,
  };

  const allModels = !isLoading && !isError && models?.length ? models : null;

  // Build all options, excluding deprecated
  const allOptions: (SelectOption & {
    _recommended?: boolean;
    _categories?: string[];
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
          _categories: m.categories,
        }))
    : fallbackModels.map((m) => ({
        value: m,
        label: m,
        icon: <Cpu className="h-3.5 w-3.5 text-muted-foreground" />,
      }));

  const hasRecommended = allOptions.some((o) => o._recommended);

  // For non-OpenRouter: auto-expand if saved model isn't in recommended
  useEffect(() => {
    if (
      !isOpenRouter &&
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

  // For OpenRouter: auto-switch category if saved model isn't visible
  useEffect(() => {
    if (isOpenRouter && value && allOptions.some((o) => o.value === value)) {
      const visible = allOptions.filter(
        (o) => category === 'all' || o._categories?.includes(category),
      );
      if (!visible.some((o) => o.value === value)) {
        // Find a category that contains this model
        for (const cat of OR_CATEGORIES) {
          if (
            cat.value === 'all' ||
            allOptions.some(
              (o) => o.value === value && o._categories?.includes(cat.value),
            )
          ) {
            setCategory(cat.value);
            break;
          }
        }
      }
    }
  }, [value, allModels]);

  // Apply filtering
  let filteredModels: SelectOption[];
  if (isOpenRouter) {
    if (category === 'all') {
      filteredModels = allOptions;
    } else {
      filteredModels = allOptions.filter((o) =>
        o._categories?.includes(category),
      );
    }
  } else {
    filteredModels = showAll
      ? allOptions
      : allOptions.filter(
          (o) => !o.disabled && (!hasRecommended || o._recommended),
        );
  }

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

  // OpenRouter: category pills
  const orCategorySelector = isOpenRouter ? (
    <div className="flex flex-wrap gap-1">
      {OR_CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          type="button"
          onClick={() => setCategory(cat.value)}
          className={cn(
            'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
            category === cat.value
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground',
          )}
        >
          {t(cat.labelKey, { defaultValue: cat.value })}
        </button>
      ))}
    </div>
  ) : null;

  // Other providers: recommended/all toggle
  const badgeButton =
    !isOpenRouter && hasRecommended ? (
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

  const effectiveValue = options.some((o) => o.value === value) ? value : '';

  return (
    <div className={className}>
      {orCategorySelector && <div className="mb-2">{orCategorySelector}</div>}
      <Select
        options={options}
        value={effectiveValue}
        onChange={onChange}
        label={label}
        labelExtra={badgeButton}
        placeholder="Select model..."
      />
      {!isOpenRouter && showAll && (
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
