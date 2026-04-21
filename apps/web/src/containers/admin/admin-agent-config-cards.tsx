import { useState, useEffect } from 'react';
import {
  Save,
  Loader2,
  Lock,
  Zap,
  Scale,
  DollarSign,
  RotateCcw,
} from 'lucide-react';
import { Button, Select, type SelectOption } from '@crypto-trader/ui';
import { useTranslation } from 'react-i18next';
import {
  useAdminAgentConfigs,
  useUpdateAdminAgentConfig,
  useApplyAdminPreset,
  type AgentPresetName,
} from '../../hooks/use-agent-config';
import { DynamicModelSelect } from '../settings/dynamic-model-select';
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
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        {meta.locked && <Lock className="h-4 w-4 text-red-500" />}
        <span className={cn('font-bold text-sm', meta.color)}>
          {meta.codename}
        </span>
        <span className="text-xs text-muted-foreground">
          ({config.agentId})
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Select
            label={t('settings.agents.provider')}
            value={provider}
            onChange={handleProviderChange}
            options={PROVIDERS}
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
      </div>
    </div>
  );
}

export function AdminAgentConfigCards() {
  const { t } = useTranslation();
  const { data: configs, isLoading } = useAdminAgentConfigs();
  const updateMutation = useUpdateAdminAgentConfig();
  const applyPreset = useApplyAdminPreset();
  const [pendingPreset, setPendingPreset] = useState<{
    id: AgentPresetName;
    name: string;
  } | null>(null);

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

      {/* Description */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        {t('agents.modelsTabDesc', {
          defaultValue:
            'These are the default models used for all users who have not set a custom override. Changes apply platform-wide.',
        })}
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(configs ?? []).map((cfg) => (
          <AdminAgentConfigCard
            key={cfg.agentId}
            config={cfg}
            onSave={(agentId, provider, model) =>
              updateMutation.mutate({ agentId, provider, model })
            }
            isSaving={updateMutation.isPending}
          />
        ))}
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
