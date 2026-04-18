import { cn } from '../utils';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  size = 'md',
  disabled = false,
  label,
  className,
}: ToggleSwitchProps) {
  const trackSize = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const thumbSize =
    size === 'sm' ? 'h-3.5 w-3.5' : 'h-4.5 w-4.5 sm:h-5 sm:w-5';
  const translate = checked
    ? size === 'sm'
      ? 'translate-x-4'
      : 'translate-x-5'
    : 'translate-x-0.5';

  return (
    <label
      className={cn(
        'inline-flex items-center gap-2',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <button
        role="switch"
        type="button"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
          trackSize,
          checked ? 'bg-primary' : 'bg-muted',
          disabled && 'cursor-not-allowed',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block transform rounded-full bg-white shadow-lg ring-0 transition duration-200',
            thumbSize,
            translate,
          )}
        />
      </button>
      {label && <span className="text-sm text-foreground">{label}</span>}
    </label>
  );
}

export type { ToggleSwitchProps };
