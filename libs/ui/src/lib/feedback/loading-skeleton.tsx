import { cn } from '../utils';

interface LoadingSkeletonProps {
  variant?: 'text' | 'card' | 'table' | 'chart';
  className?: string;
}

export function LoadingSkeleton({
  variant = 'text',
  className,
}: LoadingSkeletonProps) {
  switch (variant) {
    case 'card':
      return (
        <div className={cn('rounded-xl border border-border bg-card p-4', className)}>
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-8 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-3 w-full animate-pulse rounded bg-muted" />
        </div>
      );
    case 'table':
      return (
        <div className={cn('space-y-2', className)}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-4 rounded-lg bg-muted/30 p-3"
            >
              <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/6 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      );
    case 'chart':
      return (
        <div
          className={cn(
            'flex h-48 items-end justify-around rounded-xl border border-border bg-card p-4',
            className,
          )}
        >
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-t bg-muted"
              style={{
                width: '10%',
                height: `${30 + Math.random() * 60}%`,
              }}
            />
          ))}
        </div>
      );
    default:
      return (
        <div className={cn('space-y-2', className)}>
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      );
  }
}

export type { LoadingSkeletonProps };
