import {
  Asset,
  QuoteCurrency,
  TradingMode,
  Decision,
  AgentStatus,
  PositionStatus,
  TradeType,
  UserRole,
  NotificationType,
  LLMProvider,
  Sentiment,
  RSISignal,
  MACDCrossover,
  BollingerPosition,
  Trend,
  VolumeSignal,
} from './enums';

// ── Candle / Market Data ─────────────────────────────────
export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

// ── Technical Indicators ─────────────────────────────────
export interface RSIResult {
  value: number;
  signal: RSISignal;
}

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  crossover: MACDCrossover;
}

export interface BollingerBandsResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
  position: BollingerPosition;
}

export interface EMACrossResult {
  ema9: number;
  ema21: number;
  ema50: number;
  ema200: number;
  trend: Trend;
}

export interface VolumeResult {
  current: number;
  average: number;
  ratio: number;
  signal: VolumeSignal;
}

export interface SupportResistance {
  support: number[];
  resistance: number[];
}

export interface IndicatorSnapshot {
  rsi: RSIResult;
  macd: MACDResult;
  bollingerBands: BollingerBandsResult;
  emaCross: EMACrossResult;
  volume: VolumeResult;
  supportResistance: SupportResistance;
  timestamp: number;
}

// ── LLM ──────────────────────────────────────────────────
export interface RecentDecisionRecord {
  decision: string;
  confidence: number;
  reasoning: string;
  createdAt: string;
}

export interface LLMAnalysisInput {
  asset: Asset;
  pair: QuoteCurrency;
  indicatorSnapshot: IndicatorSnapshot;
  recentCandles: Candle[];
  newsItems: NewsItem[];
  recentTrades: TradeRecord[];
  /** Last N agent decisions for this config (newest first) */
  recentDecisions?: RecentDecisionRecord[];
  userConfig: TradingConfigData;
  /** Weight (0-100) that news sentiment carries in the decision */
  newsWeight: number;
}

export interface LLMDecision {
  decision: Decision;
  confidence: number;
  reasoning: string;
  suggestedWaitMinutes: number;
}

export interface LLMCredentialData {
  provider: LLMProvider;
  apiKey: string;
  selectedModel: string;
}

// ── News ─────────────────────────────────────────────────
export interface NewsItem {
  id: string;
  source: string;
  headline: string;
  url: string;
  summary?: string;
  author?: string;
  sentiment: Sentiment;
  publishedAt: Date;
  cachedAt: Date;
}

// ── User / Auth ──────────────────────────────────────────
export interface UserData {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  tokens: TokenPair;
  user: UserData;
}

// ── Trading Config ───────────────────────────────────────
export interface TradingConfigData {
  id: string;
  userId: string;
  asset: Asset;
  pair: QuoteCurrency;
  buyThreshold: number;
  sellThreshold: number;
  stopLossPct: number;
  takeProfitPct: number;
  /** Minimum profit % required for LLM-driven SELL (e.g. 0.003 = 0.3%) */
  minProfitPct: number;
  maxTradePct: number;
  maxConcurrentPositions: number;
  minIntervalMinutes: number;
  mode: TradingMode;
  isRunning: boolean;
}

// ── Position ─────────────────────────────────────────────
export interface PositionData {
  id: string;
  userId: string;
  configId: string;
  asset: Asset;
  pair: QuoteCurrency;
  mode: TradingMode;
  entryPrice: number;
  quantity: number;
  entryAt: Date;
  exitPrice?: number;
  exitAt?: Date;
  status: PositionStatus;
  pnl?: number;
  fees: number;
}

export interface PositionValue {
  currentValue: number;
  unrealizedPnl: number;
  pnlPct: number;
}

// ── Trade ────────────────────────────────────────────────
export interface TradeRecord {
  id: string;
  userId: string;
  positionId: string;
  type: TradeType;
  price: number;
  quantity: number;
  fee: number;
  executedAt: Date;
  mode: TradingMode;
  binanceOrderId?: string;
}

// ── Agent Decision ───────────────────────────────────────
export interface AgentDecisionRecord {
  id: string;
  userId: string;
  asset: Asset;
  pair: QuoteCurrency;
  decision: Decision;
  confidence: number;
  reasoning: string;
  indicators: IndicatorSnapshot;
  newsHeadlines: string[];
  waitMinutes: number;
  createdAt: Date;
}

// ── Agent State ──────────────────────────────────────────
export interface AgentState {
  running: boolean;
  jobId?: string;
  lastRun?: Date;
  nextRun?: Date;
  currentInterval: number;
  status: AgentStatus;
}

// ── Notification ─────────────────────────────────────────
export interface NotificationData {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: Date;
}

// ── Analytics ────────────────────────────────────────────
export interface AnalyticsSummary {
  totalTrades: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  bestTrade: number;
  worstTrade: number;
  currentDrawdown: number;
  sharpeRatio: number;
}

// ── Binance ──────────────────────────────────────────────
export interface Balance {
  asset: string;
  free: number;
  locked: number;
}

export interface OrderResult {
  orderId: string;
  symbol: string;
  side: TradeType;
  price: number;
  quantity: number;
  status: string;
  executedAt: Date;
}

// ── WebSocket Events ─────────────────────────────────────
export interface WsTradeExecuted {
  trade: TradeRecord;
  position: PositionData;
}

export interface WsPositionUpdated {
  position: PositionData;
}

export interface WsAgentDecision {
  decision: AgentDecisionRecord;
}

export interface WsPriceTick {
  symbol: string;
  price: number;
  change24h: number;
}

export interface WsNotification {
  notification: NotificationData;
}

// ── Admin ────────────────────────────────────────────────
export interface AdminActionRecord {
  id: string;
  adminId: string;
  action: string;
  targetUserId?: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

export interface PlatformStats {
  totalUsers: number;
  totalTrades: number;
  totalPnl: number;
  activeAgents: number;
}
