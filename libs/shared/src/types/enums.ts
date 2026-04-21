// ── Asset & Pair ──────────────────────────────────────────
export enum Asset {
  BTC = 'BTC',
  ETH = 'ETH',
}

export enum QuoteCurrency {
  USDT = 'USDT',
  USDC = 'USDC',
}

// ── Trading ──────────────────────────────────────────────
export enum TradingMode {
  LIVE = 'LIVE',
  SANDBOX = 'SANDBOX',
  TESTNET = 'TESTNET',
}

export enum Decision {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD',
}

export enum AgentStatus {
  RUNNING = 'RUNNING',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR',
  PAUSED = 'PAUSED',
}

export enum PositionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum TradeType {
  BUY = 'BUY',
  SELL = 'SELL',
}

// ── User ─────────────────────────────────────────────────
export enum UserRole {
  TRADER = 'TRADER',
  ADMIN = 'ADMIN',
}

// ── Notifications ────────────────────────────────────────
export enum NotificationType {
  TRADE_EXECUTED = 'TRADE_EXECUTED',
  STOP_LOSS_TRIGGERED = 'STOP_LOSS_TRIGGERED',
  TAKE_PROFIT_HIT = 'TAKE_PROFIT_HIT',
  AGENT_ERROR = 'AGENT_ERROR',
  AGENT_STARTED = 'AGENT_STARTED',
  AGENT_STOPPED = 'AGENT_STOPPED',
  AGENT_KILLED = 'AGENT_KILLED',
}

// ── LLM Providers ────────────────────────────────────────
export enum LLMProvider {
  CLAUDE = 'CLAUDE',
  OPENAI = 'OPENAI',
  GROQ = 'GROQ',
  GEMINI = 'GEMINI',
  MISTRAL = 'MISTRAL',
  TOGETHER = 'TOGETHER',
  OPENROUTER = 'OPENROUTER',
}
// ── Risk Profile ─────────────────────────────────────────────────
export enum RiskProfile {
  CONSERVATIVE = 'CONSERVATIVE',
  MODERATE = 'MODERATE',
  AGGRESSIVE = 'AGGRESSIVE',
}
// ── News ─────────────────────────────────────────────────
export enum Sentiment {
  POSITIVE = 'POSITIVE',
  NEUTRAL = 'NEUTRAL',
  NEGATIVE = 'NEGATIVE',
}

// ── Agent IDs ────────────────────────────────────────────
export enum AgentId {
  PLATFORM = 'platform',
  OPERATIONS = 'operations',
  MARKET = 'market',
  BLOCKCHAIN = 'blockchain',
  RISK = 'risk',
  ORCHESTRATOR = 'orchestrator',
  ROUTING = 'routing',
  SYNTHESIS = 'synthesis',
}

// ── Indicators ───────────────────────────────────────────
export enum RSISignal {
  OVERBOUGHT = 'OVERBOUGHT',
  NEUTRAL = 'NEUTRAL',
  OVERSOLD = 'OVERSOLD',
}

export enum MACDCrossover {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NONE = 'NONE',
}

export enum BollingerPosition {
  ABOVE = 'ABOVE',
  INSIDE = 'INSIDE',
  BELOW = 'BELOW',
}

export enum Trend {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NEUTRAL = 'NEUTRAL',
}

export enum VolumeSignal {
  HIGH = 'HIGH',
  NORMAL = 'NORMAL',
  LOW = 'LOW',
}
