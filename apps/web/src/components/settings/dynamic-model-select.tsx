import { useState } from 'react';
import { useLLMProviderModels, type LLMModel } from '../../hooks/use-llm';
import { CustomSelect, type SelectOption } from '../ui/custom-select';
import { Cpu, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Models curated for crypto-trading / financial analysis per provider */
const RECOMMENDED_MODELS: Record<string, string[]> = {
  CLAUDE: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-opus-4-5'],
  OPENAI: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  GROQ: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  GEMINI: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  MISTRAL: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
  TOGETHER: ['meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8', 'meta-llama/Llama-3.3-70B-Instruct-Turbo'],
};

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
  const { data: models, isLoading, isError } = useLLMProviderModels(provider);
  const [showAll, setShowAll] = useState(false);
  const recommended = RECOMMENDED_MODELS[provider] ?? [];

  const allOptions: SelectOption[] =
    !isLoading && !isError && models?.length
      ? models.map((m: LLMModel) => ({
          value: m.id,
          label: m.deprecated
            ? `${m.label ?? m.id} (deprecated)`
            : (m.label ?? m.id),
          description: m.contextWindow
            ? `${(m.contextWindow / 1000).toFixed(0)}K context`
            : undefined,
          icon: <Cpu className="h-3.5 w-3.5 text-muted-foreground" />,
          disabled: m.deprecated,
        }))
      : fallbackModels.map((m) => ({
          value: m,
          label: m,
          icon: <Cpu className="h-3.5 w-3.5 text-muted-foreground" />,
        }));

  const options = showAll
    ? allOptions
    : allOptions.filter(
        (o) =>
          recommended.length === 0 || recommended.includes(o.value as string),
      );

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

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        {label && (
          <label className="text-xs font-medium">{label}</label>
        )}
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
      </div>
      <CustomSelect
        options={options}
        value={value}
        onChange={onChange}
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
