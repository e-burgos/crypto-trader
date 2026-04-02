import { useState, useRef } from 'react';
import { Key, User, Trash2, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { InfoTooltip } from '../../components/ui/info-tooltip';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  useUserProfile,
  useBinanceKeyStatus,
  useLLMKeys,
  useSetBinanceKeys,
  useDeleteBinanceKeys,
  useSetLLMKey,
  useDeleteLLMKey,
  useUpdateProfile,
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
    models: ['llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
  },
];

export function SettingsPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

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

  // LLM Keys
  const { data: llmKeys = [] } = useLLMKeys();
  const { mutate: saveLLMKey, isPending: savingLLM } = useSetLLMKey();
  const { mutate: deleteLLMKey } = useDeleteLLMKey();
  const [llmForms, setLlmForms] = useState<
    Record<string, { apiKey: string; model: string }>
  >({});

  useGSAP(
    () => {
      gsap.fromTo(
        '.settings-section',
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, stagger: 0.1, duration: 0.5, ease: 'power2.out' },
      );
    },
    { scope: containerRef },
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

  return (
    <div ref={containerRef} className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile and API keys
        </p>
      </div>

      {/* Profile */}
      <div className="settings-section rounded-xl border border-border bg-card p-5">
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
            <input
              type="password"
              value={profileForm.password}
              onChange={(e) =>
                setProfileForm((f) => ({ ...f, password: e.target.value }))
              }
              placeholder="Leave blank to keep current"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
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
              if (profileForm.password) data.password = profileForm.password;
              updateProfile(data, {
                onSuccess: () => setProfileForm({ email: '', password: '' }),
              });
            }}
          >
            {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('settings.saveProfile')}
          </Button>
        </div>
      </div>

      {/* Binance Keys */}
      <div className="settings-section rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{t('settings.binanceKeys')}</h2>
            <InfoTooltip text="Your Binance API keys are encrypted with AES-256 on the server. They are never exposed in the UI." />
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
                <CheckCircle className="h-3 w-3" /> {t('settings.connected')}
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3" /> {t('settings.disconnected')}
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
            <input
              type="password"
              value={binanceForm.apiSecret}
              onChange={(e) =>
                setBinanceForm((f) => ({ ...f, apiSecret: e.target.value }))
              }
              placeholder="Your Binance API Secret"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
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
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={
                savingBinance || !binanceForm.apiKey || !binanceForm.apiSecret
              }
              onClick={() =>
                saveBinanceKeys(binanceForm, {
                  onSuccess: () =>
                    setBinanceForm({ apiKey: '', apiSecret: '' }),
                })
              }
            >
              {savingBinance && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('settings.saveKeys')}
            </Button>
            {binanceStatus?.hasKeys && (
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
            )}
          </div>
        </div>
      </div>

      {/* LLM Keys */}
      <div className="settings-section rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Key className="h-4 w-4 text-primary" />
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
                  <span className="font-medium text-sm">{provider.label}</span>
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
                    <input
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
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Model
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
                <div className="mt-3 flex gap-2">
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
                          onSuccess: () =>
                            setLlmForms((f) => ({
                              ...f,
                              [provider.value]: {
                                apiKey: '',
                                model: provider.models[0],
                              },
                            })),
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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-red-500 hover:text-red-600"
                      onClick={() => deleteLLMKey(provider.value)}
                    >
                      <Trash2 className="h-3 w-3" />
                      {t('settings.remove')}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
