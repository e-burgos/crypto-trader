import { useRef, useState, useEffect } from 'react';
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Button,
} from '@crypto-trader/ui';
import { cn } from '../../lib/utils';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTranslation } from 'react-i18next';
import {
  usePositions,
  useClosePosition,
  TradingPosition,
} from '../../hooks/use-trading';
import { useLivePrices } from '../../hooks/use-live-prices';
import { usePlatformMode } from '../../hooks/use-user';
import {
  PositionDetailModal,
  CloseConfirmDialog,
  PositionsTable,
} from '../../components/positions';

const PAGE_SIZE = 20;

type StatusTab = 'OPEN' | 'CLOSED';

export function PositionsPage() {
  const { t } = useTranslation();
  const { mode: platformMode } = usePlatformMode();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<StatusTab>('OPEN');
  const [confirmPos, setConfirmPos] = useState<TradingPosition | null>(null);
  const [detailPos, setDetailPos] = useState<TradingPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = usePositions(page, PAGE_SIZE, tab);
  const closePosition = useClosePosition();

  // Resetear página al cambiar modo global
  useEffect(() => {
    setPage(1);
  }, [platformMode]);

  const allPositions = data?.positions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Filtrar posiciones por modo global activo
  const positions = allPositions.filter((p) => {
    return p.mode === platformMode;
  });

  // Collect unique symbols from open positions and keep prices fresh
  const openSymbols =
    tab === 'OPEN'
      ? [...new Set(positions.map((p) => `${p.asset}${p.pair}`))]
      : [];
  useLivePrices(openSymbols);

  const handleTabChange = (next: StatusTab) => {
    setTab(next);
    setPage(1);
  };

  const handleConfirmClose = () => {
    if (!confirmPos) return;
    closePosition.mutate(confirmPos.id, {
      onSettled: () => setConfirmPos(null),
    });
  };

  useGSAP(
    () => {
      if (isLoading) return;
      const rows = gsap.utils.toArray<Element>(
        '.position-row',
        containerRef.current,
      );
      if (!rows.length) return;
      gsap.fromTo(
        rows,
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, stagger: 0.04, duration: 0.35, ease: 'power2.out' },
      );
    },
    { scope: containerRef, dependencies: [isLoading, page, tab] },
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

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
        {(['OPEN', 'CLOSED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => handleTabChange(s)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              tab === s
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {s === 'OPEN'
              ? t('positions.tabOpen', { defaultValue: 'Open' })
              : t('positions.tabClosed', { defaultValue: 'Closed' })}
          </button>
        ))}
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
        <PositionsTable
          positions={positions}
          tab={tab}
          t={t}
          onDetail={setDetailPos}
          onClose={setConfirmPos}
        />
      )}

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

      {confirmPos && (
        <CloseConfirmDialog
          position={confirmPos}
          onConfirm={handleConfirmClose}
          onCancel={() => setConfirmPos(null)}
          isLoading={closePosition.isPending}
        />
      )}

      {detailPos && (
        <PositionDetailModal
          position={detailPos}
          onClose={() => setDetailPos(null)}
        />
      )}
    </div>
  );
}
