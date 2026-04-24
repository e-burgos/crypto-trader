import { cn } from '../utils';

interface DocsCardProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  href?: string;
  badge?: string;
  className?: string;
}

export function DocsCard({
  icon,
  title,
  description,
  href,
  badge,
  className,
}: DocsCardProps) {
  const content = (
    <>
      {badge && (
        <span className="mb-2 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
          {badge}
        </span>
      )}
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </>
  );

  const baseClasses = cn(
    'block rounded-xl border border-border bg-card p-4 transition-all duration-200',
    href &&
      'hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 cursor-pointer',
    className,
  );

  if (href) {
    return (
      <a href={href} className={baseClasses}>
        {content}
      </a>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}

export type { DocsCardProps };
