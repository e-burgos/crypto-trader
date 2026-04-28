import { cn } from '../utils';
import { Select } from './select';
import type { SelectOption } from './select';

interface Tab {
  label: string;
  value: string;
  icon?: React.ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
  /** Adds a border around the desktop tabs container */
  border?: boolean;
  className?: string;
  fullwidth?: boolean;
}

export function Tabs({
  tabs,
  value,
  onChange,
  size = 'md',
  border = false,
  className,
  fullwidth = false,
}: TabsProps) {
  const selectOptions: SelectOption[] = tabs.map((tab) => ({
    value: tab.value,
    label: tab.label,
    icon: tab.icon,
  }));

  return (
    <>
      {/* Mobile: Select dropdown */}
      <div className={cn('sm:hidden', className)}>
        <Select
          options={selectOptions}
          value={value}
          onChange={onChange}
          className="w-full"
          size={size === 'sm' ? 'sm' : 'default'}
        />
      </div>

      {/* Desktop: Tab buttons */}
      <div
        className={cn(
          'hidden sm:flex gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1',
          border && 'border border-border',
          fullwidth ? 'w-full' : 'w-fit',
          className,
        )}
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors',
              size === 'sm' ? 'py-1.5' : 'py-2',
              tab.value === value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  tab.value === value
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}

export type { TabsProps, Tab };
