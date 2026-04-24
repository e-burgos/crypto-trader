import { useState, useEffect, useMemo } from 'react';
import {
  Save,
  Loader2,
  Lock,
  Zap,
  Scale,
  DollarSign,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { Button, Select, type SelectOption } from '@crypto-trader/ui';
import { useTranslation } from 'react-i18next';
import {
  useAdminAgentConfigs,
  useUpdateAdminAgentConfig,
  useApplyAdminPreset,
  useAutoResolveFallback,
  type AgentPresetName,
} from '../../hooks/use-agent-config';
import { useLLMKeys, useUpdateLLMModel } from '../../hooks/use-user';
import { DynamicModelSelect } from '../settings/dynamic-model-select';
import { OpenRouterModelSelect } from '../settings/openrouter-model-select';
import { cn } from '../../lib/utils';
import { Dialog } from '@crypto-trader/ui';

const AGENT_META: Record<
  string,
  { codename: string; color: string; locked?: boolean }
> = {
  orchestrator: { codename: 'KRYPTO', color: 'text-yellow-500' },
  routing: { codename: 'KRYPTO', color: 'text-yellow-500' },
  synthesis: { codename: 'KRYPTO', color: 'text-yellow-500' },
  platform: { codename: 'NEXUS', color: 'text-blue-500' },
  operations: { codename: 'FORGE', color: 'text-orange-500' },
  market: { codename: 'SIGMA', color: 'text-green-500' },
  blockchain: { codename: 'CIPHER', color: 'text-purple-500' },
  risk: { codename: 'AEGIS', color: 'text-red-500', locked: true },
};

const PROVIDERS: SelectOption[] = [
  { value: 'OPENROUTER', label: 'OpenRouter' },
  { value: 'CLAUDE', label: 'Anthropic Claude' },
  { value: 'OPENAI', label: 'OpenAI' },
  { value: 'GROQ', label: 'Groq' },
  { value: 'GEMINI', label: 'Google Gemini' },
  { value: 'MISTRAL', label: 'Mistral AI' },
  { value: 'TOGETHER', label: 'Together AI' },
];

interface AdminAgentConfigCardProps {
  config: { agentId: string; provider: string; model: string };
  onSave: (agentId: string, provider: string, model: string) => void;
  isSaving: boolean;
}

function AdminAgentConfigCard({
  config,
  onSave,
  isSaving,
}: AdminAgentConfigCardProps) {
  const { t } = useTranslation();
  const meta = AGENT_META[config.agentId] ?? {
    codename: config.agentId,
    color: 'text-muted-foreground',
  };

  const [provider, setProvider] = useState(config.provider || 'OPENROUTER');
  const [model, setModel] = useState(config.model || '');

  useEffect(() => {
    setProvider(config.provider || 'OPENROUTER');
    setModel(config.model || '');
  }, [config.provider, config.model]);

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    setModel('');
  };

  const isDirty = provider !== config.provider || model !== config.model;
  const canSave = isDirty && model.trim() !== '';

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
        {isDirty && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {t('settings.agents.unsaved', { defaultValue: 'Unsaved' })}
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="w-full">
          <Select
            label={t('settings.agents.provider')}
            value={provider}
            onChange={handleProviderChange}
            options={PROVIDERS}
          />
        </div>
        <DynamicModelSelect
          provider={provider}
          value={model}
          onChange={setModel}
          fallbackModels={[]}
          label={t('settings.agents.model')}
        />
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
        {isDirty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setProvider(config.provider || 'OPENROUTER');
              setModel(config.model || '');
            }}
          >
            <RotateCcw className="h-3 w-3" />
            <span className="ml-1">
              {t('settings.agents.reset', { defaultValue: 'Reset' })}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}

export function AdminAgentConfigCards() {
  const { t } = useTranslation();
  const { data: configs, isLoading } = useAdminAgentConfigs();
  const updateMutation = useUpdateAdminAgentConfig();
  const applyPreset = useApplyAdminPreset();
  const autoResolve = useAutoResolveFallback();
  const { data: llmKeys } = useLLMKeys();
  const updateLLMModel = useUpdateLLMModel();
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

  const DEFAULT_PRESET = {
    id: 'free' as AgentPresetName,
    label: t('agents.presets.default', { defaultValue: 'Default Set' }),
    desc: t('agents.presets.defaultDesc', {
      defaultValue: 'Platform-recommended defaults (free OpenRouter models)',
    }),
    icon: <RotateCcw className="h-4 w-4" />,
    style: 'border-border hover:border-muted-foreground/40 hover:bg-muted/30',
    badgeStyle: 'bg-muted text-muted-foreground',
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  const allConfigs = useMemo(() => configs ?? [], [configs]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  useEffect(() => {
    if (allConfigs.length > 0 && !selectedAgentId) {
      setSelectedAgentId(allConfigs[0].agentId);
    }
  }, [allConfigs, selectedAgentId]);

  const selectedConfig = allConfigs.find((c) => c.agentId === selectedAgentId);

  return (
    <div className="space-y-6">
      {/* Quick Setup */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold">
            {t('agents.quickSetup', { defaultValue: 'Quick Setup' })}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('agents.quickSetupDesc', {
              defaultValue:
                'Apply a pre-configured model set to all agents at once.',
            })}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Default preset first */}
          <button
            disabled={applyPreset.isPending}
            onClick={() =>
              setPendingPreset({
                id: DEFAULT_PRESET.id,
                name: DEFAULT_PRESET.label,
              })
            }
            className={cn(
              'flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
              DEFAULT_PRESET.style,
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn('rounded-md p-1', DEFAULT_PRESET.badgeStyle)}>
                {applyPreset.isPending &&
                pendingPreset?.id === DEFAULT_PRESET.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  DEFAULT_PRESET.icon
                )}
              </span>
              <span className="text-sm font-semibold">
                {DEFAULT_PRESET.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              {DEFAULT_PRESET.desc}
            </p>
          </button>

          {/* Dynamic presets */}
          {PRESET_OPTIONS.map((preset) => {
            const label = t(preset.labelKey);
            return (
              <button
                key={preset.id}
                disabled={applyPreset.isPending}
                onClick={() => setPendingPreset({ id: preset.id, name: label })}
                className={cn(
                  'flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
                  preset.style,
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn('rounded-md p-1', preset.badgeStyle)}>
                    {applyPreset.isPending &&
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
            {t('admin.fallbackDescription', {
              defaultValue:
                'Default fallback model used platform-wide when a user has no custom configuration. Applied automatically by presets.',
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

      {/* Description */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        {t('agents.modelsTabDesc', {
          defaultValue:
            'These are the default models used for all users who have not set a custom override. Changes apply platform-wide.',
        })}
      </div>

      {/* ── Agent Configuration — Vertical Tabs ─────────────────── */}
      <div className="space-y-3">
        {/* Mobile: dropdown selector */}
        <div className="block md:hidden">
          <Select
            value={selectedAgentId}
            onChange={setSelectedAgentId}
            options={allConfigs.map((cfg) => {
              const m = AGENT_META[cfg.agentId] ?? {
                codename: cfg.agentId,
                color: '',
              };
              return {
                value: cfg.agentId,
                label: `${m.codename} (${cfg.agentId})`,
              };
            })}
          />
        </div>

        <div className="flex gap-4 items-stretch">
          {/* Desktop: vertical nav */}
          <div className="hidden md:flex flex-col gap-1 w-48 shrink-0 rounded-xl border border-border bg-card p-2">
            {allConfigs.map((cfg) => {
              const m = AGENT_META[cfg.agentId] ?? {
                codename: cfg.agentId,
                color: 'text-muted-foreground',
              };
              const isActive = cfg.agentId === selectedAgentId;
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
                  {m.locked && (
                    <Lock className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  )}
                  <span className={cn('font-bold', m.color)}>{m.codename}</span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {cfg.agentId}
                  </span>
                  {isActive && (
                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Card content */}
          <div className="flex-1 min-w-0">
            {selectedConfig && (
              <AdminAgentConfigCard
                key={selectedConfig.agentId}
                config={selectedConfig}
                onSave={(agentId, provider, model) =>
                  updateMutation.mutate({ agentId, provider, model })
                }
                isSaving={updateMutation.isPending}
              />
            )}
          </div>
        </div>
      </div>

      {/* Confirmation dialog */}
      <Dialog
        open={pendingPreset !== null}
        onClose={() => setPendingPreset(null)}
        variant="confirm"
        title={t('settings.agents.presets.confirmTitle', {
          name: pendingPreset?.name ?? '',
          defaultValue: `Apply "${pendingPreset?.name}" preset?`,
        })}
        description={t('settings.agents.presets.confirm', {
          name: pendingPreset?.name ?? '',
          defaultValue: `Apply the "${pendingPreset?.name}" preset to all agents? This will overwrite the current platform-wide configuration.`,
        })}
        confirmLabel={t('settings.agents.presets.applying', {
          defaultValue: 'Apply',
        })}
        onConfirm={() => {
          if (pendingPreset) {
            applyPreset.mutate(pendingPreset.id, {
              onSettled: () => setPendingPreset(null),
            });
          }
        }}
      />
    </div>
  );
}
