import { useRef, useState } from 'react';
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTranslation } from 'react-i18next';
import { useOpenPositions } from '../../hooks/use-trading';
import { InfoTooltip } from '../../components/ui/info-tooltip';

const PAGE_SIZE = 20;

export function PositionsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useOpenPositions(page, PAGE_SIZE);
  const positions = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  useGSAP(
    () => {
      if (isLoading) return;
      gsap.fromTo(
        '.position-row',
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, stagger: 0.04, duration: 0.35, ease: 'power2.out' },
      );
    },
    { scope: containerRef, dependencies: [isLoading, page] },
  );

  return (
    <div ref={containerRef} className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('sidebar.positions')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('positions.subtitle')}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : positions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <Briefcase className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">{t('common.empty')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('positions.noPositionsHint')}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('trading.asset')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('trading.mode')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    {t('positions.entryPrice')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    {t('tradeHistory.qty')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    <span className="flex items-center justify-end gap-1">
                      {t('common.pnl')}
                      <InfoTooltip text={t('tooltips.pnlOpen')} side="left" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    {t('positions.opened')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr
                    key={pos.id}
                    className="position-row border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold">
                      {pos.asset}/{pos.pair}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          pos.mode === 'LIVE'
                            ? 'bg-red-500/10 text-red-500'
                            : 'bg-blue-500/10 text-blue-500',
                        )}
                      >
                        {pos.mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      $
                      {pos.entryPrice.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {pos.quantity.toFixed(6)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 font-semibold font-mono',
                          pos.unrealizedPnl >= 0
                            ? 'text-emerald-500'
                            : 'text-red-500',
                        )}
                      >
                        {pos.unrealizedPnl >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        ${pos.unrealizedPnl.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {new Date(pos.openedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
