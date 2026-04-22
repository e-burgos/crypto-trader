import { BotMessageSquare, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminAgentConfigCards } from '../../containers/admin/admin-agent-config-cards';
import { ProviderStatusGrid } from '../../containers/settings/provider-status-grid';

export function AdminLLMManagementPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <BotMessageSquare className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('admin.llmTitle')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('admin.llmSubtitle')}
        </p>
      </div>

      {/* Provider Status */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          {t('admin.llmProviderStatus')}
        </h2>
        <ProviderStatusGrid />
      </div>

      {/* Default Agent Models */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-2 font-semibold">{t('admin.llmDefaultModels')}</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {t('admin.llmDefaultModelsDesc')}
        </p>
        <AdminAgentConfigCards />
      </div>
    </div>
  );
}
