import { cn } from '../utils';

interface CardProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({
  title,
  description,
  icon,
  header,
  footer,
  actions,
  children,
  className,
  onClick,
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card',
        onClick && 'cursor-pointer hover:border-primary/30 transition-colors',
        className,
      )}
      onClick={onClick}
    >
      {(header || title || actions) && (
        <div className="flex items-start justify-between gap-3 p-4 pb-0">
          {header || (
            <div className="flex items-center gap-3">
              {icon && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {icon}
                </div>
              )}
              <div>
                {title && (
                  <h3 className="text-sm font-semibold text-foreground">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-xs text-muted-foreground">{description}</p>
                )}
              </div>
            </div>
          )}
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      {children && <div className="p-4">{children}</div>}
      {footer && (
        <div className="border-t border-border px-4 py-3">{footer}</div>
      )}
    </div>
  );
}

export type { CardProps };
