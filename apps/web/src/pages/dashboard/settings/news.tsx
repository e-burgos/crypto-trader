import { useState } from 'react';
import {
  Key,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Rss,
  RefreshCw,
} from 'lucide-react';
import { Button, InfoTooltip, Input } from '@crypto-trader/ui';
import { cn } from '../../../lib/utils';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useNewsSourcesStatus,
  useNewsApiKeys,
  useSetNewsApiKey,
  useDeleteNewsApiKey,
  useTestNewsApiKey,
} from '../../../hooks/use-user';
import { NewsConfigPanel } from '../../../containers/settings/news-config-panel';
import { useNewsConfig, useUpdateNewsConfig } from '../../../hooks/use-market';
import { toast } from 'sonner';

export function SettingsNewsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  // News Sources
  const {
    data: newsSources = [],
    isFetching: checkingNewsSources,
    refetch: recheckNewsSources,
  } = useNewsSourcesStatus();
  const { data: newsApiKeys = [] } = useNewsApiKeys();
  const { mutate: saveNewsApiKey, isPending: savingNewsKey } =
    useSetNewsApiKey();
  const { mutate: deleteNewsApiKey } = useDeleteNewsApiKey();
  const {
    mutate: testNewsApiKey,
    isPending: testingNewsKey,
    data: newsKeyTestResult,
    variables: testingNewsProvider,
    reset: resetNewsTest,
  } = useTestNewsApiKey();
  const [newsKeyForms, setNewsKeyForms] = useState<Record<string, string>>({});

  // News Config
  const { data: newsConfig } = useNewsConfig();
  const updateNewsConfig = useUpdateNewsConfig();

  const TOOLTIP_MAP: Record<string, string> = {
    coingecko: 'coingecko',
    'rss:coindesk': 'coindesk',
    'rss:cointelegraph': 'cointelegraph',
    'rss:bitcoinmagazine': 'bitcoinmagazine',
    'rss:theblock': 'theblock',
    'rss:beincrypto': 'beincrypto',
    reddit: 'reddit',
    newsdata: 'newsdata',
  };

  const freeSources = newsSources.filter((s) => !s.requiresApiKey);
  const optionalSources = newsSources.filter((s) => s.requiresApiKey);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Rss className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('settings.tabNews')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('settings.newsSubtitle')}
        </p>
      </div>

      {/* News Configuration */}
      <NewsConfigPanel
        config={newsConfig}
        onSave={(data) =>
          updateNewsConfig.mutate(data, {
            onSuccess: () => toast.success('Configuración guardada'),
            onError: () => toast.error('Error al guardar configuración'),
          })
        }
        isSaving={updateNewsConfig.isPending}
      />

      {/* Free always-on sources */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rss className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{t('settings.newsSources')}</h2>
          </div>
          <Button
            size="sm"
            variant="ghost"
            disabled={checkingNewsSources}
            onClick={() => {
              qc.invalidateQueries({
                queryKey: ['market', 'news-sources-status'],
              });
              recheckNewsSources();
            }}
          >
            <RefreshCw
              className={cn(
                'mr-1.5 h-3.5 w-3.5',
                checkingNewsSources && 'animate-spin',
              )}
            />
            {checkingNewsSources
              ? t('settings.checking')
              : t('settings.checkAll')}
          </Button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          {t('settings.noKeyNeeded')}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {freeSources.map((source) => (
            <div
              key={source.id}
              className="rounded-lg border border-border bg-background p-4"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate font-medium text-sm">
                    {source.label}
                  </span>
                  <InfoTooltip
                    text={t(`tooltips.${TOOLTIP_MAP[source.id] ?? 'reddit'}`)}
                  />
                </div>
                <span
                  className={cn(
                    'shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                    source.isReachable
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : checkingNewsSources
                        ? 'bg-amber-500/10 text-amber-500'
                        : 'bg-red-500/10 text-red-500',
                  )}
                >
                  {checkingNewsSources ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {t('settings.checking')}
                    </>
                  ) : source.isReachable ? (
                    <>
                      <CheckCircle className="h-3 w-3" />
                      {t('settings.reachable')}
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />
                      {t('settings.unreachable')}
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {source.description}
              </p>
              <p className="mt-1.5 text-xs font-medium text-primary/80">
                {t('settings.freeSource')}
              </p>
              {!source.isReachable && source.error && (
                <p
                  className="mt-1.5 truncate text-xs text-red-500"
                  title={source.error}
                >
                  {source.error}
                </p>
              )}
            </div>
          ))}

          {freeSources.length === 0 && checkingNewsSources && (
            <div className="col-span-2 flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('settings.checking')}
            </div>
          )}
        </div>
      </div>

      {/* Optional API-key sources */}
      {optionalSources.map((source) => {
        const storedKey = newsApiKeys.find(
          (k) => k.provider === source.id.toUpperCase(),
        );
        const formKey = newsKeyForms[source.id] ?? '';
        const isTestingThis =
          testingNewsKey && testingNewsProvider === source.id.toUpperCase();
        return (
          <div
            key={source.id}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-semibold">{source.label}</h2>
                    <InfoTooltip
                      text={t(
                        `tooltips.${TOOLTIP_MAP[source.id] ?? source.id}`,
                      )}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.optionalSource')}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  'shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                  source.isConfigured && source.isReachable
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : source.isConfigured && !source.isReachable
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {source.isConfigured && source.isReachable ? (
                  <>
                    <CheckCircle className="h-3 w-3" />
                    {t('settings.connected')}
                  </>
                ) : source.isConfigured && !source.isReachable ? (
                  <>
                    <XCircle className="h-3 w-3" />
                    {t('settings.unreachable')}
                  </>
                ) : (
                  t('settings.notConfigured')
                )}
              </span>
            </div>

            <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
              {source.description}
            </p>

            {source.signupUrl && (
              <p className="mb-3 text-xs text-muted-foreground">
                {t('settings.getApiKeyAt')}{' '}
                <a
                  href={source.signupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {source.signupUrl}
                </a>
              </p>
            )}

            <div className="flex flex-col gap-3">
              <Input
                type="password"
                value={formKey}
                onChange={(e) =>
                  setNewsKeyForms((prev) => ({
                    ...prev,
                    [source.id]: e.target.value,
                  }))
                }
                placeholder="API Key"
                className="font-mono text-sm"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={!formKey || savingNewsKey}
                  onClick={() => {
                    saveNewsApiKey(
                      {
                        provider: source.id.toUpperCase(),
                        apiKey: formKey,
                      },
                      {
                        onSuccess: () => {
                          setNewsKeyForms((prev) => ({
                            ...prev,
                            [source.id]: '',
                          }));
                          qc.invalidateQueries({
                            queryKey: ['market', 'news-sources-status'],
                          });
                          recheckNewsSources();
                        },
                      },
                    );
                  }}
                >
                  {t('settings.saveKey')}
                </Button>

                {storedKey?.isActive && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isTestingThis}
                      onClick={() => {
                        resetNewsTest();
                        testNewsApiKey(source.id.toUpperCase());
                      }}
                    >
                      {isTestingThis
                        ? t('settings.testing')
                        : t('settings.testConnection')}
                    </Button>
                    {newsKeyTestResult &&
                      testingNewsProvider === source.id.toUpperCase() && (
                        <span
                          className={cn(
                            'text-xs font-medium',
                            newsKeyTestResult.connected
                              ? 'text-emerald-500'
                              : 'text-red-500',
                          )}
                        >
                          {newsKeyTestResult.connected
                            ? t('settings.testSuccess')
                            : `${t('settings.testFailed')}: ${newsKeyTestResult.error}`}
                        </span>
                      )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-red-500 hover:text-red-600"
                      onClick={() => {
                        deleteNewsApiKey(source.id.toUpperCase());
                        qc.invalidateQueries({
                          queryKey: ['market', 'news-sources-status'],
                        });
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                      {t('settings.removeKey')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
