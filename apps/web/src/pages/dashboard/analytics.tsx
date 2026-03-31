import { usePortfolioSummary, useTradeHistory } from '../../hooks/use-analytics';
import { cn } from '../../lib/utils';

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-1 text-sm text-muted-foreground">{label}</div>
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function AnalyticsPage() {
  const { data: portfolio } = usePortfolioSummary();
  const { data: trades = [] } = useTradeHistory(500);

  // Calculate metrics from trade data
  const wins = trades.filter((t) => t.type === 'SELL').length; // simplified
  const total = trades.length;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '–';

  const totalVolume = trades.reduce((acc, t) => acc + t.price * t.quantity, 0);
  const totalFees = trades.reduce((acc, t) => acc + t.fee, 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Performance metrics and statistics</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Net P&L"
          value={`$${(portfolio?.netPnl ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          sub="After fees"
          color={(portfolio?.netPnl ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}
        />
        <MetricCard
          label="Total Trades"
          value={total.toString()}
          sub={`${portfolio?.closedPositions ?? 0} positions closed`}
        />
        <MetricCard
          label="Win Rate"
          value={`${winRate}%`}
          sub="Sell orders vs total"
        />
        <MetricCard
          label="Total Volume"
          value={`$${totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          sub="All-time trading volume"
        />
        <MetricCard
          label="Total Fees"
          value={`$${totalFees.toFixed(4)}`}
          sub="Cumulative trading fees"
        />
        <MetricCard
          label="Active Configs"
          value={(portfolio?.activeConfigs ?? 0).toString()}
          sub="Running trading agents"
        />
      </div>

      {total === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No trades yet. Start a trading agent to see analytics.</p>
        </div>
      )}
    </div>
  );
}
