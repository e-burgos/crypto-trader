import { Bot, TrendingUp } from 'lucide-react';
import { SparklineChart } from './sparkline-chart';
import { TradeRow } from './trade-row';

export function AgentDashboardCard() {
  return (
    <div className="agent-card relative w-full max-w-sm">
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-primary/40 via-primary/10 to-transparent blur-sm" />
      <div className="relative rounded-2xl border border-border/80 bg-card/95 p-5 shadow-2xl shadow-primary/10 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">
                AI Trading Agent
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                Powered by Esteban Burgos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="landing-status-blink h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] font-bold text-emerald-400">
              ACTIVE
            </span>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-border/50 bg-muted/30 p-3">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Portfolio Today
          </p>
          <div className="flex items-end justify-between">
            <span className="font-mono text-2xl font-extrabold text-foreground">
              +$2,847
            </span>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-mono text-sm font-bold text-emerald-400">
                +4.18%
              </span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Recent Trades
          </p>
          <div className="divide-y divide-border/30">
            <TradeRow
              symbol="BTC/USDT"
              action="BUY"
              amount="0.0025 BTC"
              change="2.47%"
              positive
            />
            <TradeRow
              symbol="ETH/USDT"
              action="SELL"
              amount="0.15 ETH"
              change="-0.63%"
              positive={false}
            />
            <TradeRow
              symbol="BTC/USDC"
              action="BUY"
              amount="0.001 BTC"
              change="1.82%"
              positive
            />
          </div>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            7-Day Performance
          </p>
          <SparklineChart />
        </div>
      </div>
    </div>
  );
}
