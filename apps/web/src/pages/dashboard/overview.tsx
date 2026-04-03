import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { TrendingUp, TrendingDown, Activity, Cpu, Wallet } from 'lucide-react';
import { usePortfolioSummary } from '../../hooks/use-analytics';
import { useSandboxWallet } from '../../hooks/use-trading';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';

gsap.registerPlugin(useGSAP);

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  positive?: boolean;
  icon: React.ReactNode;
  className?: string;
}

function StatCard({
  label,
  value,
  sub,
  positive,
  icon,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'stat-card rounded-xl border border-border bg-card p-5',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
          {icon}
        </div>
      </div>
      <div
        className={cn(
          'text-2xl font-bold',
          positive === true
            ? 'text-emerald-500'
            : positive === false
              ? 'text-red-500'
              : '',
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function OverviewPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = usePortfolioSummary();
  const { data: wallets, isLoading: walletsLoading } = useSandboxWallet();

  useGSAP(
    () => {
      gsap.from('.stat-card', {
        opacity: 0,
        y: 30,
        duration: 0.5,
        stagger: 0.1,
        ease: 'power2.out',
      });
    },
    { scope: containerRef },
  );

  function fmt(n: number, prefix = '$') {
    return `${prefix}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return (
    <div ref={containerRef} className="p-6">
      <h1 className="mb-1 text-2xl font-bold">
        {t('dashboard.portfolioOverview')}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {t('dashboard.realtimeSummary')}
      </p>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t('analytics.netPnl')}
            value={fmt(data?.netPnl ?? 0)}
            sub={t('common.afterFees')}
            positive={(data?.netPnl ?? 0) >= 0}
            icon={
              data?.netPnl && data.netPnl >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )
            }
          />
          <StatCard
            label={t('dashboard.realizedPnl')}
            value={fmt(data?.realizedPnl ?? 0)}
            sub={t('dashboard.closedPositions')}
            positive={(data?.realizedPnl ?? 0) >= 0}
            icon={<Activity className="h-4 w-4" />}
          />
          <StatCard
            label={t('dashboard.openPositions')}
            value={data?.openPositions ?? 0}
            sub={`${data?.closedPositions ?? 0} ${t('dashboard.closedTotal')}`}
            icon={<Activity className="h-4 w-4" />}
          />
          <StatCard
            label={t('trading.activeAgents')}
            value={data?.activeConfigs ?? 0}
            sub={t('dashboard.tradingConfigsRunning')}
            icon={<Cpu className="h-4 w-4" />}
          />
        </div>
      )}

      {/* Empty state message when no data */}
      {!isLoading && !data && (
        <div className="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
          <Activity className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="font-semibold">{t('dashboard.noTradingData')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('dashboard.configureAgent')}
          </p>
        </div>
      )}

      {/* Sandbox Wallet Balances */}
      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Sandbox Wallet</h2>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            Paper Trading
          </span>
        </div>

        {walletsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(wallets ?? []).map((w) => {
              const pct = Math.min((w.balance / 10_000) * 100, 100);
              const low = pct < 25;
              const mid = pct >= 25 && pct < 60;
              return (
                <div
                  key={w.currency}
                  className="stat-card rounded-xl border border-border bg-card p-5"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {w.currency} disponible
                    </span>
                    <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                      <Wallet className="h-4 w-4" />
                    </div>
                  </div>
                  <div
                    className={cn(
                      'text-2xl font-bold',
                      low
                        ? 'text-red-500'
                        : mid
                          ? 'text-amber-500'
                          : 'text-emerald-500',
                    )}
                  >
                    {w.balance.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    <span className="text-base font-normal text-muted-foreground">
                      {w.currency}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 w-full rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-1.5 rounded-full transition-all',
                        low
                          ? 'bg-red-500'
                          : mid
                            ? 'bg-amber-500'
                            : 'bg-emerald-500',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>{pct.toFixed(1)}% del capital inicial</span>
                    {w.updatedAt && (
                      <span>
                        {new Date(w.updatedAt).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
