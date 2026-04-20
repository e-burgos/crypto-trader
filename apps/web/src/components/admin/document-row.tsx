import {
  FileText,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import type { AgentDocument } from '../../hooks/use-admin-agents';

const STATUS_CONFIG = {
  PENDING: {
    icon: Clock,
    labelKey: 'admin.docPending',
    className: 'text-muted-foreground',
  },
  PROCESSING: {
    icon: Loader2,
    labelKey: 'admin.docProcessing',
    className: 'text-orange-400 animate-spin',
  },
  READY: {
    icon: CheckCircle,
    labelKey: 'admin.docReady',
    className: 'text-emerald-400',
  },
  ERROR: {
    icon: XCircle,
    labelKey: 'admin.docError',
    className: 'text-red-400',
  },
};

export function DocumentRow({
  doc,
  onDelete,
  isDeleting,
}: {
  doc: AgentDocument;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const { t } = useTranslation();
  const status = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.PENDING;
  const StatusIcon = status.icon;

  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/20 px-3 py-2 ring-1 ring-border/50">
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{doc.fileName}</p>
        <p className="text-xs text-muted-foreground">
          {(doc.sizeBytes / 1024).toFixed(1)} KB
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <StatusIcon className={cn('h-4 w-4', status.className)} />
        <span className="text-xs text-muted-foreground">
          {t(status.labelKey)}
        </span>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
