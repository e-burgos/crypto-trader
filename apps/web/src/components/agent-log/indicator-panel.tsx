import { ListChecks } from 'lucide-react';
import { type AgentDecisionIndicators } from '../../hooks/use-analytics';

export function IndicatorPanel({
  indicators,
}: {
  indicators: AgentDecisionIndicators;
}) {
  const rows = [
    {
      label: 'RSI',
      value: indicators.rsi?.value?.toFixed(1) ?? '—',
      sub: indicators.rsi?.signal,
    },
    {
      label: 'MACD',
      value: indicators.macd?.macd?.toFixed(4) ?? '—',
      sub: indicators.macd?.crossover,
    },
    { label: 'EMA9', value: indicators.emaCross?.ema9?.toFixed(2) ?? '—' },
    { label: 'EMA21', value: indicators.emaCross?.ema21?.toFixed(2) ?? '—' },
    {
      label: 'BB Upper',
      value: indicators.bollingerBands?.upper?.toFixed(2) ?? '—',
    },
    {
      label: 'BB Lower',
      value: indicators.bollingerBands?.lower?.toFixed(2) ?? '—',
    },
    {
      label: 'Volume',
      value: indicators.volume?.current?.toFixed(0) ?? '—',
      sub: indicators.volume?.signal,
    },
  ];
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
      <div className="mb-2 flex items-center gap-1.5">
        <ListChecks className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Indicators
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-2"
          >
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-mono font-semibold tabular-nums">
              {r.value}
              {r.sub && (
                <span className="ml-1 text-muted-foreground font-normal">
                  ({r.sub})
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
