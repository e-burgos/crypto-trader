import { cn } from '../../lib/utils';

export function ModeCard({
  icon,
  title,
  description,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <div className="mode-card group relative flex flex-col items-center text-center rounded-xl border border-border bg-card p-8 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div
        className={cn(
          'mb-5 flex h-14 w-14 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110',
          accent,
        )}
      >
        {icon}
      </div>
      <h3 className="mb-2 text-xl font-bold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
