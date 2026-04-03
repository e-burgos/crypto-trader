import { useRef } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  usePortfolioSummary,
  useAnalyticsSummary,
  usePnlChart,
  useAssetBreakdown,
} from '../../hooks/use-analytics';
import { InfoTooltip } from '../../components/ui/info-tooltip';
import { cn } from '../../lib/utils';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTranslation } from 'react-i18next';

function MetricCard({
  label,
  value,
  sub,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  tooltip?: string;
}) {
  return (
    <div className="metric-card rounded-xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function AnalyticsPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: portfolio } = usePortfolioSummary();
  const { data: summary } = useAnalyticsSummary();
  const { data: pnlChart = [] } = usePnlChart();
  const { data: assetBreakdown = [] } = useAssetBreakdown();

  useGSAP(
    () => {
      gsap.fromTo(
        '.metric-card',
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, stagger: 0.07, duration: 0.5, ease: 'power2.out' },
      );
    },
    { scope: containerRef },
  );

  const winRateDisplay = summary
    ? `${summary.winRate.toFixed(1)}%`
    : portfolio
      ? `–`
      : '–';

  return (
    <div ref={containerRef} className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('analytics.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('analytics.subtitle')}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label={t('analytics.netPnl')}
          value={`$${(portfolio?.netPnl ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          sub={t('common.afterFees')}
          color={
            (portfolio?.netPnl ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'
          }
          tooltip={t('tooltips.pnl')}
        />
        <MetricCard
          label={t('analytics.winRate')}
          value={winRateDisplay}
          sub={t('analytics.winRateSub')}
          tooltip={t('tooltips.winRate')}
        />
        <MetricCard
          label={t('analytics.sharpeRatio')}
          value={
            summary?.sharpeRatio != null ? summary.sharpeRatio.toFixed(2) : '–'
          }
          sub={t('analytics.sharpeRatioSub')}
          tooltip={t('tooltips.sharpeRatio')}
        />
        <MetricCard
          label={t('analytics.drawdown')}
          value={
            summary?.currentDrawdown != null
              ? `${summary.currentDrawdown.toFixed(1)}%`
              : '–'
          }
          sub={t('analytics.drawdownSub')}
          color={
            summary?.currentDrawdown != null && summary.currentDrawdown > 0.1
              ? 'text-red-500'
              : undefined
          }
          tooltip={t('tooltips.drawdown')}
        />
        <MetricCard
          label={t('analytics.bestTrade')}
          value={
            summary?.bestTrade != null
              ? `$${summary.bestTrade.toFixed(2)}`
              : t('common.noData')
          }
          color={
            summary?.bestTrade != null
              ? 'text-emerald-500'
              : 'text-muted-foreground'
          }
          tooltip={t('tooltips.bestTrade')}
        />
        <MetricCard
          label={t('analytics.worstTrade')}
          value={
            summary?.worstTrade != null
              ? `$${summary.worstTrade.toFixed(2)}`
              : t('common.noData')
          }
          color={
            summary?.worstTrade != null
              ? 'text-red-500'
              : 'text-muted-foreground'
          }
          tooltip={t('tooltips.worstTrade')}
        />
        <MetricCard
          label={t('analytics.totalTrades')}
          value={(portfolio?.closedPositions ?? 0).toString()}
          sub={`${portfolio?.openPositions ?? 0} ${t('analytics.open')}`}
        />
        <MetricCard
          label={t('analytics.activeConfigs')}
          value={(portfolio?.activeConfigs ?? 0).toString()}
          sub={t('analytics.runningAgentsSub')}
        />
      </div>

      {/* PnL Chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-1 font-semibold">{t('analytics.pnlChart')}</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          {t('analytics.last30Days')}
        </p>
        {pnlChart.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            {t('analytics.noPnlData')}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={pnlChart}
              margin={{ top: 5, right: 16, bottom: 5, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']} />
              <Line
                type="monotone"
                dataKey="pnl"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Asset Breakdown */}
      {assetBreakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">
            {t('analytics.assetBreakdown')}
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={assetBreakdown}
              margin={{ top: 5, right: 16, bottom: 5, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis dataKey="asset" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']} />
              <Bar dataKey="totalPnl" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
