import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Users,
  TrendingUp,
  TrendingDown,
  Bot,
  DollarSign,
  BarChart3,
  Eye,
} from 'lucide-react';
import { Button, DataTable, Dialog, StatItem } from '@crypto-trader/ui';
import type { DataTableColumn } from '@crypto-trader/ui';
import { cn } from '../../lib/utils';
import {
  useAdminUsers,
  useToggleUserStatus,
  useAdminUserDetail,
} from '../../hooks/use-admin';
import type { AdminUser } from '../../hooks/use-admin';
import { useTranslation } from 'react-i18next';

export function AdminUsersPage() {
  const { t } = useTranslation();
  const { data: users = [], isLoading } = useAdminUsers();
  const { mutate: toggleStatus, isPending } = useToggleUserStatus();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { data: userDetail, isLoading: loadingDetail } =
    useAdminUserDetail(selectedUserId);

  const columns: DataTableColumn<AdminUser>[] = [
    {
      key: 'email',
      header: t('admin.userColEmail'),
      render: (row) => <span className="font-medium">{row.email}</span>,
    },
    {
      key: 'role',
      header: t('admin.userColRole'),
      render: (row) => (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold',
            row.role === 'ADMIN'
              ? 'bg-red-500/10 text-red-500'
              : 'bg-blue-500/10 text-blue-500',
          )}
        >
          {row.role}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('admin.userColStatus'),
      render: (row) => (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs font-medium',
            row.isActive ? 'text-emerald-500' : 'text-muted-foreground',
          )}
        >
          {row.isActive ? (
            <>
              <CheckCircle className="h-3 w-3" /> {t('settings.active')}
            </>
          ) : (
            <>
              <XCircle className="h-3 w-3" /> {t('settings.inactive')}
            </>
          )}
        </span>
      ),
    },
    {
      key: 'configs',
      header: t('admin.userColConfigs'),
      align: 'center',
      render: (row) => (
        <span className="text-muted-foreground">
          {row._count?.tradingConfigs ?? '–'}
        </span>
      ),
    },
    {
      key: 'positions',
      header: t('admin.userColPositions'),
      align: 'center',
      render: (row) => (
        <span className="text-muted-foreground">
          {row._count?.positions ?? '–'}
        </span>
      ),
    },
    {
      key: 'joined',
      header: t('admin.userColJoined'),
      render: (row) => (
        <span className="text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedUserId(row.id);
            }}
            className="text-xs gap-1 text-primary"
          >
            <Eye className="h-3 w-3" />
            {t('common.view')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={(e) => {
              e.stopPropagation();
              toggleStatus({ id: row.id, isActive: !row.isActive });
            }}
            className={cn(
              'text-xs',
              row.isActive
                ? 'text-red-500 hover:text-red-600'
                : 'text-emerald-500 hover:text-emerald-600',
            )}
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : row.isActive ? (
              t('admin.deactivate')
            ) : (
              t('admin.activate')
            )}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('admin.usersTitle')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('admin.usersSubtitle')}
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        {t('admin.registeredUsers', { count: users.length })}
      </p>

      <DataTable<AdminUser>
        columns={columns}
        data={users}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyMessage={t('admin.noUsers')}
        onRowClick={(row) => setSelectedUserId(row.id)}
      />

      {/* User Detail Modal */}
      <Dialog
        open={!!selectedUserId}
        onClose={() => setSelectedUserId(null)}
        title={userDetail?.email ?? ''}
        description={t('admin.userDetailDesc')}
        size="lg"
      >
        {loadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : userDetail ? (
          <div className="space-y-5">
            {/* Account Info */}
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  {t('common.role')}
                </p>
                <p
                  className={cn(
                    'mt-1 font-semibold',
                    userDetail.role === 'ADMIN'
                      ? 'text-red-500'
                      : 'text-blue-500',
                  )}
                >
                  {userDetail.role}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  {t('common.status')}
                </p>
                <p
                  className={cn(
                    'mt-1 font-semibold',
                    userDetail.isActive ? 'text-emerald-500' : 'text-red-500',
                  )}
                >
                  {userDetail.isActive
                    ? t('settings.active')
                    : t('settings.inactive')}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  {t('admin.userColMode')}
                </p>
                <p className="mt-1 font-semibold">
                  {userDetail.platformOperationMode}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  {t('admin.memberSince')}
                </p>
                <p className="mt-1 font-semibold text-xs">
                  {new Date(userDetail.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div>
              <h4 className="mb-2 text-sm font-semibold flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-primary" />
                {t('admin.userStats')}
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatItem
                  label={t('admin.userNetPnl')}
                  value={`$${userDetail.stats.netPnl.toFixed(2)}`}
                  icon={
                    userDetail.stats.netPnl >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )
                  }
                  color={
                    userDetail.stats.netPnl >= 0
                      ? 'text-emerald-500'
                      : 'text-red-500'
                  }
                />
                <StatItem
                  label={t('admin.userOpenPos')}
                  value={String(userDetail.stats.openPositions)}
                />
                <StatItem
                  label={t('admin.userClosedPos')}
                  value={String(userDetail.stats.closedPositions)}
                />
                <StatItem
                  label={t('admin.userTotalTrades')}
                  value={String(userDetail.stats.totalTrades)}
                />
              </div>
            </div>

            {/* LLM Costs */}
            <div>
              <h4 className="mb-2 text-sm font-semibold flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-primary" />
                {t('admin.userLlmCosts')}
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <StatItem
                  label={t('admin.userLlmTotalCost')}
                  value={`$${userDetail.stats.llmTotalCostUsd.toFixed(4)}`}
                />
                <StatItem
                  label={t('admin.userLlmTokens')}
                  value={userDetail.stats.llmTotalTokens.toLocaleString()}
                />
                <StatItem
                  label={t('admin.userLlmCalls')}
                  value={String(userDetail.stats.llmCallCount)}
                />
              </div>
            </div>

            {/* Agent Configs */}
            <div>
              <h4 className="mb-2 text-sm font-semibold flex items-center gap-1.5">
                <Bot className="h-4 w-4 text-primary" />
                {t('admin.userAgents')}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                  {userDetail.tradingConfigs.length}
                </span>
              </h4>
              {userDetail.tradingConfigs.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  {t('admin.userNoAgents')}
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {userDetail.tradingConfigs.map((cfg) => (
                    <div
                      key={cfg.id}
                      className="flex items-center justify-between rounded-lg border border-border p-2.5 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {cfg.name || `${cfg.asset}/${cfg.pair}`}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {cfg.asset}/{cfg.pair}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-semibold',
                            cfg.mode === 'SANDBOX'
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-blue-500/10 text-blue-500',
                          )}
                        >
                          {cfg.mode}
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-xs font-semibold',
                            cfg.isRunning
                              ? 'text-emerald-500'
                              : 'text-muted-foreground',
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              cfg.isRunning
                                ? 'bg-emerald-500'
                                : 'bg-muted-foreground',
                            )}
                          />
                          {cfg.isRunning
                            ? t('admin.agentRunning')
                            : t('admin.agentStopped')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
