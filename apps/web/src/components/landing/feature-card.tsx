export interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}

export function FeatureCard({
  icon,
  title,
  description,
  badge,
}: FeatureCardProps) {
  return (
    <div className="feat-card group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card p-6 transition-all duration-500 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/8">
      <div className="pointer-events-none absolute inset-0 -z-0 rounded-xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      {badge && (
        <span className="relative mb-4 inline-block self-start rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
          {badge}
        </span>
      )}
      <div className="relative mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="relative mb-2 text-base font-bold text-foreground">
        {title}
      </h3>
      <p className="relative text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
