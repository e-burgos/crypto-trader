import { useLLMProviderModels, type LLMModel } from '../../hooks/use-llm';
import { Loader2 } from 'lucide-react';

interface DynamicModelSelectProps {
  provider: string;
  value: string;
  onChange: (model: string) => void;
  fallbackModels: string[];
  className?: string;
}

export function DynamicModelSelect({
  provider,
  value,
  onChange,
  fallbackModels,
  className = '',
}: DynamicModelSelectProps) {
  const { data: models, isLoading, isError } = useLLMProviderModels(provider);

  const options: { id: string; label: string }[] =
    !isLoading && !isError && models?.length
      ? models.map((m: LLMModel) => ({
          id: m.id,
          label: m.deprecated
            ? `${m.label ?? m.id} (deprecated)`
            : (m.label ?? m.id),
        }))
      : fallbackModels.map((m) => ({ id: m, label: m }));

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/50 ${className}`}
      >
        {options.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      {isLoading && (
        <Loader2 className="absolute right-8 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
