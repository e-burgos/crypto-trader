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
  provider?: string;
  model?: string;
}

export interface OrchestratingEvent {
  subAgents: AgentId[];
  step: string;
}

export interface UseChatAgentReturn {
  selectedAgentId: AgentId | null;
  routedAgentId: AgentId | null;
  routedProvider: string | null;
  routedModel: string | null;
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
  activeSessionId?: string | null,
): UseChatAgentReturn {
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId | null>(null);
  const [routedAgentId, setRoutedAgentId] = useState<AgentId | null>(null);
  const [routedProvider, setRoutedProvider] = useState<string | null>(null);
  const [routedModel, setRoutedModel] = useState<string | null>(null);
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [orchestratingStep, setOrchestratingStep] = useState('');

  // Reset all agent state when session becomes null (new session) or changes
  useEffect(() => {
    if (!activeSessionId) {
      setSelectedAgentId(null);
      setRoutedAgentId(null);
      setRoutedProvider(null);
      setRoutedModel(null);
      setIsOrchestrating(false);
      setOrchestratingStep('');
    }
  }, [activeSessionId]);

  // Restore routedAgentId from session data (e.g. on page load / session switch)
  // Only when no explicit selection has been made
  useEffect(() => {
    if (sessionAgentId && !selectedAgentId) {
      setRoutedAgentId(sessionAgentId as AgentId);
    }
  }, [sessionAgentId, selectedAgentId]);

  const selectAgent = useCallback((agentId: AgentId | null) => {
    setSelectedAgentId(agentId);
    setRoutedAgentId(null);
  }, []);

  const handleRoutingEvent = useCallback(
    (event: RoutingEvent) => {
      // Only apply routing if the user hasn't explicitly selected an agent
      if (!selectedAgentId) {
        setRoutedAgentId(event.agentId);
      }
      if (event.provider) setRoutedProvider(event.provider);
      if (event.model) setRoutedModel(event.model);
      setIsOrchestrating(false);
    },
    [selectedAgentId],
  );

  const handleOrchestratingEvent = useCallback((event: OrchestratingEvent) => {
    setIsOrchestrating(true);
    setOrchestratingStep(event.step);
  }, []);

  const handleStreamDone = useCallback(() => {
    setIsOrchestrating(false);
    setOrchestratingStep('');
  }, []);

  // Explicit user selection takes priority over backend routing
  const activeAgentId = selectedAgentId ?? routedAgentId;

  return {
    selectedAgentId,
    routedAgentId,
    routedProvider,
    routedModel,
    isOrchestrating,
    orchestratingStep,
    selectAgent,
    handleRoutingEvent,
    handleOrchestratingEvent,
    handleStreamDone,
    activeAgentId,
  };
}
