import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../utils';

export interface DocsPaginationLink {
  title: string;
  href: string;
  description?: string;
}

export interface DocsPaginationProps {
  prev?: DocsPaginationLink;
  next?: DocsPaginationLink;
  previousLabel?: string;
  nextLabel?: string;
  onNavigate: (href: string) => void;
}

export function DocsPagination({
  prev,
  next,
  previousLabel = 'Previous',
  nextLabel = 'Next',
  onNavigate,
}: DocsPaginationProps) {
  if (!prev && !next) return null;

  return (
    <div className="mt-12 flex items-stretch gap-4 border-t border-border/40 pt-6">
      {prev ? (
        <button
          type="button"
          onClick={() => onNavigate(prev.href)}
          className={cn(
            'group flex flex-1 flex-col items-start gap-1 rounded-lg border border-border/40 px-4 py-3',
            'text-left transition-all hover:border-border hover:bg-muted/30',
          )}
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ChevronLeft className="h-3 w-3" />
            {previousLabel}
          </span>
          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            {prev.title}
          </span>
        </button>
      ) : (
        <div className="flex-1" />
      )}

      {next ? (
        <button
          type="button"
          onClick={() => onNavigate(next.href)}
          className={cn(
            'group flex flex-1 flex-col items-end gap-1 rounded-lg border border-border/40 px-4 py-3',
            'text-right transition-all hover:border-border hover:bg-muted/30',
          )}
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {nextLabel}
            <ChevronRight className="h-3 w-3" />
          </span>
          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            {next.title}
          </span>
        </button>
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}
