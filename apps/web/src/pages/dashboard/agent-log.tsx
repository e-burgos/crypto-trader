import { useState, useRef, useMemo, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  X,
  ChevronUp,
  ChevronDown,
  LayoutList,
  TrendingUp,
  TrendingDown,
  Minus,
  XCircle,
  RefreshCw,
  Coins,
  User,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Select } from '@crypto-trader/ui';
import {
  useAgentDecisions,
  type AgentDecision,
} from '../../hooks/use-analytics';
import { usePlatformMode } from '../../hooks/use-user';
import {
  DECISION_FILTERS,
  AgentDecisionCard,
  DecisionDetailModal,
  type DecisionFilter,
  type AssetFilter,
  type AgentFilter,
} from '../../components/agent-log';

gsap.registerPlugin(useGSAP);

export function AgentLogPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { mode: platformMode } = usePlatformMode();

  const PAGE_SIZE = 10;
  const { data: allDecisions = [], isLoading } = useAgentDecisions(200);
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('ALL');
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('ALL');
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('ALL');
  const [selectedDecision, setSelectedDecision] =
    useState<AgentDecision | null>(null);
  const [page, setPage] = useState(1);

  // Resetear página al cambiar modo global
  useEffect(() => {
    setPage(1);
  }, [platformMode]);

  // Filtrar por modo de plataforma activo
  const modeFilteredDecisions = useMemo(() => {
    return allDecisions.filter((d) => {
      if (platformMode === 'SANDBOX') return d.mode === 'SANDBOX';
      return d.mode === platformMode;
    });
  }, [allDecisions, platformMode]);

  const setDecisionFilterAndReset = (v: DecisionFilter) => {
    setDecisionFilter(v);
    setPage(1);
  };
  const setAssetFilterAndReset = (v: string) => {
    setAssetFilter(v);
    setPage(1);
  };
  const setAgentFilterAndReset = (v: string) => {
    setAgentFilter(v);
    setPage(1);
  };

  const assetOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { key: string; label: string }[] = [
      { key: 'ALL', label: 'All' },
    ];
    modeFilteredDecisions.forEach((d) => {
      const key = `${d.asset}/${d.pair}`;
      if (!seen.has(key)) {
        seen.add(key);
        opts.push({ key, label: key });
      }
    });
    return opts;
  }, [modeFilteredDecisions]);

  const agentOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { key: string; label: string }[] = [
      { key: 'ALL', label: 'All' },
    ];
    modeFilteredDecisions.forEach((d) => {
      if (d.configId && !seen.has(d.configId)) {
        seen.add(d.configId);
        opts.push({ key: d.configId, label: d.configName ?? d.configId });
      }
    });
    return opts;
  }, [modeFilteredDecisions]);

  const filtered = useMemo(() => {
    return modeFilteredDecisions.filter((d) => {
      if (decisionFilter !== 'ALL' && d.decision !== decisionFilter)
        return false;
      if (assetFilter !== 'ALL' && `${d.asset}/${d.pair}` !== assetFilter)
        return false;
      if (agentFilter !== 'ALL' && d.configId !== agentFilter) return false;
      return true;
    });
  }, [modeFilteredDecisions, decisionFilter, assetFilter, agentFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page, PAGE_SIZE]);

  useGSAP(
    () => {
      gsap.from('.decision-card', {
        opacity: 0,
        x: -16,
        duration: 0.4,
        stagger: 0.06,
        ease: 'power2.out',
      });
    },
    { scope: containerRef, dependencies: [filtered.length, page] },
  );

  const decisionSelectOptions = DECISION_FILTERS.map((f) => ({
    value: f,
    label: f === 'ALL' ? t('agentLog.filterDecision') : f,
    icon:
      f === 'ALL' ? (
        <LayoutList className="h-3.5 w-3.5" />
      ) : f === 'BUY' ? (
        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
      ) : f === 'SELL' ? (
        <TrendingDown className="h-3.5 w-3.5 text-red-500" />
      ) : f === 'HOLD' ? (
        <Minus className="h-3.5 w-3.5 text-amber-500" />
      ) : f === 'CLOSE' ? (
        <XCircle className="h-3.5 w-3.5 text-orange-500" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      ),
  }));

  const assetSelectOptions = assetOptions.map((o) => ({
    value: o.key,
    label: o.key === 'ALL' ? t('agentLog.filterPair') : o.label,
    icon:
      o.key === 'ALL' ? (
        <Coins className="h-3.5 w-3.5" />
      ) : (
        <Coins className="h-3.5 w-3.5 text-primary/60" />
      ),
  }));

  const agentSelectOptions = agentOptions.map((o) => ({
    value: o.key,
    label: o.key === 'ALL' ? t('agentLog.filterAgent') : o.label,
    icon:
      o.key === 'ALL' ? (
        <User className="h-3.5 w-3.5" />
      ) : (
        <Bot className="h-3.5 w-3.5 text-primary/60" />
      ),
  }));

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          {t('sidebar.agentLog')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('botAnalysis.agentLogSubtitle')}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Decision */}
        <div className="flex-1 min-w-[120px] sm:w-40 sm:flex-none">
          <Select
            options={decisionSelectOptions}
            value={decisionFilter}
            onChange={(v) => setDecisionFilterAndReset(v as DecisionFilter)}
            size="sm"
            className="sm:hidden"
          />
          <Select
            options={decisionSelectOptions}
            value={decisionFilter}
            onChange={(v) => setDecisionFilterAndReset(v as DecisionFilter)}
            className="hidden sm:block"
          />
        </div>

        {/* Par */}
        {assetOptions.length > 2 && (
          <div className="flex-1 min-w-[120px] sm:w-40 sm:flex-none">
            <Select
              options={assetSelectOptions}
              value={assetFilter}
              onChange={setAssetFilterAndReset}
              size="sm"
              className="sm:hidden"
            />
            <Select
              options={assetSelectOptions}
              value={assetFilter}
              onChange={setAssetFilterAndReset}
              className="hidden sm:block"
            />
          </div>
        )}

        {/* Agente */}
        {agentOptions.length > 2 && (
          <div className="flex-1 min-w-[140px] sm:w-48 sm:flex-none">
            <Select
              options={agentSelectOptions}
              value={agentFilter}
              onChange={setAgentFilterAndReset}
              size="sm"
              className="sm:hidden"
            />
            <Select
              options={agentSelectOptions}
              value={agentFilter}
              onChange={setAgentFilterAndReset}
              className="hidden sm:block"
            />
          </div>
        )}

        {/* Reset */}
        {(decisionFilter !== 'ALL' ||
          assetFilter !== 'ALL' ||
          agentFilter !== 'ALL') && (
          <button
            onClick={() => {
              setDecisionFilter('ALL');
              setAssetFilter('ALL');
              setAgentFilter('ALL');
              setPage(1);
            }}
            className="flex items-center gap-1 rounded-lg border border-border bg-muted/20 px-2.5 sm:px-3 py-2 sm:py-3 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}

        {/* Count badge */}
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/20 px-2.5 py-1.5 sm:py-3 text-[11px] text-muted-foreground ml-auto">
          <Bot className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold tabular-nums">{filtered.length}</span>
          {modeFilteredDecisions.length !== filtered.length && (
            <span className="text-muted-foreground/60">
              / {modeFilteredDecisions.length}
            </span>
          )}
        </div>
      </div>

      {/* List */}
      <div ref={containerRef}>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <Bot className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="font-semibold">
              {t('botAnalysis.noAgentDecisions')}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('botAnalysis.noAgentDecisionsHint')}
            </p>
          </div>
        ) : (
          <>
            <div>
              {paginated.map((d, idx) => (
                <AgentDecisionCard
                  key={d.id}
                  decision={d}
                  isLast={idx === paginated.length - 1}
                  isFirst={idx === 0 && page === 1}
                  onOpenDetail={setSelectedDecision}
                />
              ))}
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/20 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronUp className="h-3.5 w-3.5 -rotate-90" />
                </button>

                <div className="flex items-center gap-1">
                  {(() => {
                    const WINDOW = 2;
                    const pages: (number | 'ellipsis')[] = [];
                    for (let p = 1; p <= totalPages; p++) {
                      if (
                        p === 1 ||
                        p === totalPages ||
                        (p >= page - WINDOW && p <= page + WINDOW)
                      ) {
                        pages.push(p);
                      } else if (pages[pages.length - 1] !== 'ellipsis') {
                        pages.push('ellipsis');
                      }
                    }
                    return pages.map((p, i) =>
                      p === 'ellipsis' ? (
                        <span
                          key={`ellipsis-${i}`}
                          className="flex h-8 w-6 items-end justify-center pb-1.5 text-[11px] text-muted-foreground"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={cn(
                            'flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[12px] font-semibold transition-all',
                            page === p
                              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                              : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                          )}
                        >
                          {p}
                        </button>
                      ),
                    );
                  })()}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/20 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Decision detail modal */}
      {selectedDecision && (
        <DecisionDetailModal
          decision={selectedDecision}
          onClose={() => setSelectedDecision(null)}
        />
      )}
    </div>
  );
}
