import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, TestTube, Activity, Lock, ChevronDown, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import type { TradingMode } from '../hooks/use-user';
import {
  usePlatformMode,
  useUpdatePlatformMode,
} from '../hooks/use-user';

// ── Config por modo ───────────────────────────────────────────────────────────

const MODE_CONFIG: Record<
  TradingMode,
  {
    icon: React.ElementType;
    label: string;
    descKey: string;
    badgeClass: string;
    dotClass: string;
  }
> = {
  SANDBOX: {
    icon: FlaskConical,
    label: 'Sandbox',
    descKey: 'modeSelector.sandboxDesc',
    badgeClass: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30 dark:text-yellow-400',
    dotClass: 'bg-yellow-500',
  },
  TESTNET: {
    icon: TestTube,
    label: 'Testnet',
    descKey: 'modeSelector.testnetDesc',
    badgeClass: 'bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400',
    dotClass: 'bg-orange-500',
  },
  LIVE: {
    icon: Activity,
    label: 'En Vivo',
    descKey: 'modeSelector.liveDesc',
    badgeClass: 'bg-green-500/15 text-green-600 border-green-500/30 dark:text-green-400',
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

  const tabTarget =
    mode === 'TESTNET' ? 'binance-testnet' : 'binance';

  function handleAddCredentials() {
    onClose();
    navigate(`/dashboard/settings?tab=${tabTarget}`);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg border', cfg.badgeClass)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">
              {t('modeSelector.credentialsModalTitle', { mode: cfg.label })}
            </h3>
            {mode === 'LIVE' && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <AlertTriangle className="h-3 w-3 text-orange-500" />
                {t('modeSelector.liveWarningShort', 'Dinero real')}
              </p>
            )}
          </div>
        </div>

        {/* Body */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t(descKey)}
        </p>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {t('modeSelector.credentialsModalCancel', 'Cancelar')}
          </button>
          <button
            onClick={handleAddCredentials}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg border bg-red-500/15 text-red-600 border-red-500/30">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-foreground text-sm">
            {t('modeSelector.switchConfirmTitle', 'Cambiar a modo En Vivo')}
          </h3>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          {t(
            'modeSelector.switchConfirmDesc',
            'Estás a punto de cambiar al modo EN VIVO. Las operaciones afectarán fondos reales en Binance.',
          )}
        </p>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {t('common.cancel', 'Cancelar')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            {t('modeSelector.confirmLive', 'Sí, cambiar a En Vivo')}
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

  const [open, setOpen] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState<TradingMode | null>(null);
  const [confirmLive, setConfirmLive] = useState(false);

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

  function doSwitch(target: TradingMode) {
    updateMode.mutate(target, {
      onSuccess: () => {
        toast.success(
          t('modeSelector.switchedSuccess', { mode: MODE_CONFIG[target].label }),
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
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all',
          'hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          activeCfg.badgeClass,
          updateMode.isPending && 'opacity-50 cursor-not-allowed',
        )}
        aria-label={t('modeSelector.label', 'Modo de operación')}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', activeCfg.dotClass)} />
        <ActiveIcon className="h-3.5 w-3.5" />
        <span>{activeCfg.label}</span>
        <ChevronDown
          className={cn(
            'h-3 w-3 transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown por portal */}
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ top: coords.top, left: coords.left }}
            className="fixed z-[100] w-52 rounded-xl border border-border bg-popover shadow-lg overflow-hidden"
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
                      <span className="block truncate">{cfg.label}</span>
                    </div>
                    {isActive && (
                      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg.dotClass)} />
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
    </>
  );
}
