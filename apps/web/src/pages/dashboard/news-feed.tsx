import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Newspaper,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Sparkles,
  RefreshCw,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  XCircle,
  X,
  Calendar,
  User,
  Globe,
  Settings,
  Save,
  Clock,
  Hash,
  Database,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTranslation } from 'react-i18next';
import {
  useMarketNews,
  useNewsAnalysis,
  useNewsConfig,
  useUpdateNewsConfig,
  useRunKeywordAnalysis,
  useRunAiAnalysis,
  type NewsItem,
  type NewsAnalysis,
  type NewsConfig,
} from '../../hooks/use-market';
import { toast } from 'sonner';

gsap.registerPlugin(useGSAP);

// ── Types ─────────────────────────────────────────────────────────────────────

type SentimentFilter = 'ALL' | 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

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
      { value: 'claude-haiku-3-5-20241022', label: 'Claude Haiku 3.5' },
      { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
    ],
  },
  {
    value: 'OPENAI',
    label: 'OpenAI',
    models: [
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    ],
  },
  {
    value: 'GROQ',
    label: 'Groq (Llama)',
    models: [
      { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (rápido)' },
      { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    ],
  },
];

// ── Constants ─────────────────────────────────────────────────────────────────

const LAST_PROVIDER_KEY = 'news_ai_last_provider';
const LAST_MODEL_KEY = 'news_ai_last_model';

const NEWS_COUNTS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

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

const SENTIMENT_CONFIG: Record<
  NewsItem['sentiment'],
  {
    label: string;
    icon: typeof TrendingUp;
    color: string;
    bg: string;
    border: string;
  }
> = {
  POSITIVE: {
    label: 'Positivo',
    icon: TrendingUp,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  NEGATIVE: {
    label: 'Negativo',
    icon: TrendingDown,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
  NEUTRAL: {
    label: 'Neutral',
    icon: Minus,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    border: 'border-border',
  },
};

// ── Analysis Summary Card (DB-driven) ────────────────────────────────────────

function AnalysisSummaryCard({
  analysis,
  onRunKeyword,
  isRunningKeyword,
  onRunAi,
  isRunningAi,
}: {
  analysis: NewsAnalysis | null | undefined;
  onRunKeyword: () => void;
  isRunningKeyword: boolean;
  onRunAi: (provider: string, model: string) => void;
  isRunningAi: boolean;
}) {
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(
    () => localStorage.getItem(LAST_PROVIDER_KEY) ?? 'CLAUDE',
  );
  const [selectedModel, setSelectedModel] = useState(
    () =>
      localStorage.getItem(LAST_MODEL_KEY) ?? LLM_PROVIDERS[0].models[0].value,
  );
  const providerObj =
    LLM_PROVIDERS.find((p) => p.value === selectedProvider) ?? LLM_PROVIDERS[0];

  const handleProviderChange = (val: string) => {
    setSelectedProvider(val);
    localStorage.setItem(LAST_PROVIDER_KEY, val);
    const first =
      LLM_PROVIDERS.find((p) => p.value === val)?.models[0].value ?? '';
    setSelectedModel(first);
    localStorage.setItem(LAST_MODEL_KEY, first);
  };
  const handleModelChange = (val: string) => {
    setSelectedModel(val);
    localStorage.setItem(LAST_MODEL_KEY, val);
  };

  // Decide which layer to display: AI if within 12h, else keyword
  const AI_VALID_MS = 12 * 60 * 60 * 1000;
  const hasAi = !!(
    analysis?.aiAnalyzedAt &&
    Date.now() - new Date(analysis.aiAnalyzedAt).getTime() < AI_VALID_MS
  );

  const positive = hasAi
    ? (analysis?.aiPositiveCount ?? 0)
    : (analysis?.positiveCount ?? 0);
  const negative = hasAi
    ? (analysis?.aiNegativeCount ?? 0)
    : (analysis?.negativeCount ?? 0);
  const neutral = hasAi
    ? (analysis?.aiNeutralCount ?? 0)
    : (analysis?.neutralCount ?? 0);
  const total = positive + negative + neutral;
  const score = hasAi ? (analysis?.aiScore ?? 0) : (analysis?.score ?? 0);
  const overall = hasAi
    ? (analysis?.aiOverallSentiment ?? 'NEUTRAL')
    : (analysis?.overallSentiment ?? 'NEUTRAL');
  const summary = hasAi ? analysis?.aiSummary : analysis?.summary;

  const overallColor =
    overall === 'BULLISH'
      ? 'text-emerald-400'
      : overall === 'BEARISH'
        ? 'text-red-400'
        : 'text-amber-400';
  const overallBg =
    overall === 'BULLISH'
      ? 'bg-emerald-500/10 border-emerald-500/25'
      : overall === 'BEARISH'
        ? 'bg-red-500/10 border-red-500/25'
        : 'bg-amber-500/10 border-amber-500/25';

  // Reclassifications
  const aiMap = new Map((analysis?.aiHeadlines ?? []).map((a) => [a.id, a]));
  const changed = (analysis?.headlines ?? []).filter((h) => {
    const ai = aiMap.get(h.id);
    return ai && ai.sentiment !== h.sentiment;
  });

  return (
    <div className="rounded-2xl border border-border bg-card mb-6">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/20">
        <Brain className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Resumen de Sentimiento</span>
        {hasAi && (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary">
            <Sparkles className="h-3 w-3" />
            IA activa
          </span>
        )}
        {analysis && (
          <span className="flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
            <Database className="h-2.5 w-2.5" />
            {timeAgo(analysis.analyzedAt)}
          </span>
        )}
        <span
          className={cn(
            'ml-auto rounded-full border px-3 py-0.5 text-xs font-bold',
            overallColor,
            overallBg,
          )}
        >
          {overall === 'BULLISH'
            ? 'Alcista'
            : overall === 'BEARISH'
              ? 'Bajista'
              : 'Neutral'}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Sentiment bar */}
        {analysis ? (
          <div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-400" />
                <span className="font-semibold text-emerald-400">
                  {positive} positivas
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Minus className="h-3 w-3 text-amber-400" />
                <span className="text-amber-400">{neutral} neutrales</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-red-400" />
                <span className="font-semibold text-red-400">
                  {negative} negativas
                </span>
              </div>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden flex">
              {positive > 0 && (
                <div
                  className="h-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${(positive / total) * 100}%` }}
                />
              )}
              {neutral > 0 && (
                <div
                  className="h-full bg-amber-500/50 transition-all duration-700"
                  style={{ width: `${(neutral / total) * 100}%` }}
                />
              )}
              {negative > 0 && (
                <div
                  className="h-full bg-red-500 transition-all duration-700"
                  style={{ width: `${(negative / total) * 100}%` }}
                />
              )}
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[11px]">
              <span className="text-muted-foreground">
                {total} noticias analizadas
              </span>
              <span className={cn('font-bold', overallColor)}>
                Score: {score > 0 ? '+' : ''}
                {score}
              </span>
            </div>
            {summary && (
              <p className="mt-2 text-[11px] text-muted-foreground/70 leading-relaxed">
                {summary}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              No hay análisis guardado aún.
            </p>
            <button
              onClick={onRunKeyword}
              disabled={isRunningKeyword}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {isRunningKeyword ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Generar análisis
            </button>
          </div>
        )}

        {/* AI analyzer controls */}
        {analysis && (
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-xs font-semibold">Análisis con IA</span>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  — reclasifica usando el LLM configurado y persiste en DB
                </span>
              </div>
              <button
                onClick={onRunKeyword}
                disabled={isRunningKeyword}
                title="Actualizar análisis keyword"
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 shrink-0"
              >
                <RefreshCw
                  className={cn(
                    'h-3.5 w-3.5',
                    isRunningKeyword && 'animate-spin',
                  )}
                />
                Actualizar
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              {/* Provider selector */}
              <div className="relative flex-1">
                <button
                  onClick={() => {
                    setShowProviderMenu((v) => !v);
                    setShowModelMenu(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs hover:border-primary/50 transition-colors"
                >
                  <span className="font-medium truncate">
                    {providerObj.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0',
                      showProviderMenu && 'rotate-180',
                    )}
                  />
                </button>
                {showProviderMenu && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-card shadow-lg">
                    {LLM_PROVIDERS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => {
                          handleProviderChange(p.value);
                          setShowProviderMenu(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted transition-colors',
                          selectedProvider === p.value &&
                            'bg-primary/10 text-primary font-semibold',
                        )}
                      >
                        {selectedProvider === p.value ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        ) : (
                          <div className="h-3.5 w-3.5 shrink-0" />
                        )}
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Model selector */}
              <div className="relative flex-1">
                <button
                  onClick={() => {
                    setShowModelMenu((v) => !v);
                    setShowProviderMenu(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs hover:border-primary/50 transition-colors"
                >
                  <span className="font-medium truncate">
                    {providerObj.models.find((m) => m.value === selectedModel)
                      ?.label ?? selectedModel}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0',
                      showModelMenu && 'rotate-180',
                    )}
                  />
                </button>
                {showModelMenu && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-card shadow-lg">
                    {providerObj.models.map((m) => (
                      <button
                        key={m.value}
                        onClick={() => {
                          handleModelChange(m.value);
                          setShowModelMenu(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted transition-colors',
                          selectedModel === m.value &&
                            'bg-primary/10 text-primary font-semibold',
                        )}
                      >
                        {selectedModel === m.value ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        ) : (
                          <div className="h-3.5 w-3.5 shrink-0" />
                        )}
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => onRunAi(selectedProvider, selectedModel)}
                disabled={isRunningAi}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunningAi ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Analizando…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Analizar con IA
                  </>
                )}
              </button>
            </div>

            {analysis.aiAnalyzedAt && (
              <p className="text-[10px] text-muted-foreground/60">
                Último análisis IA: {timeAgo(analysis.aiAnalyzedAt)}
                {!hasAi &&
                  ' — expiró (más de 12h). El bot usa análisis keyword.'}
                {hasAi && ' — activo. El bot usa este análisis.'}
              </p>
            )}

            {/* Reclassification diff */}
            {hasAi && changed.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {changed.length} reclasificaciones por IA
                </p>
                {changed.slice(0, 4).map((n) => {
                  const ai = aiMap.get(n.id)!;
                  return (
                    <div
                      key={n.id}
                      className="flex items-center gap-2 rounded-lg bg-muted/30 border border-border/50 px-3 py-2"
                    >
                      <XCircle className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                      <span
                        className={cn(
                          'text-[10px] font-bold uppercase shrink-0',
                          SENTIMENT_CONFIG[
                            n.sentiment as keyof typeof SENTIMENT_CONFIG
                          ]?.color ?? 'text-muted-foreground',
                        )}
                      >
                        {n.sentiment.slice(0, 3)}
                      </span>
                      <span className="text-muted-foreground/40 text-[10px] shrink-0">
                        →
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-bold uppercase shrink-0',
                          SENTIMENT_CONFIG[
                            ai.sentiment as keyof typeof SENTIMENT_CONFIG
                          ]?.color ?? 'text-muted-foreground',
                        )}
                      >
                        {ai.sentiment.slice(0, 3)}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate flex-1">
                        {n.headline}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── News Config Panel ─────────────────────────────────────────────────────────

const ALL_SOURCE_IDS = [
  'coingecko',
  'rss:coindesk',
  'rss:cointelegraph',
  'rss:bitcoinmagazine',
  'rss:theblock',
  'rss:beincrypto',
  'reddit',
];

function NewsConfigPanel({
  config,
  onSave,
  isSaving,
}: {
  config: NewsConfig | undefined;
  onSave: (data: Partial<NewsConfig>) => void;
  isSaving: boolean;
}) {
  const [interval, setInterval] = useState(config?.intervalMinutes ?? 30);
  const [count, setCount] = useState(config?.newsCount ?? 40);
  const [sources, setSources] = useState<string[]>(
    config?.enabledSources ?? [],
  );
  const [onlySummary, setOnlySummary] = useState(config?.onlySummary ?? true);
  const [botEnabled, setBotEnabled] = useState(config?.botEnabled ?? true);

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
            onClick={() => setBotEnabled((v) => !v)}
            className={cn(
              'h-5 w-9 rounded-full border transition-colors relative shrink-0',
              botEnabled
                ? 'bg-primary border-primary'
                : 'bg-muted border-border',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                botEnabled ? 'translate-x-4' : 'translate-x-0.5',
              )}
            />
          </button>
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
            onClick={() => setOnlySummary((v) => !v)}
            className={cn(
              'h-5 w-9 rounded-full border transition-colors relative shrink-0',
              onlySummary
                ? 'bg-primary border-primary'
                : 'bg-muted border-border',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                onlySummary ? 'translate-x-4' : 'translate-x-0.5',
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

// ── News Detail Modal ─────────────────────────────────────────────────────────

function NewsDetailModal({
  item,
  aiResult,
  onClose,
}: {
  item: NewsItem;
  aiResult?: AiHeadline;
  onClose: () => void;
}) {
  const effectiveSentiment = aiResult?.sentiment ?? item.sentiment;
  const s = SENTIMENT_CONFIG[effectiveSentiment];
  const SentimentIcon = s.icon;
  const changed = aiResult && aiResult.sentiment !== item.sentiment;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-card border border-border max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border shrink-0">
          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-muted-foreground truncate flex-1">
            {sourceLabel(item.source)}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
            <Calendar className="h-3 w-3" />
            {timeAgo(item.publishedAt)}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-muted transition-colors ml-1 shrink-0"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Sentiment badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border',
                s.bg,
                s.color,
                s.border,
              )}
            >
              <SentimentIcon className="h-3.5 w-3.5" />
              {s.label}
            </span>
            {changed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-1 text-[11px] font-semibold text-primary">
                <Sparkles className="h-3 w-3" />
                Reclasificado por IA
              </span>
            )}
          </div>

          {/* Headline */}
          <h2 className="text-base font-bold leading-snug">{item.headline}</h2>

          {/* Summary */}
          {item.summary && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Resumen
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.summary}
              </p>
            </div>
          )}

          {/* No content fallback */}
          {!item.summary && (
            <p className="text-[12px] text-muted-foreground/50 italic">
              Esta fuente no provee resumen. Hacé clic en "Ver artículo" para
              leer el contenido completo.
            </p>
          )}

          {/* AI reasoning */}
          {aiResult?.reasoning && (
            <div className="rounded-xl bg-primary/5 border border-primary/15 p-3.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Brain className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-semibold text-primary">
                  Análisis de IA
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {aiResult.reasoning}
              </p>
            </div>
          )}

          {/* Author */}
          {item.author && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span>{item.author}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Ver artículo completo
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── News Card ─────────────────────────────────────────────────────────────────

function NewsCard({
  item,
  aiResult,
  onOpen,
}: {
  item: NewsItem;
  aiResult?: AiHeadline;
  onOpen: () => void;
}) {
  const effectiveSentiment = aiResult?.sentiment ?? item.sentiment;
  const s = SENTIMENT_CONFIG[effectiveSentiment];
  const SentimentIcon = s.icon;
  const changed = aiResult && aiResult.sentiment !== item.sentiment;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className="news-card group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 cursor-pointer"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border',
              s.bg,
              s.color,
              s.border,
            )}
          >
            <SentimentIcon className="h-3 w-3" />
            {s.label}
          </span>
          {changed && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              IA
            </span>
          )}
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Abrir en nueva pestaña"
          className="shrink-0"
        >
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
        </a>
      </div>

      <p className="mb-2 line-clamp-3 text-sm font-medium leading-snug">
        {item.headline}
      </p>

      {item.summary && !aiResult?.reasoning && (
        <p className="mb-2 line-clamp-2 text-[11px] text-muted-foreground/60 leading-snug">
          {item.summary}
        </p>
      )}

      {aiResult?.reasoning && (
        <p className="mb-2 line-clamp-2 text-[11px] text-muted-foreground/70 italic leading-snug border-l-2 border-primary/20 pl-2">
          {aiResult.reasoning}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate">{sourceLabel(item.source)}</span>
        <span className="shrink-0">{timeAgo(item.publishedAt)}</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function NewsFeedPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<SentimentFilter>('ALL');
  const [showConfig, setShowConfig] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  const { data: config } = useNewsConfig();
  const { data: analysis } = useNewsAnalysis();
  const { data: news = [], isLoading } = useMarketNews(config?.newsCount ?? 40);
  const updateConfig = useUpdateNewsConfig();
  const runKeyword = useRunKeywordAnalysis();
  const runAi = useRunAiAnalysis();

  // Build AI overlay map from persisted analysis
  const AI_VALID_MS = 12 * 60 * 60 * 1000;
  const hasValidAi = !!(
    analysis?.aiAnalyzedAt &&
    Date.now() - new Date(analysis.aiAnalyzedAt).getTime() < AI_VALID_MS
  );
  const aiMap = new Map((analysis?.aiHeadlines ?? []).map((a) => [a.id, a]));

  const effectiveNews = news.map((n) => ({
    ...n,
    sentiment:
      ((hasValidAi ? aiMap.get(n.id)?.sentiment : undefined) as
        | 'POSITIVE'
        | 'NEGATIVE'
        | 'NEUTRAL'
        | undefined) ?? n.sentiment,
  }));

  const filtered =
    filter === 'ALL'
      ? effectiveNews
      : effectiveNews.filter((n) => n.sentiment === filter);

  const handleRunKeyword = () => {
    runKeyword.mutate(undefined, {
      onSuccess: () => toast.success('Análisis keyword actualizado'),
      onError: () => toast.error('Error al actualizar el análisis'),
    });
  };

  const handleRunAi = (provider: string, model: string) => {
    runAi.mutate(
      { provider, model },
      {
        onSuccess: () => toast.success('Análisis IA completado y guardado'),
        onError: (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('No LLM credential')) {
            toast.error(
              `Sin clave para ${provider}. Configurá en Ajustes > LLM.`,
            );
          } else {
            toast.error(`Error al analizar: ${msg}`);
          }
        },
      },
    );
  };

  useGSAP(
    () => {
      if (isLoading) return;
      gsap.fromTo(
        '.news-card',
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, stagger: 0.05, duration: 0.4, ease: 'power2.out' },
      );
    },
    { scope: containerRef, dependencies: [isLoading, filter, analysis?.id] },
  );

  return (
    <div ref={containerRef} className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center gap-4 justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">{t('sidebar.news')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t('news.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfig((v) => !v)}
            aria-label="Configuración de noticias"
            className={cn(
              'rounded-lg border p-2 transition-colors',
              showConfig
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'border-border hover:border-primary/50 text-muted-foreground',
            )}
          >
            <Settings className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            {(
              ['ALL', 'POSITIVE', 'NEGATIVE', 'NEUTRAL'] as SentimentFilter[]
            ).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  filter === s
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s === 'ALL'
                  ? t('news.all')
                  : s === 'POSITIVE'
                    ? t('news.positive')
                    : s === 'NEGATIVE'
                      ? t('news.negative')
                      : t('news.neutral')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Config panel (toggleable) */}
      {showConfig && (
        <NewsConfigPanel
          config={config}
          onSave={(data) =>
            updateConfig.mutate(data, {
              onSuccess: () => toast.success('Configuración guardada'),
              onError: () => toast.error('Error al guardar configuración'),
            })
          }
          isSaving={updateConfig.isPending}
        />
      )}

      {/* Analysis Summary + AI runner */}
      <AnalysisSummaryCard
        analysis={analysis}
        onRunKeyword={handleRunKeyword}
        isRunningKeyword={runKeyword.isPending}
        onRunAi={handleRunAi}
        isRunningAi={runAi.isPending}
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {t('common.empty')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            {t('news.apiKeyRequired')}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <NewsCard
              key={item.id}
              item={item}
              aiResult={hasValidAi ? aiMap.get(item.id) : undefined}
              onOpen={() => setSelectedNews(item)}
            />
          ))}
        </div>
      )}

      {selectedNews && (
        <NewsDetailModal
          item={selectedNews}
          aiResult={hasValidAi ? aiMap.get(selectedNews.id) : undefined}
          onClose={() => setSelectedNews(null)}
        />
      )}
    </div>
  );
}
