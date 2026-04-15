import { Asset, QuoteCurrency } from '../types/enums';

// ── Supported Trading Pairs ──────────────────────────────
export const SUPPORTED_PAIRS = [
  { asset: Asset.BTC, quote: QuoteCurrency.USDT, symbol: 'BTCUSDT' },
  { asset: Asset.BTC, quote: QuoteCurrency.USDC, symbol: 'BTCUSDC' },
  { asset: Asset.ETH, quote: QuoteCurrency.USDT, symbol: 'ETHUSDT' },
  { asset: Asset.ETH, quote: QuoteCurrency.USDC, symbol: 'ETHUSDC' },
] as const;

// ── Fees ─────────────────────────────────────────────────
export const TRADE_FEE_PCT = 0.001; // 0.1% Binance fee

// ── Agent Defaults ───────────────────────────────────────
export const MAX_ACTIVE_AGENTS_PER_USER = 4;
export const DEFAULT_MIN_INTERVAL_MINUTES = 5;
export const DEFAULT_BUY_THRESHOLD = 70;
export const DEFAULT_SELL_THRESHOLD = 70;
export const DEFAULT_STOP_LOSS_PCT = 0.03; // 3%
export const DEFAULT_TAKE_PROFIT_PCT = 0.05; // 5%
export const DEFAULT_MAX_TRADE_PCT = 0.05; // 5% (conservative)
export const DEFAULT_MAX_CONCURRENT_POSITIONS = 2;
export const DEFAULT_SANDBOX_BALANCE = 10000; // 10k virtual USDT

// ── Candle Intervals ─────────────────────────────────────
export const CANDLE_INTERVALS = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
] as const;

export type CandleInterval = (typeof CANDLE_INTERVALS)[number];

export const DEFAULT_CANDLE_INTERVAL: CandleInterval = '1h';
export const DEFAULT_CANDLE_LIMIT = 200;

// ── Indicator Defaults ───────────────────────────────────
export const RSI_PERIOD = 14;
export const RSI_OVERBOUGHT = 70;
export const RSI_OVERSOLD = 30;

export const MACD_FAST = 12;
export const MACD_SLOW = 26;
export const MACD_SIGNAL = 9;

export const BOLLINGER_PERIOD = 20;
export const BOLLINGER_STD_DEV = 2;

export const EMA_PERIODS = [9, 21, 50, 200] as const;
export const VOLUME_PERIOD = 20;

// ── LLM Defaults ─────────────────────────────────────────
export const LLM_MAX_TOKENS = 1024;
export const LLM_TEMPERATURE = 0.3;
export const LLM_MAX_RETRIES = 2;

export const LLM_MODELS = {
  CLAUDE: ['claude-sonnet-4-6', 'claude-haiku-4-5'],
  OPENAI: ['gpt-4o', 'gpt-4o-mini'],
  GROQ: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
} as const;

// ── Binance Rate Limits ──────────────────────────────────
export const BINANCE_RATE_LIMIT_WEIGHT = 1200; // per minute
export const BINANCE_WS_RECONNECT_DELAY_MS = 5000;

// ── Auth ─────────────────────────────────────────────────
export const ACCESS_TOKEN_EXPIRY = '15m';
export const REFRESH_TOKEN_EXPIRY = '7d';
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const BCRYPT_SALT_ROUNDS = 12;

// ── News Cache ───────────────────────────────────────────
export const NEWS_CACHE_TTL_SECONDS = 600; // 10 minutes

// ── Pagination ───────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
