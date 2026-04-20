import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useChatLLMOptions,
  useUpdateChatSession,
  LLMOption,
} from '../../hooks/use-chat';
import { useLLMProviderModels, type LLMModel } from '../../hooks/use-llm';
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

// ── OpenRouter category filters ─────────────────────────────────────────────

type ORCategory =
  | 'top-paid'
  | 'free'
  | 'all'
  | 'reasoning'
  | 'fast'
  | 'analytics';

const OR_CATEGORIES: { value: ORCategory; labelKey: string }[] = [
  { value: 'top-paid', labelKey: 'settings.orCategory.topPaid' },
  { value: 'free', labelKey: 'settings.orCategory.free' },
  { value: 'all', labelKey: 'settings.orCategory.all' },
  { value: 'reasoning', labelKey: 'settings.orCategory.reasoning' },
  { value: 'fast', labelKey: 'settings.orCategory.fast' },
  { value: 'analytics', labelKey: 'settings.orCategory.analytics' },
];

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
  const [category, setCategory] = useState<ORCategory>('top-paid');
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isOpenRouter = sessionProvider === 'OPENROUTER';

  // Fetch dynamic models for OpenRouter
  const { data: orModels } = useLLMProviderModels(
    isOpenRouter ? 'OPENROUTER' : '',
  );

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
    isOpenRouter && orModels
      ? category === 'all'
        ? orModels.filter((m) => !m.deprecated)
        : orModels.filter(
            (m) => !m.deprecated && m.categories?.includes(category),
          )
      : [];

  // For non-OpenRouter providers
  const availableModels = activeOption?.models ?? [];

  // Auto-switch category if current model is not visible
  useEffect(() => {
    if (!isOpenRouter || !orModels?.length || !sessionModel) return;
    const visible = orFiltered.some((m) => m.id === sessionModel);
    if (!visible) {
      for (const cat of OR_CATEGORIES) {
        if (cat.value === 'all') {
          setCategory('all');
          break;
        }
        if (
          orModels.some(
            (m) => m.id === sessionModel && m.categories?.includes(cat.value),
          )
        ) {
          setCategory(cat.value);
          break;
        }
      }
    }
  }, [sessionModel, orModels]);

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

  const handleCategorySelect = (cat: ORCategory) => {
    setCategory(cat);
    setProviderOpen(false);
  };

  // Show when multiple providers OR when single provider is OpenRouter
  const hasOpenRouter = options.some((o) => o.provider === 'OPENROUTER');
  if (options.length <= 1 && !hasOpenRouter) return null;

  // Active category label for display
  const activeCategoryLabel = isOpenRouter
    ? t(
        OR_CATEGORIES.find((c) => c.value === category)?.labelKey ??
          'settings.orCategory.topPaid',
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
                OR_CATEGORIES.map((cat) => (
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
          {OR_CATEGORIES.map((cat) => (
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
                        (m.label ?? '').toLowerCase().includes(q),
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
                          <span className="truncate">{m.label ?? m.id}</span>
                          {m.contextWindow && (
                            <span className="ml-2 shrink-0 text-[10px] text-muted-foreground/50">
                              {(m.contextWindow / 1000).toFixed(0)}K
                            </span>
                          )}
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
