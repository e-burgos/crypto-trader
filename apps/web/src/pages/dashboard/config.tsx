import { useState, useRef } from 'react';
import {
  Play,
  Square,
  BookOpen,
  Eye,
  Pencil,
  Plus,
  Bot,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TradingConfig } from '../../hooks/use-trading';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  useTradingConfigs,
  useStartAgent,
  useStopAgent,
  useAgentStatus,
} from '../../hooks/use-trading';
import { usePlatformMode } from '../../hooks/use-user';
import {
  AgentDetailModal,
  NewAgentStepperModal,
  EditAgentModal,
  DeleteAgentModal,
} from '../../components/config';

export function ConfigPage() {
  const { t } = useTranslation();
  const { mode: platformMode } = usePlatformMode();
  const [selectedConfig, setSelectedConfig] = useState<TradingConfig | null>(
    null,
  );
  const [editingConfig, setEditingConfig] = useState<TradingConfig | null>(
    null,
  );
  const [deletingConfig, setDeletingConfig] = useState<TradingConfig | null>(
    null,
  );
  const [stepperOpen, setStepperOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { mutate: startAgent } = useStartAgent();
  const { mutate: stopAgent } = useStopAgent();
  const { data: configs = [], isLoading } = useTradingConfigs();
  useAgentStatus();

  // Solo mostrar agentes del modo activo
  const modeConfigs = configs.filter((c) => {
    if (platformMode === 'SANDBOX') return c.mode === 'SANDBOX';
    return c.mode === platformMode;
  });

  useGSAP(
    () => {
      gsap.fromTo(
        '.config-card',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, stagger: 0.08, duration: 0.4, ease: 'power2.out' },
      );
    },
    { scope: containerRef },
  );

  function getAgentIsRunning(configId: string) {
    return modeConfigs.find((c) => c.id === configId)?.isRunning ?? false;
  }

  return (
    <div ref={containerRef} className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="config-card flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('sidebar.config')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('trading.configSubtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStepperOpen(true)}
          className="shrink-0 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary/20 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          {t('config.stepper.openStepper')}
        </button>
      </div>

      {/* Docs callout */}
      <div className="config-card flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
        <BookOpen className="h-5 w-5 shrink-0 text-primary" />
        <p className="flex-1 text-sm text-muted-foreground">
          {t('config.docsCallout')}
        </p>
        <div className="flex gap-2">
          <Link
            to="/help#agent-flow"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            {t('config.docsCalloutGuide')}
          </Link>
          <Link
            to="/help#config-concepts-thresholds"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {t('config.docsCalloutConcepts')}
          </Link>
        </div>
      </div>

      {/* Agents list */}
      <div className="config-card rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">{t('trading.activeAgents')}</h2>
          {modeConfigs.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {modeConfigs.length}{' '}
              {modeConfigs.length === 1
                ? t('config.agentSingular')
                : t('config.agentPlural')}
            </span>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-muted/50"
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && modeConfigs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 px-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted/30">
              <Bot className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">
                {t('trading.noConfigs')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('config.noConfigsHint')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStepperOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-5 py-2.5 text-sm font-bold text-primary hover:bg-primary/20 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t('config.stepper.openStepper')}
            </button>
          </div>
        )}

        {/* Agent cards */}
        {!isLoading && modeConfigs.length > 0 && (
          <div className="divide-y divide-border">
            {modeConfigs.map((cfg) => {
              const isRunning = getAgentIsRunning(cfg.id);
              const modeColor =
                cfg.mode === 'TESTNET'
                  ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
                  : cfg.mode === 'LIVE'
                    ? 'text-red-400 bg-red-500/10 border-red-500/20'
                    : 'text-muted-foreground bg-muted/30 border-border';

              return (
                <div
                  key={cfg.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors"
                >
                  {/* Status dot */}
                  <div
                    className={cn(
                      'shrink-0 h-2.5 w-2.5 rounded-full',
                      isRunning
                        ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                        : 'bg-muted-foreground/30',
                    )}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold truncate">
                        {cfg.name || `${cfg.asset}/${cfg.pair}`}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                          modeColor,
                        )}
                      >
                        {cfg.mode}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          isRunning
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {isRunning ? t('common.running') : t('common.stopped')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {cfg.name ? `${cfg.asset}/${cfg.pair} · ` : ''}
                      SL {(cfg.stopLossPct * 100).toFixed(1)}% · TP{' '}
                      {(cfg.takeProfitPct * 100).toFixed(1)}% · Compra{' '}
                      {cfg.buyThreshold}%
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-1">
                    {/* Start / Stop */}
                    {isRunning ? (
                      <button
                        type="button"
                        title={t('trading.stopAgent')}
                        onClick={() => stopAgent(cfg.id)}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Square className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title={t('trading.startAgent')}
                        onClick={() => startAgent(cfg.id)}
                        className="rounded-lg p-2 text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}

                    {/* View detail */}
                    <button
                      type="button"
                      title={t('config.viewDetail')}
                      onClick={() => setSelectedConfig(cfg)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      title={t('config.editModal.title')}
                      onClick={() => setEditingConfig(cfg)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      title={t('trading.deleteConfig')}
                      onClick={() => setDeletingConfig(cfg)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stepper Modal */}
      {stepperOpen && (
        <NewAgentStepperModal
          onClose={() => setStepperOpen(false)}
          onCreated={() => setStepperOpen(false)}
          defaultMode={platformMode}
        />
      )}

      {/* Edit Modal */}
      {editingConfig && (
        <EditAgentModal
          cfg={editingConfig}
          onClose={() => setEditingConfig(null)}
        />
      )}

      {/* Delete Modal */}
      {deletingConfig && (
        <DeleteAgentModal
          cfg={deletingConfig}
          onClose={() => setDeletingConfig(null)}
        />
      )}

      {/* Detail Modal */}
      {selectedConfig && (
        <AgentDetailModal
          cfg={selectedConfig}
          isRunning={getAgentIsRunning(selectedConfig.id)}
          onClose={() => setSelectedConfig(null)}
          onStart={() => startAgent(selectedConfig.id)}
          onStop={() => stopAgent(selectedConfig.id)}
        />
      )}
    </div>
  );
}
