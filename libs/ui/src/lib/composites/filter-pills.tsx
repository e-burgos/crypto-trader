import { cn } from '../utils';

interface FilterPill {
  label: string;
  value: string;
  count?: number;
}

interface FilterPillsProps {
  options: FilterPill[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function FilterPills({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: FilterPillsProps) {
  return (
    <div role="group" className={cn('flex flex-wrap gap-2', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            option.value === value
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="text-[10px] font-bold opacity-70">
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export type { FilterPillsProps, FilterPill };
