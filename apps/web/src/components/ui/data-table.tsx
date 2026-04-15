import { cn } from '../../lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DataTableColumn<T> {
  /** i18n-translated header label */
  header: React.ReactNode;
  /** Unique key for React list rendering */
  key: string;
  /** Horizontal alignment (default: 'left') */
  align?: 'left' | 'right' | 'center';
  /** Render the cell content for a given row */
  render: (row: T, index: number) => React.ReactNode;
  /** Optional: only show this column when truthy */
  show?: boolean;
  /** Extra className on <th> and <td> */
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Unique key extractor per row */
  rowKey: (row: T, index: number) => string;
  /** Loading state — shows skeleton rows */
  isLoading?: boolean;
  /** Message shown when data is empty and not loading */
  emptyMessage?: string;
  /** Number of skeleton rows to show while loading (default: 5) */
  skeletonRows?: number;
  /** Extra className on each <tr> body row */
  rowClassName?: string | ((row: T, index: number) => string);
  /** Click handler for a row */
  onRowClick?: (row: T, index: number) => void;
  /** Outer container className */
  className?: string;
}

// ── Alignment helper ─────────────────────────────────────────────────────────

const ALIGN: Record<string, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

// ── Component ────────────────────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  data,
  rowKey,
  isLoading = false,
  emptyMessage = 'No data',
  skeletonRows = 5,
  rowClassName,
  onRowClick,
  className,
}: DataTableProps<T>) {
  const visibleCols = columns.filter((c) => c.show !== false);
  const colSpan = visibleCols.length;

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card overflow-hidden',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          {/* ── Header ── */}
          <thead className="border-b border-border bg-muted/30">
            <tr>
              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 font-medium text-xs uppercase tracking-wide text-muted-foreground',
                    ALIGN[col.align ?? 'left'],
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {isLoading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={`skel-${i}`} className="border-b border-border/50">
                  {visibleCols.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const rClass =
                  typeof rowClassName === 'function'
                    ? rowClassName(row, idx)
                    : rowClassName;
                return (
                  <tr
                    key={rowKey(row, idx)}
                    onClick={
                      onRowClick ? () => onRowClick(row, idx) : undefined
                    }
                    className={cn(
                      'border-b border-border/50 hover:bg-muted/20 transition-colors',
                      onRowClick && 'cursor-pointer',
                      rClass,
                    )}
                  >
                    {visibleCols.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 py-3',
                          ALIGN[col.align ?? 'left'],
                          col.className,
                        )}
                      >
                        {col.render(row, idx)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
