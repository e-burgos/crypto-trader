import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '../utils';

interface CopyButtonProps {
  text: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function CopyButton({ text, size = 'sm', className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      )}
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <Check className={cn(iconSize, 'text-emerald-500')} />
      ) : (
        <Copy className={iconSize} />
      )}
    </button>
  );
}

export type { CopyButtonProps };
