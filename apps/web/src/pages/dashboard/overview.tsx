import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Cpu,
  Wallet,
  TestTube2,
  Zap,
  AlertTriangle,
  ArrowRight,
  Trophy,
  ShieldAlert,
  BarChart2,
  Target,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { Button, InfoTooltip } from '@crypto-trader/ui';
import {
  usePortfolioSummary,
  useAnalyticsSummary,
  usePnlChart,
  useAssetBreakdown,
} from '../../hooks/use-analytics';
import {
  useSandboxWallet,
  useBinanceBalance,
  useAgentStatus,
} from '../../hooks/use-trading';
import {
  useBinanceKeyStatus,
  useTestnetBinanceKeyStatus,
  usePlatformMode,
} from '../../hooks/use-user';
import { useThemeStore } from '../../store/theme.store';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

gsap.registerPlugin(useGSAP);

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  positive,
  icon,
  tooltip,
  className,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  positive?: boolean;
  icon: React.ReactNode;
  tooltip?: string;
  className?: string;
  href?: string;
}) {
  const inner = (
    <div
      className={cn(
        'stat-card h-full rounded-xl border border-border bg-card p-5',
        href &&
          'cursor-pointer transition-colors hover:border-primary/40 hover:bg-card/80',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {label}
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
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
  return href ? (
    <Link to={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

// ── PnL Tooltip ───────────────────────────────────────────────────────────────
function PnlTooltip({
  active,
  payload,
  label,
}: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  const isPos = val >= 0;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p
        className={cn(
          'font-bold text-sm',
          isPos ? 'text-emerald-400' : 'text-red-400',
        )}
      >
        {isPos ? '+' : ''}${val.toFixed(2)}
      </p>
    </div>
  );
}

// ── Asset Tooltip ─────────────────────────────────────────────────────────────
function AssetTooltip({
  active,
  payload,
  label,
}: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  const isPos = val >= 0;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold mb-1">{label}</p>
      <p
        className={cn(
          'font-bold text-sm',
          isPos ? 'text-emerald-400' : 'text-red-400',
        )}
      >
        {isPos ? '+' : ''}${val.toFixed(2)} P&L
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function OverviewPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  // Chart color tokens — adapt to dark/light mode
  const chartGrid = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
  const chartTick = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)';
  const chartRef = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)';
  const chartCursor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';

  const { mode: platformMode } = usePlatformMode();

  const { data, isLoading } = usePortfolioSummary(platformMode);
  const { data: summary } = useAnalyticsSummary(platformMode);
  const { data: pnlChart = [] } = usePnlChart(platformMode);
  const { data: assetBreakdown = [] } = useAssetBreakdown(platformMode);
  const { data: wallets, isLoading: walletsLoading } = useSandboxWallet();
  const { data: agentStatuses } = useAgentStatus();
  const { data: liveKeyStatus } = useBinanceKeyStatus();
  const { data: testnetKeyStatus } = useTestnetBinanceKeyStatus();

  const hasLiveKeys = liveKeyStatus?.hasKeys ?? false;
  const hasTestnetKeys = testnetKeyStatus?.hasKeys ?? false;

  const {
    data: liveBalance,
    isLoading: liveLoading,
    error: liveBalanceError,
  } = useBinanceBalance('LIVE', hasLiveKeys && platformMode === 'LIVE');
  const {
    data: testnetBalance,
    isLoading: testnetLoading,
    error: testnetBalanceError,
  } = useBinanceBalance(
    'TESTNET',
    hasTestnetKeys && platformMode === 'TESTNET',
  );

  useEffect(() => {
    if (liveBalanceError)
      toast.error(
        (liveBalanceError as { message?: string })?.message ??
          'Error al obtener balance de Binance Live',
      );
  }, [liveBalanceError]);

  useEffect(() => {
    if (testnetBalanceError)
      toast.error(
        (testnetBalanceError as { message?: string })?.message ??
          'Error al obtener balance de Binance Testnet',
      );
  }, [testnetBalanceError]);

  useGSAP(
    () => {
      if (isLoading) return;
      const cards = gsap.utils.toArray<Element>(
        '.stat-card',
        containerRef.current,
      );
      if (!cards.length) return;
      gsap.from(cards, {
        opacity: 0,
        y: 24,
        duration: 0.45,
        stagger: 0.07,
        ease: 'power2.out',
      });
    },
    { scope: containerRef, dependencies: [isLoading] },
  );

  function fmt(n: number) {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const netPnl = data?.netPnl ?? 0;

  return (
    <div ref={containerRef} className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {t('dashboard.portfolioOverview')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('dashboard.realtimeSummary')}
        </p>
      </div>

      {/* KPI Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
          <KpiCard
            label={t('analytics.netPnl')}
            value={fmt(netPnl)}
            sub={t('common.afterFees')}
            positive={netPnl >= 0}
            icon={
              netPnl >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )
            }
            tooltip={t('tooltips.pnl')}
          />
          <KpiCard
            label={t('analytics.winRate')}
            value={
              summary?.winRate != null ? `${summary.winRate.toFixed(1)}%` : '–'
            }
            sub={t('analytics.winRateSub')}
            positive={
              summary?.winRate != null ? summary.winRate >= 50 : undefined
            }
            icon={<Target className="h-4 w-4" />}
            tooltip={t('tooltips.winRate')}
          />
          <KpiCard
            label={t('analytics.drawdown')}
            value={
              summary?.currentDrawdown != null
                ? `${summary.currentDrawdown.toFixed(1)}%`
                : '–'
            }
            sub={t('analytics.drawdownSub')}
            positive={
              summary?.currentDrawdown != null
                ? summary.currentDrawdown <= 0.1
                : undefined
            }
            icon={<ShieldAlert className="h-4 w-4" />}
            tooltip={t('tooltips.drawdown')}
          />
          <KpiCard
            label={t('analytics.sharpeRatio')}
            value={
              summary?.sharpeRatio != null
                ? summary.sharpeRatio.toFixed(2)
                : '–'
            }
            sub={t('analytics.sharpeRatioSub')}
            positive={
              summary?.sharpeRatio != null
                ? summary.sharpeRatio >= 1
                : undefined
            }
            icon={<BarChart2 className="h-4 w-4" />}
            tooltip={t('tooltips.sharpeRatio')}
          />
          <KpiCard
            label={t('analytics.bestTrade')}
            value={
              summary?.bestTrade?.pnl != null
                ? fmt(summary.bestTrade.pnl)
                : t('common.noData')
            }
            sub={
              summary?.bestTrade?.pair
                ? `${summary.bestTrade.asset}/${summary.bestTrade.pair}`
                : undefined
            }
            positive={
              summary?.bestTrade?.pnl != null
                ? summary.bestTrade.pnl > 0
                : undefined
            }
            icon={<Trophy className="h-4 w-4" />}
            tooltip={t('tooltips.bestTrade')}
            href="/dashboard/history"
          />
          <KpiCard
            label={t('analytics.worstTrade')}
            value={
              summary?.worstTrade?.pnl != null
                ? fmt(summary.worstTrade.pnl)
                : t('common.noData')
            }
            sub={
              summary?.worstTrade?.pair
                ? `${summary.worstTrade.asset}/${summary.worstTrade.pair}`
                : undefined
            }
            positive={
              summary?.worstTrade?.pnl != null
                ? summary.worstTrade.pnl > 0
                : undefined
            }
            icon={<AlertTriangle className="h-4 w-4" />}
            tooltip={t('tooltips.worstTrade')}
            href="/dashboard/history"
          />
          <KpiCard
            label={t('dashboard.openPositions')}
            value={data?.openPositions ?? 0}
            sub={`${data?.closedPositions ?? 0} ${t('dashboard.closedTotal')}`}
            icon={<Activity className="h-4 w-4" />}
            href="/dashboard/positions"
          />
          <KpiCard
            label={t('trading.activeAgents')}
            value={data?.activeConfigs ?? 0}
            sub={t('dashboard.tradingConfigsRunning')}
            icon={<Cpu className="h-4 w-4" />}
            href="/dashboard/config"
          />
        </div>
      )}

      {!isLoading && !data && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Activity className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="font-semibold">{t('dashboard.noTradingData')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('dashboard.configureAgent')}
          </p>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* PnL Area Chart */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <h2 className="font-semibold">{t('analytics.pnlChart')}</h2>
            <p className="text-xs text-muted-foreground">
              {t('analytics.last30Days')}
            </p>
          </div>
          {pnlChart.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
              {t('analytics.noPnlData')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={pnlChart}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chartGrid}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: chartTick }}
                  tickFormatter={(v: string) => v.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: chartTick }}
                  tickFormatter={(v: number) => `$${v}`}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <ReferenceLine y={0} stroke={chartRef} strokeDasharray="4 4" />
                <Tooltip content={<PnlTooltip />} />
                <Area
                  type="monotone"
                  dataKey="pnl"
                  stroke={netPnl >= 0 ? '#10b981' : '#ef4444'}
                  strokeWidth={2}
                  fill={`url(#${netPnl >= 0 ? 'gradGreen' : 'gradRed'})`}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Asset Breakdown Bar Chart */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <h2 className="font-semibold">{t('analytics.assetBreakdown')}</h2>
            <p className="text-xs text-muted-foreground">
              {t('analytics.totalTrades')}: {data?.closedPositions ?? 0}
            </p>
          </div>
          {assetBreakdown.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
              {t('analytics.noPnlData')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={assetBreakdown}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chartGrid}
                  vertical={false}
                />
                <XAxis
                  dataKey="asset"
                  tick={{ fontSize: 11, fill: chartTick }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: chartTick }}
                  tickFormatter={(v: number) => `$${v}`}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <ReferenceLine y={0} stroke={chartRef} strokeDasharray="4 4" />
                <Tooltip
                  content={<AssetTooltip />}
                  cursor={{ fill: chartCursor }}
                />
                <Bar dataKey="totalPnl" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {assetBreakdown.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.totalPnl >= 0 ? '#10b981' : '#ef4444'}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Balance Widget */}
      <div>
        {platformMode === 'SANDBOX' && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Sandbox Wallet</h2>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                {t('balanceSource.sandbox')}
              </span>
            </div>
            {walletsLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-xl bg-muted"
                  />
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
          </>
        )}

        {platformMode === 'TESTNET' && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <TestTube2 className="h-5 w-5 text-sky-400" />
              <h2 className="text-lg font-semibold">Binance Testnet Balance</h2>
              <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-500">
                {t('balanceSource.testnet')}
              </span>
            </div>
            {testnetLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-xl bg-muted"
                  />
                ))}
              </div>
            ) : !hasTestnetKeys ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <TestTube2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {t('balanceSource.noKeysConfigured')}
                </p>
              </div>
            ) : testnetBalanceError ? (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-400">
                    {t('balanceSource.fetchError')}
                  </p>
                  <p className="mt-0.5 text-xs text-red-400/70">
                    {(testnetBalanceError as { message?: string })?.message ??
                      'Error desconocido'}
                  </p>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="mt-3 gap-1.5 border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/70"
                  >
                    <Link to="/dashboard/settings">
                      {t('balanceSource.goToSettings')}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {(testnetBalance ?? []).map((b) => (
                  <div
                    key={b.currency}
                    className="stat-card rounded-xl border border-sky-500/20 bg-card p-5"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {b.currency} (Testnet)
                      </span>
                      <div className="rounded-lg bg-sky-500/10 p-2 text-sky-400">
                        <TestTube2 className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-sky-400">
                      {b.balance.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      <span className="text-base font-normal text-muted-foreground">
                        {b.currency}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {platformMode === 'LIVE' && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-semibold">Binance Live Balance</h2>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500">
                {t('balanceSource.live')}
              </span>
            </div>
            {liveLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-xl bg-muted"
                  />
                ))}
              </div>
            ) : !hasLiveKeys ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <Zap className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {t('balanceSource.noKeysConfigured')}
                </p>
              </div>
            ) : liveBalanceError ? (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-400">
                    {t('balanceSource.fetchError')}
                  </p>
                  <p className="mt-0.5 text-xs text-red-400/70">
                    {(liveBalanceError as { message?: string })?.message ??
                      'Error desconocido'}
                  </p>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="mt-3 gap-1.5 border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/70"
                  >
                    <Link to="/dashboard/settings">
                      {t('balanceSource.goToSettings')}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {(liveBalance ?? []).map((b) => (
                  <div
                    key={b.currency}
                    className="stat-card rounded-xl border border-emerald-500/20 bg-card p-5"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {b.currency} (Live)
                      </span>
                      <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
                        <Zap className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {b.balance.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      <span className="text-base font-normal text-muted-foreground">
                        {b.currency}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
