import { useRef, useState } from 'react';
import {
  AlertTriangle,
  Activity,
  TrendingUp,
  Users,
  BarChart3,
  Clock,
  Loader2,
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
    <div ref={containerRef} className="space-y-6">
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
      {agentStatuses.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 font-semibold">
            {t('admin.activeAgentsPlatform')}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {agentStatuses.map((s, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center justify-between rounded-lg border p-3 text-sm',
                  s.isRunning
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border',
                )}
              >
                <span className="font-medium">
                  {s.asset}/{s.pair} ({s.mode})
                </span>
                <span
                  className={cn(
                    'text-xs font-semibold',
                    s.isRunning ? 'text-emerald-500' : 'text-muted-foreground',
                  )}
                >
                  {s.isRunning
                    ? t('admin.agentRunning')
                    : t('admin.agentStopped')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  <div>{entry.userId}</div>
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
