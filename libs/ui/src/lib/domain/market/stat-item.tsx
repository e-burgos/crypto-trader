import * as React from 'react';
import { cn } from '../../utils';

interface StatItemProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  color?: string;
  className?: string;
}

export function StatItem({
  label,
  value,
  icon,
  color,
  className,
}: StatItemProps) {
  return (
    <div className={cn('rounded-lg border border-border p-3', className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-sm font-semibold flex items-center gap-1',
          color,
        )}
      >
        {icon}
        {value}
      </p>
    </div>
  );
}

export type { StatItemProps };
