import { Wrench, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';

interface ToolCallCardProps {
  tool: string;
  params?: Record<string, unknown>;
  onConfirm?: () => void;
  onCancel?: () => void;
  isPending?: boolean;
  className?: string;
}

export function ToolCallCard({
  tool,
  params,
  onConfirm,
  onCancel,
  isPending = false,
  className,
}: ToolCallCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 space-y-3',
        className,
      )}
      data-testid="tool-call-card"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/15 ring-1 ring-orange-500/30">
          <Wrench className="h-3.5 w-3.5 text-orange-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-orange-400">
            {t('agents.toolCall')}
          </p>
          <code
            className="text-xs text-muted-foreground"
            data-testid="tool-name"
          >
            {tool}
          </code>
        </div>
      </div>

      {params && Object.keys(params).length > 0 && (
        <div className="rounded-lg bg-muted/30 p-2 text-xs font-mono space-y-0.5">
          {Object.entries(params).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-muted-foreground">{k}:</span>
              <span>{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      {(onConfirm || onCancel) && (
        <div className="flex gap-2">
          {onConfirm && (
            <button
              type="button"
              disabled={isPending}
              onClick={onConfirm}
              data-testid="tool-confirm-btn"
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              {t('common.confirm')}
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              disabled={isPending}
              onClick={onCancel}
              data-testid="tool-cancel-btn"
              className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-border hover:bg-muted transition-colors disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              {t('common.cancel')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
