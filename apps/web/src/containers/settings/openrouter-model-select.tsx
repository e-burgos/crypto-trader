import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, type SelectOption, ModelInfoModal } from '@crypto-trader/ui';
import {
  useOpenRouterModels,
  type OpenRouterModelInfo,
} from '../../hooks/use-openrouter-models';
import { Cpu, Info, Loader2, Sparkles, Coins, Zap } from 'lucide-react';

// ── Filters ─────────────────────────────────────────────────────────────────

type SortMode = 'smart' | 'price-asc' | 'price-desc' | 'context';

const SORT_OPTIONS: { value: SortMode; labelKey: string }[] = [
  { value: 'smart', labelKey: 'settings.orSort.smart' },
  { value: 'price-asc', labelKey: 'settings.orSort.cheapest' },
  { value: 'price-desc', labelKey: 'settings.orSort.mostCapable' },
  { value: 'context', labelKey: 'settings.orSort.longestContext' },
];

type PriceFilter = 'all' | 'free' | 'paid';

const PRICE_OPTIONS: { value: PriceFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'settings.orPrice.all' },
  { value: 'free', labelKey: 'settings.orPrice.free' },
  { value: 'paid', labelKey: 'settings.orPrice.paid' },
];

// i18n label map for known categories — keys come from API model data
const CATEGORY_LABEL_MAP: Record<string, string> = {
  reasoning: 'settings.orCategory.reasoning',
  'tool-use': 'settings.orCategory.toolUse',
  fast: 'settings.orCategory.fast',
  'long-context': 'settings.orCategory.longContext',
  premium: 'settings.orCategory.premium',
};

// Categories already covered by the Price filter
const HIDDEN_CATEGORIES = new Set(['free', 'paid']);

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(pricePerMillion: number): string {
  if (pricePerMillion === 0) return 'Free';
  if (pricePerMillion < 0.1) return `$${pricePerMillion.toFixed(3)}/M`;
  if (pricePerMillion < 1) return `$${pricePerMillion.toFixed(2)}/M`;
  return `$${pricePerMillion.toFixed(1)}/M`;
}

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M ctx`;
  return `${(tokens / 1_000).toFixed(0)}K ctx`;
}

function smartScore(m: OpenRouterModelInfo): number {
  // Higher = better. Weighs pricing (proxy for quality) + context length
  let score = 0;
  if (m.isFree) {
    score = m.contextLength >= 200_000 ? 25 : 15;
  } else if (m.pricing.completion >= 10) {
    score = 90;
  } else if (m.pricing.completion >= 3) {
    score = 70;
  } else if (m.pricing.completion >= 1) {
    score = 50;
  } else {
    score = 35;
  }
  // Bonus for large context
  score += Math.min(m.contextLength / 100_000, 10);
  return score;
}

// ── Component ───────────────────────────────────────────────────────────────

interface OpenRouterModelSelectProps {
  value: string;
  onChange: (model: string) => void;
  label?: string;
  className?: string;
  /** Compact mode: filters in a single row with smaller labels */
  compact?: boolean;
}

export function OpenRouterModelSelect({
  value,
  onChange,
  label,
  className = '',
  compact = false,
}: OpenRouterModelSelectProps) {
  const { t } = useTranslation();
  const { data: allModels, isLoading } = useOpenRouterModels();

  const [category, setCategory] = useState<string>('');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('smart');
  const [infoOpen, setInfoOpen] = useState(false);

  // Derive available categories dynamically from model data
  const availableCategories = useMemo(() => {
    if (!allModels) return [];
    const catSet = new Set<string>();
    for (const m of allModels) {
      for (const c of m.categories) {
        if (!HIDDEN_CATEGORIES.has(c)) catSet.add(c);
      }
    }
    return Array.from(catSet).sort();
  }, [allModels]);

  // Auto-detect category of currently selected model
  useEffect(() => {
    if (!value || !allModels) return;
    const selected = allModels.find((m) => m.id === value);
    if (!selected) return;

    // Auto-set price filter based on model
    if (selected.isFree && priceFilter === 'paid') {
      setPriceFilter('all');
    } else if (!selected.isFree && priceFilter === 'free') {
      setPriceFilter('all');
    }
  }, [value, allModels]);

  // Build filtered + sorted model options
  const modelOptions = useMemo(() => {
    if (!allModels) return [];

    let filtered = [...allModels];

    // Price filter
    if (priceFilter === 'free') {
      filtered = filtered.filter((m) => m.isFree);
    } else if (priceFilter === 'paid') {
      filtered = filtered.filter((m) => !m.isFree);
    }

    // Category filter
    if (category) {
      filtered = filtered.filter((m) => m.categories.includes(category));
    }

    // Sort
    switch (sortMode) {
      case 'smart':
        filtered.sort((a, b) => smartScore(b) - smartScore(a));
        break;
      case 'price-asc':
        filtered.sort((a, b) => a.pricing.completion - b.pricing.completion);
        break;
      case 'price-desc':
        filtered.sort((a, b) => b.pricing.completion - a.pricing.completion);
        break;
      case 'context':
        filtered.sort((a, b) => b.contextLength - a.contextLength);
        break;
    }

    return filtered;
  }, [allModels, category, priceFilter, sortMode]);

  // Build SelectOption array
  const autoOption: SelectOption = {
    value: '',
    label: t('config.stepper.autoSelect', {
      defaultValue: 'Auto (recommended)',
    }),
    icon: <Sparkles className="h-3.5 w-3.5 text-primary" />,
  };

  const options: SelectOption[] = [
    autoOption,
    ...modelOptions.map(
      (m): SelectOption => ({
        value: m.id,
        label: m.name,
        description: [
          m.isFree ? '🆓 Free' : `${formatPrice(m.pricing.completion)} out`,
          formatContext(m.contextLength),
        ].join(' · '),
        icon: m.isFree ? (
          <Zap className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Coins className="h-3.5 w-3.5 text-amber-400" />
        ),
      }),
    ),
  ];

  // Ensure currently selected model appears even if filtered out
  const valueInOptions = options.some((o) => o.value === value);
  if (value && !valueInOptions) {
    const selectedModel = allModels?.find((m) => m.id === value);
    if (selectedModel) {
      options.push({
        value: selectedModel.id,
        label: selectedModel.name,
        description: [
          selectedModel.isFree
            ? '🆓 Free'
            : `${formatPrice(selectedModel.pricing.completion)} out`,
          formatContext(selectedModel.contextLength),
        ].join(' · '),
        icon: <Cpu className="h-3.5 w-3.5 text-primary" />,
      });
    } else if (value) {
      // Model not in API results at all (legacy/custom)
      options.push({
        value,
        label: value,
        icon: <Cpu className="h-3.5 w-3.5 text-amber-400" />,
      });
    }
  }

  // Filter selectors as Select components
  const categoryOptions: SelectOption[] = [
    {
      value: '',
      label: t('settings.orCategory.allCategories', {
        defaultValue: 'All Categories',
      }),
    },
    ...availableCategories.map((cat) => ({
      value: cat,
      label: CATEGORY_LABEL_MAP[cat]
        ? t(CATEGORY_LABEL_MAP[cat], { defaultValue: cat })
        : cat.charAt(0).toUpperCase() + cat.slice(1).replace(/-/g, ' '),
    })),
  ];

  const priceOptions: SelectOption[] = PRICE_OPTIONS.map((p) => ({
    value: p.value,
    label: t(p.labelKey, {
      defaultValue:
        p.value === 'all' ? 'All' : p.value === 'free' ? 'Free' : 'Paid',
    }),
  }));

  const sortOptions: SelectOption[] = SORT_OPTIONS.map((s) => ({
    value: s.value,
    label: t(s.labelKey, {
      defaultValue:
        s.value === 'smart'
          ? 'Smart Ranking'
          : s.value === 'price-asc'
            ? 'Cheapest First'
            : s.value === 'price-desc'
              ? 'Most Capable'
              : 'Longest Context',
    }),
  }));

  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <Select
          options={[
            {
              value: '',
              label: t('common.loading', { defaultValue: 'Loading...' }),
            },
          ]}
          value=""
          onChange={() => ({}) as unknown as Promise<void>}
          label={label}
          disabled
        />
        <Loader2 className="absolute right-10 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Model selector + info button */}
      <div className="flex items-end gap-2 w-full!">
        <div className="flex-1">
          <Select
            options={options}
            value={value || ''}
            onChange={onChange}
            label={compact ? undefined : label}
            searchable
            searchPlaceholder={t('settings.modelFilter.searchPlaceholder', {
              defaultValue: 'Search model...',
            })}
          />
        </div>
        {value && allModels?.find((m) => m.id === value) && (
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={t('settings.modelInfo.viewDetails', {
              defaultValue: 'View model details',
            })}
          >
            <Info className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className={`mb-2 grid gap-2 grid-cols-1 sm:grid-cols-3`}>
        <Select
          options={categoryOptions}
          value={category}
          onChange={(v) => setCategory(v)}
          label={
            compact
              ? undefined
              : t('settings.orFilter.category', { defaultValue: 'Category' })
          }
          placeholder={
            compact
              ? t('settings.orFilter.category', { defaultValue: 'Category' })
              : undefined
          }
        />
        <Select
          options={priceOptions}
          value={priceFilter}
          onChange={(v) => setPriceFilter(v as PriceFilter)}
          label={
            compact
              ? undefined
              : t('settings.orFilter.price', { defaultValue: 'Price' })
          }
          placeholder={
            compact
              ? t('settings.orFilter.price', { defaultValue: 'Price' })
              : undefined
          }
        />
        <Select
          options={sortOptions}
          value={sortMode}
          onChange={(v) => setSortMode(v as SortMode)}
          label={
            compact
              ? undefined
              : t('settings.orFilter.sort', { defaultValue: 'Sort' })
          }
          placeholder={
            compact
              ? t('settings.orFilter.sort', { defaultValue: 'Sort' })
              : undefined
          }
        />
      </div>

      {/* Model count indicator */}
      <p className="mb-1 ml-1 text-[10px] text-muted-foreground">
        {modelOptions.length}{' '}
        {t('settings.orFilter.modelsAvailable', {
          defaultValue: 'models available',
        })}
      </p>

      {/* Model info modal */}
      <ModelInfoModal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        model={allModels?.find((m) => m.id === value) ?? null}
      />
    </div>
  );
}
