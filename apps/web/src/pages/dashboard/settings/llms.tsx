import { useState } from 'react';
import {
  Key,
  Trash2,
  Loader2,
  RefreshCw,
  BotMessageSquare,
  ExternalLink,
  BarChart3,
  Star,
  AlertTriangle,
  Ban,
} from 'lucide-react';
import { Button, Input } from '@crypto-trader/ui';
import { cn } from '../../../lib/utils';
import { useTranslation } from 'react-i18next';
import {
  useLLMKeys,
  useSetLLMKey,
  useDeleteLLMKey,
  useUpdateLLMModel,
  useTestLLMKey,
  useValidateAllLLMKeys,
  usePlatformLLMStatus,
} from '../../../hooks/use-user';
import { DynamicModelSelect } from '../../../containers/settings/dynamic-model-select';
import { AIUsageDashboard } from '../../../containers/settings/ai-usage-dashboard';
import { ProviderStatusGrid } from '../../../containers/settings/provider-status-grid';
import { OpenRouterPrimaryTab } from '../../../containers/settings/openrouter-primary-tab';

const LLM_PROVIDERS = [
  {
    value: 'CLAUDE',
    label: 'Anthropic Claude',
    models: [
      'claude-sonnet-4-20250514',
      'claude-opus-4-5',
      'claude-3-5-sonnet-20241022',
      'claude-3-haiku-20240307',
    ],
    helpLink: 'https://console.anthropic.com/settings/keys',
    helpLinkText: 'console.anthropic.com',
  },
  {
    value: 'OPENAI',
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini'],
    helpLink: 'https://platform.openai.com/api-keys',
    helpLinkText: 'platform.openai.com',
  },
  {
    value: 'GROQ',
    label: 'Groq',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    helpLink: 'https://console.groq.com/keys',
    helpLinkText: 'console.groq.com',
  },
  {
    value: 'GEMINI',
    label: 'Google Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'],
    helpLink: 'https://aistudio.google.com/apikey',
    helpLinkText: 'aistudio.google.com',
  },
  {
    value: 'MISTRAL',
    label: 'Mistral AI',
    models: [
      'mistral-small-latest',
      'mistral-medium-latest',
      'mistral-large-latest',
    ],
    helpLink: 'https://console.mistral.ai/api-keys/',
    helpLinkText: 'console.mistral.ai',
  },
  {
    value: 'TOGETHER',
    label: 'Together AI',
    models: [
      'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
      'meta-llama/Llama-4-Scout-17B-16E-Instruct',
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    ],
    helpLink: 'https://api.together.xyz/settings/api-keys',
    helpLinkText: 'api.together.xyz',
  },
  {
    value: 'OPENROUTER',
    label: 'OpenRouter',
    models: [], // Resolved dynamically via useOpenRouterModels hook
    helpLink: 'https://openrouter.ai/keys',
    helpLinkText: 'openrouter.ai',
  },
];

type AISubTab = 'primary' | 'providers' | 'analytics';

export function SettingsLLMsPage() {
  const { t } = useTranslation();
  const [aiSubTab, setAiSubTab] = useState<AISubTab>('primary');

  // LLM Keys
  const { data: llmKeys = [] } = useLLMKeys();
  const { data: platformStatus = [] } = usePlatformLLMStatus();
  const hasActiveKey = llmKeys.some((k) => k.isActive);
  const { mutate: saveLLMKey, isPending: savingLLM } = useSetLLMKey();
  const { mutate: deleteLLMKey } = useDeleteLLMKey();
  const { mutate: updateLLMModel } = useUpdateLLMModel();
  const [llmForms, setLlmForms] = useState<
    Record<string, { apiKey: string; model: string }>
  >({});

  // Auto-validate all LLM keys
  const {
    data: llmValidation,
    isLoading: validatingLLMKeys,
    refetch: revalidateLLMKeys,
  } = useValidateAllLLMKeys(llmKeys.length > 0);

  const {
    mutate: testLLM,
    isPending: testingLLM,
    data: llmTestResult,
    variables: llmTestProvider,
    reset: resetLLMTest,
  } = useTestLLMKey();

  function getLLMKeyStatus(provider: string) {
    return llmKeys.find((k) => k.provider === provider);
  }

  function getLLMForm(provider: string) {
    const saved = getLLMKeyStatus(provider);
    return (
      llmForms[provider] ?? {
        apiKey: '',
        model: saved?.selectedModel ?? '',
      }
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <BotMessageSquare className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('settings.llmsTitle')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('settings.llmsSubtitle')}
        </p>
      </div>

      {/* No-key banner */}
      {!hasActiveKey && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="font-medium text-amber-300">
              {t('settings.llms.noKeyBannerTitle', {
                defaultValue: 'API key required',
              })}
            </p>
            <p className="mt-0.5 text-amber-400/80">
              {t('settings.llms.noKeyBannerDesc', {
                defaultValue:
                  'You need to configure at least one active API key to access the platform. Add your OpenRouter key below and test the connection.',
              })}
            </p>
          </div>
        </div>
      )}

      {/* AI Subtab Navigation */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        <button
          onClick={() => setAiSubTab('primary')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
            aiSubTab === 'primary'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Star className="h-4 w-4" />
          <span className="hidden sm:inline">
            {t('settings.aiSubTabs.primary', {
              defaultValue: 'Primary Provider',
            })}
          </span>
        </button>
        <button
          onClick={() => setAiSubTab('providers')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
            aiSubTab === 'providers'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Key className="h-4 w-4" />
          <span className="hidden sm:inline">
            {t('settings.aiSubTabs.providers', {
              defaultValue: 'Other Providers',
            })}
          </span>
        </button>
        <button
          onClick={() => setAiSubTab('analytics')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
            aiSubTab === 'analytics'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">
            {t('settings.aiSubTabs.analytics')}
          </span>
        </button>
      </div>

      {/* Subtab content */}
      {aiSubTab === 'primary' && (
        <OpenRouterPrimaryTab
          llmKeys={llmKeys}
          llmValidation={llmValidation}
          validatingLLMKeys={validatingLLMKeys}
          savingLLM={savingLLM}
          testingLLM={testingLLM}
          llmTestProvider={llmTestProvider}
          llmTestResult={llmTestResult}
          onSave={(data) =>
            saveLLMKey(data, {
              onSuccess: () => resetLLMTest(),
            })
          }
          onTest={(provider) => testLLM(provider)}
          onDelete={(provider) => deleteLLMKey(provider)}
        />
      )}

      {aiSubTab === 'providers' && (
        <>
          {/* Banner suggesting OpenRouter */}
          <div className="mb-4 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-sm text-muted-foreground">
              <Star className="mr-1 inline h-4 w-4 text-primary" />
              {t('settings.openrouter.bannerHint', {
                defaultValue:
                  'With OpenRouter you can access all these providers with a single API key.',
              })}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setAiSubTab('primary')}
              className="shrink-0 text-primary"
            >
              {t('settings.openrouter.configureCta', {
                defaultValue: 'Configure OpenRouter',
              })}
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BotMessageSquare className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">{t('settings.llmKeys')}</h2>
                {llmValidation && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      llmValidation.active > 0
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-red-500/10 text-red-500',
                    )}
                  >
                    {llmValidation.active}/{llmValidation.total}{' '}
                    {t('settings.available')}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={validatingLLMKeys}
                onClick={() => revalidateLLMKeys()}
              >
                {validatingLLMKeys ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-3 w-3" />
                )}
                {validatingLLMKeys
                  ? t('settings.validating')
                  : t('settings.revalidate')}
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {LLM_PROVIDERS.filter((p) => p.value !== 'OPENROUTER').map(
                (provider) => {
                  const status = getLLMKeyStatus(provider.value);
                  const form = getLLMForm(provider.value);
                  const validation = llmValidation?.results.find(
                    (r) => r.provider === provider.value,
                  );
                  const platformProvider = platformStatus.find(
                    (p) => p.provider === provider.value,
                  );
                  const isDisabledByAdmin =
                    platformProvider?.isActive === false;
                  const manualTestFailed =
                    status?.isActive &&
                    llmTestResult &&
                    llmTestProvider === provider.value &&
                    !llmTestResult.connected;
                  const resolvedStatus = isDisabledByAdmin
                    ? 'DISABLED'
                    : manualTestFailed
                      ? 'INVALID'
                      : (validation?.status ??
                        (status?.isActive ? 'ACTIVE' : 'INACTIVE'));
                  return (
                    <div
                      key={provider.value}
                      className={cn(
                        'rounded-lg border p-4',
                        isDisabledByAdmin
                          ? 'border-red-500/20 bg-red-500/5 opacity-70'
                          : 'border-border',
                      )}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {provider.label}
                        </span>
                        {isDisabledByAdmin ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-400">
                            <Ban className="h-3 w-3" />
                            {t('settings.disabledByAdmin', {
                              defaultValue: 'Disabled',
                            })}
                          </span>
                        ) : validatingLLMKeys && status?.isActive ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-500">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {t('settings.validating')}
                          </span>
                        ) : (
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-semibold',
                              resolvedStatus === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : resolvedStatus === 'INVALID'
                                  ? 'bg-red-500/10 text-red-500'
                                  : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {resolvedStatus === 'ACTIVE'
                              ? t('settings.active')
                              : resolvedStatus === 'INVALID'
                                ? t('settings.invalid')
                                : t('settings.inactive')}
                          </span>
                        )}
                      </div>

                      {isDisabledByAdmin ? (
                        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400 leading-relaxed">
                          <Ban className="inline h-3 w-3 mr-1 -mt-0.5" />
                          {t('settings.providerDisabledNotice', {
                            defaultValue:
                              'This provider has been temporarily disabled by the administrator. For more details, please contact us.',
                          })}
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-3 sm:grid-cols-1">
                            <div>
                              <label className="mb-1 block text-xs font-medium">
                                API Key
                              </label>
                              <Input
                                type="password"
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
                                className="px-2 py-2"
                              />
                              <p className="mt-1.5 text-xs text-muted-foreground">
                                {t('settings.getApiKeyAt')}{' '}
                                <a
                                  href={provider.helpLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                                >
                                  {provider.helpLinkText}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </p>
                            </div>
                            {status?.isActive ? (
                              <div>
                                <DynamicModelSelect
                                  provider={provider.value}
                                  value={form.model}
                                  label={t('settings.model')}
                                  onChange={(model) => {
                                    setLlmForms((f) => ({
                                      ...f,
                                      [provider.value]: {
                                        ...(f[provider.value] ?? {
                                          apiKey: '',
                                        }),
                                        model,
                                      },
                                    }));
                                    updateLLMModel({
                                      provider: provider.value,
                                      selectedModel: model || null,
                                    });
                                  }}
                                  fallbackModels={provider.models}
                                />
                              </div>
                            ) : (
                              <div className="mt-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground italic text-center">
                                {t('settings.activateProviderFirst', {
                                  defaultValue:
                                    'Guarda tu API key para seleccionar un modelo',
                                })}
                              </div>
                            )}
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
                                    selectedModel: form.model || null,
                                  },
                                  {
                                    onSuccess: () => {
                                      setLlmForms((f) => ({
                                        ...f,
                                        [provider.value]: {
                                          apiKey: '',
                                          model: '',
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
                                  {testingLLM &&
                                  llmTestProvider === provider.value
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
                                {validation?.status === 'INVALID' &&
                                  validation.error &&
                                  !(
                                    llmTestResult &&
                                    llmTestProvider === provider.value
                                  ) && (
                                    <span className="text-xs font-medium text-red-500">
                                      {t('settings.autoValidationFailed')}:{' '}
                                      {validation.error}
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
                        </>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </>
      )}

      {aiSubTab === 'analytics' && (
        <div className="space-y-6">
          <ProviderStatusGrid />
          <AIUsageDashboard />
        </div>
      )}
    </div>
  );
}
