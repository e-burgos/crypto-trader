import {
  CheckCircle2,
  XCircle,
  Target,
  Shield,
  Wallet,
  Timer,
  MapPin,
  Lightbulb,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

interface ExplainPanelProps {
  /** Render only the concept with this id. Omit to render all concepts. */
  conceptId?: 'threshold' | 'sl' | 'capital' | 'interval' | 'offset';
}

export function ExplainPanel({ conceptId }: ExplainPanelProps = {}) {
  const { t } = useTranslation();

  const concepts = [
    {
      id: 'threshold',
      icon: <Target className="h-5 w-5" />,
      color: 'blue' as const,
      title: t('config.explain.thresholdTitle'),
      field: `${t('trading.buyThreshold')} · ${t('trading.sellThreshold')}`,
      desc: t('config.explain.thresholdDesc'),
      example: (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {t('config.explain.examplePrefix')} {t('trading.buyThreshold')} = 70
          </p>
          <div className="space-y-1">
            {[
              {
                cond: `${t('config.guide.confidence')}: 73 ≥ 70`,
                out: t('config.explain.executes'),
                color: 'emerald',
                icon: <CheckCircle2 className="h-3 w-3" />,
              },
              {
                cond: `${t('config.guide.confidence')}: 65 < 70`,
                out: 'HOLD ⏸',
                color: 'muted',
                icon: <XCircle className="h-3 w-3" />,
              },
              {
                cond: `${t('config.guide.confidence')}: 70 = 70`,
                out: t('config.explain.executes'),
                color: 'emerald',
                icon: <CheckCircle2 className="h-3 w-3" />,
              },
            ].map((row) => (
              <div
                key={row.cond}
                className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1 font-mono text-[10px]"
              >
                <span className="text-muted-foreground">{row.cond}</span>
                <span
                  className={cn(
                    'flex items-center gap-1 font-semibold',
                    row.color === 'emerald'
                      ? 'text-emerald-400'
                      : 'text-muted-foreground',
                  )}
                >
                  {row.icon}
                  {row.out}
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
      profiles: [
        {
          name: t('config.guide.preset.conservative'),
          buy: '85%',
          sell: '80%',
        },
        { name: t('config.guide.preset.balanced'), buy: '72%', sell: '68%' },
        { name: t('config.guide.preset.aggressive'), buy: '60%', sell: '55%' },
      ],
      profileCols: [
        t('config.explain.buyLabel'),
        t('config.explain.sellLabel'),
      ],
      tip: t('config.explain.thresholdTip'),
    },
    {
      id: 'sl',
      icon: <Shield className="h-5 w-5" />,
      color: 'red' as const,
      title: t('config.explain.slTitle'),
      field: t('trading.stopLoss'),
      desc: t('config.explain.slDesc'),
      example: (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {t('config.explain.examplePrefix')} stop_loss = 3%
          </p>
          <div className="rounded-md bg-muted/40 px-3 py-2 text-[10px] space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t('config.explain.entryPrice')}
              </span>
              <span className="font-mono font-semibold">$80,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t('config.explain.slTrigger')}
              </span>
              <span className="font-mono font-semibold text-red-400">
                $77,600 (–3%)
              </span>
            </div>
            <div className="flex justify-between border-t border-border/50 pt-1">
              <span className="text-muted-foreground">
                {t('config.explain.result')}
              </span>
              <span className="font-semibold text-red-400">
                {t('config.explain.autoSell')}
              </span>
            </div>
          </div>
        </div>
      ),
      profiles: [
        { name: t('config.guide.preset.conservative'), buy: '2%', sell: '3%' },
        { name: t('config.guide.preset.balanced'), buy: '3%', sell: '5%' },
        { name: t('config.guide.preset.aggressive'), buy: '5%', sell: '10%' },
      ],
      profileCols: ['Stop Loss', 'Take Profit'],
      tip: t('config.explain.slTip'),
    },
    {
      id: 'capital',
      icon: <Wallet className="h-5 w-5" />,
      color: 'purple' as const,
      title: t('config.explain.capitalTitle'),
      field: t('trading.maxTrade'),
      desc: t('config.explain.capitalDesc'),
      example: (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {t('config.explain.examplePrefix')} {t('trading.maxTrade')} = 10%
          </p>
          <div className="rounded-md bg-muted/40 px-3 py-2 text-[10px] space-y-1">
            {[
              { label: t('config.explain.balance'), value: '$10,000' },
              { label: t('trading.maxTrade'), value: '10%' },
              {
                label: t('config.explain.maxOrder'),
                value: '$1,000',
                highlight: true,
              },
            ].map((row) => (
              <div
                key={row.label}
                className={cn(
                  'flex justify-between',
                  row.highlight ? 'border-t border-border/50 pt-1' : '',
                )}
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span
                  className={cn(
                    'font-mono font-semibold',
                    row.highlight ? 'text-purple-400' : '',
                  )}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
      profiles: [
        { name: t('config.guide.preset.conservative'), buy: '5%', sell: '1' },
        { name: t('config.guide.preset.balanced'), buy: '10%', sell: '3' },
        { name: t('config.guide.preset.aggressive'), buy: '20%', sell: '5' },
      ],
      profileCols: ['Max Trade', t('config.explain.maxPositionsLabel')],
      tip: t('config.explain.capitalTip'),
    },
    {
      id: 'interval',
      icon: <Timer className="h-5 w-5" />,
      color: 'amber' as const,
      title: t('config.explain.intervalTitle'),
      field: t('trading.minInterval'),
      desc: t('config.explain.intervalDesc'),
      example: (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {t('config.explain.intervalComparison')}
          </p>
          <div className="space-y-1">
            {[
              {
                interval: '30 min',
                freq: t('config.explain.freq30'),
                cost: t('config.explain.costHigh'),
                col: 'amber',
              },
              {
                interval: '60 min',
                freq: t('config.explain.freq60'),
                cost: t('config.explain.costMed'),
                col: 'emerald',
              },
              {
                interval: '120 min',
                freq: t('config.explain.freq120'),
                cost: t('config.explain.costLow'),
                col: 'blue',
              },
            ].map((row) => (
              <div
                key={row.interval}
                className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1 font-mono text-[10px]"
              >
                <span className="font-semibold text-foreground">
                  {row.interval}
                </span>
                <span className="text-muted-foreground">{row.freq}</span>
                <span
                  className={cn(
                    'font-semibold',
                    row.col === 'amber'
                      ? 'text-amber-400'
                      : row.col === 'emerald'
                        ? 'text-emerald-400'
                        : 'text-blue-400',
                  )}
                >
                  {row.cost}
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
      profiles: [
        {
          name: t('config.guide.preset.conservative'),
          buy: '120 min',
          sell: '1',
        },
        { name: t('config.guide.preset.balanced'), buy: '60 min', sell: '3' },
        {
          name: t('config.guide.preset.aggressive'),
          buy: '30 min',
          sell: '5',
        },
      ],
      profileCols: ['Min Interval', t('config.explain.maxPositionsLabel')],
      tip: t('config.explain.intervalTip'),
    },
    {
      id: 'offset',
      icon: <MapPin className="h-5 w-5" />,
      color: 'slate' as const,
      title: t('config.explain.offsetTitle'),
      field: t('trading.orderPriceOffset'),
      desc: t('config.explain.offsetDesc'),
      example: (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {t('config.explain.examplePrefix')} BTC = $80,000
          </p>
          <div className="space-y-1">
            {[
              {
                label: 'offset = –1%',
                price: '$79,200',
                color: 'emerald',
                note: t('config.explain.offsetNegNote'),
              },
              {
                label: 'offset = 0%',
                price: '$80,000',
                color: 'muted',
                note: t('config.explain.offsetZeroNote'),
              },
              {
                label: 'offset = +1%',
                price: '$80,800',
                color: 'amber',
                note: t('config.explain.offsetPosNote'),
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1 font-mono text-[10px]"
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span
                  className={cn(
                    'font-semibold',
                    row.color === 'emerald'
                      ? 'text-emerald-400'
                      : row.color === 'amber'
                        ? 'text-amber-400'
                        : 'text-muted-foreground',
                  )}
                >
                  {row.price}
                </span>
                <span className="text-muted-foreground">{row.note}</span>
              </div>
            ))}
          </div>
        </div>
      ),
      profiles: [
        {
          name: t('config.guide.preset.conservative'),
          buy: '–1%',
          sell: '–',
        },
        { name: t('config.guide.preset.balanced'), buy: '0%', sell: '–' },
        {
          name: t('config.guide.preset.aggressive'),
          buy: '+1%',
          sell: '–',
        },
      ],
      profileCols: ['Offset', ''],
      tip: t('config.explain.offsetTip'),
    },
  ];

  const colorMap = {
    blue: {
      border: 'border-blue-500/20',
      bg: 'bg-blue-500/5',
      badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      heading: 'text-blue-400',
    },
    red: {
      border: 'border-red-500/20',
      bg: 'bg-red-500/5',
      badge: 'bg-red-500/10 text-red-400 border-red-500/20',
      heading: 'text-red-400',
    },
    purple: {
      border: 'border-purple-500/20',
      bg: 'bg-purple-500/5',
      badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      heading: 'text-purple-400',
    },
    amber: {
      border: 'border-amber-500/20',
      bg: 'bg-amber-500/5',
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      heading: 'text-amber-400',
    },
    slate: {
      border: 'border-border',
      bg: 'bg-muted/20',
      badge: 'bg-muted text-muted-foreground border-border',
      heading: 'text-muted-foreground',
    },
  };

  const filtered = conceptId
    ? concepts.filter((c) => c.id === conceptId)
    : concepts;

  return (
    <div className="space-y-4">
      {filtered.map((c) => {
        const colors = colorMap[c.color];
        return (
          <div
            key={c.id}
            className={cn(
              'rounded-xl border p-4 space-y-3',
              colors.border,
              colors.bg,
            )}
          >
            {/* Header */}
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-muted-foreground">{c.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className={cn('text-sm font-bold', colors.heading)}>
                    {c.title}
                  </h4>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 font-mono text-[9px]',
                      colors.badge,
                    )}
                  >
                    {c.field}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {c.desc}
                </p>
              </div>
            </div>

            {/* Example */}
            <div>{c.example}</div>

            {/* Profiles table */}
            {c.profileCols[1] !== '' && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('config.explain.profilesTitle')}
                </p>
                <div className="rounded-md border border-border/50 overflow-hidden">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30">
                        <th className="px-2 py-1 text-left font-semibold text-muted-foreground">
                          {t('config.explain.profile')}
                        </th>
                        {c.profileCols.filter(Boolean).map((col) => (
                          <th
                            key={col}
                            className="px-2 py-1 text-right font-semibold text-muted-foreground"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {c.profiles.map((p, i) => (
                        <tr
                          key={p.name}
                          className={cn(
                            i !== c.profiles.length - 1 &&
                              'border-b border-border/40',
                          )}
                        >
                          <td className="px-2 py-1.5 font-medium">{p.name}</td>
                          <td className="px-2 py-1.5 text-right font-mono">
                            {p.buy}
                          </td>
                          {c.profileCols[1] && (
                            <td className="px-2 py-1.5 text-right font-mono">
                              {p.sell}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tip */}
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Lightbulb className="h-3 w-3 shrink-0 text-amber-400" /> {c.tip}
            </p>
          </div>
        );
      })}
    </div>
  );
}
