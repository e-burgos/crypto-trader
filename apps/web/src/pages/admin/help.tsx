import { HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function AdminHelpPage() {
  const { t } = useTranslation();

  const sections = [
    {
      title: t('admin.helpDashboard'),
      desc: t('admin.helpDashboardDesc'),
      link: '/admin',
    },
    {
      title: t('admin.helpUsers'),
      desc: t('admin.helpUsersDesc'),
      link: '/admin/users',
    },
    {
      title: t('admin.helpAgents'),
      desc: t('admin.helpAgentsDesc'),
      link: '/admin/agents',
    },
    {
      title: t('admin.helpLLMs'),
      desc: t('admin.helpLLMsDesc'),
      link: '/admin/llm-management',
    },
    {
      title: t('admin.helpAuditLog'),
      desc: t('admin.helpAuditLogDesc'),
      link: '/admin/audit-log',
    },
    {
      title: t('admin.helpKillSwitch'),
      desc: t('admin.helpKillSwitchDesc'),
      link: '/admin',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('admin.helpTitle')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('admin.helpSubtitle')}
        </p>
      </div>

      {/* Quick reference cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.link}
            to={section.link}
            className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-sm"
          >
            <h3 className="mb-2 font-semibold group-hover:text-primary transition-colors">
              {section.title}
            </h3>
            <p className="text-sm text-muted-foreground">{section.desc}</p>
          </Link>
        ))}
      </div>

      {/* General Help link */}
      <div className="rounded-xl border border-border bg-muted/20 p-5">
        <h2 className="mb-2 font-semibold">{t('admin.helpGeneral')}</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          {t('admin.helpGeneralDesc')}
        </p>
        <Link
          to="/help"
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('admin.helpGoToGuide')} →
        </Link>
      </div>
    </div>
  );
}
