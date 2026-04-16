import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLLMProviderModels, type LLMModel } from '../../hooks/use-llm';
import { CustomSelect, type SelectOption } from '../ui/custom-select';
import { Cpu, Loader2, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

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
  const [showAll, setShowAll] = useState(false);

  const autoOption: SelectOption = {
    value: '',
    label: t('config.stepper.autoSelect'),
    icon: <Sparkles className="h-3.5 w-3.5 text-primary" />,
  };

  // Build options with a _recommended flag for filtering
  const allModels = !isLoading && !isError && models?.length ? models : null;

  const allOptions: (SelectOption & { _recommended?: boolean })[] = allModels
    ? allModels.map((m: LLMModel) => ({
        value: m.id,
        label: m.deprecated
          ? `${m.label ?? m.id} (deprecated)`
          : (m.label ?? m.id),
        description: m.contextWindow
          ? `${(m.contextWindow / 1000).toFixed(0)}K context`
          : undefined,
        icon: <Cpu className="h-3.5 w-3.5 text-muted-foreground" />,
        disabled: m.deprecated,
        _recommended: m.recommended,
      }))
    : fallbackModels.map((m) => ({
        value: m,
        label: m,
        icon: <Cpu className="h-3.5 w-3.5 text-muted-foreground" />,
      }));

  const hasRecommended = allOptions.some((o) => o._recommended);

  // Auto-expand to "Todos" if the saved model exists but isn't recommended
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

  const filteredModels: SelectOption[] = showAll
    ? allOptions
    : allOptions.filter(
        (o) => !o.disabled && (!hasRecommended || o._recommended),
      );
  const options: SelectOption[] = [autoOption, ...filteredModels];

  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <CustomSelect
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

  const badgeButton = (
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
      {showAll ? 'Todos' : 'Recomendados'}
    </button>
  );

  // If the current value isn't among the visible options, fall back to auto
  const effectiveValue = options.some((o) => o.value === value) ? value : '';

  return (
    <div className={className}>
      <CustomSelect
        options={options}
        value={effectiveValue}
        onChange={onChange}
        label={label}
        labelExtra={badgeButton}
        placeholder="Select model..."
      />
      {showAll && (
        <p className="mt-1 text-[10px] text-amber-400">
          ⚠️ Algunos modelos no están optimizados para análisis financiero
        </p>
      )}
    </div>
  );
}
