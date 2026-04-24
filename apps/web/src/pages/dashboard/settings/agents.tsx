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
  Info,
  CheckCircle2,
} from 'lucide-react';
import { Button, Dialog, Select, type SelectOption } from '@crypto-trader/ui';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useMemo } from 'react';
import {
  useAgentConfigs,
  useAgentHealth,
  useUpdateAgentConfig,
  useResetAgentConfig,
  useApplyRecommendedPreset,
  useAutoResolveFallback,
  ResolvedAgentConfig,
  AgentPresetName,
  type RecommendedModelMap,
} from '../../../hooks/use-agent-config';
import {
  useLLMKeys,
  useUpdateLLMModel,
  usePlatformLLMStatus,
} from '../../../hooks/use-user';
import { useOpenRouterModels } from '../../../hooks/use-openrouter-models';
import { DynamicModelSelect } from '../../../containers/settings/dynamic-model-select';
import { OpenRouterModelSelect } from '../../../containers/settings/openrouter-model-select';
import { cn } from '../../../lib/utils';

interface AgentMetaInfo {
  codename: string;
  color: string;
  locked?: boolean;
  dual?: boolean;
  roleKey: string;
  freeModel: string;
  balancedModel: string;
  optimizedModel: string;
}

const AGENT_META: Record<string, AgentMetaInfo> = {
  routing: {
    codename: 'KRYPTO',
    color: 'text-yellow-500',
    dual: true,
    roleKey: 'agents.roles.routing',
    freeModel: 'google/gemma-4-26b-a4b-it:free',
    balancedModel: 'qwen/qwen3.5-9b',
    optimizedModel: 'deepseek/deepseek-v4-flash',
  },
  synthesis: {
    codename: 'KRYPTO',
    color: 'text-yellow-500',
    dual: true,
    roleKey: 'agents.roles.synthesis',
    freeModel: 'nvidia/nemotron-3-super-120b-a12b:free',
    balancedModel: 'deepseek/deepseek-v4-pro',
    optimizedModel: 'moonshotai/kimi-k2.6',
  },
  platform: {
    codename: 'NEXUS',
    color: 'text-blue-500',
    roleKey: 'agents.roles.platform',
    freeModel: 'google/gemma-4-31b-it:free',
    balancedModel: 'qwen/qwen3.5-35b-a3b',
    optimizedModel: 'deepseek/deepseek-v4-flash',
  },
  operations: {
    codename: 'FORGE',
    color: 'text-orange-500',
    roleKey: 'agents.roles.operations',
    freeModel: 'qwen/qwen3-next-80b-a3b-instruct:free',
    balancedModel: 'deepseek/deepseek-v4-flash',
    optimizedModel: 'qwen/qwen3.6-plus',
  },
  market: {
    codename: 'SIGMA',
    color: 'text-green-500',
    roleKey: 'agents.roles.market',
    freeModel: 'nvidia/nemotron-3-super-120b-a12b:free',
    balancedModel: 'deepseek/deepseek-v4-flash',
    optimizedModel: 'deepseek/deepseek-v4-pro',
  },
  blockchain: {
    codename: 'CIPHER',
    color: 'text-purple-500',
    roleKey: 'agents.roles.blockchain',
    freeModel: 'minimax/minimax-m2.5:free',
    balancedModel: 'minimax/minimax-m2.7',
    optimizedModel: 'qwen/qwen3.6-plus',
  },
  risk: {
    codename: 'AEGIS',
    color: 'text-red-500',
    locked: true,
    roleKey: 'agents.roles.risk',
    freeModel: 'nvidia/nemotron-3-super-120b-a12b:free',
    balancedModel: 'deepseek/deepseek-v4-pro',
    optimizedModel: 'moonshotai/kimi-k2.6',
  },
};

const FALLBACK_RECOMMENDED = {
  free: 'nvidia/nemotron-3-super-120b-a12b:free',
  balanced: 'deepseek/deepseek-v4-flash',
  optimized: 'moonshotai/kimi-k2.6',
} as const;

function ModelValidationBadge({
  modelId,
  availableModelIds,
  t,
}: {
  modelId: string;
  availableModelIds: Set<string> | null;
  t: (key: string) => string;
}) {
  if (!availableModelIds) return null;
  const exists = availableModelIds.has(modelId);
  return exists ? (
    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
      <CheckCircle2 className="h-2.5 w-2.5" />
      {t('agents.validated')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
      <AlertTriangle className="h-2.5 w-2.5" />
      {t('agents.deprecated')}
    </span>
  );
}

function ModelRecommendationRow({
  tier,
  tierColor,
  modelId,
  availableModelIds,
  onApply,
  t,
}: {
  tier: string;
  tierColor: string;
  modelId: string;
  availableModelIds: Set<string> | null;
  onApply: (modelId: string) => void;
  t: (key: string) => string;
}) {
  const isAvailable = availableModelIds?.has(modelId) ?? false;
  return (
    <p className="flex items-center gap-1 flex-wrap">
      <span className={cn('font-semibold', tierColor)}>{tier}:</span>
      <button
        type="button"
        disabled={!isAvailable}
        onClick={() => onApply(modelId)}
        className={cn(
          'font-mono text-foreground/70 transition-colors',
          isAvailable
            ? 'hover:text-primary hover:underline cursor-pointer'
            : 'opacity-50 cursor-not-allowed line-through',
        )}
      >
        {modelId}
      </button>
      <ModelValidationBadge
        modelId={modelId}
        availableModelIds={availableModelIds}
        t={t}
      />
    </p>
  );
}

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
  availableModelIds,
}: {
  config: ResolvedAgentConfig;
  activeProviders: string[];
  onSave: (agentId: string, provider: string, model: string) => void;
  onReset: (agentId: string) => void;
  isSaving: boolean;
  t: (key: string) => string;
  availableModelIds: Set<string> | null;
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

      {/* Agent role description */}
      {'roleKey' in meta && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t(meta.roleKey)}
        </p>
      )}

      {/* Recommended models — click to apply */}
      {'balancedModel' in meta && (
        <div className="flex items-start gap-1.5 rounded-lg bg-primary/5 border border-primary/10 p-2.5">
          <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <div className="text-[11px] text-muted-foreground leading-snug space-y-1">
            <p className="font-medium text-foreground/80">
              {t('agents.recommendedModels')}
            </p>
            <ModelRecommendationRow
              tier="Free"
              tierColor="text-emerald-500"
              modelId={meta.freeModel}
              availableModelIds={availableModelIds}
              onApply={(m) => {
                setProvider('OPENROUTER');
                setModel(m);
              }}
              t={t}
            />
            <ModelRecommendationRow
              tier="Balanced"
              tierColor="text-blue-500"
              modelId={meta.balancedModel}
              availableModelIds={availableModelIds}
              onApply={(m) => {
                setProvider('OPENROUTER');
                setModel(m);
              }}
              t={t}
            />
            <ModelRecommendationRow
              tier="Optimized"
              tierColor="text-yellow-500"
              modelId={meta.optimizedModel}
              availableModelIds={availableModelIds}
              onApply={(m) => {
                setProvider('OPENROUTER');
                setModel(m);
              }}
              t={t}
            />
          </div>
        </div>
      )}

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
  const applyRecommended = useApplyRecommendedPreset();
  const autoResolve = useAutoResolveFallback();
  const updateLLMModel = useUpdateLLMModel();
  const { data: platformStatus } = usePlatformLLMStatus();
  const { data: orModels } = useOpenRouterModels();

  // Build a set of available model IDs for validation
  const availableModelIds = useMemo(
    () => (orModels ? new Set(orModels.map((m) => m.id)) : null),
    [orModels],
  );

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

  // Build recommended model map from AGENT_META for preset application
  const recommendedModels = useMemo<RecommendedModelMap>(() => {
    const map: RecommendedModelMap = {};
    for (const [agentId, meta] of Object.entries(AGENT_META)) {
      if ('freeModel' in meta) {
        map[agentId] = {
          free: meta.freeModel,
          balanced: meta.balancedModel,
          optimized: meta.optimizedModel,
        };
      }
    }
    return map;
  }, []);

  const handleConfirmPreset = () => {
    if (!pendingPreset) return;
    applyRecommended.mutate(
      {
        tier: pendingPreset.id,
        models: recommendedModels,
        availableModelIds,
      },
      {
        onSettled: () => setPendingPreset(null),
        onSuccess: () => {
          // Also update the fallback model to the recommended one for this tier
          const fallback =
            FALLBACK_RECOMMENDED[
              pendingPreset.id as keyof typeof FALLBACK_RECOMMENDED
            ];
          if (fallback) {
            updateLLMModel.mutate({
              provider: 'OPENROUTER',
              selectedModel: fallback,
            });
          }
        },
      },
    );
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

  // Split configs into groups (must be before early return — Rules of Hooks)
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

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
                disabled={applyRecommended.isPending}
                onClick={() => handleApplyPreset(preset.id, label)}
                className={cn(
                  'flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
                  preset.style,
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn('rounded-md p-1', preset.badgeStyle)}>
                    {applyRecommended.isPending &&
                    pendingPreset?.id === preset.id ? (
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
          <div className="flex items-start gap-1.5 rounded-lg bg-amber-500/5 border border-amber-500/10 p-2.5">
            <Info className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-[11px] text-muted-foreground leading-snug space-y-1">
              <p className="font-medium text-foreground/80">
                {t('settings.agents.fallback.recommendedTitle', {
                  defaultValue: 'Recommended fallback models (all-rounder):',
                })}
              </p>
              <ModelRecommendationRow
                tier="Free"
                tierColor="text-emerald-500"
                modelId={FALLBACK_RECOMMENDED.free}
                availableModelIds={availableModelIds}
                onApply={(m) => {
                  setFallbackModel(m);
                  setFallbackDirty(true);
                }}
                t={t}
              />
              <ModelRecommendationRow
                tier="Balanced"
                tierColor="text-blue-500"
                modelId={FALLBACK_RECOMMENDED.balanced}
                availableModelIds={availableModelIds}
                onApply={(m) => {
                  setFallbackModel(m);
                  setFallbackDirty(true);
                }}
                t={t}
              />
              <ModelRecommendationRow
                tier="Optimized"
                tierColor="text-yellow-500"
                modelId={FALLBACK_RECOMMENDED.optimized}
                availableModelIds={availableModelIds}
                onApply={(m) => {
                  setFallbackModel(m);
                  setFallbackDirty(true);
                }}
                t={t}
              />
            </div>
          </div>
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
                availableModelIds={availableModelIds}
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
        isPending={applyRecommended.isPending}
      >
        <span />
      </Dialog>
    </div>
  );
}
