import { HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface InfoTooltipProps {
  text: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export function InfoTooltip({ text, side = 'top', className }: InfoTooltipProps) {
  const translateClass: Record<string, string> = {
    top: '-translate-x-1/2 left-1/2 bottom-full mb-2',
    bottom: '-translate-x-1/2 left-1/2 top-full mt-2',
    left: '-translate-y-1/2 top-1/2 right-full mr-2',
    right: '-translate-y-1/2 top-1/2 left-full ml-2',
  };

  return (
    <span className={cn('relative inline-flex group', className)}>
      <HelpCircle className="h-3.5 w-3.5 cursor-help text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
      <span
        className={cn(
          'pointer-events-none absolute z-50 w-64 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
          translateClass[side],
        )}
        role="tooltip"
      >
        {text}
      </span>
    </span>
  );
}
