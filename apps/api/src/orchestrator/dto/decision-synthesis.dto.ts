export interface SubAgentResult {
  agentId: string;
  task: string;
  output: string;
  /** True when this result was reused from a recent decision (within analysis interval TTL) */
  cached?: boolean;
}

export interface AegisVerdict {
  riskScore: number;
  verdict: 'PASS' | 'REDUCE' | 'BLOCK';
  positionSizeMultiplier: number;
  reason: string;
  alerts: string[];
}

export interface DecisionPayload {
  decision: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  /** Maps to suggestedWaitMinutes in TradingProcessor */
  waitMinutes: number;
  orchestrated: boolean;
  subAgentResults: SubAgentResult[];
}
