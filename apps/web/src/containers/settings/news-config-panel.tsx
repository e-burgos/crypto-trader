import { useState, useEffect } from 'react';
import { Settings, Clock, Hash, Brain, RefreshCw, Save } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
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
  const [interval, setInterval] = useState(config?.intervalMinutes ?? 10);
  const [count, setCount] = useState(config?.newsCount ?? 15);
  const [sources, setSources] = useState<string[]>(
    config?.enabledSources ?? [],
  );
  const [onlySummary, setOnlySummary] = useState(config?.onlySummary ?? true);
  const [botEnabled, setBotEnabled] = useState(config?.botEnabled ?? true);
  const [newsWeight, setNewsWeight] = useState(config?.newsWeight ?? 15);

  // Sync local state when config loads asynchronously
  useEffect(() => {
    if (config) {
      setInterval(config.intervalMinutes ?? 10);
      setCount(config.newsCount ?? 15);
      setSources(config.enabledSources ?? []);
      setOnlySummary(config.onlySummary ?? true);
      setBotEnabled(config.botEnabled ?? true);
      setNewsWeight(config.newsWeight ?? 15);
    }
  }, [config]);

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
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card mb-6">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/20">
        <Settings className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">{t('news.configTitle')}</span>
      </div>
      <div className="p-5 space-y-5">
        {/* Interval & Count */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1.5">
              <Clock className="h-3 w-3" />
              {t('news.analysisInterval')}
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
              {t('news.newsCount')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {NEWS_COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={cn(
                    'rounded-md px-2 py-2 min-w-[40px] text-[11px] font-medium border transition-colors',
                    count === n
                      ? 'bg-primary/10 text-primary-foreground border-primary'
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
            <p className="text-xs font-semibold">{t('news.botAnalyzesNews')}</p>
            <p className="text-[11px] text-muted-foreground">
              {t('news.botAnalyzesNewsDesc')}
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
                <p className="text-xs font-semibold">{t('news.newsWeight')}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t('news.newsWeightDesc')}
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
              <span>{t('news.weightTechnicalOnly')}</span>
              <span>{t('news.weightBalanced')}</span>
              <span>{t('news.weightNewsOnly')}</span>
            </div>
          </div>
        )}

        {/* LLM Provider/Model — gestionado por SIGMA en /settings/agents */}
        <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-semibold">{t('news.llmConfig')}</p>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {t('news.llmConfigNote')}
          </p>
        </div>

        {/* Only summary toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
          <div>
            <p className="text-xs font-semibold">{t('news.onlySummary')}</p>
            <p className="text-[11px] text-muted-foreground">
              {t('news.onlySummaryDesc')}
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
            {t('news.enabledSources')}
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
          {t('news.saveConfig')}
        </button>
      </div>
    </div>
  );
}
