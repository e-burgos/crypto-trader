/** Agent identifiers used across the chat domain. */
export type AgentId =
  | 'platform'
  | 'operations'
  | 'market'
  | 'blockchain'
  | 'risk'
  | 'orchestrator';

/** Chat capability categories. */
export type ChatCapability = 'help' | 'trade' | 'market' | 'blockchain';

/** A single chat message displayed in the message list. */
export interface ChatMessageItem {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: string;
  generatedBy?: string | null;
  metadata?: { capability?: string } | null;
}

/** Error from LLM stream. */
export interface StreamError {
  errorCode: string;
  message: string;
  retryAfter?: number;
}

/** Agent definition for the selector/header. */
export interface AgentConfig {
  id: AgentId;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

/** Summary of a chat session for the session panel. */
export interface ChatSessionSummary {
  id: string;
  title: string;
  provider: string;
  model: string;
  agentId?: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

/** LLM option for provider/model selection. */
export interface LLMOption {
  provider: string;
  label: string;
  model: string;
  models: string[];
}
