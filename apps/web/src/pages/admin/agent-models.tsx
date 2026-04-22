import { Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminAgentConfigCards } from '../../containers/admin/admin-agent-config-cards';

export function AdminAgentModelsPage() {
  const { t } = useTranslation();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('admin.agentModelsTitle')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('admin.agentModelsSubtitle')}
        </p>
      </div>

      {/* Default Agent Models */}
      <AdminAgentConfigCards />
    </div>
  );
}
