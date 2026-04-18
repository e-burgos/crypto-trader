import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical,
  TestTube,
  Activity,
  Lock,
  ChevronDown,
  AlertTriangle,
  Pause,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import type { TradingMode } from '../hooks/use-user';
import { usePlatformMode, useUpdatePlatformMode } from '../hooks/use-user';
import { useAgentStatus, useStopAgentsByMode } from '../hooks/use-trading';

// ── Config por modo ───────────────────────────────────────────────────────────

const MODE_CONFIG: Record<
  TradingMode,
  {
    icon: React.ElementType;
    label: string;
    labelKey: string;
    descKey: string;
    badgeClass: string;
    dotClass: string;
  }
> = {
  SANDBOX: {
    icon: FlaskConical,
    label: 'Sandbox',
    labelKey: 'modeSelector.sandbox',
    descKey: 'modeSelector.sandboxDesc',
    badgeClass:
      'bg-yellow-500/15 text-yellow-600 border-yellow-500/30 dark:text-yellow-400',
    dotClass: 'bg-yellow-500',
  },
  TESTNET: {
    icon: TestTube,
    label: 'Testnet',
    labelKey: 'modeSelector.testnet',
    descKey: 'modeSelector.testnetDesc',
    badgeClass:
      'bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400',
    dotClass: 'bg-orange-500',
  },
  LIVE: {
    icon: Activity,
    label: 'En Vivo',
    labelKey: 'modeSelector.live',
    descKey: 'modeSelector.liveDesc',
    badgeClass:
      'bg-green-500/15 text-green-600 border-green-500/30 dark:text-green-400',
    dotClass: 'bg-green-500 animate-pulse',
  },
};

const ALL_MODES: TradingMode[] = ['SANDBOX', 'TESTNET', 'LIVE'];

// ── CredentialsRequiredModal ──────────────────────────────────────────────────

interface CredentialsModalProps {
  mode: TradingMode;
  onClose: () => void;
}

function CredentialsRequiredModal({ mode, onClose }: CredentialsModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cfg = MODE_CONFIG[mode];
  const Icon = cfg.icon;

  const descKey =
    mode === 'TESTNET'
      ? 'modeSelector.credentialsModalTestnetDesc'
      : 'modeSelector.credentialsModalLiveDesc';

  const tabTarget = 'exchange';

  function handleAddCredentials() {
    onClose();
    navigate(`/dashboard/settings?tab=${tabTarget}`);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 flex flex-col items-center text-center gap-3">
          <div className={cn('p-3 rounded-xl border-2', cfg.badgeClass)}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h3 className="font-semibold text-foreground text-base leading-snug">
              {t('modeSelector.credentialsModalTitle', {
                mode: t(cfg.labelKey),
              })}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('modeSelector.label')}
            </p>
          </div>
        </div>

        {/* Live warning banner */}
        {mode === 'LIVE' && (
          <div className="mx-5 mb-4 px-3 py-2.5 bg-orange-500/10 border border-orange-500/25 rounded-lg flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-600 dark:text-orange-400 leading-relaxed">
              {t('modeSelector.liveWarningShort')}
            </p>
          </div>
        )}

        {/* Body */}
        <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed text-center">
          {t(descKey)}
        </p>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Actions */}
        <div className="flex">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border-r border-border"
          >
            {t('modeSelector.credentialsModalCancel', 'Cancelar')}
          </button>
          <button
            onClick={handleAddCredentials}
            className="flex-1 px-4 py-3.5 text-sm font-semibold text-primary hover:bg-primary/8 transition-colors"
          >
            {t('modeSelector.credentialsModalCta', 'Agregar Credenciales')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── ConfirmLiveModal ──────────────────────────────────────────────────────────

interface ConfirmLiveModalProps {
  onConfirm: () => void;
  onClose: () => void;
}

function ConfirmLiveModal({ onConfirm, onClose }: ConfirmLiveModalProps) {
  const { t } = useTranslation();

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 flex flex-col items-center text-center gap-3">
          <div className="p-3 rounded-xl border-2 bg-red-500/15 text-red-600 border-red-500/30">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h3 className="font-semibold text-foreground text-base leading-snug">
              {t('modeSelector.switchConfirmTitle', 'Cambiar a modo En Vivo')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('modeSelector.label')}
            </p>
          </div>
        </div>

        {/* Body */}
        <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed text-center">
          {t(
            'modeSelector.switchConfirmDesc',
            'Estás a punto de cambiar al modo EN VIVO. Las operaciones afectarán fondos reales en Binance.',
          )}
        </p>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Actions */}
        <div className="flex">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border-r border-border"
          >
            {t('common.cancel', 'Cancelar')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3.5 text-sm font-semibold text-red-600 hover:bg-red-500/8 transition-colors"
          >
            {t('modeSelector.confirmLive', 'Sí, cambiar a En Vivo')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── PauseAgentsModal ──────────────────────────────────────────────────────────

interface PauseAgentsModalProps {
  fromMode: TradingMode;
  toMode: TradingMode;
  runningCount: number;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}

function PauseAgentsModal({
  fromMode,
  toMode,
  runningCount,
  onConfirm,
  onClose,
  isPending,
}: PauseAgentsModalProps) {
  const { t } = useTranslation();
  const fromCfg = MODE_CONFIG[fromMode];
  const toCfg = MODE_CONFIG[toMode];
  const FromIcon = fromCfg.icon;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (!isPending && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 flex flex-col items-center text-center gap-3">
          <div className={cn('p-3 rounded-xl border-2', fromCfg.badgeClass)}>
            <Pause className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h3 className="font-semibold text-foreground text-base leading-snug">
              {t('modeSelector.pauseAgentsTitle', {
                count: runningCount,
                mode: t(fromCfg.labelKey),
              })}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('modeSelector.label')}
            </p>
          </div>
        </div>

        {/* Warning banner */}
        {fromMode === 'LIVE' && (
          <div className="mx-5 mb-4 px-3 py-2.5 bg-orange-500/10 border border-orange-500/25 rounded-lg flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-600 dark:text-orange-400 leading-relaxed">
              {t('modeSelector.pauseAgentsLiveWarning')}
            </p>
          </div>
        )}

        {/* Body */}
        <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed text-center">
          {t('modeSelector.pauseAgentsDesc', {
            count: runningCount,
            fromMode: t(fromCfg.labelKey),
            toMode: t(toCfg.labelKey),
          })}
        </p>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Actions */}
        <div className="flex">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 px-4 py-3.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border-r border-border disabled:opacity-50"
          >
            {t('common.cancel', 'Cancelar')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              'flex-1 px-4 py-3.5 text-sm font-semibold transition-colors disabled:opacity-50',
              fromMode === 'LIVE'
                ? 'text-red-600 hover:bg-red-500/8'
                : 'text-primary hover:bg-primary/8',
            )}
          >
            {isPending
              ? t('modeSelector.pauseAgentsStopping', 'Deteniendo...')
              : t('modeSelector.pauseAgentsCta', 'Detener y cambiar')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── ModeSelector ──────────────────────────────────────────────────────────────

export function ModeSelector() {
  const { t } = useTranslation();
  const { mode, availableModes, isLoading } = usePlatformMode();
  const updateMode = useUpdatePlatformMode();
  const { data: agentStatuses } = useAgentStatus();
  const stopByMode = useStopAgentsByMode();

  const [open, setOpen] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState<TradingMode | null>(
    null,
  );
  const [confirmLive, setConfirmLive] = useState(false);
  const [pauseAgentsTarget, setPauseAgentsTarget] =
    useState<TradingMode | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleToggle() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 6, left: rect.left });
    }
    setOpen((v) => !v);
  }

  function handleModeClick(target: TradingMode) {
    if (target === mode) {
      setOpen(false);
      return;
    }

    // Modo no disponible → modal de credenciales
    if (!availableModes.includes(target)) {
      setOpen(false);
      setCredentialsModal(target);
      return;
    }

    // Si hay agentes corriendo en el modo actual → confirmar pausa
    const runningInCurrentMode =
      agentStatuses?.filter((a) => a.isRunning && a.mode === mode) ?? [];
    if (runningInCurrentMode.length > 0) {
      setOpen(false);
      setPauseAgentsTarget(target);
      return;
    }

    // LIVE requiere confirmación
    if (target === 'LIVE') {
      setOpen(false);
      setConfirmLive(true);
      return;
    }

    // SANDBOX / TESTNET → cambio directo
    doSwitch(target);
    setOpen(false);
  }

  function handlePauseAndSwitch() {
    stopByMode.mutate(mode, {
      onSuccess: () => {
        const target = pauseAgentsTarget!;
        setPauseAgentsTarget(null);
        // Si el destino es LIVE, mostrar confirmación adicional
        if (target === 'LIVE') {
          setConfirmLive(true);
        } else {
          doSwitch(target);
        }
      },
    });
  }

  function doSwitch(target: TradingMode) {
    updateMode.mutate(target, {
      onSuccess: () => {
        toast.success(
          t('modeSelector.switchedSuccess', {
            mode: t(MODE_CONFIG[target].labelKey),
          }),
        );
      },
    });
  }

  if (isLoading) return null;

  const activeCfg = MODE_CONFIG[mode];
  const ActiveIcon = activeCfg.icon;

  return (
    <>
      {/* Trigger badge */}
      <button
        ref={triggerRef}
        onClick={handleToggle}
        disabled={updateMode.isPending}
        className={cn(
          'flex items-center gap-1.5 px-2 sm:px-2.5 py-2 rounded-md border text-xs font-medium transition-all',
          'hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          activeCfg.badgeClass,
          updateMode.isPending && 'opacity-50 cursor-not-allowed',
        )}
        aria-label={t('modeSelector.label', 'Modo de operación')}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', activeCfg.dotClass)} />
        <ActiveIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:block">{t(activeCfg.labelKey)}</span>
        <ChevronDown
          className={cn(
            'hidden sm:block h-3 w-3 transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown por portal */}
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            style={
              typeof window !== 'undefined' && window.innerWidth < 640
                ? {
                    top: coords.top,
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }
                : { top: coords.top, left: coords.left }
            }
            className="fixed z-[9999] w-52 rounded-xl border border-border bg-popover bg-card shadow-2xl overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-border">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('modeSelector.label', 'Modo de operación')}
              </p>
            </div>
            <div className="p-1">
              {ALL_MODES.map((m) => {
                const cfg = MODE_CONFIG[m];
                const Icon = cfg.icon;
                const isActive = m === mode;
                const isAvailable = availableModes.includes(m);

                return (
                  <button
                    key={m}
                    onClick={() => handleModeClick(m)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition-colors',
                      isActive
                        ? cn('font-medium', cfg.badgeClass)
                        : 'text-foreground hover:bg-muted',
                      !isAvailable && !isActive && 'opacity-50',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="block truncate">{t(cfg.labelKey)}</span>
                    </div>
                    {isActive && (
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full shrink-0',
                          cfg.dotClass,
                        )}
                      />
                    )}
                    {!isAvailable && !isActive && (
                      <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}

      {/* Modal credenciales requeridas */}
      {credentialsModal && (
        <CredentialsRequiredModal
          mode={credentialsModal}
          onClose={() => setCredentialsModal(null)}
        />
      )}

      {/* Modal confirmación LIVE */}
      {confirmLive && (
        <ConfirmLiveModal
          onConfirm={() => {
            setConfirmLive(false);
            doSwitch('LIVE');
          }}
          onClose={() => setConfirmLive(false)}
        />
      )}

      {/* Modal pausar agentes al cambiar de modo */}
      {pauseAgentsTarget && (
        <PauseAgentsModal
          fromMode={mode}
          toMode={pauseAgentsTarget}
          runningCount={
            agentStatuses?.filter((a) => a.isRunning && a.mode === mode)
              .length ?? 0
          }
          onConfirm={handlePauseAndSwitch}
          onClose={() => setPauseAgentsTarget(null)}
          isPending={stopByMode.isPending}
        />
      )}
    </>
  );
}
