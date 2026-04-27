import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '../utils';

interface DocsCodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
  copyable?: boolean;
  className?: string;
}

export function DocsCodeBlock({
  code,
  language,
  title,
  showLineNumbers = false,
  copyable = true,
  className,
}: DocsCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div
      className={cn(
        'rounded-lg border border-border/60 bg-zinc-950 overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      {(title || language || copyable) && (
        <div className="flex items-center justify-between border-b border-border/30 bg-zinc-900/80 px-4 py-2">
          <div className="flex items-center gap-2">
            {title && (
              <span className="text-xs font-medium text-zinc-400">{title}</span>
            )}
            {language && !title && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                {language}
              </span>
            )}
          </div>
          {copyable && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Copy code"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Code */}
      <div className="overflow-x-auto">
        <pre className="p-4 text-sm leading-relaxed">
          <code>
            {lines.map((line, i) => (
              <div key={i} className="flex">
                {showLineNumbers && (
                  <span className="mr-4 inline-block w-8 select-none text-right font-mono text-xs text-zinc-600">
                    {i + 1}
                  </span>
                )}
                <span className="font-mono text-zinc-200">{line}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

export type { DocsCodeBlockProps };
