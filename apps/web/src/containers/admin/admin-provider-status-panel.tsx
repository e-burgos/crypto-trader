import { useState } from 'react';
import { Shield, Power } from 'lucide-react';
import { Badge, Dialog, ToggleSwitch } from '@crypto-trader/ui';
import { useTranslation } from 'react-i18next';
import {
  useAdminLLMProviderStatus,
  useToggleLLMProvider,
  type PlatformLLMProviderStatus,
} from '../../hooks/use-admin';

export function AdminProviderStatusPanel() {
  const { t } = useTranslation();
  const { data: providers = [], isLoading } = useAdminLLMProviderStatus();
  const { mutate: toggleProvider, isPending } = useToggleLLMProvider();
  const [confirmTarget, setConfirmTarget] =
    useState<PlatformLLMProviderStatus | null>(null);

  function handleToggle(provider: PlatformLLMProviderStatus) {
    if (provider.isActive) {
      setConfirmTarget(provider);
    } else {
      toggleProvider(provider.provider);
    }
  }

  function confirmDisable() {
    if (confirmTarget) {
      toggleProvider(confirmTarget.provider);
      setConfirmTarget(null);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 animate-pulse">
        <div className="h-6 w-48 bg-muted rounded" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          {t('admin.providerStatusTitle')}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {t('admin.providerStatusSubtitle')}
        </p>

        <div className="divide-y divide-border">
          {providers.map((p) => (
            <div
              key={p.provider}
              className="flex items-center justify-between py-3"
            >
              <div className="flex items-center gap-3">
                <Power
                  className={`h-4 w-4 ${p.isActive ? 'text-green-400' : 'text-red-400'}`}
                />
                <span className="font-medium">{p.provider}</span>
                <Badge
                  variant={p.isActive ? 'success' : 'error'}
                  label={
                    p.isActive
                      ? t('admin.providerActive')
                      : t('admin.providerInactive')
                  }
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {new Date(p.updatedAt).toLocaleDateString()}
                </span>
                <ToggleSwitch
                  checked={p.isActive}
                  onChange={() => handleToggle(p)}
                  disabled={isPending}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        title={t('admin.providerToggleConfirmTitle')}
        variant="danger"
        onConfirm={confirmDisable}
        confirmLabel={t('admin.providerToggleConfirmAction')}
        cancelLabel={t('common.cancel')}
      >
        <p className="text-sm text-muted-foreground">
          {t('admin.providerToggleConfirmDesc', {
            provider: confirmTarget?.provider,
          })}
        </p>
      </Dialog>
    </>
  );
}
