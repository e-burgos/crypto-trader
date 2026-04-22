import { useRef, useState, useMemo } from 'react';
import {
  AlertTriangle,
  Activity,
  TrendingUp,
  Users,
  BarChart3,
  Loader2,
  LayoutDashboard,
  Bot,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button, DataTable } from '@crypto-trader/ui';
import type { DataTableColumn } from '@crypto-trader/ui';
import { cn } from '../../lib/utils';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  useAdminStats,
  useAdminAgentsStatus,
  useKillSwitch,
} from '../../hooks/use-admin';
import type { AdminAgentStatus } from '../../hooks/use-admin';
import { useTranslation } from 'react-i18next';
import { StatCard } from '../../components/admin';

export function AdminStatsPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: stats, isLoading } = useAdminStats();
  const { data: agentStatuses = [] } = useAdminAgentsStatus();
  const { mutate: killSwitch, isPending: killing } = useKillSwitch();
  const [confirmKill, setConfirmKill] = useState(false);

  const [agentPage, setAgentPage] = useState(1);
  const AGENTS_PER_PAGE = 10;

  const agentsPaginated = useMemo(() => {
    const start = (agentPage - 1) * AGENTS_PER_PAGE;
    return agentStatuses.slice(start, start + AGENTS_PER_PAGE);
  }, [agentStatuses, agentPage]);

  const totalAgentPages = Math.max(
    1,
    Math.ceil(agentStatuses.length / AGENTS_PER_PAGE),
  );

  useGSAP(
    () => {
      gsap.fromTo(
        '.stat-card',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, stagger: 0.08, duration: 0.4, ease: 'power2.out' },
      );
    },
    { scope: containerRef, dependencies: [isLoading] },
  );

  const agentColumns: DataTableColumn<AdminAgentStatus>[] = [
    {
      key: 'pair',
      header: t('admin.agentColPair'),
      render: (row) => (
        <span className="font-medium">
          {row.asset}/{row.pair}
        </span>
      ),
    },
    {
      key: 'name',
      header: t('admin.agentColName'),
      render: (row) => (
        <span className="text-muted-foreground truncate max-w-[160px] block">
          {row.configName}
        </span>
      ),
    },
    {
      key: 'user',
      header: t('admin.agentColUser'),
      render: (row) => (
        <span className="text-muted-foreground">
          {row.email ?? row.userId.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'mode',
      header: t('admin.agentColMode'),
      render: (row) => (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold uppercase',
            row.mode === 'SANDBOX'
              ? 'bg-amber-500/10 text-amber-500'
              : 'bg-blue-500/10 text-blue-500',
          )}
        >
          {row.mode}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('admin.agentColStatus'),
      render: (row) => (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-semibold',
            row.isRunning ? 'text-emerald-500' : 'text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              row.isRunning ? 'bg-emerald-500' : 'bg-muted',
            )}
          />
          {row.isRunning ? t('admin.agentRunning') : t('admin.agentStopped')}
        </span>
      ),
    },
    {
      key: 'updatedAt',
      header: t('admin.agentColUpdated'),
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '–'}
        </span>
      ),
    },
  ];

  return (
    <div ref={containerRef} className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('admin.overviewTitle')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('admin.overviewSubtitle')}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label={t('admin.totalUsers')}
          value={stats?.totalUsers ?? '–'}
          icon={Users}
          tooltip={t('tooltips.adminTotalUsers')}
        />
        <StatCard
          label={t('admin.openPositions')}
          value={stats?.openPositions ?? '–'}
          icon={Activity}
          color="text-emerald-500"
          tooltip={t('tooltips.adminOpenPositions')}
        />
        <StatCard
          label={t('admin.tradesToday')}
          value={stats?.tradesToday ?? '–'}
          icon={BarChart3}
          tooltip={t('tooltips.adminTradesToday')}
        />
        <StatCard
          label={t('admin.pnlToday')}
          value={
            stats?.profitToday != null
              ? `$${stats.profitToday.toFixed(2)}`
              : '–'
          }
          icon={TrendingUp}
          color={
            stats && (stats.profitToday ?? 0) >= 0
              ? 'text-emerald-500'
              : 'text-red-500'
          }
          tooltip={t('tooltips.adminPnlToday')}
        />
      </div>

      {/* Kill Switch */}
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-red-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {t('admin.killSwitch')}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('admin.killSwitchDesc')}
            </p>
          </div>
          {confirmKill ? (
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setConfirmKill(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                className="bg-red-500 hover:bg-red-600 text-white"
                disabled={killing}
                onClick={() => {
                  killSwitch();
                  setConfirmKill(false);
                }}
              >
                {killing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('admin.confirmStopAll')}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 gap-2 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white"
              onClick={() => setConfirmKill(true)}
            >
              <AlertTriangle className="h-4 w-4" />
              {t('admin.killAllAgents')}
            </Button>
          )}
        </div>
      </div>

      {/* Active Agents */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">{t('admin.activeAgentsPlatform')}</h3>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-500">
            {agentStatuses.length}
          </span>
        </div>
        <DataTable<AdminAgentStatus>
          columns={agentColumns}
          data={agentsPaginated}
          rowKey={(row, i) => row.configId ?? `${row.userId}-${i}`}
          isLoading={!stats && isLoading}
          emptyMessage={t('admin.noActiveAgents')}
          skeletonRows={5}
        />
        {totalAgentPages > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {t('admin.agentPageInfo', {
                from: (agentPage - 1) * AGENTS_PER_PAGE + 1,
                to: Math.min(agentPage * AGENTS_PER_PAGE, agentStatuses.length),
                total: agentStatuses.length,
              })}
            </p>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={agentPage <= 1}
                onClick={() => setAgentPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-xs font-medium">
                {agentPage}/{totalAgentPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={agentPage >= totalAgentPages}
                onClick={() => setAgentPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
