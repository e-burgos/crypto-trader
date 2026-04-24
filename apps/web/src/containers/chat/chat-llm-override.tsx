import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Search, Coins, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useChatLLMOptions,
  useUpdateChatSession,
  LLMOption,
} from '../../hooks/use-chat';
import { useLLMProviderModels, type LLMModel } from '../../hooks/use-llm';
import {
  useOpenRouterModels,
  type OpenRouterModelInfo,
} from '../../hooks/use-openrouter-models';
import { useChatStore } from '../../store/chat.store';
import { useTranslation } from 'react-i18next';

const PROVIDER_COLORS: Record<string, string> = {
  CLAUDE: 'text-orange-400',
  OPENAI: 'text-emerald-400',
  GROQ: 'text-violet-400',
  GEMINI: 'text-blue-400',
  MISTRAL: 'text-orange-500',
  TOGETHER: 'text-cyan-400',
  OPENROUTER: 'text-purple-400',
};

// ── OpenRouter category labels (mapped from API-derived categories) ──────────

// i18n label map — categories come from model data, not hardcoded
const CATEGORY_LABEL_MAP: Record<string, string> = {
  free: 'settings.orPrice.free',
  reasoning: 'settings.orCategory.reasoning',
  'tool-use': 'settings.orCategory.toolUse',
  fast: 'settings.orCategory.fast',
  'long-context': 'settings.orCategory.longContext',
  premium: 'settings.orCategory.premium',
};

// ── Component ───────────────────────────────────────────────────────────────

interface ChatLLMOverrideProps {
  /** Current session provider */
  sessionProvider: string;
  /** Current session model */
  sessionModel: string;
}

export function ChatLLMOverride({
  sessionProvider,
  sessionModel,
}: ChatLLMOverrideProps) {
  const { t } = useTranslation();
  const { data: options = [] } = useChatLLMOptions();
  const { activeSessionId } = useChatStore();
  const updateSession = useUpdateChatSession(activeSessionId ?? '');

  const [providerOpen, setProviderOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [category, setCategory] = useState<string>('');
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isOpenRouter = sessionProvider === 'OPENROUTER';

  // Fetch dynamic models from new OpenRouter endpoint
  const { data: orModelsRaw } = useOpenRouterModels();

  // Derive available categories dynamically from model data
  const orCategories = useMemo(() => {
    if (!orModelsRaw) return [];
    const catSet = new Set<string>();
    for (const m of orModelsRaw) {
      for (const c of m.categories) catSet.add(c);
    }
    return [
      { value: '', labelKey: 'settings.orCategory.allCategories' },
      ...Array.from(catSet)
        .sort()
        .map((c) => ({
          value: c,
          labelKey: CATEGORY_LABEL_MAP[c] || c,
        })),
    ];
  }, [orModelsRaw]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setProviderOpen(false);
        setModelOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const activeOption = options.find((o) => o.provider === sessionProvider);

  // For OpenRouter: filter models by selected category
  const orFiltered =
    isOpenRouter && orModelsRaw
      ? (() => {
          let models = [...orModelsRaw];
          if (category === 'free') {
            models = models.filter((m) => m.isFree);
          } else if (category) {
            models = models.filter((m) => m.categories.includes(category));
          }
          // Sort: paid by price desc, free by context desc
          models.sort((a, b) => {
            if (a.isFree !== b.isFree) return a.isFree ? 1 : -1;
            if (!a.isFree) return b.pricing.completion - a.pricing.completion;
            return b.contextLength - a.contextLength;
          });
          return models;
        })()
      : [];

  // For non-OpenRouter providers
  const availableModels = activeOption?.models ?? [];

  // Auto-switch category if current model is not visible
  useEffect(() => {
    if (!isOpenRouter || !orModelsRaw?.length || !sessionModel) return;
    const visible = orFiltered.some((m) => m.id === sessionModel);
    if (!visible) {
      // Try to find a specific category that contains this model
      const model = orModelsRaw.find((m) => m.id === sessionModel);
      if (model) {
        if (model.isFree) {
          setCategory('free');
        } else if (model.categories.length > 0) {
          const matchedCat = orCategories.find(
            (c) =>
              c.value &&
              c.value !== 'free' &&
              model.categories.includes(c.value),
          );
          setCategory(matchedCat?.value ?? '');
        } else {
          setCategory('');
        }
      }
    }
  }, [sessionModel, orModelsRaw]);

  const handleProviderSelect = (opt: LLMOption) => {
    const newModel = opt.models[0] ?? sessionModel;
    updateSession.mutate({ provider: opt.provider, model: newModel });
    setProviderOpen(false);
  };

  const handleModelSelect = (model: string) => {
    updateSession.mutate({ model });
    setModelOpen(false);
    setSearch('');
  };

  const handleCategorySelect = (cat: string) => {
    setCategory(cat);
    setProviderOpen(false);
  };

  // Show when multiple providers OR when single provider is OpenRouter
  const hasOpenRouter = options.some((o) => o.provider === 'OPENROUTER');
  if (options.length <= 1 && !hasOpenRouter) return null;

  // Active category label for display
  const activeCategoryLabel = isOpenRouter
    ? t(
        orCategories.find((c) => c.value === category)?.labelKey ??
          'settings.orCategory.allCategories',
      )
    : null;

  return (
    <div ref={containerRef} className="flex items-center gap-1 px-3 pb-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
        {t('chat.llmOverride.label', { defaultValue: 'Model' })}
      </span>

      {/* First selector: Provider (multi-provider) or Category (OpenRouter-only) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setProviderOpen(!providerOpen);
            setModelOpen(false);
          }}
          className={cn(
            'flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
            'hover:bg-muted/50',
            isOpenRouter ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <span
            className={
              isOpenRouter
                ? 'text-purple-400'
                : (PROVIDER_COLORS[sessionProvider] ?? 'text-muted-foreground')
            }
          >
            {isOpenRouter && options.length <= 1
              ? activeCategoryLabel
              : (activeOption?.label ?? sessionProvider)}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>

        {providerOpen && (
          <div className="absolute bg-background bottom-full left-0 z-50 mb-1 min-w-[140px] rounded-lg border border-border bg-popover p-1 shadow-lg">
            {isOpenRouter && options.length <= 1
              ? /* Category list for OpenRouter-only */
                orCategories.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => handleCategorySelect(cat.value)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                      'hover:bg-muted/60',
                      cat.value === category && 'bg-muted/40 font-medium',
                    )}
                  >
                    <span
                      className={
                        cat.value === category
                          ? 'text-purple-400'
                          : 'text-muted-foreground'
                      }
                    >
                      {t(cat.labelKey)}
                    </span>
                  </button>
                ))
              : /* Provider list for multi-provider */
                options.map((opt) => (
                  <button
                    key={opt.provider}
                    type="button"
                    onClick={() => handleProviderSelect(opt)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                      'hover:bg-muted/60',
                      opt.provider === sessionProvider &&
                        'bg-muted/40 font-medium',
                    )}
                  >
                    <span className={PROVIDER_COLORS[opt.provider] ?? ''}>
                      {opt.label}
                    </span>
                  </button>
                ))}
          </div>
        )}
      </div>

      {/* Separator when multi-provider + OpenRouter: show category pills */}
      {isOpenRouter && options.length > 1 && (
        <div className="flex items-center gap-0.5">
          <span className="text-muted-foreground/40 mx-0.5">·</span>
          {orCategories.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              className={cn(
                'rounded-md px-1.5 py-0.5 text-[10px] transition-colors',
                cat.value === category
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/40',
              )}
            >
              {t(cat.labelKey)}
            </button>
          ))}
        </div>
      )}

      {/* Second selector: Models */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            const next = !modelOpen;
            setModelOpen(next);
            setProviderOpen(false);
            if (!next) setSearch('');
            else setTimeout(() => searchInputRef.current?.focus(), 0);
          }}
          className={cn(
            'flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors',
            'hover:bg-muted/50',
            'text-muted-foreground',
          )}
        >
          <span className="max-w-[180px] truncate">{sessionModel}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>

        {modelOpen && (
          <div className="absolute bg-background bottom-full left-0 z-50 mb-1 max-h-64 min-w-[260px] rounded-lg border border-border bg-popover shadow-lg flex flex-col">
            {/* Search input */}
            <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
              <Search className="h-3 w-3 shrink-0 text-muted-foreground/50" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('chat.llmOverride.searchPlaceholder', {
                  defaultValue: 'Search models...',
                })}
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none"
              />
            </div>
            {/* Model list */}
            <div className="overflow-y-auto p-1">
              {isOpenRouter
                ? (() => {
                    const q = search.toLowerCase();
                    const visible = orFiltered.filter(
                      (m) =>
                        !q ||
                        m.id.toLowerCase().includes(q) ||
                        m.name.toLowerCase().includes(q),
                    );
                    return visible.length > 0 ? (
                      visible.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleModelSelect(m.id)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                            'hover:bg-muted/60',
                            m.id === sessionModel && 'bg-muted/40 font-medium',
                          )}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            {m.isFree ? (
                              <Zap className="h-3 w-3 shrink-0 text-emerald-400" />
                            ) : (
                              <Coins className="h-3 w-3 shrink-0 text-amber-400" />
                            )}
                            <span className="truncate">{m.name}</span>
                          </span>
                          <span className="ml-2 shrink-0 text-[10px] text-muted-foreground/50">
                            {m.isFree
                              ? 'Free'
                              : `$${m.pricing.completion < 1 ? m.pricing.completion.toFixed(2) : m.pricing.completion.toFixed(1)}/M`}
                            {' · '}
                            {m.contextLength >= 1_000_000
                              ? `${(m.contextLength / 1_000_000).toFixed(1)}M`
                              : `${(m.contextLength / 1000).toFixed(0)}K`}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground/60">
                        {t('chat.llmOverride.noModels', {
                          defaultValue: 'No models in this category',
                        })}
                      </div>
                    );
                  })()
                : (() => {
                    const q = search.toLowerCase();
                    const visible = availableModels.filter(
                      (m) => !q || m.toLowerCase().includes(q),
                    );
                    return visible.length > 0
                      ? visible.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleModelSelect(m)}
                            className={cn(
                              'flex w-full items-center rounded-md px-2 py-1.5 text-xs transition-colors',
                              'hover:bg-muted/60',
                              m === sessionModel && 'bg-muted/40 font-medium',
                            )}
                          >
                            <span className="truncate">{m}</span>
                          </button>
                        ))
                      : null;
                  })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
