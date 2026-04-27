import {
  useAgentData,
  OrchestratorHero,
  PipelineSection,
  AgentCard,
} from '../../components/agents-showcase';

/* ── Main Page ── */
/* ── Main Page ── */
export function AgentsShowcasePage() {
  const agents = useAgentData();

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6 pb-12">
      <OrchestratorHero />
      <PipelineSection />

      <div className="space-y-4">
        {agents.map((agent, i) => (
          <AgentCard key={agent.id} agent={agent} index={i} />
        ))}
      </div>
    </div>
  );
}

/* ── Embeddable Section (for Help page and Docs) ── */
export function AgentsShowcaseSection({
  hideChatCta = false,
}: {
  hideChatCta?: boolean;
}) {
  const agents = useAgentData();

  return (
    <div className="space-y-6">
      <OrchestratorHero hideChatCta={hideChatCta} />
      <PipelineSection />

      <div className="space-y-4">
        {agents.map((agent, i) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            index={i}
            hideChatCta={hideChatCta}
          />
        ))}
      </div>
    </div>
  );
}
