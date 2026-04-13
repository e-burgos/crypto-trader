export type SubAgentId =
  | 'platform'
  | 'operations'
  | 'market'
  | 'blockchain'
  | 'risk';

export interface IntentClassification {
  agentId: SubAgentId;
  confidence: number;
  reason: string;
  suggestedGreeting: string;
}
