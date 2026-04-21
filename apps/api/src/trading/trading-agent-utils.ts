const RISK_PROFILES: Record<string, string> = {
  CONSERVATIVE: 'Safe',
  MODERATE: 'Balanced',
  AGGRESSIVE: 'Alpha',
};

/**
 * Generates an auto-name for a trading agent based on its configuration.
 * Format: {Asset}-{Profile}
 *
 * Examples:
 *   "BTC-Safe"
 *   "ETH-Alpha"
 *   "BTC-Balanced"
 */
export function generateAgentName(config: {
  asset: string;
  riskProfile: string;
}): string {
  const profile = RISK_PROFILES[config.riskProfile] ?? 'Balanced';
  return `${config.asset}-${profile}`;
}
