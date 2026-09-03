import { cn } from '../utils';

interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  id?: string;
  hint?: string;
  tooltip?: string;
  formatValue?: (value: number) => string;
  className?: string;
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  disabled = false,
  id,
  hint,
  tooltip,
  formatValue,
  className,
}: SliderFieldProps) {
  const hintId = hint && id ? `${id}-hint` : undefined;
  const describedBy = [hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-2', disabled && 'opacity-60', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm font-mono text-muted-foreground">
          {formatValue ? formatValue(value) : value}
          {!formatValue && unit && <span className="ml-0.5">{unit}</span>}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        aria-describedby={describedBy}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary disabled:cursor-not-allowed"
      />
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {tooltip && <p className="text-xs text-amber-500">{tooltip}</p>}
    </div>
  );
}

export type { SliderFieldProps };
