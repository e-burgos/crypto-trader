import { useState, useMemo } from 'react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  UserCheck,
  UserX,
  Activity,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTable, Badge, Button } from '@crypto-trader/ui';
import type { DataTableColumn } from '@crypto-trader/ui';
import type { BadgeVariant } from '@crypto-trader/ui';
import { useAuditLog } from '../../hooks/use-admin';
import type { AuditLog } from '../../hooks/use-admin';

const ROWS_PER_PAGE = 15;

const ACTION_CONFIG: Record<
  string,
  { variant: BadgeVariant; icon: React.ReactNode }
> = {
  KILL_SWITCH: {
    variant: 'error',
    icon: <ShieldAlert className="h-3.5 w-3.5" />,
  },
  ACTIVATE_USER: {
    variant: 'success',
    icon: <UserCheck className="h-3.5 w-3.5" />,
  },
  DEACTIVATE_USER: {
    variant: 'warning',
    icon: <UserX className="h-3.5 w-3.5" />,
  },
};

const DEFAULT_ACTION_CONFIG = {
  variant: 'neutral' as BadgeVariant,
  icon: <Activity className="h-3.5 w-3.5" />,
};

export function AdminAuditLogPage() {
  const { t } = useTranslation();
  const { data: auditLog = [], isLoading } = useAuditLog();
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(auditLog.length / ROWS_PER_PAGE));

  const paginated = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return auditLog.slice(start, start + ROWS_PER_PAGE);
  }, [auditLog, page]);

  const columns: DataTableColumn<AuditLog>[] = [
    {
      key: 'action',
      header: t('admin.auditAction'),
      render: (row) => {
        const cfg = ACTION_CONFIG[row.action] ?? DEFAULT_ACTION_CONFIG;
        return <Badge variant={cfg.variant} label={row.action} />;
      },
    },
    {
      key: 'target',
      header: t('admin.auditTarget'),
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.target?.email ?? '–'}
        </span>
      ),
    },
    {
      key: 'admin',
      header: t('admin.auditAdmin'),
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.admin?.email ?? row.adminId.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'date',
      header: t('admin.auditDate'),
      align: 'right',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('admin.auditLogTitle')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('admin.auditLogSubtitle')}
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        {t('admin.auditLogEntries', { count: auditLog.length })}
      </p>

      <DataTable<AuditLog>
        columns={columns}
        data={paginated}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyMessage={t('admin.noAuditEntries')}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t('admin.auditPageInfo', {
              from: (page - 1) * ROWS_PER_PAGE + 1,
              to: Math.min(page * ROWS_PER_PAGE, auditLog.length),
              total: auditLog.length,
            })}
          </p>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs font-medium">
              {page}/{totalPages}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
