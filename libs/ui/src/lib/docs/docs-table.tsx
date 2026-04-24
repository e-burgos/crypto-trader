import { cn } from '../utils';

interface DocsTableProps {
  headers: string[];
  rows: (string | React.ReactNode)[][];
  variant?: 'default' | 'overview';
  className?: string;
}

export function DocsTable({
  headers,
  rows,
  variant = 'default',
  className,
}: DocsTableProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {headers.map((header, i) => (
                <th
                  key={i}
                  className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {rows.map((row, ri) => (
              <tr key={ri} className="transition-colors hover:bg-muted/20">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      'px-4 py-2.5 text-sm',
                      variant === 'overview' && ci === 0
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type { DocsTableProps };
