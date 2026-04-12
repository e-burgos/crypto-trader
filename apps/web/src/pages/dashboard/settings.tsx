import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Key,
  User,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Rss,
  RefreshCw,
  BotMessageSquare,
  TrendingUp,
  TestTube2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { InfoTooltip } from '../../components/ui/info-tooltip';
import { PasswordInput } from '../../components/ui/password-input';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useQueryClient } from '@tanstack/react-query';
import {
  useUserProfile,
  useBinanceKeyStatus,
  useTestnetBinanceKeyStatus,
  useLLMKeys,
  useSetBinanceKeys,
  useDeleteBinanceKeys,
  useSetTestnetBinanceKeys,
  useDeleteTestnetBinanceKeys,
  useTestTestnetBinanceConnection,
  useSetLLMKey,
  useDeleteLLMKey,
  useUpdateProfile,
  useTestBinanceConnection,
  useTestLLMKey,
  useNewsSourcesStatus,
  useNewsApiKeys,
  useSetNewsApiKey,
  useDeleteNewsApiKey,
  useTestNewsApiKey,
} from '../../hooks/use-user';

const LLM_PROVIDERS = [
  {
    value: 'CLAUDE',
    label: 'Anthropic Claude',
    models: [
      'claude-opus-4-5',
      'claude-3-5-sonnet-20241022',
      'claude-3-haiku-20240307',
    ],
  },
  {
    value: 'OPENAI',
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  },
  {
    value: 'GROQ',
    label: 'Groq',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  },
];

type Tab = 'profile' | 'exchange' | 'ai' | 'news';

export function SettingsPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get('tab') as Tab | null;
    return tab && ['profile', 'exchange', 'ai', 'news'].includes(tab)
      ? tab
      : 'profile';
  });

  // Sync tab when URL param changes
  useEffect(() => {
    const tab = searchParams.get('tab') as Tab | null;
    if (tab && ['profile', 'exchange', 'ai', 'news'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Profile
  const { data: profile } = useUserProfile();
  const { mutate: updateProfile, isPending: savingProfile } =
    useUpdateProfile();
  const [profileForm, setProfileForm] = useState({ email: '', password: '' });

  // Binance Keys
  const { data: binanceStatus } = useBinanceKeyStatus();
  const { mutate: saveBinanceKeys, isPending: savingBinance } =
    useSetBinanceKeys();
  const { mutate: deleteBinanceKeys, isPending: deletingBinance } =
    useDeleteBinanceKeys();
  const [binanceForm, setBinanceForm] = useState({ apiKey: '', apiSecret: '' });

  // Binance Testnet Keys
  const { data: testnetStatus } = useTestnetBinanceKeyStatus();
  const { mutate: saveTestnetKeys, isPending: savingTestnet } =
    useSetTestnetBinanceKeys();
  const { mutate: deleteTestnetKeys, isPending: deletingTestnet } =
    useDeleteTestnetBinanceKeys();
  const [testnetForm, setTestnetForm] = useState({ apiKey: '', apiSecret: '' });
  const {
    mutate: testTestnet,
    isPending: testingTestnet,
    data: testnetTestResult,
    reset: resetTestnetTest,
  } = useTestTestnetBinanceConnection();

  // LLM Keys
  const { data: llmKeys = [] } = useLLMKeys();
  const { mutate: saveLLMKey, isPending: savingLLM } = useSetLLMKey();
  const { mutate: deleteLLMKey } = useDeleteLLMKey();
  const [llmForms, setLlmForms] = useState<
    Record<string, { apiKey: string; model: string }>
  >({});

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
  const qc = useQueryClient();

  // Connection tests
  const {
    mutate: testBinance,
    isPending: testingBinance,
    data: binanceTestResult,
    reset: resetBinanceTest,
  } = useTestBinanceConnection();
  const {
    mutate: testLLM,
    isPending: testingLLM,
    data: llmTestResult,
    variables: llmTestProvider,
    reset: resetLLMTest,
  } = useTestLLMKey();

  useGSAP(
    () => {
      gsap.fromTo(
        '.tab-content',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' },
      );
    },
    { scope: containerRef, dependencies: [activeTab] },
  );

  function getLLMKeyStatus(provider: string) {
    return llmKeys.find((k) => k.provider === provider);
  }

  function getLLMForm(provider: string) {
    return (
      llmForms[provider] ?? {
        apiKey: '',
        model: LLM_PROVIDERS.find((p) => p.value === provider)?.models[0] ?? '',
      }
    );
  }

  const TABS: {
    id: Tab;
    label: string;
    icon: React.ReactNode;
    badge?: React.ReactNode;
  }[] = [
    {
      id: 'profile',
      label: t('settings.tabProfile'),
      icon: <User className="h-4 w-4" />,
    },
    {
      id: 'exchange',
      label: t('settings.tabExchange'),
      icon: <TrendingUp className="h-4 w-4" />,
      badge: binanceStatus?.hasKeys ? (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      ) : null,
    },
    {
      id: 'ai',
      label: t('settings.tabAiModels'),
      icon: <BotMessageSquare className="h-4 w-4" />,
      badge:
        llmKeys.length > 0 ? (
          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-500">
            {llmKeys.length}
          </span>
        ) : null,
    },
    {
      id: 'news',
      label: t('settings.tabNews'),
      icon: <Rss className="h-4 w-4" />,
      badge:
        newsSources.length > 0 ? (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            {newsSources.filter((s) => s.isReachable).length}/
            {newsSources.length}
          </span>
        ) : null,
    },
  ];

  return (
    <div ref={containerRef} className="p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('settings.subtitle')}
        </p>
      </div>

      {/* Tabs nav */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="tab-content">
        {/* ── Profile ─────────────────────────────────── */}
        {activeTab === 'profile' && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">{t('settings.profile')}</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {t('settings.email')}
                </label>
                <input
                  type="email"
                  placeholder={profile?.email ?? ''}
                  value={profileForm.email}
                  onChange={(e) =>
                    setProfileForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {t('settings.password')}
                </label>
                <PasswordInput
                  value={profileForm.password}
                  onChange={(e) =>
                    setProfileForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder="Leave blank to keep current"
                />
              </div>
              <Button
                size="sm"
                disabled={
                  savingProfile || (!profileForm.email && !profileForm.password)
                }
                onClick={() => {
                  const data: { email?: string; password?: string } = {};
                  if (profileForm.email) data.email = profileForm.email;
                  if (profileForm.password)
                    data.password = profileForm.password;
                  updateProfile(data, {
                    onSuccess: () =>
                      setProfileForm({ email: '', password: '' }),
                  });
                }}
              >
                {savingProfile && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t('settings.saveProfile')}
              </Button>
            </div>
          </div>
        )}

        {/* ── Exchange (Binance) ───────────────────────── */}
        {activeTab === 'exchange' && (
          <div className="space-y-4">
            {/* Production keys */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">{t('settings.binanceKeys')}</h2>
                  <InfoTooltip text={t('tooltips.binanceKeys')} />
                </div>
                <span
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                    binanceStatus?.hasKeys
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {binanceStatus?.hasKeys ? (
                    <>
                      <CheckCircle className="h-3 w-3" />{' '}
                      {t('settings.connected')}
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />{' '}
                      {t('settings.disconnected')}
                    </>
                  )}
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {t('settings.apiKey')}
                  </label>
                  <input
                    type="text"
                    value={binanceForm.apiKey}
                    onChange={(e) =>
                      setBinanceForm((f) => ({ ...f, apiKey: e.target.value }))
                    }
                    placeholder="Your Binance API Key"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {t('settings.apiSecret')}
                  </label>
                  <PasswordInput
                    value={binanceForm.apiSecret}
                    onChange={(e) =>
                      setBinanceForm((f) => ({
                        ...f,
                        apiSecret: e.target.value,
                      }))
                    }
                    placeholder="Your Binance API Secret"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Create a read+spot trading API key in{' '}
                  <a
                    href="https://www.binance.com/en/my/settings/api-management"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Binance API Management
                  </a>
                  . Do NOT enable withdrawals.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    disabled={
                      savingBinance ||
                      !binanceForm.apiKey ||
                      !binanceForm.apiSecret
                    }
                    onClick={() =>
                      saveBinanceKeys(binanceForm, {
                        onSuccess: () => {
                          setBinanceForm({ apiKey: '', apiSecret: '' });
                          resetBinanceTest();
                        },
                      })
                    }
                  >
                    {savingBinance && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t('settings.saveKeys')}
                  </Button>
                  {binanceStatus?.hasKeys && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={testingBinance}
                        onClick={() => testBinance()}
                      >
                        {testingBinance && (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        )}
                        {testingBinance
                          ? t('settings.testing')
                          : t('settings.testConnection')}
                      </Button>
                      {binanceTestResult && (
                        <span
                          className={cn(
                            'text-xs font-medium',
                            binanceTestResult.connected
                              ? 'text-emerald-500'
                              : 'text-red-500',
                          )}
                        >
                          {binanceTestResult.connected
                            ? t('settings.testSuccess')
                            : `${t('settings.testFailed')}: ${binanceTestResult.error}`}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-red-500 hover:text-red-600"
                        disabled={deletingBinance}
                        onClick={() => deleteBinanceKeys()}
                      >
                        <Trash2 className="h-3 w-3" />
                        {t('settings.disconnectBinance')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Testnet keys */}
            <div className="rounded-xl border border-sky-500/20 bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TestTube2 className="h-4 w-4 text-sky-400" />
                  <h2 className="font-semibold">
                    {t('settings.binanceTestnetKeys')}
                  </h2>
                </div>
                <span
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                    testnetStatus?.hasKeys
                      ? 'bg-sky-500/10 text-sky-400'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {testnetStatus?.hasKeys ? (
                    <>
                      <CheckCircle className="h-3 w-3" />{' '}
                      {t('settings.connected')}
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />{' '}
                      {t('settings.disconnected')}
                    </>
                  )}
                </span>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                {t('settings.binanceTestnetTip')}
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {t('settings.binanceTestnetApiKey')}
                  </label>
                  <input
                    type="text"
                    value={testnetForm.apiKey}
                    onChange={(e) =>
                      setTestnetForm((f) => ({ ...f, apiKey: e.target.value }))
                    }
                    placeholder="Your Binance Testnet API Key"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500/50"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {t('settings.binanceTestnetApiSecret')}
                  </label>
                  <PasswordInput
                    value={testnetForm.apiSecret}
                    onChange={(e) =>
                      setTestnetForm((f) => ({
                        ...f,
                        apiSecret: e.target.value,
                      }))
                    }
                    placeholder="Your Binance Testnet API Secret"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    disabled={
                      savingTestnet ||
                      !testnetForm.apiKey ||
                      !testnetForm.apiSecret
                    }
                    onClick={() =>
                      saveTestnetKeys(testnetForm, {
                        onSuccess: () => {
                          setTestnetForm({ apiKey: '', apiSecret: '' });
                          resetTestnetTest();
                        },
                      })
                    }
                  >
                    {savingTestnet && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t('settings.saveKeys')}
                  </Button>
                  {testnetStatus?.hasKeys && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={testingTestnet}
                        onClick={() => testTestnet()}
                      >
                        {testingTestnet && (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        )}
                        {testingTestnet
                          ? t('settings.testing')
                          : t('settings.testConnection')}
                      </Button>
                      {testnetTestResult && (
                        <span
                          className={cn(
                            'text-xs font-medium',
                            testnetTestResult.connected
                              ? 'text-emerald-500'
                              : 'text-red-500',
                          )}
                        >
                          {testnetTestResult.connected
                            ? t('settings.testSuccess')
                            : `${t('settings.testFailed')}: ${testnetTestResult.error}`}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-red-500 hover:text-red-600"
                        disabled={deletingTestnet}
                        onClick={() => deleteTestnetKeys()}
                      >
                        <Trash2 className="h-3 w-3" />
                        {t('settings.disconnectBinance')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── AI Models (LLM) ──────────────────────────── */}
        {activeTab === 'ai' && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <BotMessageSquare className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">{t('settings.llmKeys')}</h2>
            </div>
            <div className="space-y-4">
              {LLM_PROVIDERS.map((provider) => {
                const status = getLLMKeyStatus(provider.value);
                const form = getLLMForm(provider.value);
                return (
                  <div
                    key={provider.value}
                    className="rounded-lg border border-border p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {provider.label}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          status?.isActive
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {status?.isActive
                          ? t('settings.active')
                          : t('settings.inactive')}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium">
                          API Key
                        </label>
                        <PasswordInput
                          placeholder="sk-..."
                          value={form.apiKey}
                          onChange={(e) =>
                            setLlmForms((f) => ({
                              ...f,
                              [provider.value]: {
                                ...(f[provider.value] ?? {
                                  model: provider.models[0],
                                }),
                                apiKey: e.target.value,
                              },
                            }))
                          }
                          className="px-2 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">
                          {t('settings.model')}
                        </label>
                        <select
                          value={form.model}
                          onChange={(e) =>
                            setLlmForms((f) => ({
                              ...f,
                              [provider.value]: {
                                ...(f[provider.value] ?? { apiKey: '' }),
                                model: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          {provider.models.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        disabled={savingLLM || !form.apiKey}
                        onClick={() =>
                          saveLLMKey(
                            {
                              provider: provider.value,
                              apiKey: form.apiKey,
                              selectedModel: form.model,
                            },
                            {
                              onSuccess: () => {
                                setLlmForms((f) => ({
                                  ...f,
                                  [provider.value]: {
                                    apiKey: '',
                                    model: provider.models[0],
                                  },
                                }));
                                resetLLMTest();
                              },
                            },
                          )
                        }
                      >
                        {savingLLM && (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        )}
                        {t('common.save')}
                      </Button>
                      {status?.isActive && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={testingLLM}
                            onClick={() => testLLM(provider.value)}
                          >
                            {testingLLM &&
                              llmTestProvider === provider.value && (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              )}
                            {testingLLM && llmTestProvider === provider.value
                              ? t('settings.testing')
                              : t('settings.testConnection')}
                          </Button>
                          {llmTestResult &&
                            llmTestProvider === provider.value && (
                              <span
                                className={cn(
                                  'text-xs font-medium',
                                  llmTestResult.connected
                                    ? 'text-emerald-500'
                                    : 'text-red-500',
                                )}
                              >
                                {llmTestResult.connected
                                  ? t('settings.testSuccess')
                                  : `${t('settings.testFailed')}: ${llmTestResult.error}`}
                              </span>
                            )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5 text-red-500 hover:text-red-600"
                            onClick={() => deleteLLMKey(provider.value)}
                          >
                            <Trash2 className="h-3 w-3" />
                            {t('settings.remove')}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── News Sources ─────────────────────────────── */}
        {activeTab === 'news' &&
          (() => {
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
              <div className="space-y-4">
                {/* Free always-on sources */}
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Rss className="h-4 w-4 text-primary" />
                      <h2 className="font-semibold">
                        {t('settings.newsSources')}
                      </h2>
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
                              text={t(
                                `tooltips.${TOOLTIP_MAP[source.id] ?? 'reddit'}`,
                              )}
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
                    testingNewsKey &&
                    testingNewsProvider === source.id.toUpperCase();
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
                        <PasswordInput
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
                                      queryKey: [
                                        'market',
                                        'news-sources-status',
                                      ],
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
                                testingNewsProvider ===
                                  source.id.toUpperCase() && (
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
          })()}
      </div>
    </div>
  );
}
