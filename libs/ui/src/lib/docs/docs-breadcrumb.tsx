import { ChevronRight } from 'lucide-react';

export interface DocsBreadcrumbProps {
  group: string;
  page: string;
  rootLabel?: string;
  rootHref?: string;
  onNavigateRoot?: () => void;
}

export function DocsBreadcrumb({
  group,
  page,
  rootLabel = 'Docs',
  onNavigateRoot,
}: DocsBreadcrumbProps) {
  return (
    <nav className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
      {onNavigateRoot ? (
        <button
          type="button"
          onClick={onNavigateRoot}
          className="hover:text-foreground transition-colors"
        >
          {rootLabel}
        </button>
      ) : (
        <span>{rootLabel}</span>
      )}
      <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
      <span>{group}</span>
      <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
      <span className="text-foreground font-medium">{page}</span>
    </nav>
  );
}
