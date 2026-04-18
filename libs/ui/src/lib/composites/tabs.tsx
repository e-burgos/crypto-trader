import { cn } from '../utils';

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
  className?: string;
}

export function Tabs({
  tabs,
  value,
  onChange,
  size = 'md',
  className,
}: TabsProps) {
  return (
    <div
      className={cn(
        'flex gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1',
        className,
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors',
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
  );
}

export type { TabsProps, Tab };
