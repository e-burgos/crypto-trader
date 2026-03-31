// Mock for generated/prisma/client — used by Jest to avoid ESM resolution issues
export class PrismaClient {}
export const $Enums = {
  UserRole: { ADMIN: 'ADMIN', TRADER: 'TRADER', VIEWER: 'VIEWER' },
  LLMProvider: { OPENAI: 'OPENAI', CLAUDE: 'CLAUDE', DEEPSEEK: 'DEEPSEEK' },
  OrderSide: { BUY: 'BUY', SELL: 'SELL' },
  OrderType: { MARKET: 'MARKET', LIMIT: 'LIMIT', STOP_LOSS: 'STOP_LOSS' },
  PositionStatus: { OPEN: 'OPEN', CLOSED: 'CLOSED', LIQUIDATED: 'LIQUIDATED' },
  AgentAction: { BUY: 'BUY', SELL: 'SELL', HOLD: 'HOLD', CLOSE: 'CLOSE' },
  NewsSentiment: { POSITIVE: 'POSITIVE', NEGATIVE: 'NEGATIVE', NEUTRAL: 'NEUTRAL' },
  NotificationType: { TRADE_EXECUTED: 'TRADE_EXECUTED', POSITION_CLOSED: 'POSITION_CLOSED', RISK_ALERT: 'RISK_ALERT', DAILY_SUMMARY: 'DAILY_SUMMARY', SYSTEM: 'SYSTEM' },
};
