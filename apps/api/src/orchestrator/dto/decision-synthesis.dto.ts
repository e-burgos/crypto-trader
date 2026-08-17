export interface SubAgentResult {
  agentId: string;
  task: string;
  output: string;
  /** True when this result was reused from a recent decision (within analysis interval TTL) */
  cached?: boolean;
  /** LLM model used for this sub-agent call */
  model?: string;
  /** LLM provider used for this sub-agent call */
  provider?: string;
}

export const AEGIS_BLOCK_REASONS = [
  'SINGLE_ASSET_CONCENTRATION',
  'PORTFOLIO_EXPOSURE',
  'DRAWDOWN',
  'DAILY_LOSS_LIMIT',
  'MAX_POSITIONS',
  'VOLATILITY',
  'SYSTEMIC_RISK',
  'INSUFFICIENT_BALANCE',
  'OTHER',
] as const;
export type AegisBlockReason = (typeof AEGIS_BLOCK_REASONS)[number];

export interface AegisVerdict {
  riskScore: number;
  verdict: 'PASS' | 'REDUCE' | 'BLOCK';
  positionSizeMultiplier: number;
  blockReasons: AegisBlockReason[];
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
  /** LLM provider used for the synthesis call */
  llmProvider?: string;
  /** LLM model used for the synthesis call */
  llmModel?: string;
}
