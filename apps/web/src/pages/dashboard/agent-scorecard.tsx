import { useState } from 'react';
import { BarChart3, Filter, TrendingUp, DollarSign, Target } from 'lucide-react';
import {
  useAgentScorecard,
  useAgentScorecardSummary,
  type ScorecardFilters,
} from '../../hooks/use-agent-scorecard';
import { Card, Select, Spinner, EmptyState } from '@crypto-trader/ui';

const AGENT_OPTIONS = [
  { label: 'All Agents', value: '' },
  { label: 'Orchestrator', value: 'orchestrator' },
  { label: 'Market', value: 'market' },
  { label: 'Risk', value: 'risk' },
  { label: 'Platform', value: 'platform' },
  { label: 'Operations', value: 'operations' },
  { label: 'Blockchain', value: 'blockchain' },
];

const MODE_OPTIONS = [
  { label: 'All Modes', value: '' },
  { label: 'Live', value: 'LIVE' },
  { label: 'Paper', value: 'PAPER' },
  { label: 'Shadow', value: 'SHADOW' },
];

const REGIME_OPTIONS = [
  { label: 'All Regimes', value: '' },
  { label: 'Trending Up', value: 'TRENDING_UP' },
  { label: 'Trending Down', value: 'TRENDING_DOWN' },
  { label: 'High Volatility', value: 'HIGH_VOLATILITY' },
  { label: 'Ranging', value: 'RANGING' },
  { label: 'Unknown', value: 'UNKNOWN' },
];

function StatCardItem({
  label,
  value,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: 'positive' | 'negative' | 'neutral';
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium">{label}</span>
        </div>
      </div>
      <p
        className={`mt-2 text-2xl font-bold ${
          trend === 'positive'
            ? 'text-green-500'
            : trend === 'negative'
              ? 'text-red-500'
              : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </Card>
  );
}

export function AgentScorecardPage() {
  const [filters, setFilters] = useState<ScorecardFilters>({});

  const { data: entries, isLoading } = useAgentScorecard(filters);
  const { data: summary, isLoading: summaryLoading } =
    useAgentScorecardSummary();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Agent Scorecard</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Performance metrics and ROI breakdown by agent, model, and market
          regime.
        </p>
      </div>

      {/* Summary Stats */}
      {summaryLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="md" />
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCardItem
            label="Total Decisions"
            value={String(summary.totalDecisions)}
            icon={Target}
          />
          <StatCardItem
            label="Win Rate"
            value={`${(summary.overallWinRate * 100).toFixed(1)}%`}
            icon={TrendingUp}
            trend={
              summary.overallWinRate >= 0.5 ? 'positive' : 'negative'
            }
          />
          <StatCardItem
            label="Total P&L"
            value={`$${summary.totalPnlUsd.toFixed(2)}`}
            icon={DollarSign}
            trend={summary.totalPnlUsd >= 0 ? 'positive' : 'negative'}
          />
          <StatCardItem
            label="Total Cost"
            value={`$${summary.totalCostUsd.toFixed(4)}`}
            icon={DollarSign}
          />
          <StatCardItem
            label="ROI"
            value={`${(summary.overallRoi * 100).toFixed(1)}%`}
            icon={TrendingUp}
            trend={summary.overallRoi >= 0 ? 'positive' : 'negative'}
          />
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select
          options={AGENT_OPTIONS}
          value={filters.agentId || ''}
          onChange={(v) =>
            setFilters((f) => ({ ...f, agentId: v || undefined }))
          }
          placeholder="Agent"
        />
        <Select
          options={MODE_OPTIONS}
          value={filters.mode || ''}
          onChange={(v) =>
            setFilters((f) => ({ ...f, mode: v || undefined }))
          }
          placeholder="Mode"
        />
        <Select
          options={REGIME_OPTIONS}
          value={filters.marketRegime || ''}
          onChange={(v) =>
            setFilters((f) => ({ ...f, marketRegime: v || undefined }))
          }
          placeholder="Market Regime"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : !entries || entries.length === 0 ? (
        <EmptyState
          title="No scorecard data"
          description="No evaluation data available for the selected filters."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Agent
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Model
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Regime
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Decisions
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Win Rate
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Avg P&L
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Cost
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  ROI
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{entry.agentId}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                    {entry.model.length > 30
                      ? `${entry.model.slice(0, 30)}…`
                      : entry.model}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {entry.marketRegime}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {entry.totalDecisions}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={
                        entry.winRate >= 0.5
                          ? 'text-green-500'
                          : 'text-red-500'
                      }
                    >
                      {(entry.winRate * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={
                        entry.avgPnlUsd >= 0
                          ? 'text-green-500'
                          : 'text-red-500'
                      }
                    >
                      ${entry.avgPnlUsd.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    ${entry.totalCostUsd.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={
                        entry.roi >= 0 ? 'text-green-500' : 'text-red-500'
                      }
                    >
                      {(entry.roi * 100).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
