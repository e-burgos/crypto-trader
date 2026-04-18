export function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <code className="block rounded-lg bg-muted px-4 py-3 font-mono text-xs text-foreground">
      {children}
    </code>
  );
}

export function HelpSectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center gap-2 border-b border-border pb-3">
      <span className="text-primary">{icon}</span>
      <h2 className="text-xl font-bold">{children}</h2>
    </div>
  );
}
