// Mock for generated/prisma/client — used by Jest to avoid ESM resolution issues
export class PrismaClient {}

class PrismaClientKnownRequestError extends Error {
  code: string;
  meta?: Record<string, unknown>;
  clientVersion: string;
  batchRequestIdx?: number;

  constructor(
    message: string,
    {
      code,
      clientVersion,
      meta,
      batchRequestIdx,
    }: {
      code: string;
      clientVersion: string;
      meta?: Record<string, unknown>;
      batchRequestIdx?: number;
    },
  ) {
    super(message);
    this.code = code;
    this.clientVersion = clientVersion;
    this.meta = meta;
    this.batchRequestIdx = batchRequestIdx;
  }
}

export const Prisma = {
  PrismaClientKnownRequestError,
};
export const $Enums = {
  UserRole: { ADMIN: 'ADMIN', TRADER: 'TRADER', VIEWER: 'VIEWER' },
  LLMProvider: {
    OPENAI: 'OPENAI',
    CLAUDE: 'CLAUDE',
    GROQ: 'GROQ',
    GEMINI: 'GEMINI',
    MISTRAL: 'MISTRAL',
    TOGETHER: 'TOGETHER',
    OPENROUTER: 'OPENROUTER',
  },
  LLMSource: { TRADING: 'TRADING', CHAT: 'CHAT', ANALYSIS: 'ANALYSIS' },
  OrderSide: { BUY: 'BUY', SELL: 'SELL' },
  OrderType: { MARKET: 'MARKET', LIMIT: 'LIMIT', STOP_LOSS: 'STOP_LOSS' },
  PositionStatus: { OPEN: 'OPEN', CLOSED: 'CLOSED', LIQUIDATED: 'LIQUIDATED' },
  AgentAction: { BUY: 'BUY', SELL: 'SELL', HOLD: 'HOLD', CLOSE: 'CLOSE' },
  NewsSentiment: {
    POSITIVE: 'POSITIVE',
    NEGATIVE: 'NEGATIVE',
    NEUTRAL: 'NEUTRAL',
  },
  NotificationType: {
    TRADE_EXECUTED: 'TRADE_EXECUTED',
    POSITION_CLOSED: 'POSITION_CLOSED',
    RISK_ALERT: 'RISK_ALERT',
    DAILY_SUMMARY: 'DAILY_SUMMARY',
    SYSTEM: 'SYSTEM',
  },
  AgentId: {
    platform: 'platform',
    operations: 'operations',
    market: 'market',
    blockchain: 'blockchain',
    risk: 'risk',
    orchestrator: 'orchestrator',
    routing: 'routing',
    synthesis: 'synthesis',
  },
};
export const LLMProvider = $Enums.LLMProvider;
export const LLMSource = $Enums.LLMSource;
export const TradingMode = {
  LIVE: 'LIVE',
  SANDBOX: 'SANDBOX',
  TESTNET: 'TESTNET',
  PAPER: 'PAPER',
};
export const NotificationType = $Enums.NotificationType;
export const RiskProfile = {
  CONSERVATIVE: 'CONSERVATIVE',
  MODERATE: 'MODERATE',
  AGGRESSIVE: 'AGGRESSIVE',
};
export const AgentId = $Enums.AgentId;
export const NewsApiProvider = {
  CRYPTOPANIC: 'CRYPTOPANIC',
  NEWSDATA: 'NEWSDATA',
};
export const DataSourceCategory = {
  TECHNICAL: 'TECHNICAL',
  SENTIMENT: 'SENTIMENT',
  DERIVATIVES: 'DERIVATIVES',
  DEFI_ONCHAIN: 'DEFI_ONCHAIN',
  NEWS: 'NEWS',
  MARKET_DATA: 'MARKET_DATA',
  PREDICTION: 'PREDICTION',
  TOKEN_UNLOCKS: 'TOKEN_UNLOCKS',
};
export const AgentOutcomeStatus = {
  PENDING: 'PENDING',
  WIN: 'WIN',
  LOSS: 'LOSS',
  NEUTRAL: 'NEUTRAL',
  MISSED_OPPORTUNITY: 'MISSED_OPPORTUNITY',
  AVOIDED_LOSS: 'AVOIDED_LOSS',
  NOT_EVALUABLE: 'NOT_EVALUABLE',
};
export const PositionProtectionStatus = {
  NONE: 'NONE',
  PENDING: 'PENDING',
  PROTECTED: 'PROTECTED',
  UNPROTECTED: 'UNPROTECTED',
  RELEASED: 'RELEASED',
};
export const PositionExitReason = {
  LLM_SIGNAL: 'LLM_SIGNAL',
  LOSS_CUT: 'LOSS_CUT',
  STOP_LOSS: 'STOP_LOSS',
  TAKE_PROFIT: 'TAKE_PROFIT',
  TRAILING_STOP: 'TRAILING_STOP',
  TIME_EXIT: 'TIME_EXIT',
  PARTIAL_TP: 'PARTIAL_TP',
  EXCHANGE_STOP: 'EXCHANGE_STOP',
  EXCHANGE_TAKE_PROFIT: 'EXCHANGE_TAKE_PROFIT',
  PROTECTION_FAILURE: 'PROTECTION_FAILURE',
  MANUAL: 'MANUAL',
};
