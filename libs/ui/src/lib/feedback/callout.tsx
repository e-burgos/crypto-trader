import { Info, AlertTriangle, AlertCircle, Lightbulb } from 'lucide-react';
import { cn } from '../utils';

type CalloutVariant = 'info' | 'warning' | 'danger' | 'tip';

interface CalloutProps {
  variant?: CalloutVariant;
  icon?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const VARIANT_STYLES: Record<
  CalloutVariant,
  { bg: string; border: string; icon: React.ReactNode }
> = {
  info: {
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/20',
    icon: <Info className="h-4 w-4 text-blue-500" />,
  },
  warning: {
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/20',
    icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  },
  danger: {
    bg: 'bg-red-500/5',
    border: 'border-red-500/20',
    icon: <AlertCircle className="h-4 w-4 text-red-500" />,
  },
  tip: {
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/20',
    icon: <Lightbulb className="h-4 w-4 text-emerald-500" />,
  },
};

export function Callout({
  variant = 'info',
  icon,
  title,
  children,
  className,
}: CalloutProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={cn(
        'flex gap-3 rounded-lg border p-3',
        styles.bg,
        styles.border,
        className,
      )}
    >
      <div className="shrink-0 mt-0.5">{icon || styles.icon}</div>
      <div className="text-sm">
        {title && <p className="font-medium text-foreground">{title}</p>}
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

export type { CalloutProps, CalloutVariant };
