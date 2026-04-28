import * as React from 'react';
import { cn } from '../utils';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  labelExtra?: React.ReactNode;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
  size?: 'default' | 'sm';
}

export function Select({
  options,
  value,
  onChange,
  label,
  labelExtra,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  className,
  disabled,
  searchable = false,
  size = 'default',
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [dropUp, setDropUp] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value);

  // Detect if dropdown should open upward
  React.useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = 280; // max-h-60 (240px) + search bar + margin
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setDropUp(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
  }, [open]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  React.useEffect(() => {
    if (open && searchable) {
      // Small delay to ensure DOM is rendered
      requestAnimationFrame(() => searchRef.current?.focus());
    }
    if (!open) setSearch('');
  }, [open, searchable]);

  const filteredOptions = React.useMemo(() => {
    if (!searchable || !search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q),
    );
  }, [options, search, searchable]);

  return (
    <div className={cn('space-y-1.5', className)} ref={ref}>
      {(label || labelExtra) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="text-sm font-medium text-foreground">{label}</span>
          )}
          {labelExtra}
        </div>
      )}
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className={cn(
            size === 'sm'
              ? 'flex h-8 w-full items-center justify-between rounded-lg border border-border bg-background px-2.5 py-1 text-xs transition-colors'
              : 'flex h-10 w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors',
            'hover:border-primary/30 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            open && 'border-primary/50 ring-2 ring-primary/20',
          )}
        >
          <span className="flex items-center gap-2 truncate">
            {selected?.icon}
            <span
              className={cn(
                'truncate',
                !selected && 'text-muted-foreground/60',
              )}
            >
              {selected?.label ?? placeholder}
            </span>
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>

        {open && (
          <div
            className={cn(
              'absolute z-50 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg animate-in fade-in-0 zoom-in-95',
              dropUp
                ? 'bottom-full mb-1.5 slide-in-from-bottom-2'
                : 'top-full mt-1.5 slide-in-from-top-2',
            )}
          >
            {searchable && (
              <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
                  onKeyDown={(e) => {
                    // Prevent dropdown close on typing
                    e.stopPropagation();
                    if (e.key === 'Escape') {
                      if (search) {
                        setSearch('');
                      } else {
                        setOpen(false);
                      }
                    }
                  }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
            <div className="max-h-60 overflow-y-auto p-1">
              {filteredOptions.length === 0 ? (
                <div className="px-2.5 py-3 text-center text-sm text-muted-foreground">
                  No results
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors',
                      'hover:bg-accent/50',
                      option.value === value && 'bg-primary/10 text-primary',
                      option.disabled && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    {option.icon && (
                      <span className="shrink-0">{option.icon}</span>
                    )}
                    <div className="flex-1 text-left">
                      <span className="block">{option.label}</span>
                      {option.description && (
                        <span className="block text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </div>
                    {option.value === value && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
