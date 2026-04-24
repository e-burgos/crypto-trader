import { useState, useCallback } from 'react';
import { Link2 } from 'lucide-react';
import { cn } from '../utils';

interface DocsSectionHeaderProps {
  id: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  level?: 'h2' | 'h3';
  className?: string;
}

export function DocsSectionHeader({
  id,
  icon,
  children,
  level = 'h2',
  className,
}: DocsSectionHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyAnchor = useCallback(async () => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [id]);

  const Tag = level;

  return (
    <div
      className={cn(
        'group mb-5 flex items-center gap-2 border-b border-border/60 pb-3',
        className,
      )}
    >
      {icon && <span className="text-primary shrink-0">{icon}</span>}
      <Tag
        className={cn(
          'font-bold text-foreground',
          level === 'h2' ? 'text-xl' : 'text-lg',
        )}
      >
        {children}
      </Tag>
      <button
        type="button"
        onClick={handleCopyAnchor}
        className="ml-1 inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground/0 transition-all group-hover:text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={`Copy link to ${id}`}
      >
        {copied ? (
          <span className="text-[10px] font-medium text-emerald-400">
            Copied!
          </span>
        ) : (
          <Link2 className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

export type { DocsSectionHeaderProps };
