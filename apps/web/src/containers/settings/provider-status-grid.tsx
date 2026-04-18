import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { useProviderStatuses, type ProviderStatus } from '../../hooks/use-llm';

// ── Constants ────────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  CLAUDE: 'Anthropic (Claude)',
  OPENAI: 'OpenAI',
  GROQ: 'Groq',
  GEMINI: 'Google Gemini',
  MISTRAL: 'Mistral AI',
  TOGETHER: 'Together AI',
};

const AVAILABILITY_STYLES: Record<
  string,
  { dot: string; bar: string; text: string }
> = {
  AVAILABLE: {
    dot: 'bg-green-400',
    bar: 'bg-green-400/80',
    text: 'text-green-400',
  },
  LIMITED: {
    dot: 'bg-yellow-400',
    bar: 'bg-yellow-400/80',
    text: 'text-yellow-400',
  },
  UNAVAILABLE: {
    dot: 'bg-red-400',
    bar: 'bg-red-400/80',
    text: 'text-red-400',
  },
};

const SOURCE_COLORS: Record<string, string> = {
  TRADING: 'text-blue-400',
  CHAT: 'text-purple-400',
  ANALYSIS: 'text-amber-400',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function timeAgo(
  iso: string,
  t: (key: string, opts?: object) => string,
): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)
    return t('providerStatus.justNow', { defaultValue: 'just now' });
  if (mins < 60)
    return t('providerStatus.minsAgo', {
      defaultValue: '{{count}} min ago',
      count: mins,
    });
  const hours = Math.floor(mins / 60);
  return t('providerStatus.hoursAgo', {
    defaultValue: '{{count}}h ago',
    count: hours,
  });
}

// ── AvailabilityBar ──────────────────────────────────────────────────────────

function AvailabilityBar({
  score,
  availability,
}: {
  score: number;
  availability: string;
}) {
  const style =
    AVAILABILITY_STYLES[availability] ?? AVAILABILITY_STYLES.UNAVAILABLE;
  const filled = Math.round(score / 10);
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-2 w-2.5 rounded-[2px] transition-colors',
              i < filled ? style.bar : 'bg-muted/40',
            )}
          />
        ))}
      </div>
      <span className={cn('text-xs font-medium', style.text)}>{score}</span>
    </div>
  );
}

// ── MiniSparkline ────────────────────────────────────────────────────────────

function MiniSparkline({ data }: { data: { costUsd: number }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.costUsd), 0.0001);
  return (
    <div className="flex h-6 items-end gap-px">
      {data.slice(-14).map((d, i) => {
        const pct = (d.costUsd / max) * 100;
        return (
          <div
            key={i}
            className="flex-1 rounded-t bg-primary/50 transition-colors hover:bg-primary"
            style={{ height: `${Math.max(pct, 4)}%` }}
          />
        );
      })}
    </div>
  );
}

// ── ProviderStatusCard ───────────────────────────────────────────────────────

function ProviderStatusCard({ status }: { status: ProviderStatus }) {
  const { t } = useTranslation();
  const style =
    AVAILABILITY_STYLES[status.availability] ?? AVAILABILITY_STYLES.UNAVAILABLE;
  const label = PROVIDER_LABELS[status.provider] ?? status.provider;

  const totalCalls = status.usage.totalCalls;
  const totalSources =
    status.usage.bySource.reduce((a, s) => a + s.calls, 0) || 1;

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 transition-colors hover:bg-card/70">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('h-2.5 w-2.5 rounded-full', style.dot)} />
          <h3 className="text-sm font-semibold">{label}</h3>
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-medium',
            status.keyStatus === 'ACTIVE'
              ? 'bg-green-400/15 text-green-400'
              : status.keyStatus === 'INACTIVE'
                ? 'bg-muted text-muted-foreground'
                : 'bg-red-400/15 text-red-400',
          )}
        >
          {status.keyStatus}
        </span>
      </div>

      {/* Availability bar */}
      <AvailabilityBar
        score={status.availabilityScore}
        availability={status.availability}
      />
      {status.reason && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          {status.reason}
        </p>
      )}

      {/* Tokens */}
      <div className="mt-3 space-y-0.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
          {t('providerStatus.tokens', { defaultValue: 'Tokens' })}
        </p>
        <div className="grid grid-cols-2 gap-x-3 text-xs">
          <span className="text-muted-foreground">
            {t('providerStatus.input', { defaultValue: 'Input' })}
          </span>
          <span className="text-right font-medium">
            {formatTokens(status.usage.totalTokensIn)}
          </span>
          <span className="text-muted-foreground">
            {t('providerStatus.output', { defaultValue: 'Output' })}
          </span>
          <span className="text-right font-medium">
            {formatTokens(status.usage.totalTokensOut)}
          </span>
        </div>
      </div>

      {/* Cost + sparkline */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {t('providerStatus.estimated', { defaultValue: 'Est. Cost' })}
          </span>
          <span className="font-semibold">
            {formatCost(status.usage.estimatedCostUsd)}
          </span>
        </div>
        <div className="mt-1">
          <MiniSparkline data={status.usage.dailySeries} />
        </div>
      </div>

      {/* Usage breakdown */}
      {totalCalls > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              {totalCalls}{' '}
              {t('providerStatus.calls', { defaultValue: 'calls' })}
            </span>
            {status.usage.totalErrors > 0 && (
              <span className="text-red-400">
                {status.usage.totalErrors}{' '}
                {t('providerStatus.errors', { defaultValue: 'errors' })}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-2 text-[10px]">
            {status.usage.bySource.map((s) => (
              <span
                key={s.source}
                className={SOURCE_COLORS[s.source] ?? 'text-muted-foreground'}
              >
                {s.source} {Math.round((s.calls / totalSources) * 100)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Rate limits */}
      {status.rateLimits ? (
        <div className="mt-3 space-y-0.5 text-xs">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
            {t('providerStatus.rateLimits', { defaultValue: 'Rate Limits' })}
          </p>
          {status.rateLimits.tokensRemaining !== null &&
            status.rateLimits.tokensLimit !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tokens</span>
                <span className="font-medium">
                  {formatTokens(status.rateLimits.tokensRemaining)} /{' '}
                  {formatTokens(status.rateLimits.tokensLimit)} (
                  {Math.round(
                    (status.rateLimits.tokensRemaining /
                      status.rateLimits.tokensLimit) *
                      100,
                  )}
                  %)
                </span>
              </div>
            )}
          {status.rateLimits.requestsRemaining !== null &&
            status.rateLimits.requestsLimit !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Requests</span>
                <span className="font-medium">
                  {status.rateLimits.requestsRemaining} /{' '}
                  {status.rateLimits.requestsLimit}
                </span>
              </div>
            )}
        </div>
      ) : (
        <div className="mt-3 text-[10px] text-muted-foreground/50">
          {t('providerStatus.noRateLimits', {
            defaultValue: 'Rate limits not available',
          })}
        </div>
      )}

      {/* Last success */}
      <div className="mt-3 text-[10px] text-muted-foreground/60">
        {status.lastSuccessAt
          ? `${t('providerStatus.lastSuccess', { defaultValue: 'Last success' })}: ${timeAgo(status.lastSuccessAt, t)}`
          : t('providerStatus.neverUsed', { defaultValue: 'Never used' })}
      </div>
    </div>
  );
}

// ── ProviderStatusGrid ───────────────────────────────────────────────────────

export function ProviderStatusGrid() {
  const { t } = useTranslation();
  const {
    data: statuses,
    isLoading,
    refetch,
    isFetching,
  } = useProviderStatuses();
  const prevStatuses = useRef<Map<string, string>>(new Map());

  // Proactive toast when a provider becomes UNAVAILABLE
  useEffect(() => {
    if (!statuses) return;
    for (const s of statuses) {
      const prev = prevStatuses.current.get(s.provider);
      if (prev && prev !== 'UNAVAILABLE' && s.availability === 'UNAVAILABLE') {
        const label = PROVIDER_LABELS[s.provider] ?? s.provider;
        toast.error(
          t('providerStatus.unavailableToast', {
            defaultValue:
              '{{provider}} is now unavailable. Agents using it will fall back to secondary provider.',
            provider: label,
          }),
        );
      }
      prevStatuses.current.set(s.provider, s.availability);
    }
  }, [statuses, t]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!statuses || statuses.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">
            {t('providerStatus.title', {
              defaultValue: 'LLM Provider Status',
            })}
          </h2>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
          {t('providerStatus.refresh', { defaultValue: 'Refresh' })}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {statuses.map((status) => (
          <ProviderStatusCard key={status.provider} status={status} />
        ))}
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground/50">
        {t('providerStatus.disclaimer', {
          defaultValue:
            'Costs are estimates based on published pricing and may differ from actual billing.',
        })}
      </p>
    </div>
  );
}
