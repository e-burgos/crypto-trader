import {
  Bot,
  RotateCcw,
  Save,
  Lock,
  Loader2,
  Zap,
  DollarSign,
  Scale,
} from 'lucide-react';
import { Button, Dialog, Select, type SelectOption } from '@crypto-trader/ui';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import {
  useAgentConfigs,
  useAgentHealth,
  useUpdateAgentConfig,
  useResetAgentConfig,
  useApplyPreset,
  ResolvedAgentConfig,
  AgentPresetName,
} from '../../../hooks/use-agent-config';
import { useLLMKeys } from '../../../hooks/use-user';
import { DynamicModelSelect } from '../../../containers/settings/dynamic-model-select';
import { cn } from '../../../lib/utils';

const AGENT_META: Record<
  string,
  { codename: string; color: string; locked?: boolean; dual?: boolean }
> = {
  routing: { codename: 'KRYPTO', color: 'text-yellow-500', dual: true },
  synthesis: { codename: 'KRYPTO', color: 'text-yellow-500', dual: true },
  platform: { codename: 'NEXUS', color: 'text-blue-500' },
  operations: { codename: 'FORGE', color: 'text-orange-500' },
  market: { codename: 'SIGMA', color: 'text-green-500' },
  blockchain: { codename: 'CIPHER', color: 'text-purple-500' },
  risk: { codename: 'AEGIS', color: 'text-red-500', locked: true },
};

const PROVIDERS = [
  { value: 'OPENROUTER', label: 'OpenRouter' },
  { value: 'CLAUDE', label: 'Anthropic Claude' },
  { value: 'OPENAI', label: 'OpenAI' },
  { value: 'GROQ', label: 'Groq' },
  { value: 'GEMINI', label: 'Google Gemini' },
  { value: 'MISTRAL', label: 'Mistral AI' },
  { value: 'TOGETHER', label: 'Together AI' },
];

function AgentConfigCard({
  config,
  activeProviders,
  onSave,
  onReset,
  isSaving,
  t,
}: {
  config: ResolvedAgentConfig;
  activeProviders: string[];
  onSave: (agentId: string, provider: string, model: string) => void;
  onReset: (agentId: string) => void;
  isSaving: boolean;
  t: (key: string) => string;
}) {
  const meta = AGENT_META[config.agentId] ?? {
    codename: config.agentId,
    color: 'text-muted-foreground',
  };
  const [provider, setProvider] = useState(config.provider);
  const [model, setModel] = useState(config.model);

  // Sync local state when server data changes (e.g. after applying a preset)
  useEffect(() => {
    setProvider(config.provider);
    setModel(config.model);
  }, [config.provider, config.model]);

  // Reset model when provider changes
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    setModel('');
  };

  const isDirty = provider !== config.provider || model !== config.model;
  const canSave = isDirty && model.trim() !== '';
  const isOverridden = config.source === 'user';

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {meta.locked && <Lock className="h-4 w-4 text-red-500" />}
          <span className={cn('font-bold text-sm', meta.color)}>
            {meta.codename}
          </span>
          <span className="text-xs text-muted-foreground">
            ({config.agentId})
          </span>
        </div>
        <span
          className={cn('text-xs px-2 py-0.5 rounded-full', {
            'bg-primary/10 text-primary': config.source === 'user',
            'bg-muted text-muted-foreground': config.source !== 'user',
          })}
        >
          {config.source === 'user'
            ? t('settings.agents.usingOverride')
            : config.source === 'admin'
              ? t('settings.agents.usingAdmin')
              : t('settings.agents.usingDefault')}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Select
            label={t('settings.agents.provider')}
            value={provider}
            onChange={handleProviderChange}
            options={PROVIDERS.filter(
              (p) => activeProviders.includes(p.value) || p.value === provider,
            ).map(
              (p): SelectOption => ({
                value: p.value,
                label: activeProviders.includes(p.value)
                  ? p.label
                  : `${p.label} ⚠️`,
              }),
            )}
          />
        </div>
        <div>
          <DynamicModelSelect
            provider={provider}
            value={model}
            onChange={setModel}
            fallbackModels={[]}
            label={t('settings.agents.model')}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="default"
          size="sm"
          disabled={!canSave || isSaving}
          onClick={() => onSave(config.agentId, provider, model)}
        >
          {isSaving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          <span className="ml-1">{t('common.save')}</span>
        </Button>
        {isOverridden && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onReset(config.agentId)}
          >
            <RotateCcw className="h-3 w-3" />
            <span className="ml-1">{t('settings.agents.resetToDefault')}</span>
          </Button>
        )}
      </div>
    </div>
  );
}

export function SettingsAgentsPage() {
  const { t } = useTranslation();
  const { data: configs, isLoading } = useAgentConfigs();
  const { data: health } = useAgentHealth();
  const { data: llmKeys } = useLLMKeys();
  const updateMutation = useUpdateAgentConfig();
  const resetMutation = useResetAgentConfig();
  const applyPreset = useApplyPreset();

  const [pendingPreset, setPendingPreset] = useState<{
    id: AgentPresetName;
    name: string;
  } | null>(null);

  const activeProviders = (llmKeys ?? [])
    .filter((k) => k.isActive)
    .map((k) => k.provider);

  const handleSave = (agentId: string, provider: string, model: string) => {
    updateMutation.mutate({ agentId, provider, model });
  };

  const handleReset = (agentId: string) => {
    resetMutation.mutate({ agentId });
  };

  const handleApplyPreset = (preset: AgentPresetName, name: string) => {
    setPendingPreset({ id: preset, name });
  };

  const handleConfirmPreset = () => {
    if (!pendingPreset) return;
    applyPreset.mutate(pendingPreset.id, {
      onSettled: () => setPendingPreset(null),
    });
  };

  const PRESET_OPTIONS: Array<{
    id: AgentPresetName;
    labelKey: string;
    descKey: string;
    icon: React.ReactNode;
    style: string;
    badgeStyle: string;
  }> = [
    {
      id: 'free',
      labelKey: 'settings.agents.presets.free',
      descKey: 'settings.agents.presets.freeDesc',
      icon: <Zap className="h-4 w-4" />,
      style:
        'border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5',
      badgeStyle: 'bg-emerald-500/10 text-emerald-500',
    },
    {
      id: 'balanced',
      labelKey: 'settings.agents.presets.balanced',
      descKey: 'settings.agents.presets.balancedDesc',
      icon: <Scale className="h-4 w-4" />,
      style: 'border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/5',
      badgeStyle: 'bg-blue-500/10 text-blue-500',
    },
    {
      id: 'optimized',
      labelKey: 'settings.agents.presets.optimized',
      descKey: 'settings.agents.presets.optimizedDesc',
      icon: <DollarSign className="h-4 w-4" />,
      style:
        'border-yellow-500/30 hover:border-yellow-500/60 hover:bg-yellow-500/5',
      badgeStyle: 'bg-yellow-500/10 text-yellow-500',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Split configs into groups
  const kryptoConfigs = (configs ?? []).filter(
    (c) => c.agentId === 'routing' || c.agentId === 'synthesis',
  );
  const standardConfigs = (configs ?? []).filter(
    (c) =>
      !['routing', 'synthesis', 'risk', 'orchestrator'].includes(c.agentId),
  );
  const aegisConfig = (configs ?? []).find((c) => c.agentId === 'risk');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('settings.agents.title')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('settings.agents.description')}
        </p>
      </div>

      {/* ── Preset Selector ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold">
            {t('settings.agents.presets.title')}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('settings.agents.presets.description')}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PRESET_OPTIONS.map((preset) => {
            const label = t(preset.labelKey);
            return (
              <button
                key={preset.id}
                disabled={applyPreset.isPending}
                onClick={() => handleApplyPreset(preset.id, label)}
                className={cn(
                  'flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
                  preset.style,
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn('rounded-md p-1', preset.badgeStyle)}>
                    {applyPreset.isPending &&
                    applyPreset.variables === preset.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      preset.icon
                    )}
                  </span>
                  <span className="text-sm font-semibold">{label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  {t(preset.descKey)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Health warning */}
      {health && !health.healthy && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
          ⚠️ {t('settings.agents.healthWarning')}
        </div>
      )}

      {/* KRYPTO — dual model (routing + synthesis) */}
      {kryptoConfigs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-yellow-500">
            KRYPTO — {t('settings.agents.orchestrator')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {kryptoConfigs.map((cfg) => (
              <AgentConfigCard
                key={cfg.agentId}
                config={cfg}
                activeProviders={activeProviders}
                onSave={handleSave}
                onReset={handleReset}
                isSaving={updateMutation.isPending}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* Standard agents: NEXUS, FORGE, SIGMA, CIPHER */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          {t('settings.agents.specialists')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {standardConfigs.map((cfg) => (
            <AgentConfigCard
              key={cfg.agentId}
              config={cfg}
              activeProviders={activeProviders}
              onSave={handleSave}
              onReset={handleReset}
              isSaving={updateMutation.isPending}
              t={t}
            />
          ))}
        </div>
      </div>

      {/* AEGIS — locked */}
      {aegisConfig && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-red-500">
            AEGIS — {t('settings.agents.riskManager')}
          </h2>
          <AgentConfigCard
            config={aegisConfig}
            activeProviders={activeProviders}
            onSave={handleSave}
            onReset={handleReset}
            isSaving={updateMutation.isPending}
            t={t}
          />
        </div>
      )}

      {/* Preset confirmation dialog */}
      <Dialog
        open={!!pendingPreset}
        onClose={() => setPendingPreset(null)}
        title={t('settings.agents.presets.confirmTitle', {
          defaultValue: 'Apply preset',
        })}
        description={t('settings.agents.presets.confirm', {
          name: pendingPreset?.name ?? '',
        })}
        variant="confirm"
        size="sm"
        onConfirm={handleConfirmPreset}
        confirmLabel={t('settings.agents.presets.applying', {
          defaultValue: 'Apply',
        })}
        cancelLabel={t('common.cancel', { defaultValue: 'Cancel' })}
        isPending={applyPreset.isPending}
      >
        <span />
      </Dialog>
    </div>
  );
}
