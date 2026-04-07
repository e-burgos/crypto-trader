import {
  ArrowRight,
  Radio,
  Newspaper,
  BarChart2,
  Cpu,
  Settings2,
  Clock,
  Check,
  TrendingDown,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

export function DecisionFlowDiagram() {
  const { t } = useTranslation();
  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row md:items-stretch gap-3 w-full">
        {/* Sources */}
        <div className="flex flex-col justify-center gap-2 flex-1">
          {[
            {
              icon: <Radio className="h-3.5 w-3.5" />,
              label: t('config.guide.sourceMarket'),
              sub: '200 candles · RSI · MACD · BB',
            },
            {
              icon: <Newspaper className="h-3.5 w-3.5" />,
              label: t('config.guide.sourceNews'),
              sub: t('config.guide.sourceNewsSub'),
            },
            {
              icon: <BarChart2 className="h-3.5 w-3.5" />,
              label: t('config.guide.sourceTrades'),
              sub: t('config.guide.sourceTradesSub'),
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3"
            >
              <div className="text-xs font-semibold text-blue-400 flex items-center gap-1">
                {s.icon} {s.label}
              </div>
              <div className="text-[10px] text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="flex md:flex-col items-center justify-center text-muted-foreground/50">
          <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" />
        </div>

        {/* LLM */}
        <div className="flex items-center justify-center flex-1">
          <div className="rounded-xl border-2 border-purple-500/40 bg-purple-500/10 px-5 py-5 text-center w-full">
            <div className="flex justify-center mb-1">
              <Cpu className="h-6 w-6 text-purple-400" />
            </div>
            <div className="text-xs font-bold text-purple-300">
              {t('config.guide.llmLabel')}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              Claude · GPT-4o · Groq
            </div>
            <div className="mt-2 rounded-md bg-purple-500/20 px-2 py-1">
              <div className="text-[10px] text-purple-300 font-semibold">
                {t('config.guide.confidence')}
              </div>
              <div className="text-xs font-bold text-purple-200">0 – 100%</div>
            </div>
          </div>
        </div>

        <div className="flex md:flex-col items-center justify-center text-muted-foreground/50">
          <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" />
        </div>

        {/* Decision Logic */}
        <div className="flex items-center justify-center flex-1">
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-5 py-4 w-full">
            <div className="mb-2 text-xs font-bold text-yellow-400 flex items-center gap-1">
              <Settings2 className="h-3.5 w-3.5" />{' '}
              {t('config.guide.decisionLogic')}
            </div>
            <div className="space-y-1.5 text-[10px]">
              {[
                {
                  cond: 'Score ≥ buyThreshold',
                  out: 'BUY',
                  color: 'text-emerald-400',
                },
                {
                  cond: 'SL threshold hit',
                  out: 'STOP LOSS',
                  color: 'text-orange-400',
                },
                {
                  cond: 'TP threshold hit',
                  out: 'TAKE PROFIT',
                  color: 'text-blue-400',
                },
                {
                  cond: t('config.guide.otherwise'),
                  out: 'HOLD',
                  color: 'text-muted-foreground',
                  icon: <Clock className="h-2.5 w-2.5" />,
                },
              ].map((row) => (
                <div key={row.out} className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">{row.cond}</span>
                  <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />
                  <span
                    className={cn(
                      'flex items-center gap-0.5 font-semibold',
                      row.color,
                    )}
                  >
                    {row.icon}
                    {row.out}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex md:flex-col items-center justify-center text-muted-foreground/50">
          <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" />
        </div>

        {/* Outcomes */}
        <div className="flex flex-col justify-center gap-2 flex-1">
          {[
            {
              color: 'emerald',
              icon: <Check className="h-3 w-3" />,
              label: t('config.guide.outcomeBuy'),
              sub: t('config.guide.outcomeBuySub'),
            },
            {
              color: 'orange',
              icon: <TrendingDown className="h-3 w-3" />,
              label: t('config.guide.outcomeSL'),
              sub: t('config.guide.outcomeSLSub'),
            },
            {
              color: 'slate',
              icon: <Clock className="h-3 w-3" />,
              label: t('config.guide.outcomeHold'),
              sub: t('config.guide.outcomeHoldSub'),
            },
          ].map((o) => (
            <div
              key={o.label}
              className={cn(
                'rounded-lg border px-4 py-3',
                o.color === 'emerald'
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : o.color === 'orange'
                    ? 'border-orange-500/30 bg-orange-500/5'
                    : 'border-border bg-muted/20',
              )}
            >
              <div
                className={cn(
                  'text-xs font-semibold flex items-center gap-1',
                  o.color === 'emerald'
                    ? 'text-emerald-400'
                    : o.color === 'orange'
                      ? 'text-orange-400'
                      : 'text-muted-foreground',
                )}
              >
                {o.icon} {o.label}
              </div>
              <div className="text-[10px] text-muted-foreground">{o.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
