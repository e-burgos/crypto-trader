import { cn } from '../../lib/utils';

interface SettingsCardProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  accent?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingsCard({
  icon,
  title,
  description,
  badge,
  actions,
  accent,
  children,
  className,
}: SettingsCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card overflow-hidden',
        accent ? `border-${accent}` : 'border-border',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border/50 px-6 py-4">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
          )}
          <div>
            <h3 className="font-semibold">{title}</h3>
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {actions}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
