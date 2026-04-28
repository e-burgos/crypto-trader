import { Trash2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TradingConfig } from '../../hooks/use-trading';
import { useDeleteConfig } from '../../hooks/use-trading';
import { TabModal } from '@crypto-trader/ui';

export function DeleteAgentModal({
  cfg,
  onClose,
}: {
  cfg: TradingConfig;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { mutate: deleteConfig, isPending } = useDeleteConfig();

  function handleConfirm() {
    deleteConfig(cfg.id, { onSuccess: onClose });
  }

  const content = (
    <div className="space-y-3">
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
  );

  return (
    <TabModal
      icon={Trash2}
      title={t('config.deleteModal.title')}
      content={content}
      successButton={{
        label: isPending
          ? t('common.deleting')
          : t('config.deleteModal.confirm'),
        onClick: handleConfirm,
      }}
      closeButton={{
        label: t('common.cancel'),
        onClick: onClose,
      }}
      onClose={onClose}
    />
  );
}
