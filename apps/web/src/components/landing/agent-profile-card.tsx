import { cn } from '../../lib/utils';

export function AgentProfileCard({
  codename,
  role,
  description,
  icon,
  color,
}: {
  codename: string;
  role: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="agent-profile-card group relative flex flex-col items-center text-center rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div
        className={cn(
          'mb-4 flex h-16 w-16 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-background transition-transform duration-300 group-hover:scale-110',
          color,
        )}
      >
        {icon}
      </div>
      <h3 className="mb-1 font-mono text-lg font-extrabold tracking-wider text-foreground">
        {codename}
      </h3>
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
        {role}
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
