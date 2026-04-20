import { useState } from 'react';
import {
  Star,
  Loader2,
  CheckCircle,
  XCircle,
  ExternalLink,
  Trash2,
  Shield,
  Zap,
  DollarSign,
  Layers,
} from 'lucide-react';
import { Button, Input } from '@crypto-trader/ui';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { DynamicModelSelect } from './dynamic-model-select';

interface OpenRouterPrimaryTabProps {
  llmKeys: Array<{
    provider: string;
    isActive: boolean;
    selectedModel?: string;
  }>;
  llmValidation?: {
    results: Array<{ provider: string; status: string; error?: string }>;
  };
  validatingLLMKeys: boolean;
  savingLLM: boolean;
  testingLLM: boolean;
  llmTestProvider?: string;
  llmTestResult?: { connected: boolean; error?: string };
  onSave: (data: {
    provider: string;
    apiKey: string;
    selectedModel: string | null;
  }) => void;
  onTest: (provider: string) => void;
  onDelete: (provider: string) => void;
  onUpdateModel: (data: {
    provider: string;
    selectedModel: string | null;
  }) => void;
}

// Curated ranking: best paid (by Finance rank) then best free
const OPENROUTER_MODELS = [
  // ── Top Paid ──
  'anthropic/claude-sonnet-4.6',
  'google/gemini-3-flash-preview',
  'anthropic/claude-opus-4.6',
  'deepseek/deepseek-v3.2',
  'google/gemini-2.5-flash-lite',
  // ── Top Free ──
  'openrouter/elephant-alpha',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'google/gemma-4-31b-it:free',
];

export function OpenRouterPrimaryTab({
  llmKeys,
  llmValidation,
  validatingLLMKeys,
  savingLLM,
  testingLLM,
  llmTestProvider,
  llmTestResult,
  onSave,
  onTest,
  onDelete,
  onUpdateModel,
}: OpenRouterPrimaryTabProps) {
  const { t } = useTranslation();
  const status = llmKeys.find((k) => k.provider === 'OPENROUTER');
  const validation = llmValidation?.results.find(
    (r) => r.provider === 'OPENROUTER',
  );
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(
    status?.selectedModel || 'anthropic/claude-sonnet-4.6',
  );

  const isActive = status?.isActive ?? false;
  const manualTestFailed =
    isActive &&
    llmTestResult &&
    llmTestProvider === 'OPENROUTER' &&
    !llmTestResult.connected;
  const resolvedStatus = manualTestFailed
    ? 'INVALID'
    : (validation?.status ?? (isActive ? 'ACTIVE' : 'INACTIVE'));

  const benefits = [
    {
      icon: <Layers className="h-4 w-4 text-primary" />,
      text: t('settings.openrouter.benefit1', {
        defaultValue: '200+ models from all major providers',
      }),
    },
    {
      icon: <Shield className="h-4 w-4 text-primary" />,
      text: t('settings.openrouter.benefit2', {
        defaultValue: 'Automatic fallback if a model fails',
      }),
    },
    {
      icon: <DollarSign className="h-4 w-4 text-primary" />,
      text: t('settings.openrouter.benefit3', {
        defaultValue: 'Unified billing across all providers',
      }),
    },
    {
      icon: <Zap className="h-4 w-4 text-primary" />,
      text: t('settings.openrouter.benefit4', {
        defaultValue: 'No need to manage multiple accounts',
      }),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Main OpenRouter Card */}
      <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Star className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">OpenRouter</h2>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {t('settings.openrouter.recommended', {
                    defaultValue: 'Recommended',
                  })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('settings.openrouter.subtitle', {
                  defaultValue:
                    'One API key to access all AI models: Claude, GPT, Gemini, Llama, Mistral & more.',
                })}
              </p>
            </div>
          </div>
          {validatingLLMKeys && isActive ? (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('settings.validating')}
            </span>
          ) : (
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                resolvedStatus === 'ACTIVE'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : resolvedStatus === 'INVALID'
                    ? 'bg-red-500/10 text-red-500'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {resolvedStatus === 'ACTIVE' ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5" />
                  {t('settings.active')}
                </>
              ) : resolvedStatus === 'INVALID' ? (
                <>
                  <XCircle className="h-3.5 w-3.5" />
                  {t('settings.invalid')}
                </>
              ) : (
                t('settings.inactive')
              )}
            </span>
          )}
        </div>

        {/* Benefits */}
        <div className="mb-5 grid grid-cols-2 gap-2">
          {benefits.map((b, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2 text-sm"
            >
              {b.icon}
              <span className="text-muted-foreground">{b.text}</span>
            </div>
          ))}
        </div>

        {/* API Key Input */}
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">API Key</label>
            <Input
              type="password"
              placeholder="sk-or-v1-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="px-3 py-2"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t('settings.getApiKeyAt')}{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
              >
                openrouter.ai/keys
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          {/* Model Select */}
          {isActive ? (
            <DynamicModelSelect
              provider="OPENROUTER"
              value={model}
              label={t('settings.openrouter.primaryModel', {
                defaultValue: 'Primary Model',
              })}
              onChange={(m) => {
                setModel(m);
                onUpdateModel({
                  provider: 'OPENROUTER',
                  selectedModel: m || null,
                });
              }}
              fallbackModels={OPENROUTER_MODELS}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground italic text-center">
              {t('settings.activateProviderFirst', {
                defaultValue: 'Save your API key to select a model',
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={savingLLM || !apiKey}
              onClick={() =>
                onSave({
                  provider: 'OPENROUTER',
                  apiKey,
                  selectedModel: model || null,
                })
              }
            >
              {savingLLM && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {t('common.save')}
            </Button>
            {isActive && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={testingLLM}
                  onClick={() => onTest('OPENROUTER')}
                >
                  {testingLLM && llmTestProvider === 'OPENROUTER' && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  {testingLLM && llmTestProvider === 'OPENROUTER'
                    ? t('settings.testing')
                    : t('settings.testConnection')}
                </Button>
                {llmTestResult && llmTestProvider === 'OPENROUTER' && (
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
                  onClick={() => onDelete('OPENROUTER')}
                >
                  <Trash2 className="h-3 w-3" />
                  {t('settings.remove')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        <p>
          {t('settings.openrouter.directProvidersNote', {
            defaultValue:
              'You can also configure individual providers with their own API keys in the "Other Providers" tab if you prefer direct access.',
          })}
        </p>
      </div>
    </div>
  );
}
