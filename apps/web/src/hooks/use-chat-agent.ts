import { useState, useCallback, useEffect } from 'react';

export type AgentId =
  | 'platform'
  | 'operations'
  | 'market'
  | 'blockchain'
  | 'risk'
  | 'orchestrator';

export interface RoutingEvent {
  agentId: AgentId;
  greeting?: string;
}

export interface OrchestratingEvent {
  subAgents: AgentId[];
  step: string;
}

export interface UseChatAgentReturn {
  selectedAgentId: AgentId | null;
  routedAgentId: AgentId | null;
  isOrchestrating: boolean;
  orchestratingStep: string;
  selectAgent: (agentId: AgentId | null) => void;
  handleRoutingEvent: (event: RoutingEvent) => void;
  handleOrchestratingEvent: (event: OrchestratingEvent) => void;
  handleStreamDone: () => void;
  activeAgentId: AgentId | null;
}

export function useChatAgent(
  sessionAgentId?: string | null,
): UseChatAgentReturn {
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId | null>(null);
  const [routedAgentId, setRoutedAgentId] = useState<AgentId | null>(null);
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [orchestratingStep, setOrchestratingStep] = useState('');

  // Restore routedAgentId from session data (e.g. on page load / session switch)
  useEffect(() => {
    if (sessionAgentId && !selectedAgentId) {
      setRoutedAgentId(sessionAgentId as AgentId);
    }
  }, [sessionAgentId, selectedAgentId]);

  const selectAgent = useCallback((agentId: AgentId | null) => {
    setSelectedAgentId(agentId);
    setRoutedAgentId(null);
  }, []);

  const handleRoutingEvent = useCallback((event: RoutingEvent) => {
    setRoutedAgentId(event.agentId);
    setIsOrchestrating(false);
  }, []);

  const handleOrchestratingEvent = useCallback((event: OrchestratingEvent) => {
    setIsOrchestrating(true);
    setOrchestratingStep(event.step);
  }, []);

  const handleStreamDone = useCallback(() => {
    setIsOrchestrating(false);
    setOrchestratingStep('');
  }, []);

  const activeAgentId = routedAgentId ?? selectedAgentId;

  return {
    selectedAgentId,
    routedAgentId,
    isOrchestrating,
    orchestratingStep,
    selectAgent,
    handleRoutingEvent,
    handleOrchestratingEvent,
    handleStreamDone,
    activeAgentId,
  };
}
