import {
  Bot,
  RotateCcw,
  Save,
  Lock,
  Loader2,
  Zap,
  DollarSign,
  Scale,
  ShieldAlert,
  Sparkles,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { Button, Dialog, Select, type SelectOption } from '@crypto-trader/ui';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useMemo } from 'react';
import {
  useAgentConfigs,
  useAgentHealth,
  useUpdateAgentConfig,
  useResetAgentConfig,
  useApplyPreset,
  useAutoResolveFallback,
  ResolvedAgentConfig,
  AgentPresetName,
} from '../../../hooks/use-agent-config';
import {
  useLLMKeys,
  useUpdateLLMModel,
  usePlatformLLMStatus,
} from '../../../hooks/use-user';
import { DynamicModelSelect } from '../../../containers/settings/dynamic-model-select';
import { OpenRouterModelSelect } from '../../../containers/settings/openrouter-model-select';
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
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 h-full">
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

      <div className="space-y-3">
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
  const autoResolve = useAutoResolveFallback();
  const updateLLMModel = useUpdateLLMModel();
  const { data: platformStatus } = usePlatformLLMStatus();

  // Build a set of inactive providers for quick lookup
  const inactiveProviders = useMemo(
    () =>
      new Set(
        (platformStatus ?? [])
          .filter((p) => !p.isActive)
          .map((p) => p.provider),
      ),
    [platformStatus],
  );

  const [pendingPreset, setPendingPreset] = useState<{
    id: AgentPresetName;
    name: string;
  } | null>(null);

  // Fallback model state
  const openRouterCred = (llmKeys ?? []).find(
    (k) => k.provider === 'OPENROUTER' && k.isActive,
  );
  const [fallbackModel, setFallbackModel] = useState(
    openRouterCred?.selectedModel ?? '',
  );
  const [fallbackDirty, setFallbackDirty] = useState(false);

  useEffect(() => {
    if (openRouterCred?.selectedModel) {
      setFallbackModel(openRouterCred.selectedModel);
      setFallbackDirty(false);
    }
  }, [openRouterCred?.selectedModel]);

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

  // All agents in display order for the vertical nav
  const allAgentConfigs = useMemo(() => {
    const list: ResolvedAgentConfig[] = [];
    list.push(...kryptoConfigs);
    list.push(...standardConfigs);
    if (aegisConfig) list.push(aegisConfig);
    return list;
  }, [kryptoConfigs, standardConfigs, aegisConfig]);

  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  // Set initial selected agent once loaded
  useEffect(() => {
    if (allAgentConfigs.length > 0 && !selectedAgentId) {
      setSelectedAgentId(allAgentConfigs[0].agentId);
    }
  }, [allAgentConfigs, selectedAgentId]);

  const selectedConfig = allAgentConfigs.find(
    (c) => c.agentId === selectedAgentId,
  );

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

      {/* ── Fallback Model ──────────────────────────────────────────── */}
      {openRouterCred && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold">
                {t('settings.agents.fallback.title', {
                  defaultValue: 'Fallback Model',
                })}
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={autoResolve.isPending}
              onClick={() => autoResolve.mutate()}
            >
              {autoResolve.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-3 w-3 mr-1" />
              )}
              {t('settings.agents.fallback.autoResolve', {
                defaultValue: 'Auto-resolve',
              })}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settings.agents.fallback.description', {
              defaultValue:
                'Safety net model used when an agent has no specific configuration. Applied automatically by presets.',
            })}
          </p>
          <OpenRouterModelSelect
            value={fallbackModel}
            onChange={(m) => {
              setFallbackModel(m);
              setFallbackDirty(true);
            }}
            compact
          />
          {fallbackDirty && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={updateLLMModel.isPending || !fallbackModel}
                onClick={() =>
                  updateLLMModel.mutate(
                    {
                      provider: 'OPENROUTER',
                      selectedModel: fallbackModel,
                    },
                    { onSuccess: () => setFallbackDirty(false) },
                  )
                }
              >
                {updateLLMModel.isPending && (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                )}
                <Save className="h-3 w-3 mr-1" />
                {t('common.save')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFallbackModel(openRouterCred?.selectedModel ?? '');
                  setFallbackDirty(false);
                }}
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Health warning */}
      {health && !health.healthy && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
          ⚠️ {t('settings.agents.healthWarning')}
        </div>
      )}

      {/* ── Agent Configuration — Vertical Tabs ─────────────────── */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          {t('settings.agents.specialists')}
        </h2>

        {/* Mobile: dropdown selector */}
        <div className="block md:hidden">
          <Select
            value={selectedAgentId}
            onChange={setSelectedAgentId}
            options={allAgentConfigs.map((cfg) => {
              const m = AGENT_META[cfg.agentId] ?? {
                codename: cfg.agentId,
                color: '',
              };
              const needsAttention =
                cfg.provider && inactiveProviders.has(cfg.provider);
              return {
                value: cfg.agentId,
                label: needsAttention
                  ? `⚠️ ${m.codename} (${cfg.agentId})`
                  : `${m.codename} (${cfg.agentId})`,
              };
            })}
          />
        </div>

        <div className="flex gap-4 items-stretch">
          {/* Desktop: vertical nav */}
          <div className="hidden md:flex flex-col gap-1 w-48 shrink-0 rounded-xl border border-border bg-card p-2">
            {allAgentConfigs.map((cfg) => {
              const m = AGENT_META[cfg.agentId] ?? {
                codename: cfg.agentId,
                color: 'text-muted-foreground',
              };
              const isActive = cfg.agentId === selectedAgentId;
              const needsAttention =
                cfg.provider && inactiveProviders.has(cfg.provider);
              return (
                <button
                  key={cfg.agentId}
                  type="button"
                  onClick={() => setSelectedAgentId(cfg.agentId)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-primary/10 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  {needsAttention ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  ) : (
                    m.locked && (
                      <Lock className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    )
                  )}
                  <span className={cn('font-bold', m.color)}>{m.codename}</span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {cfg.agentId}
                  </span>
                  {needsAttention && (
                    <span className="ml-auto text-[9px] text-amber-500 font-semibold shrink-0">
                      {t('agents.providerNeedsAttention')}
                    </span>
                  )}
                  {isActive && !needsAttention && (
                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Card content */}
          <div className="flex-1 min-w-0">
            {selectedConfig && (
              <AgentConfigCard
                key={selectedConfig.agentId}
                config={selectedConfig}
                activeProviders={activeProviders}
                onSave={handleSave}
                onReset={handleReset}
                isSaving={updateMutation.isPending}
                t={t}
              />
            )}
          </div>
        </div>
      </div>

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
