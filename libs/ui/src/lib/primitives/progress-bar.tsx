import { cn } from '../utils';

interface ProgressBarProps {
  value: number;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<string, string> = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export function ProgressBar({
  value,
  color = 'bg-primary',
  size = 'md',
  showLabel = false,
  className,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          {Math.round(clamped)}%
        </span>
      )}
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-muted',
          SIZE_CLASSES[size],
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            color,
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export type { ProgressBarProps };
