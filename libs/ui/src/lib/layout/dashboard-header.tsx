import { cn } from '../utils';

interface DashboardHeaderProps {
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  className?: string;
}

export function DashboardHeader({
  leftSlot,
  rightSlot,
  className,
}: DashboardHeaderProps) {
  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center justify-between gap-1 border-b border-border/60 bg-card/50 px-4 backdrop-blur-sm',
        className,
      )}
    >
      {leftSlot && <div className="flex items-center gap-2">{leftSlot}</div>}
      <div className="flex-1" />
      {rightSlot && (
        <div className="flex items-center gap-1.5">{rightSlot}</div>
      )}
    </header>
  );
}

export type { DashboardHeaderProps };
