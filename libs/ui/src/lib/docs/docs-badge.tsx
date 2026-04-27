import { cn } from '../utils';

type DocsBadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface DocsBadgeProps {
  variant?: DocsBadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const VARIANT_STYLES: Record<DocsBadgeVariant, string> = {
  default: 'bg-muted text-foreground',
  success: 'bg-emerald-500/15 text-emerald-500',
  warning: 'bg-amber-500/15 text-amber-500',
  danger: 'bg-red-500/15 text-red-500',
  info: 'bg-blue-500/15 text-blue-500',
};

export function DocsBadge({
  variant = 'default',
  children,
  className,
}: DocsBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest',
        VARIANT_STYLES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type { DocsBadgeProps, DocsBadgeVariant };
