import { cn } from '../../lib/utils';
import { CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';

type BadgeVariant = 'success' | 'error' | 'warning' | 'neutral' | 'loading';

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  className?: string;
}

const VARIANTS: Record<
  BadgeVariant,
  { bg: string; text: string; icon: React.ReactNode }
> = {
  success: {
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    text: 'text-emerald-500',
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
  error: {
    bg: 'bg-red-500/10 border-red-500/20',
    text: 'text-red-500',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  warning: {
    bg: 'bg-amber-500/10 border-amber-500/20',
    text: 'text-amber-500',
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
  neutral: {
    bg: 'bg-muted border-border',
    text: 'text-muted-foreground',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  loading: {
    bg: 'bg-primary/10 border-primary/20',
    text: 'text-primary',
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  },
};

export function StatusBadge({ variant, label, className }: StatusBadgeProps) {
  const v = VARIANTS[variant];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        v.bg,
        v.text,
        className,
      )}
    >
      {v.icon}
      {label}
    </span>
  );
}
