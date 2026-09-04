import { useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  CircleCheck,
  Clock,
} from 'lucide-react';
import { Button, Tabs } from '@crypto-trader/ui';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTranslation } from 'react-i18next';
import { ENTRY_ORDER_STATUSES } from '@crypto-trader/shared';
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
import { EntryOrdersPanel } from '../../components/positions/entry-orders';
import type { EntryOrdersFilters as EntryOrdersFiltersState } from '../../hooks/use-entry-orders';

const PAGE_SIZE = 20;

type StatusTab = 'OPEN' | 'CLOSED' | 'ENTRIES';

const TAB_PARAM: Record<StatusTab, string> = {
  OPEN: 'open',
  CLOSED: 'closed',
  ENTRIES: 'entries',
};

const PARAM_TAB: Record<string, StatusTab> = {
  open: 'OPEN',
  closed: 'CLOSED',
  entries: 'ENTRIES',
};

function parseTab(raw: string | null): StatusTab {
  return (raw && PARAM_TAB[raw]) || 'OPEN';
}

function parseEntryFilters(searchParams: URLSearchParams): EntryOrdersFiltersState {
  const status = searchParams.get('status');
  const configId = searchParams.get('configId');
  return {
    status: status && (ENTRY_ORDER_STATUSES as readonly string[]).includes(status)
      ? (status as EntryOrdersFiltersState['status'])
      : 'ALL',
    configId: configId ?? 'ALL',
  };
}

export function PositionsPage() {
  const { t } = useTranslation();
  const { mode: platformMode } = usePlatformMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const tab = parseTab(searchParams.get('tab'));
  const entryFilters = parseEntryFilters(searchParams);
  const highlightEntryOrderId = searchParams.get('entryOrderId') ?? undefined;
  const [confirmPos, setConfirmPos] = useState<TradingPosition | null>(null);
  const [detailPos, setDetailPos] = useState<TradingPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const positionsTab: 'OPEN' | 'CLOSED' = tab === 'CLOSED' ? 'CLOSED' : 'OPEN';
  const { data, isLoading } = usePositions(page, PAGE_SIZE, positionsTab);
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
    const params = new URLSearchParams(searchParams);
    params.set('tab', TAB_PARAM[next]);
    if (next !== 'ENTRIES') {
      params.delete('status');
      params.delete('configId');
      params.delete('entryOrderId');
    }
    setSearchParams(params, { replace: true });
    setPage(1);
  };

  const handleEntryFiltersChange = (next: EntryOrdersFiltersState) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', TAB_PARAM.ENTRIES);
    if (next.status === 'ALL') params.delete('status');
    else params.set('status', next.status);
    if (next.configId === 'ALL') params.delete('configId');
    else params.set('configId', next.configId);
    setSearchParams(params, { replace: true });
  };

  const handleConfirmClose = () => {
    if (!confirmPos) return;
    closePosition.mutate(confirmPos.id, {
      onSettled: () => setConfirmPos(null),
    });
  };

  useEffect(() => {
    if (isLoading) return;
    const positionId = searchParams.get('positionId');
    if (!positionId) return;
    const match = positions.find((p) => p.id === positionId);
    if (match) setDetailPos(match);
    const next = new URLSearchParams(searchParams);
    next.delete('positionId');
    setSearchParams(next, { replace: true });
  }, [isLoading, positions, searchParams, setSearchParams]);

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
      <div className="mb-4">
        <Tabs
          tabs={[
            {
              value: 'OPEN',
              label: t('positions.tabOpen', { defaultValue: 'Open' }),
              icon: <CircleDot className="h-3.5 w-3.5" />,
            },
            {
              value: 'CLOSED',
              label: t('positions.tabClosed', { defaultValue: 'Closed' }),
              icon: <CircleCheck className="h-3.5 w-3.5" />,
            },
            {
              value: 'ENTRIES',
              label: t('positions.tabEntries', { defaultValue: 'Entries' }),
              icon: <Clock className="h-3.5 w-3.5" />,
            },
          ]}
          value={tab}
          onChange={(v) => handleTabChange(v as StatusTab)}
          border
        />
      </div>

      {tab === 'ENTRIES' ? (
        <EntryOrdersPanel
          filters={entryFilters}
          onFiltersChange={handleEntryFiltersChange}
          highlightEntryOrderId={highlightEntryOrderId}
        />
      ) : isLoading ? (
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
          tab={positionsTab}
          t={t}
          onDetail={setDetailPos}
          onClose={setConfirmPos}
        />
      )}

      {/* Pagination */}
      {tab !== 'ENTRIES' && totalPages > 1 && (
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
