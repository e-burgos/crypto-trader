import { Target, Shield, Wallet, Timer, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

export function ParameterCards() {
  const { t } = useTranslation();

  const cards = [
    {
      title: t('config.guide.cardThresholds'),
      color: 'blue',
      icon: <Target className="h-4 w-4" />,
      content: (
        <div className="space-y-2 text-[11px]">
          <p className="text-muted-foreground">
            {t('config.guide.cardThresholdsDesc')}
          </p>
          <div className="rounded-md bg-muted/40 p-2 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">BUY:</span>
              <span className="text-emerald-400">score ≥ 72% → order</span>
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-muted-foreground">HOLD:</span>
              <span className="text-muted-foreground">
                score &lt; 72% → wait
              </span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Lightbulb className="h-3 w-3 shrink-0 text-amber-400" />{' '}
            {t('config.guide.cardThresholdsTip')}
          </p>
        </div>
      ),
    },
    {
      title: t('config.guide.cardRisk'),
      color: 'red',
      icon: <Shield className="h-4 w-4" />,
      content: (
        <div className="space-y-2 text-[11px]">
          <p className="text-muted-foreground">
            {t('config.guide.cardRiskDesc')}
          </p>
          <div className="rounded-md bg-muted/40 p-2 text-xs">
            <div>
              <span className="text-red-400 font-semibold">Stop Loss 3%: </span>
              <span className="text-muted-foreground">
                {t('config.guide.slExample')}
              </span>
            </div>
            <div className="mt-0.5">
              <span className="text-emerald-400 font-semibold">
                Take Profit 5%:{' '}
              </span>
              <span className="text-muted-foreground">
                {t('config.guide.tpExample')}
              </span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Lightbulb className="h-3 w-3 shrink-0 text-amber-400" />{' '}
            {t('config.guide.cardRiskTip')}
          </p>
        </div>
      ),
    },
    {
      title: t('config.guide.cardCapital'),
      color: 'purple',
      icon: <Wallet className="h-4 w-4" />,
      content: (
        <div className="space-y-2 text-[11px]">
          <p className="text-muted-foreground">
            {t('config.guide.cardCapitalDesc')}
          </p>
          <div className="rounded-md bg-muted/40 p-2 text-xs">
            <div className="text-muted-foreground">
              {t('config.guide.capitalExample1')}
            </div>
            <div className="mt-0.5 text-purple-400 font-semibold">
              {t('config.guide.capitalExample2')}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Lightbulb className="h-3 w-3 shrink-0 text-amber-400" />{' '}
            {t('config.guide.cardCapitalTip')}
          </p>
        </div>
      ),
    },
    {
      title: t('config.guide.cardTiming'),
      color: 'amber',
      icon: <Timer className="h-4 w-4" />,
      content: (
        <div className="space-y-2 text-[11px]">
          <p className="text-muted-foreground">
            {t('config.guide.cardTimingDesc')}
          </p>
          <div className="rounded-md bg-muted/40 p-2 text-xs space-y-0.5">
            <div className="text-amber-400 font-semibold">
              {t('config.guide.timingExample1')}
            </div>
            <div className="text-muted-foreground">
              {t('config.guide.timingExample2')}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Lightbulb className="h-3 w-3 shrink-0 text-amber-400" />{' '}
            {t('config.guide.cardTimingTip')}
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className={cn(
            'rounded-xl border p-3',
            card.color === 'blue'
              ? 'border-blue-500/20 bg-blue-500/5'
              : card.color === 'red'
                ? 'border-red-500/20 bg-red-500/5'
                : card.color === 'purple'
                  ? 'border-purple-500/20 bg-purple-500/5'
                  : 'border-amber-500/20 bg-amber-500/5',
          )}
        >
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-muted-foreground">{card.icon}</span>
            <span className="text-xs font-bold">{card.title}</span>
          </div>
          {card.content}
        </div>
      ))}
    </div>
  );
}
