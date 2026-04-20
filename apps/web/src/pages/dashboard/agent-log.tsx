import { useState, useRef, useMemo, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useAgentDecisions,
  type AgentDecision,
} from '../../hooks/use-analytics';
import { usePlatformMode } from '../../hooks/use-user';
import {
  DECISION_COLOR,
  DECISION_BG,
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
  const [filtersOpen, setFiltersOpen] = useState(false);
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
      {(() => {
        const activeCount = [
          decisionFilter !== 'ALL',
          assetFilter !== 'ALL',
          agentFilter !== 'ALL',
        ].filter(Boolean).length;

        const PillGroup = ({
          label,
          options,
          value,
          onChange,
          colorMap,
          bgMap,
        }: {
          label: string;
          options: { key: string; label: string }[];
          value: string;
          onChange: (v: string) => void;
          colorMap?: Record<string, string>;
          bgMap?: Record<string, string>;
        }) => (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-0.5 sm:hidden">
              {label}
            </span>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/20 p-0.5 overflow-x-auto scrollbar-none">
              {options.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => onChange(opt.key)}
                  className={cn(
                    'shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all touch-manipulation',
                    value === opt.key
                      ? opt.key === 'ALL'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : colorMap && bgMap
                          ? cn(
                              bgMap[opt.key] ?? 'bg-muted',
                              colorMap[opt.key] ?? 'text-foreground',
                              'shadow-sm',
                            )
                          : 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );

        return (
          <>
            {/* Mobile: compact toggle bar */}
            <div className="flex items-center gap-2 sm:hidden">
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className={cn(
                  'flex flex-1 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-colors',
                  filtersOpen || activeCount > 0
                    ? 'border-primary/40 bg-primary/5 text-primary'
                    : 'border-border bg-muted/20 text-muted-foreground',
                )}
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Filtros</span>
                  {activeCount > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {activeCount}
                    </span>
                  )}
                </div>
                {filtersOpen ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {activeCount > 0 && (
                <button
                  onClick={() => {
                    setDecisionFilter('ALL');
                    setAssetFilter('ALL');
                    setAgentFilter('ALL');
                    setPage(1);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-border bg-muted/20 px-2.5 py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}

              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/20 px-2.5 py-2 text-[11px] text-muted-foreground">
                <Bot className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold tabular-nums">
                  {filtered.length}
                </span>
                {modeFilteredDecisions.length !== filtered.length && (
                  <span className="text-muted-foreground/60">
                    / {modeFilteredDecisions.length}
                  </span>
                )}
              </div>
            </div>

            {/* Mobile: expanded filter panel */}
            {filtersOpen && (
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:hidden">
                <PillGroup
                  label="Decisión"
                  options={DECISION_FILTERS.map((f) => ({ key: f, label: f }))}
                  value={decisionFilter}
                  onChange={(v) =>
                    setDecisionFilterAndReset(v as DecisionFilter)
                  }
                  colorMap={DECISION_COLOR}
                  bgMap={DECISION_BG}
                />
                {assetOptions.length > 2 && (
                  <PillGroup
                    label="Par"
                    options={assetOptions}
                    value={assetFilter}
                    onChange={setAssetFilterAndReset}
                  />
                )}
                {agentOptions.length > 2 && (
                  <PillGroup
                    label="Agente"
                    options={agentOptions}
                    value={agentFilter}
                    onChange={setAgentFilterAndReset}
                  />
                )}
              </div>
            )}

            {/* Desktop: inline pill row */}
            <div className="hidden sm:flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/20 p-0.5">
                {DECISION_FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setDecisionFilterAndReset(f)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[11px] font-bold uppercase transition-all',
                      decisionFilter === f
                        ? f === 'ALL'
                          ? 'bg-primary text-primary-foreground'
                          : cn(
                              DECISION_BG[f] ?? 'bg-muted',
                              DECISION_COLOR[f] ?? 'text-foreground',
                              'shadow-sm',
                            )
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {assetOptions.length > 2 && (
                <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/20 p-0.5">
                  {assetOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setAssetFilterAndReset(opt.key)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all',
                        assetFilter === opt.key
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {agentOptions.length > 2 && (
                <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/20 p-0.5">
                  <Bot className="ml-1 h-3 w-3 text-muted-foreground shrink-0" />
                  {agentOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setAgentFilterAndReset(opt.key)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all',
                        agentFilter === opt.key
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/20 px-2.5 py-1 text-[11px] text-muted-foreground">
                <Bot className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold">
                  {t('botAnalysis.agentDecisions', { count: filtered.length })}
                </span>
                {modeFilteredDecisions.length !== filtered.length && (
                  <span className="text-muted-foreground/60">
                    ({modeFilteredDecisions.length})
                  </span>
                )}
              </div>
            </div>
          </>
        );
      })()}

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
