import { Shield, TrendingUp, Zap } from 'lucide-react';
import { cn } from '../../utils';

export const PRESETS = {
  conservative: {
    buyThreshold: '85',
    sellThreshold: '80',
    stopLossPct: '2',
    takeProfitPct: '3',
    minProfitPct: '0.2',
    maxTradePct: '5',
    maxConcurrentPositions: '1',
    minIntervalMinutes: '120',
    orderPriceOffsetPct: '-1',
  },
  balanced: {
    buyThreshold: '72',
    sellThreshold: '68',
    stopLossPct: '3',
    takeProfitPct: '5',
    minProfitPct: '0.3',
    maxTradePct: '10',
    maxConcurrentPositions: '3',
    minIntervalMinutes: '60',
    orderPriceOffsetPct: '0',
  },
  aggressive: {
    buyThreshold: '60',
    sellThreshold: '55',
    stopLossPct: '5',
    takeProfitPct: '10',
    minProfitPct: '0.1',
    maxTradePct: '20',
    maxConcurrentPositions: '5',
    minIntervalMinutes: '30',
    orderPriceOffsetPct: '1',
  },
} as const;

interface StrategyPresetsProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
  onApply?: (preset: keyof typeof PRESETS) => void;
}

export function StrategyPresets({ t, onApply }: StrategyPresetsProps) {
  const presets: Array<{
    key: keyof typeof PRESETS;
    icon: React.ReactNode;
    colorClass: string;
    borderClass: string;
    textClass: string;
  }> = [
    {
      key: 'conservative',
      icon: <Shield className="h-5 w-5" />,
      colorClass: onApply
        ? 'bg-blue-500/10 hover:bg-blue-500/15'
        : 'bg-blue-500/10',
      borderClass: 'border-blue-500/30',
      textClass: 'text-blue-400',
    },
    {
      key: 'balanced',
      icon: <TrendingUp className="h-5 w-5" />,
      colorClass: onApply
        ? 'bg-emerald-500/10 hover:bg-emerald-500/15'
        : 'bg-emerald-500/10',
      borderClass: 'border-emerald-500/30',
      textClass: 'text-emerald-400',
    },
    {
      key: 'aggressive',
      icon: <Zap className="h-5 w-5" />,
      colorClass: onApply
        ? 'bg-red-500/10 hover:bg-red-500/15'
        : 'bg-red-500/10',
      borderClass: 'border-red-500/30',
      textClass: 'text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {presets.map((p) => {
        const preset = PRESETS[p.key];
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onApply?.(p.key)}
            className={cn(
              'rounded-xl border p-3 text-left transition-all',
              onApply ? 'cursor-pointer' : 'cursor-default',
              p.colorClass,
              p.borderClass,
            )}
          >
            <div className={cn('mb-1 flex items-center gap-1.5', p.textClass)}>
              {p.icon}
              <span className="text-sm font-bold">
                {t(`config.guide.preset.${p.key}`)}
              </span>
            </div>
            <p className="mb-2 text-[10px] text-muted-foreground">
              {t(`config.guide.preset.${p.key}Desc`)}
            </p>
            <div className="space-y-0.5 text-[10px] text-muted-foreground">
              <div className="flex justify-between">
                <span>{t('trading.buyThreshold')}</span>
                <span className="font-medium">{preset.buyThreshold}%</span>
              </div>
              <div className="flex justify-between">
                <span>{t('trading.stopLoss')}</span>
                <span className="font-medium">{preset.stopLossPct}%</span>
              </div>
              <div className="flex justify-between">
                <span>{t('trading.maxTrade')}</span>
                <span className="font-medium">{preset.maxTradePct}%</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
