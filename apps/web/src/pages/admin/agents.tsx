import { useRef, useState } from 'react';
import { Bot, Users } from 'lucide-react';

import { useTranslation } from 'react-i18next';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useAgents } from '../../hooks/use-admin-agents';
import {
  useAdminAgentConfigs,
  useUpdateAdminAgentConfig,
} from '../../hooks/use-agent-config';
import { useLLMKeys } from '../../hooks/use-user';
import type { AgentId } from '@crypto-trader/ui';
import { AgentCard } from '../../components/admin';
import { AdminAgentConfigCards } from '../../containers/admin/admin-agent-config-cards';
import { cn } from '../../lib/utils';

gsap.registerPlugin(useGSAP);

type Tab = 'status' | 'models';

export function AdminAgentsPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { isLoading } = useAgents();
  const [tab, setTab] = useState<Tab>('status');

  useGSAP(
    () => {
      if (isLoading) return;
      gsap.fromTo(
        '.agent-card',
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.06,
          duration: 0.3,
          ease: 'power2.out',
        },
      );
    },
    { scope: containerRef, dependencies: [isLoading] },
  );

  const agentIds: AgentId[] = [
    'orchestrator',
    'platform',
    'operations',
    'market',
    'blockchain',
    'risk',
  ];

  return (
    <div ref={containerRef} className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('admin.agentsPageTitle')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('admin.agentsPageSubtitle')}
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1 w-fit">
        <button
          onClick={() => setTab('status')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
            tab === 'status'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Users className="h-4 w-4" />
          {t('agents.tabStatus', { defaultValue: 'Agent Status' })}
        </button>
        <button
          onClick={() => setTab('models')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
            tab === 'models'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Bot className="h-4 w-4" />
          {t('agents.tabModels', { defaultValue: 'Default Models' })}
        </button>
      </div>

      {tab === 'status' && (
        <>
          {isLoading ? (
            <div className="space-y-3">
              {agentIds.map((id) => (
                <div
                  key={id}
                  className="h-16 animate-pulse rounded-xl bg-muted"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {agentIds.map((id) => (
                <div key={id} className="agent-card">
                  <AgentCard agentId={id} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'models' && <AdminAgentConfigCards />}
    </div>
  );
}
