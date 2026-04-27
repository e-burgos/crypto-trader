import { Info, AlertTriangle, AlertCircle, Lightbulb } from 'lucide-react';
import { cn } from '../utils';

type DocsCalloutVariant = 'info' | 'warning' | 'tip' | 'danger';

interface DocsCalloutProps {
  variant?: DocsCalloutVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const VARIANT_CONFIG: Record<
  DocsCalloutVariant,
  {
    border: string;
    bg: string;
    iconColor: string;
    titleColor: string;
    icon: React.ReactNode;
  }
> = {
  info: {
    border: 'border-l-blue-500',
    bg: 'bg-blue-500/5',
    iconColor: 'text-blue-500',
    titleColor: 'text-blue-400',
    icon: <Info className="h-4 w-4" />,
  },
  warning: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-500/5',
    iconColor: 'text-amber-500',
    titleColor: 'text-amber-400',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  danger: {
    border: 'border-l-red-500',
    bg: 'bg-red-500/5',
    iconColor: 'text-red-500',
    titleColor: 'text-red-400',
    icon: <AlertCircle className="h-4 w-4" />,
  },
  tip: {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-500/5',
    iconColor: 'text-emerald-500',
    titleColor: 'text-emerald-400',
    icon: <Lightbulb className="h-4 w-4" />,
  },
};

export function DocsCallout({
  variant = 'info',
  title,
  children,
  className,
}: DocsCalloutProps) {
  const config = VARIANT_CONFIG[variant];

  return (
    <div
      className={cn(
        'rounded-lg border border-transparent border-l-4 px-4 py-4 mt-6 mb-6',
        config.border,
        config.bg,
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 shrink-0', config.iconColor)}>
          {config.icon}
        </span>
        <div className="min-w-0">
          {title && (
            <p className={cn('text-sm font-semibold mb-1', config.titleColor)}>
              {title}
            </p>
          )}
          <div className="text-sm text-muted-foreground leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export type { DocsCalloutProps, DocsCalloutVariant };
