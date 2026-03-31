# Crypto Trader — Design Specification

**Version:** 1.1
**Date:** 2026-03-31
**Status:** Approved

---

## 1. Overview

Crypto Trader is a fullstack autonomous trading platform that uses a hybrid AI agent (technical indicators + LLM reasoning) to buy and sell BTC and ETH against USDT/USDC on Binance. Multiple users can connect their own Binance API keys and operate independently. The platform includes a real-money trading mode and a sandbox (paper trading) mode.

The agent continuously analyzes historical market data, technical indicators, and crypto news to detect buy/sell opportunities within user-defined thresholds. Over time it adapts its analysis intervals based on accumulated trading experience.

---

## 2. Goals

- **Autonomous trading**: The agent operates without manual intervention once configured.
- **Hybrid intelligence**: Combines classical technical analysis with LLM-based reasoning (Claude API).
- **Multi-user**: Each user manages their own funds, API keys, thresholds, and trade history.
- **Safe by default**: Sandbox mode allows full simulation before risking real funds.
- **Transparent**: Full dashboard with real-time charts, P&L, decision logs, and news context.
- **Adaptive**: The agent learns optimal analysis intervals and refines strategy from trade history.

---

## 3. Non-Goals (Phase 1)

- MetaMask / on-chain / DEX trading (Phase 2).
- Futures, margin, or leveraged trading.
- Mobile app.
- Social/copy trading features.

---

## 4. Users

| Role | Description |
|------|-------------|
| **Trader (user)** | Registers, connects Binance API keys, funds account, configures thresholds, starts/stops the agent. |
| **Admin** | Platform owner; can view all users, pause the system, manage global settings. |

---

## 5. Core Features

### 5.1 Authentication & Multi-user
- Email/password registration and login (JWT + refresh tokens).
- Each user has isolated: Binance API credentials (encrypted at rest), trading configuration, portfolio, trade history.
- Admin role with protected routes.

### 5.2 Wallet & Funding
- Users connect their Binance account via API Key + Secret (read + trading permissions).
- Initial funding: user deposits USDT or USDC into their Binance account manually; the app reads the balance via API.
- The app tracks internal "virtual balance" for reporting, but real funds live on Binance.
- Supported base pairs: `BTC/USDT`, `BTC/USDC`, `ETH/USDT`, `ETH/USDC`.

### 5.3 Trading Agent

#### 5.3.1 Analysis Pipeline (runs every N minutes — N is adaptive)
```
1. Fetch latest OHLCV candles (Binance API)
2. Compute technical indicators
3. Fetch latest crypto news (free sources)
4. Run LLM analysis (Claude API) combining indicators + news + trade history
5. Produce a trading decision: BUY | SELL | HOLD + confidence score + reasoning
6. Execute trade if confidence ≥ user threshold
7. Log decision + result to DB
8. Update adaptive interval based on volatility and recent accuracy
```

#### 5.3.2 Technical Indicators
- RSI (14)
- MACD (12, 26, 9)
- Bollinger Bands (20, 2)
- EMA (9, 21, 50, 200)
- Volume analysis
- Support & Resistance levels

#### 5.3.3 LLM Brain (Claude API)
- Receives a structured prompt containing:
  - Current indicators snapshot
  - Last N candles summary
  - Latest news headlines + sentiment
  - Recent trade history (last 10 trades) for self-reflection
  - User-configured thresholds and risk tolerance
- Returns structured JSON: `{ decision, confidence, reasoning, suggested_wait_minutes }`
- `suggested_wait_minutes` drives the adaptive interval.

#### 5.3.4 News Sources (free)
- **CryptoPanic API** (free tier) — aggregated crypto news with sentiment scores
- **CoinGecko /news** endpoint (free)
- **Reddit API** — r/bitcoin, r/ethereum, r/CryptoCurrency (top posts, last hour)
- **RSS feeds** — CoinDesk, Cointelegraph, Decrypt (parsed server-side)

#### 5.3.5 Buy/Sell Thresholds
User configures per-asset:
- `buy_threshold`: minimum confidence score (0–100) to trigger a BUY
- `sell_threshold`: minimum confidence score to trigger a SELL
- `stop_loss_pct`: automatic SELL if asset drops X% from last buy price
- `take_profit_pct`: automatic SELL if asset gains X% from last buy price
- `max_trade_pct`: max % of available balance per single trade (default: 20%)
- `max_concurrent_positions`: max open positions at once (default: 2)
- `min_interval_minutes`: minimum wait between analyses (default: 5, configurable per user)

### 5.4 Sandbox (Paper Trading) Mode
- Full simulation with no real orders placed.
- Uses a virtual wallet funded with a user-defined amount of virtual USDT/USDC.
- Real market prices fetched from Binance (same pipeline).
- Same agent logic, same indicators, same LLM calls.
- Separate trade history from live trades.
- P&L computed on virtual positions.
- Users can switch between live and sandbox per-session; cannot be live and sandbox simultaneously.

### 5.5 Dashboard (Frontend)
- **Overview**: total portfolio value, P&L today/week/all-time, active positions, agent status.
- **Live chart**: TradingView-style candlestick chart with indicator overlays (BTC/ETH).
- **Trade history**: table with filters (date, asset, mode, result).
- **Agent log**: timeline of every decision with reasoning and news context.
- **Configuration panel**: thresholds, API keys, sandbox/live toggle, start/stop agent.
- **News feed**: latest news used by the agent with sentiment labels.
- **Performance analytics**: win rate, avg profit per trade, drawdown, Sharpe ratio (basic).

### 5.6 Notifications (Phase 1: in-app only)
- Toast notifications for: trade executed, stop-loss triggered, take-profit hit, agent error.
- Notification center in the dashboard.

---

## 6. Architecture

### 6.1 Monorepo Structure (NX)
```
crypto-trader/
├── apps/
│   ├── web/                  # React 19 + Vite (GitHub Pages)
│   └── api/                  # NestJS (Railway)
├── libs/
│   ├── trading-engine/       # Core buy/sell logic, order execution
│   ├── analysis/             # Technical indicators + LLM integration
│   ├── data-fetcher/         # Binance OHLCV, news APIs, RSS
│   ├── shared/               # Types, DTOs, constants, utils
│   └── ui/                   # Shared React components
├── docs/
│   ├── specs/
│   └── plans/
└── nx.json
```

### 6.2 Backend (NestJS — Railway)
**Modules:**
- `AuthModule` — JWT auth, refresh tokens, bcrypt passwords
- `UsersModule` — user CRUD, Binance key management (AES-256 encryption)
- `TradingModule` — agent lifecycle (start/stop), order execution, position tracking
- `AnalysisModule` — technical indicators, LLM calls, news fetching
- `DataModule` — Binance WebSocket feeds, OHLCV storage, news cache
- `NotificationsModule` — in-app notification queue
- `AdminModule` — platform-level management

**Infrastructure:**
- PostgreSQL (Railway) via Prisma ORM
- Redis (Railway) for: WebSocket pub/sub, news cache, agent state
- Bull queues for: analysis jobs, order execution, news refresh
- WebSocket gateway (Socket.io) for real-time dashboard updates

### 6.3 Frontend (React 19 — GitHub Pages)
- Vite build, deployed as static site to GitHub Pages
- React Query for server state
- Zustand for client state
- Socket.io client for real-time updates
- Recharts + custom candlestick for charts
- Animations: Emil Kowalski principles (purposeful, fast, accessible)
- Design system: UI/UX Pro Max skill guidelines
- React Router v7 for navigation
- React Hook Form + Zod for forms

### 6.4 Database Schema (Prisma)

**Key models:**
- `User` — id, email, passwordHash, role, createdAt
- `BinanceCredential` — userId, apiKeyEncrypted, secretEncrypted, isActive
- `TradingConfig` — userId, asset, pair, buyThreshold, sellThreshold, stopLossPct, takeProfitPct, maxTradePct, maxPositions, isActive, mode (LIVE | SANDBOX)
- `Position` — id, userId, asset, pair, mode, entryPrice, quantity, entryAt, exitPrice, exitAt, status (OPEN | CLOSED), pnl
- `Trade` — id, userId, positionId, type (BUY | SELL), price, quantity, fee, executedAt, mode, binanceOrderId
- `AgentDecision` — id, userId, asset, decision, confidence, reasoning, indicators (JSON), newsHeadlines (JSON), waitMinutes, createdAt
- `NewsItem` — id, source, headline, url, sentiment, publishedAt, cachedAt
- `Notification` — id, userId, type, message, read, createdAt

---

## 7. API Design

### REST (NestJS)
- `POST /auth/register` — create account
- `POST /auth/login` — returns JWT + refresh token
- `POST /auth/refresh` — rotate tokens
- `GET/PUT /users/me` — profile management
- `POST/DELETE /users/me/binance-keys` — manage API keys
- `GET/PUT /trading/config` — read/update trading configuration
- `POST /trading/start` — start agent (live or sandbox)
- `POST /trading/stop` — stop agent
- `GET /trading/positions` — open positions
- `GET /trading/history` — trade history (paginated, filterable)
- `GET /trading/decisions` — agent decision log
- `GET /market/ohlcv/:asset/:interval` — candlestick data
- `GET /market/news` — latest news feed
- `GET /analytics/summary` — P&L summary, win rate, etc.

### WebSocket Events (Socket.io)
- `trade:executed` — new trade placed
- `position:updated` — position P&L update
- `agent:decision` — new agent decision
- `price:tick` — real-time price update
- `notification:new` — in-app notification

---

## 8. Security

- Binance API keys encrypted with AES-256-GCM, key stored in env var (never in DB plain).
- JWT short-lived (15 min) + refresh token rotation.
- Rate limiting on all endpoints (NestJS Throttler).
- CORS restricted to known origins.
- No Binance withdrawal permissions required (trading only).
- Sandbox mode cannot execute real orders by design (enforced server-side).
- All LLM calls server-side only (Claude API key never exposed to client).

---

## 9. Deployment

| Environment | Service | Notes |
|-------------|---------|-------|
| Frontend (prod) | GitHub Pages | Static build via GitHub Actions |
| Backend (prod) | Railway | NestJS + PostgreSQL + Redis |
| Local (dev) | Docker Compose | All services: api, web, postgres, redis |
| CI/CD | GitHub Actions | Lint → test → build → deploy on merge to main |

**Environment Variables (Backend):**
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `BINANCE_KEY_ENCRYPTION_KEY` — AES-256 master key
- `ANTHROPIC_API_KEY` — Claude API
- `CRYPTOPANIC_API_KEY` — CryptoPanic free tier
- `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`

---

## 10. Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Monorepo | NX |
| Frontend | React 19, Vite, React Router v7, React Query, Zustand |
| UI/Animations | UI/UX Pro Max skill, Emil Kowalski principles, Tailwind CSS |
| Backend | NestJS, Bull, Socket.io |
| ORM | Prisma |
| Database | PostgreSQL |
| Cache/Queue | Redis |
| Auth | JWT + bcrypt |
| Trading API | Binance REST + WebSocket |
| LLM | Claude API (claude-sonnet-4-6) |
| News | CryptoPanic, CoinGecko, Reddit API, RSS |
| Charts | Recharts + lightweight-charts |
| Testing | Vitest (frontend), Jest (backend), Supertest (e2e) |
| CI/CD | GitHub Actions |
| Deploy | GitHub Pages (web), Railway (api) |

---

## 11. Out of Scope (Phase 2+)

- MetaMask / Web3 wallet integration
- DEX trading (Uniswap, etc.)
- Additional assets beyond BTC/ETH
- Mobile app
- Email/push notifications
- Social features
- Backtesting engine (separate tool)

---

## 12. Decisions Log

| # | Question | Decision |
|---|----------|----------|
| 1 | Minimum analysis interval | **5 minutes** (configurable per user, enforced as floor) |
| 2 | Technical indicators | **Fixed set for Phase 1**: RSI, MACD, Bollinger Bands, EMA (9/21/50/200), Volume, S&R |
| 3 | Admin kill-switch | **Yes** — admin can stop all users' agents globally in one action |
| 4 | Trade fees | **Estimated fixed at 0.1%** per trade (both BUY and SELL sides) |

---

*Next step: approve this spec → generate implementation plan → execute with SDD*
