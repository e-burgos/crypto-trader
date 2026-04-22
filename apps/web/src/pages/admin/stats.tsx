import { useRef, useState, useMemo } from 'react';
import {
  AlertTriangle,
  Activity,
  TrendingUp,
  Users,
  BarChart3,
  Clock,
  Loader2,
  LayoutDashboard,
  Bot,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@crypto-trader/ui';
import { cn } from '../../lib/utils';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  useAdminStats,
  useAuditLog,
  useAdminAgentsStatus,
  useKillSwitch,
} from '../../hooks/use-admin';
import { useTranslation } from 'react-i18next';
import { StatCard } from '../../components/admin';

export function AdminStatsPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: stats, isLoading } = useAdminStats();
  const { data: auditLog = [] } = useAuditLog();
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
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            {t('admin.activeAgentsPlatform')}
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-500">
              {agentStatuses.length}
            </span>
          </h3>
        </div>
        {agentStatuses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('admin.noActiveAgents', {
              defaultValue: 'No agents running at this time',
            })}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 font-medium text-muted-foreground">
                      {t('admin.agentColPair', { defaultValue: 'Pair' })}
                    </th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">
                      {t('admin.agentColUser', { defaultValue: 'User' })}
                    </th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">
                      {t('admin.agentColMode', { defaultValue: 'Mode' })}
                    </th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">
                      {t('admin.agentColStatus', { defaultValue: 'Status' })}
                    </th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">
                      {t('admin.agentColUpdated', {
                        defaultValue: 'Last Update',
                      })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {agentsPaginated.map((s, i) => (
                    <tr
                      key={s.configId ?? i}
                      className="agent-row border-b border-border/50 transition-colors hover:bg-muted/30"
                    >
                      <td className="px-3 py-2.5 font-medium">
                        {s.asset}/{s.pair}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {s.email ?? s.userId.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-semibold uppercase',
                            s.mode === 'SANDBOX'
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-blue-500/10 text-blue-500',
                          )}
                        >
                          {s.mode}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-xs font-semibold',
                            s.isRunning
                              ? 'text-emerald-500'
                              : 'text-muted-foreground',
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              s.isRunning ? 'bg-emerald-500' : 'bg-muted',
                            )}
                          />
                          {s.isRunning
                            ? t('admin.agentRunning')
                            : t('admin.agentStopped')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {s.updatedAt
                          ? new Date(s.updatedAt).toLocaleString()
                          : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalAgentPages > 1 && (
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">
                  {t('admin.agentPageInfo', {
                    defaultValue:
                      'Showing {{from}}-{{to}} of {{total}} agents',
                    from: (agentPage - 1) * AGENTS_PER_PAGE + 1,
                    to: Math.min(
                      agentPage * AGENTS_PER_PAGE,
                      agentStatuses.length,
                    ),
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
          </>
        )}
      </div>

      {/* Audit Log */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          {t('admin.auditLog')}
          <span className="text-xs text-muted-foreground font-normal">
            {t('admin.auditLogNote')}
          </span>
        </h3>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('admin.noAuditEntries')}
            </p>
          ) : (
            auditLog.slice(0, 50).map((entry) => (
              <div
                key={entry.id}
                className="flex items-start justify-between gap-3 rounded-md px-2 py-1.5 text-xs hover:bg-muted/30"
              >
                <span className="font-mono text-primary">{entry.action}</span>
                <div className="text-right text-muted-foreground shrink-0">
                  <div>{entry.admin?.email ?? entry.adminId}</div>
                  <div>{new Date(entry.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
