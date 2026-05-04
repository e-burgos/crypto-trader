export interface MacroContextOutput {
  regime: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  keyFactors: string[];
  reasoning: string;
}
