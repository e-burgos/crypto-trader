import { useLLMProviderModels, type LLMModel } from '../../hooks/use-llm';
import { CustomSelect, type SelectOption } from '../ui/custom-select';
import { Cpu, Loader2 } from 'lucide-react';

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

  const options: SelectOption[] =
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
    <CustomSelect
      options={options}
      value={value}
      onChange={onChange}
      label={label}
      className={className}
      placeholder="Select model..."
    />
  );
}
