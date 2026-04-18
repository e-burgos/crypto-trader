import { useRef } from 'react';

import { useTranslation } from 'react-i18next';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useAgents } from '../../hooks/use-admin-agents';
import type { AgentId } from '@crypto-trader/ui';
import { AgentCard } from '../../components/admin';

gsap.registerPlugin(useGSAP);

export function AdminAgentsPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { isLoading } = useAgents();

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
    <div ref={containerRef}>
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">{t('agents.pageDesc')}</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {agentIds.map((id) => (
            <div key={id} className="h-16 animate-pulse rounded-xl bg-muted" />
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
    </div>
  );
}
