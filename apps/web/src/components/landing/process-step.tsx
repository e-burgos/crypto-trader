export function ProcessStep({
  number,
  title,
  description,
  icon,
}: {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="process-step relative flex flex-col items-center text-center">
      <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 animate-pulse rounded-full border border-primary/15" />
        <div className="absolute inset-3 rounded-full bg-primary/8" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-primary shadow-lg shadow-primary/10">
          {icon}
        </div>
        <div className="proc-number absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground shadow-md shadow-primary/25">
          {number}
        </div>
      </div>
      <h3 className="mb-3 text-xl font-bold text-foreground">{title}</h3>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
