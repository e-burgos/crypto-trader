import { cn } from '../utils';

export interface TooltipProps {
  /** The content shown inside the tooltip bubble */
  content: React.ReactNode;
  /** The trigger element that receives hover/focus */
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Alignment along the cross axis */
  align?: 'start' | 'center' | 'end';
  className?: string;
  /** Extra className applied to the tooltip bubble */
  tooltipClassName?: string;
}

const POSITION: Record<string, string> = {
  top: 'bottom-full mb-2',
  bottom: 'top-full mt-2',
  left: 'right-full mr-2 top-1/2 -translate-y-1/2',
  right: 'left-full ml-2 top-1/2 -translate-y-1/2',
};

const ALIGN_H: Record<string, string> = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
};

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  className,
  tooltipClassName,
}: TooltipProps) {
  const isVertical = side === 'top' || side === 'bottom';

  return (
    <span className={cn('relative inline-flex group', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 w-max max-w-xs rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-card-foreground shadow-xl',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
          POSITION[side],
          isVertical && ALIGN_H[align],
          tooltipClassName,
        )}
      >
        {content}
      </span>
    </span>
  );
}
