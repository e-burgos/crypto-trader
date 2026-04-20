import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TradingConfig } from '../../hooks/use-trading';
import { useDeleteConfig } from '../../hooks/use-trading';

export function DeleteAgentModal({
  cfg,
  onClose,
}: {
  cfg: TradingConfig;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { mutate: deleteConfig, isPending } = useDeleteConfig();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleConfirm() {
    deleteConfig(cfg.id, { onSuccess: onClose });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
              <Trash2 className="h-4 w-4" />
            </div>
            <h2 className="font-bold">{t('config.deleteModal.title')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('config.deleteModal.body')}
          </p>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="font-semibold text-sm">
              {cfg.name || `${cfg.asset}/${cfg.pair}`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {cfg.mode} · {cfg.asset}/{cfg.pair}
            </p>
          </div>
          <p className="text-xs text-red-500/80">
            {t('config.deleteModal.warning')}
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 transition-colors disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {isPending ? t('common.deleting') : t('config.deleteModal.confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
