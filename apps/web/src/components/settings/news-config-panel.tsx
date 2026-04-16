import { useState, useEffect } from 'react';
import {
  Settings,
  Clock,
  Hash,
  Brain,
  RefreshCw,
  Save,
  Cpu,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { useLLMKeys } from '../../hooks/use-user';
import { DynamicModelSelect } from './dynamic-model-select';
import { CustomSelect } from '../ui/custom-select';
import type { NewsConfig } from '../../hooks/use-market';

const NEWS_COUNTS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

const ALL_SOURCE_IDS = [
  'coingecko',
  'rss:coindesk',
  'rss:cointelegraph',
  'rss:bitcoinmagazine',
  'rss:theblock',
  'rss:beincrypto',
  'reddit',
];

interface LLMProviderOption {
  value: string;
  label: string;
  models: { value: string; label: string }[];
}

const LLM_PROVIDERS: LLMProviderOption[] = [
  {
    value: 'CLAUDE',
    label: 'Claude (Anthropic)',
    models: [
      { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { value: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
    ],
  },
  {
    value: 'OPENAI',
    label: 'OpenAI',
    models: [
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4o', label: 'GPT-4o' },
    ],
  },
  {
    value: 'GROQ',
    label: 'Groq (Llama)',
    models: [
      { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (rápido)' },
    ],
  },
  {
    value: 'GEMINI',
    label: 'Google Gemini',
    models: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
    ],
  },
  {
    value: 'MISTRAL',
    label: 'Mistral AI',
    models: [
      { value: 'mistral-small-latest', label: 'Mistral Small' },
      { value: 'mistral-medium-latest', label: 'Mistral Medium' },
      { value: 'mistral-large-latest', label: 'Mistral Large' },
    ],
  },
  {
    value: 'TOGETHER',
    label: 'Together AI',
    models: [
      {
        value: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
        label: 'Llama 4 Maverick',
      },
      {
        value: 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
        label: 'Llama 4 Scout',
      },
      {
        value: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        label: 'Llama 3.3 70B Turbo',
      },
    ],
  },
];

function sourceLabel(source: string): string {
  if (source === 'coingecko') return 'CoinGecko';
  if (source === 'cryptopanic') return 'CryptoPanic';
  if (source === 'newsdata') return 'NewsData';
  if (source.startsWith('rss:')) {
    const name = source.replace('rss:', '');
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  if (source.startsWith('reddit:')) return `r/${source.replace('reddit:', '')}`;
  return source;
}

export function NewsConfigPanel({
  config,
  onSave,
  isSaving,
}: {
  config: NewsConfig | undefined;
  onSave: (data: Partial<NewsConfig>) => void;
  isSaving: boolean;
}) {
  const { t } = useTranslation();
  const { data: llmKeys = [] } = useLLMKeys();
  const [interval, setInterval] = useState(config?.intervalMinutes ?? 30);
  const [count, setCount] = useState(config?.newsCount ?? 40);
  const [sources, setSources] = useState<string[]>(
    config?.enabledSources ?? [],
  );
  const [onlySummary, setOnlySummary] = useState(config?.onlySummary ?? true);
  const [botEnabled, setBotEnabled] = useState(config?.botEnabled ?? true);
  const [newsWeight, setNewsWeight] = useState(config?.newsWeight ?? 15);
  const [primaryProvider, setPrimaryProvider] = useState(
    config?.primaryProvider ?? '',
  );
  const [primaryModel, setPrimaryModel] = useState(config?.primaryModel ?? '');
  const [fallbackProvider, setFallbackProvider] = useState(
    config?.fallbackProvider ?? '',
  );
  const [fallbackModel, setFallbackModel] = useState(
    config?.fallbackModel ?? '',
  );

  // Sync local state when config loads asynchronously
  useEffect(() => {
    if (config) {
      setInterval(config.intervalMinutes ?? 30);
      setCount(config.newsCount ?? 40);
      setSources(config.enabledSources ?? []);
      setOnlySummary(config.onlySummary ?? true);
      setBotEnabled(config.botEnabled ?? true);
      setNewsWeight(config.newsWeight ?? 15);
      setPrimaryProvider(config.primaryProvider ?? '');
      setPrimaryModel(config.primaryModel ?? '');
      setFallbackProvider(config.fallbackProvider ?? '');
      setFallbackModel(config.fallbackModel ?? '');
    }
  }, [config]);

  const activeProviderOptions = llmKeys
    .filter((k) => k.isActive)
    .map((k) => ({
      value: k.provider,
      label:
        LLM_PROVIDERS.find((p) => p.value === k.provider)?.label ?? k.provider,
      icon: <Cpu className="h-3.5 w-3.5 text-muted-foreground" />,
    }));

  const handleProviderChange = (
    type: 'primary' | 'fallback',
    value: string,
  ) => {
    if (type === 'primary') {
      setPrimaryProvider(value);
      setPrimaryModel('');
    } else {
      setFallbackProvider(value);
      setFallbackModel('');
    }
  };

  const allEnabled = sources.length === 0;

  const toggleSource = (id: string) => {
    if (allEnabled) {
      setSources(ALL_SOURCE_IDS.filter((s) => s !== id));
    } else if (sources.includes(id)) {
      const next = sources.filter((s) => s !== id);
      setSources(next.length === ALL_SOURCE_IDS.length ? [] : next);
    } else {
      const next = [...sources, id];
      setSources(next.length === ALL_SOURCE_IDS.length ? [] : next);
    }
  };

  const isEnabled = (id: string) => allEnabled || sources.includes(id);

  const handleSave = () => {
    onSave({
      intervalMinutes: interval,
      newsCount: count,
      enabledSources: sources,
      onlySummary,
      botEnabled,
      newsWeight,
      primaryProvider: primaryProvider || null,
      primaryModel: primaryModel || null,
      fallbackProvider: fallbackProvider || null,
      fallbackModel: fallbackModel || null,
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card mb-6">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/20">
        <Settings className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Configuración de Noticias</span>
      </div>
      <div className="p-5 space-y-5">
        {/* Interval & Count */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1.5">
              <Clock className="h-3 w-3" />
              Intervalo de análisis (min)
            </label>
            <input
              type="number"
              min={5}
              max={120}
              step={5}
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1.5">
              <Hash className="h-3 w-3" />
              Cantidad de noticias
            </label>
            <div className="flex flex-wrap gap-1.5">
              {NEWS_COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-medium border transition-colors',
                    count === n
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:border-primary/50',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bot enabled toggle */}
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <div>
            <p className="text-xs font-semibold">
              Agente analiza noticias antes de decidir
            </p>
            <p className="text-[11px] text-muted-foreground">
              El bot incluirá el análisis de noticias al tomar decisiones de
              trading
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={botEnabled}
            onClick={() => setBotEnabled((v) => !v)}
            className={cn(
              'inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
              botEnabled ? 'bg-primary' : 'bg-muted-foreground/40',
            )}
          >
            <span
              className={cn(
                'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200',
                botEnabled ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </button>
        </div>

        {/* News weight slider */}
        {botEnabled && (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">
                  Peso de noticias en la decisión
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Porcentaje de influencia del sentimiento sobre los indicadores
                  técnicos
                </p>
              </div>
              <span className="text-sm font-bold text-primary shrink-0 w-10 text-right">
                {newsWeight}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={newsWeight}
              onChange={(e) => setNewsWeight(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0% (solo técnicos)</span>
              <span>50% (equilibrado)</span>
              <span>100% (solo noticias)</span>
            </div>
          </div>
        )}

        {/* LLM Provider/Model for Analysis */}
        <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-semibold">{t('news.llmConfig')}</p>
          </div>

          {activeProviderOptions.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {t('news.noProviders')}
            </p>
          ) : (
            <div className="space-y-3">
              {/* Primary */}
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CustomSelect
                    options={[
                      { value: '', label: t('news.selectProvider') },
                      ...activeProviderOptions,
                    ]}
                    value={primaryProvider}
                    onChange={(v) => handleProviderChange('primary', v)}
                    label={t('news.primaryProvider')}
                  />
                  {primaryProvider && (
                    <DynamicModelSelect
                      provider={primaryProvider}
                      value={primaryModel}
                      onChange={setPrimaryModel}
                      label={t('settings.model')}
                      fallbackModels={
                        LLM_PROVIDERS.find(
                          (p) => p.value === primaryProvider,
                        )?.models.map((m) => m.value) ?? []
                      }
                    />
                  )}
                </div>
              </div>

              {/* Fallback */}
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CustomSelect
                    options={[
                      { value: '', label: t('news.selectProvider') },
                      ...activeProviderOptions,
                    ]}
                    value={fallbackProvider}
                    onChange={(v) => handleProviderChange('fallback', v)}
                    label={t('news.fallbackProvider')}
                  />
                  {fallbackProvider && (
                    <DynamicModelSelect
                      provider={fallbackProvider}
                      value={fallbackModel}
                      onChange={setFallbackModel}
                      label={t('settings.model')}
                      fallbackModels={
                        LLM_PROVIDERS.find(
                          (p) => p.value === fallbackProvider,
                        )?.models.map((m) => m.value) ?? []
                      }
                    />
                  )}
                </div>
              </div>

              {!primaryProvider && !fallbackProvider && (
                <p className="text-[10px] text-muted-foreground/70 italic">
                  💡 {t('news.autoSuggestion')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Only summary toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
          <div>
            <p className="text-xs font-semibold">Solo noticias con resumen</p>
            <p className="text-[11px] text-muted-foreground">
              Excluye noticias sin contenido (recomendado)
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={onlySummary}
            onClick={() => setOnlySummary((v) => !v)}
            className={cn(
              'inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
              onlySummary ? 'bg-primary' : 'bg-muted-foreground/40',
            )}
          >
            <span
              className={cn(
                'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200',
                onlySummary ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </button>
        </div>

        {/* Sources */}
        <div>
          <p className="text-[11px] text-muted-foreground mb-2">
            Fuentes habilitadas (todas = vacío)
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_SOURCE_IDS.map((id) => (
              <button
                key={id}
                onClick={() => toggleSource(id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-[11px] font-medium transition-colors',
                  isEnabled(id)
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-muted border-border text-muted-foreground hover:border-primary/30',
                )}
              >
                {sourceLabel(id)}
              </button>
            ))}
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Guardar configuración
        </button>
      </div>
    </div>
  );
}
