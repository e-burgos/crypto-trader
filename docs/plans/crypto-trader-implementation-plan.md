# Crypto Trader — Implementation Plan

**Spec:** `docs/specs/crypto-trader-spec.md` (v1.1 — Approved)
**Date:** 2026-03-31
**Method:** Subagent-Driven Development (SDD)

---

## Branch Strategy

All work happens on a feature branch: `feature/initial-implementation`
Never commit directly to `main`.

---

## Task Overview

| # | Task | Scope | Model |
|---|------|-------|-------|
| 1 | Monorepo NX setup | Scaffolding | haiku |
| 2 | Shared lib: types, DTOs, constants | 1 lib | haiku |
| 3 | Database schema (Prisma) | 1 file | haiku |
| 4 | Backend: Auth module | 2–3 files | sonnet |
| 5 | Backend: Users module + Binance key encryption | 2–3 files | sonnet |
| 6 | Backend: Data fetcher lib (Binance OHLCV + WebSocket) | 1 lib | sonnet |
| 7 | Backend: News fetcher (CryptoPanic, CoinGecko, Reddit, RSS) | 1 lib | sonnet |
| 8 | Backend: Analysis lib — technical indicators | 1 lib | sonnet |
| 9 | Backend: Analysis lib — LLM integration (Claude API) | 1 lib | sonnet |
| 10 | Backend: Trading engine lib — order execution + position tracking | 1 lib | sonnet |
| 11 | Backend: Trading module — agent lifecycle + adaptive interval | 1 module | sonnet |
| 12 | Backend: Admin module — kill-switch + platform management | 1 module | sonnet |
| 13 | Backend: Notifications module + WebSocket gateway | 1 module | haiku |
| 14 | Backend: Analytics module — P&L, win rate, Sharpe | 1 module | haiku |
| 15 | Frontend: Project setup + design system + routing | scaffolding | haiku |
| 16 | Frontend: Auth pages (login, register) | 2 pages | haiku |
| 17 | Frontend: Dashboard layout + navigation | layout | haiku |
| 18 | Frontend: Overview page (portfolio, P&L, agent status) | 1 page | sonnet |
| 19 | Frontend: Live chart page (candlestick + indicator overlays) | 1 page | sonnet |
| 20 | Frontend: Trade history page | 1 page | haiku |
| 21 | Frontend: Agent log page (decisions + reasoning + news) | 1 page | haiku |
| 22 | Frontend: Configuration panel (thresholds, API keys, sandbox toggle) | 1 page | sonnet |
| 23 | Frontend: News feed page | 1 page | haiku |
| 24 | Frontend: Analytics page (performance metrics) | 1 page | haiku |
| 25 | Frontend: Admin panel (kill-switch, user management) | 1 page | haiku |
| 26 | Frontend: Real-time WebSocket integration | cross-cutting | sonnet |
| 27 | Frontend: Notification system (toasts + notification center) | component | haiku |
| 28 | CI/CD: GitHub Actions (lint → test → build → deploy) | config | haiku |
| 29 | Docker Compose for local dev | config | haiku |
| 30 | E2E integration tests (critical flows) | tests | sonnet |

---

## Detailed Tasks

---

### Task 1 — Monorepo NX Setup

**Goal:** Initialize the NX monorepo with all apps and libs scaffolded and ready for development.

**Steps:**
1. Run `npx create-nx-workspace@latest crypto-trader --preset=ts --nxCloud=skip` inside the repo root (or init NX in existing repo with `npx nx init`).
2. Generate apps:
   - `nx g @nx/react:app web --bundler=vite --style=tailwind --routing=true`
   - `nx g @nx/nest:app api`
3. Generate libs:
   - `nx g @nx/js:lib shared --bundler=vite`
   - `nx g @nx/js:lib trading-engine --bundler=vite`
   - `nx g @nx/js:lib analysis --bundler=vite`
   - `nx g @nx/js:lib data-fetcher --bundler=vite`
   - `nx g @nx/react:lib ui --bundler=vite --style=tailwind`
4. Install global dependencies: `tailwindcss`, `prisma`, `@prisma/client`, `socket.io`, `socket.io-client`, `@tanstack/react-query`, `zustand`, `react-router-dom`, `recharts`, `lightweight-charts`, `react-hook-form`, `zod`, `@anthropic-ai/sdk`, `bull`, `ioredis`, `bcrypt`, `jsonwebtoken`, `class-validator`, `class-transformer`, `rss-parser`, `axios`.
5. Configure path aliases in `tsconfig.base.json`.
6. Verify `nx graph` shows correct dependency graph.
7. Commit: "chore: initialize NX monorepo with apps and libs"

**Done when:** `nx run-many --target=build --all` completes without errors.

---

### Task 2 — Shared Lib: Types, DTOs, Constants

**Goal:** Define all shared TypeScript types, Zod schemas, DTOs, and constants used across apps and libs.

**File:** `libs/shared/src/`

**Contents:**
- `types/`: `Asset` (BTC | ETH), `Pair` (USDT | USDC), `TradingMode` (LIVE | SANDBOX), `Decision` (BUY | SELL | HOLD), `AgentStatus`, `UserRole`, `PositionStatus`, `TradeType`, `NotificationType`
- `dtos/`: Auth DTOs (RegisterDto, LoginDto, TokenDto), TradingConfig DTOs, Position DTOs, Trade DTOs, AgentDecision DTOs
- `constants/`: `SUPPORTED_PAIRS`, `TRADE_FEE_PCT = 0.001`, `DEFAULT_MIN_INTERVAL_MINUTES = 5`, `MAX_TRADE_PCT = 0.2`, `CANDLE_INTERVALS`, indicator defaults
- `utils/`: `calculatePnl()`, `applyFee()`, `formatCurrency()`, `formatPercent()`
- `index.ts`: re-exports everything

**Done when:** All types import cleanly from `@crypto-trader/shared` in both `apps/api` and `apps/web`.

---

### Task 3 — Database Schema (Prisma)

**Goal:** Define the complete Prisma schema and generate the initial migration.

**File:** `apps/api/prisma/schema.prisma`

**Models to implement** (exact fields per spec section 6.4):
- `User` — id (cuid), email (unique), passwordHash, role (enum: TRADER | ADMIN), createdAt, updatedAt, isActive
- `BinanceCredential` — id, userId (FK), apiKeyEncrypted, secretEncrypted, isActive, createdAt
- `TradingConfig` — id, userId (FK), asset (enum), pair (enum), buyThreshold, sellThreshold, stopLossPct, takeProfitPct, maxTradePct, maxConcurrentPositions, minIntervalMinutes (default: 5), mode (LIVE | SANDBOX), isRunning, createdAt, updatedAt
- `Position` — id, userId (FK), configId (FK), asset, pair, mode, entryPrice, quantity, entryAt, exitPrice?, exitAt?, status (OPEN | CLOSED), pnl?, fees
- `Trade` — id, userId (FK), positionId (FK), type (BUY | SELL), price, quantity, fee, executedAt, mode, binanceOrderId?
- `AgentDecision` — id, userId (FK), asset, pair, decision, confidence, reasoning, indicators (Json), newsHeadlines (Json), waitMinutes, createdAt
- `NewsItem` — id, source, headline, url, sentiment (POSITIVE | NEUTRAL | NEGATIVE), publishedAt, cachedAt
- `Notification` — id, userId (FK), type, message, read (default: false), createdAt
- `AdminAction` — id, adminId (FK), action, targetUserId?, details (Json), createdAt

**Steps:**
1. Write schema.prisma with all models, enums, and relations.
2. Configure `datasource db` with `provider = "postgresql"` and `env("DATABASE_URL")`.
3. Run `npx prisma migrate dev --name init`.
4. Run `npx prisma generate`.
5. Seed file: `prisma/seed.ts` — creates 1 admin user and 1 test trader with sandbox config.
6. Commit: "feat(db): add prisma schema with all models and initial migration"

**Done when:** `npx prisma studio` opens and shows all tables. Seed runs without errors.

---

### Task 4 — Backend: Auth Module

**Goal:** JWT authentication with register, login, and token refresh.

**Files:** `apps/api/src/auth/`

**Endpoints:**
- `POST /auth/register` — validate RegisterDto, hash password (bcrypt, 12 rounds), create User, return tokens
- `POST /auth/login` — validate credentials, return `{ accessToken, refreshToken, user }`
- `POST /auth/refresh` — validate refresh token, rotate and return new pair
- `POST /auth/logout` — invalidate refresh token (stored in Redis with TTL)

**Implementation details:**
- Access token: JWT, 15min expiry, payload `{ sub, email, role }`
- Refresh token: JWT, 7d expiry, stored in Redis as `refresh:{userId}` with same TTL
- `JwtAuthGuard` — applied globally, `@Public()` decorator for open routes
- `RolesGuard` + `@Roles(UserRole.ADMIN)` decorator
- Passwords: bcrypt with 12 salt rounds
- All DTOs validated with `class-validator`

**Done when:** All 4 endpoints work via curl/httpie. Unit tests cover: register (happy path, duplicate email), login (wrong password), refresh (expired token). Tests use in-memory mocks for DB and Redis.

---

### Task 5 — Backend: Users Module + Binance Key Encryption

**Goal:** User profile management and secure storage of Binance API credentials.

**Files:** `apps/api/src/users/`

**Endpoints:**
- `GET /users/me` — return profile (no sensitive fields)
- `PUT /users/me` — update email/password
- `POST /users/me/binance-keys` — encrypt and store API key + secret
- `DELETE /users/me/binance-keys` — remove credentials
- `GET /users/me/binance-keys/status` — returns `{ connected: boolean }`
- `GET /admin/users` — list all users (ADMIN only)
- `PATCH /admin/users/:id/status` — activate/deactivate user (ADMIN only)

**Encryption:** AES-256-GCM. Master key from `BINANCE_KEY_ENCRYPTION_KEY` env var. Each credential gets a random 12-byte IV stored alongside the ciphertext. Service method: `encrypt(plaintext): { iv, ciphertext }` / `decrypt(iv, ciphertext): string`.

**Done when:** API keys saved/retrieved correctly. Unit tests verify encryption roundtrip and that plaintext never appears in DB records.

---

### Task 6 — Backend: Data Fetcher Lib (Binance)

**Goal:** Fetch OHLCV candles and subscribe to real-time price feeds from Binance.

**Files:** `libs/data-fetcher/src/binance/`

**Exports:**
- `BinanceRestClient` — wraps Binance REST API:
  - `getCandles(symbol, interval, limit)` → `Candle[]`
  - `getAccountBalance(apiKey, secret)` → `Balance[]`
  - `placeOrder(apiKey, secret, symbol, side, quantity)` → `OrderResult`
  - `getOpenOrders(apiKey, secret, symbol)` → `Order[]`
  - `cancelOrder(apiKey, secret, symbol, orderId)` → void
- `BinanceWsClient` — WebSocket price feed:
  - `subscribe(symbols, callback)` → starts stream
  - `unsubscribe(symbols)` → stops stream
  - Auto-reconnect on disconnect
- `BinanceRateLimiter` — token bucket, respects Binance 1200 req/min weight limit

**Note:** In SANDBOX mode, `placeOrder` is mocked — returns a fake `OrderResult` without hitting Binance. This is enforced in this lib via a `sandboxMode: boolean` constructor parameter.

**Done when:** Unit tests mock Binance HTTP responses and verify candle parsing, order placement (live and sandbox), and rate limiter behavior.

---

### Task 7 — Backend: News Fetcher Lib

**Goal:** Aggregate crypto news from free sources with sentiment tagging.

**Files:** `libs/data-fetcher/src/news/`

**Sources:**
- `CryptoPanicFetcher` — GET `https://cryptopanic.com/api/free/v1/posts/?auth_token=X&filter=hot&currencies=BTC,ETH`
- `CoinGeckoNewsFetcher` — GET `https://api.coingecko.com/api/v3/news`
- `RedditFetcher` — GET `https://oauth.reddit.com/r/bitcoin+ethereum+CryptoCurrency/hot?limit=10` (OAuth2 app-only flow)
- `RssFetcher` — parse RSS feeds for CoinDesk (`https://www.coindesk.com/arc/outboundfeeds/rss/`), Cointelegraph, Decrypt using `rss-parser`

**NewsAggregator:**
- Calls all fetchers in parallel
- Deduplicates by URL
- Basic sentiment: if source provides it (CryptoPanic), use it; otherwise classify as NEUTRAL
- Caches results in Redis with 10-minute TTL
- Returns `NewsItem[]` sorted by `publishedAt` desc

**Done when:** Each fetcher has unit tests with mocked HTTP responses. Aggregator test verifies dedup and caching logic.

---

### Task 8 — Backend: Analysis Lib — Technical Indicators

**Goal:** Compute all technical indicators from OHLCV data.

**Files:** `libs/analysis/src/indicators/`

**Indicators to implement** (no external TA library — implement from scratch for control):
- `calculateRSI(closes: number[], period = 14)` → `{ value, signal: OVERBOUGHT | NEUTRAL | OVERSOLD }`
- `calculateMACD(closes: number[], fast=12, slow=26, signal=9)` → `{ macd, signal, histogram, crossover: BULLISH | BEARISH | NONE }`
- `calculateBollingerBands(closes: number[], period=20, stdDev=2)` → `{ upper, middle, lower, bandwidth, position: ABOVE | INSIDE | BELOW }`
- `calculateEMA(closes: number[], period: number)` → `number[]`
- `calculateEMACross(closes: number[])` → `{ ema9, ema21, ema50, ema200, trend: BULLISH | BEARISH | NEUTRAL }`
- `calculateVolume(volumes: number[], period=20)` → `{ current, average, ratio, signal: HIGH | NORMAL | LOW }`
- `calculateSupportResistance(candles: Candle[])` → `{ support: number[], resistance: number[] }`
- `buildIndicatorSnapshot(candles: Candle[])` → aggregates all indicators into a single `IndicatorSnapshot` object

**Done when:** Each indicator function has unit tests with known inputs and verified outputs. `buildIndicatorSnapshot` integrates all functions correctly.

---

### Task 9 — Backend: Analysis Lib — LLM Integration

**Goal:** Use Claude API to produce a structured trading decision from indicators + news + history.

**Files:** `libs/analysis/src/llm/`

**Exports:**
- `LLMAnalyzer` class:
  - `analyze(input: LLMAnalysisInput)` → `LLMDecision`
  - Input: `{ asset, pair, indicatorSnapshot, recentCandles (last 5 summary), newsItems (last 10), recentTrades (last 10), userConfig }`
  - Output: `{ decision: BUY | SELL | HOLD, confidence: number (0-100), reasoning: string, suggestedWaitMinutes: number }`

**Prompt design:**
- System prompt: role as a crypto trading analyst, instructions for structured JSON output, risk management rules
- User prompt: formatted snapshot of all inputs
- Response: parsed and validated with Zod schema
- Model: `claude-sonnet-4-6`
- Max tokens: 1024
- Temperature: 0.3 (low randomness for consistency)
- Retry on parse failure (up to 2 retries)

**Done when:** Unit test with mocked Anthropic SDK verifies prompt construction, JSON parsing, Zod validation, and retry logic. Integration test (optional, behind env flag) calls real API and verifies shape of response.

---

### Task 10 — Backend: Trading Engine Lib

**Goal:** Execute buy/sell orders, track positions, and compute P&L.

**Files:** `libs/trading-engine/src/`

**Exports:**
- `OrderExecutor`:
  - `executeBuy(userId, config, price, quantity)` → creates Position + Trade in DB, calls Binance (or mock in sandbox)
  - `executeSell(userId, positionId, price)` → closes Position, creates Trade, computes P&L with 0.1% fee both sides
  - `checkStopLoss(position, currentPrice)` → returns true if stop-loss threshold breached
  - `checkTakeProfit(position, currentPrice)` → returns true if take-profit threshold breached
- `PositionManager`:
  - `getOpenPositions(userId, asset)` → `Position[]`
  - `getPositionValue(position, currentPrice)` → `{ currentValue, unrealizedPnl, pnlPct }`
  - `hasCapacity(userId, config)` → checks `maxConcurrentPositions` not exceeded

**P&L formula:**
```
buyFee = entryPrice * quantity * 0.001
sellFee = exitPrice * quantity * 0.001
pnl = (exitPrice - entryPrice) * quantity - buyFee - sellFee
```

**Done when:** Unit tests cover: buy execution (live + sandbox), sell with P&L calculation, stop-loss trigger, take-profit trigger, capacity check.

---

### Task 11 — Backend: Trading Module — Agent Lifecycle

**Goal:** The core agent loop that orchestrates analysis and trading for each user.

**Files:** `apps/api/src/trading/`

**Endpoints:**
- `GET /trading/config` — get user's trading config
- `PUT /trading/config` — update trading config
- `POST /trading/start` — start agent for authenticated user
- `POST /trading/stop` — stop agent for authenticated user
- `GET /trading/status` — agent status + current interval
- `GET /trading/positions` — open positions (paginated)
- `GET /trading/history` — trade history (paginated, filter by asset/mode/date)
- `GET /trading/decisions` — agent decision log (paginated)

**Agent loop (Bull queue job per user):**
```
1. Load user config and credentials
2. Fetch candles for configured asset (last 200 candles, 1h interval)
3. Build IndicatorSnapshot
4. Fetch news (from cache or refresh)
5. Load last 10 trades from DB
6. Call LLMAnalyzer.analyze()
7. Save AgentDecision to DB
8. Emit agent:decision via WebSocket
9. If decision is BUY and confidence >= buyThreshold and capacity available:
   a. Execute buy order
   b. Emit trade:executed
10. Check open positions for stop-loss/take-profit
    a. Execute sell if triggered
    b. Emit trade:executed, position:updated
11. Schedule next job in max(suggestedWaitMinutes, minIntervalMinutes)
```

**Agent state in Redis:** `agent:{userId}:status` → `{ running, jobId, lastRun, nextRun, currentInterval }`

**Kill-switch:** `AgentService.killAll()` — reads all active `agent:*:status` keys from Redis, cancels all Bull jobs, sets `isRunning=false` on all TradingConfigs in DB, emits `agent:killed` WebSocket event to all connected users.

**Done when:** Integration tests cover: start agent → verify job queued, stop agent → verify job cancelled, agent loop with mocked analysis and execution, kill-switch stops all agents.

---

### Task 12 — Backend: Admin Module

**Goal:** Admin-only endpoints for platform management.

**Files:** `apps/api/src/admin/`

**Endpoints (all require `ADMIN` role):**
- `POST /admin/kill-switch` — calls `AgentService.killAll()`, logs `AdminAction`
- `GET /admin/agents/status` — list all users' agent statuses
- `GET /admin/users` — list all users with trading stats
- `PATCH /admin/users/:id/active` — activate/deactivate user account
- `GET /admin/stats` — platform stats: total trades, total users, total P&L across all users

**AdminAction logging:** every admin action persisted to `AdminAction` table with actor, action type, target, and details.

**Done when:** All endpoints protected by RolesGuard. Unit tests verify unauthorized access returns 403. Admin actions logged correctly.

---

### Task 13 — Backend: Notifications Module + WebSocket Gateway

**Goal:** In-app notification system with real-time delivery via Socket.io.

**Files:** `apps/api/src/notifications/`, `apps/api/src/gateway/`

**WebSocket events (server → client):**
- `trade:executed` — `{ trade, position }`
- `position:updated` — `{ position }`
- `agent:decision` — `{ decision }`
- `price:tick` — `{ symbol, price, change24h }`
- `notification:new` — `{ notification }`
- `agent:killed` — `{}` (broadcast to all)

**WebSocket auth:** client sends JWT in handshake `auth.token`, validated on connect.

**Endpoints:**
- `GET /notifications` — list user's notifications (unread first, paginated)
- `PATCH /notifications/:id/read` — mark as read
- `PATCH /notifications/read-all` — mark all as read

**Done when:** WebSocket connection works with valid JWT, rejected with invalid JWT. Notification creation + delivery tested end-to-end with test client.

---

### Task 14 — Backend: Analytics Module

**Goal:** Compute trading performance metrics for the dashboard.

**Files:** `apps/api/src/analytics/`

**Endpoints:**
- `GET /analytics/summary` — `{ totalTrades, winRate, avgPnl, totalPnl, bestTrade, worstTrade, currentDrawdown, sharpeRatio }`
- `GET /analytics/pnl-chart` — daily P&L for last 30 days `{ date, pnl }[]`
- `GET /analytics/asset-breakdown` — P&L split by BTC/ETH

**Formulas:**
- `winRate` = closed positions with pnl > 0 / total closed positions
- `avgPnl` = sum(pnl) / count(closed positions)
- `currentDrawdown` = (peakValue - currentValue) / peakValue
- `sharpeRatio` (basic) = avgDailyReturn / stdDevDailyReturn * sqrt(365)

**Done when:** Unit tests verify each formula with known datasets. Endpoints return correct shape.

---

### Task 15 — Frontend: Project Setup + Design System + Routing

**Goal:** Configure React 19 app with Tailwind, design tokens, routing, and global providers.

**Files:** `apps/web/src/`

**Steps:**
1. Configure Tailwind with custom design tokens (colors, spacing, typography) following UI/UX Pro Max skill guidelines.
2. Set up React Router v7 with routes:
   - `/login`, `/register` (public)
   - `/dashboard` → redirect to `/dashboard/overview`
   - `/dashboard/overview`
   - `/dashboard/chart`
   - `/dashboard/history`
   - `/dashboard/decisions`
   - `/dashboard/config`
   - `/dashboard/news`
   - `/dashboard/analytics`
   - `/admin` (admin only)
3. Global providers: `QueryClientProvider`, `AuthProvider`, `SocketProvider`, `NotificationProvider`.
4. Auth guard: protected routes redirect to `/login` if not authenticated.
5. HTTP client: Axios instance with JWT interceptor (auto-attach token, auto-refresh on 401).
6. Zustand stores: `useAuthStore`, `useAgentStore`, `usePriceStore`.

**Design system (`libs/ui/src/`):**
- Color palette: dark theme (charcoal/slate base), green for gains, red for losses, amber for warnings
- Typography: Inter font
- Components: Button, Input, Badge, Card, Modal, Spinner, Tooltip, Dropdown
- Animations: follow Emil Kowalski principles — fast (150–300ms), purposeful easing, `prefers-reduced-motion` respected

**Done when:** All routes render without errors. Design system components render correctly in Storybook (optional) or simple test page. Auth guard redirects unauthenticated users.

---

### Task 16 — Frontend: Auth Pages (Login + Register)

**Goal:** Login and register forms with validation and JWT storage.

**Files:** `apps/web/src/pages/auth/`

**Login page:**
- Email + password form (React Hook Form + Zod)
- Submit → `POST /auth/login` → store tokens in memory (access) + httpOnly cookie (refresh, handled by backend) or localStorage
- Error states: wrong credentials, network error
- Link to register

**Register page:**
- Email + password + confirm password
- Submit → `POST /auth/register` → auto-login
- Validation: email format, password min 8 chars, passwords match

**UX:** smooth form transitions (Emil Kowalski), clear error messages inline, loading state on submit button.

**Done when:** Login and register work end-to-end with the running backend. Form validation shows errors without submitting. Redirects to dashboard on success.

---

### Task 17 — Frontend: Dashboard Layout + Navigation

**Goal:** Persistent shell with sidebar navigation and top bar.

**Files:** `apps/web/src/layouts/`

**Sidebar:**
- Logo + app name
- Nav links: Overview, Chart, History, Decisions, Configuration, News, Analytics
- Admin link (visible only for ADMIN role)
- Agent status indicator (running / stopped / error) with pulsing dot animation
- User menu (profile, logout)

**Top bar:**
- Current asset prices (BTC/USDT, ETH/USDT) — updated from WebSocket
- Notification bell with unread count badge
- Trading mode badge (LIVE / SANDBOX)

**Responsive:** collapsible sidebar on smaller screens.

**Done when:** Layout renders on all dashboard routes. Active nav item highlighted. Agent status updates in real-time from WebSocket.

---

### Task 18 — Frontend: Overview Page

**Goal:** Main dashboard with portfolio snapshot and agent activity.

**Files:** `apps/web/src/pages/dashboard/overview/`

**Sections:**
- **Portfolio cards**: Total Value (USDT), Today's P&L (+ % change), All-time P&L, Available Balance — each with trend indicator and animated number change
- **Agent status card**: running/stopped, current asset, last decision, time until next analysis, start/stop button
- **Open positions**: compact table showing asset, entry price, current price, unrealized P&L (colored green/red), quantity
- **Recent trades**: last 5 trades with asset, type (BUY/SELL badge), price, P&L
- **Quick stats**: win rate, total trades, avg profit

**Real-time:** portfolio values and open position P&L update on every `price:tick` WebSocket event.

**Done when:** Page loads data via React Query. Real-time updates work. Start/stop agent button calls API and reflects updated status.

---

### Task 19 — Frontend: Live Chart Page

**Goal:** Candlestick chart with technical indicator overlays.

**Files:** `apps/web/src/pages/dashboard/chart/`

**Chart (using `lightweight-charts`):**
- Candlestick series: BTC/USDT or ETH/USDT
- Overlays toggle: EMA 9, EMA 21, EMA 50, EMA 200, Bollinger Bands
- Sub-chart: RSI with overbought/oversold lines (70/30)
- Sub-chart: MACD histogram + signal line
- Volume bars
- Asset selector (BTC/ETH) and interval selector (1h, 4h, 1d)
- Trade markers: green arrow (BUY), red arrow (SELL) on the candlestick where trades occurred
- Real-time candle updates from WebSocket `price:tick`

**Done when:** Chart loads last 200 candles. Indicator overlays toggle correctly. Trade markers visible. Real-time price updates animate last candle.

---

### Task 20 — Frontend: Trade History Page

**Goal:** Filterable, paginated table of all executed trades.

**Files:** `apps/web/src/pages/dashboard/history/`

**Table columns:** Date/Time, Asset, Pair, Type (BUY/SELL), Price, Quantity, Fee, P&L, Mode (LIVE/SANDBOX)

**Filters:** asset, type, mode, date range (from/to)

**Features:**
- Pagination (20 per page)
- Export to CSV button
- P&L column: green if positive, red if negative
- Summary row: total P&L for filtered results

**Done when:** Table loads data. Filters work. Pagination works. CSV export downloads correctly.

---

### Task 21 — Frontend: Agent Log Page

**Goal:** Timeline of every agent decision with full context.

**Files:** `apps/web/src/pages/dashboard/decisions/`

**Each decision card shows:**
- Timestamp + asset + pair
- Decision badge (BUY green / SELL red / HOLD gray)
- Confidence bar (0–100%)
- Reasoning text (collapsible)
- Indicator snapshot summary (RSI value, MACD signal, BB position, trend)
- News headlines used (collapsible list with sentiment badges)
- Resulting trade (if executed)
- Next analysis in X minutes

**Real-time:** new decisions pushed via `agent:decision` WebSocket event appear at top with slide-in animation.

**Done when:** Page loads historical decisions. New decisions appear in real-time. Expand/collapse reasoning and news works smoothly.

---

### Task 22 — Frontend: Configuration Panel

**Goal:** User configures trading parameters, manages API keys, and toggles modes.

**Files:** `apps/web/src/pages/dashboard/config/`

**Sections:**

**Binance API Keys:**
- Input fields for API Key + Secret (masked)
- Connect / Disconnect button
- Status: connected ✓ / disconnected

**Trading Configuration (per asset: BTC, ETH):**
- Asset toggle (enable/disable)
- Pair selector (USDT / USDC)
- Buy threshold (0–100 slider + number input)
- Sell threshold slider
- Stop-loss % input
- Take-profit % input
- Max trade % slider
- Max concurrent positions input
- Min interval minutes input (min: 5)

**Mode:**
- LIVE / SANDBOX toggle (large, prominent, with confirmation modal for switching to LIVE)
- Sandbox virtual balance input (only in SANDBOX mode)

**Done when:** Form saves to API. Switching to LIVE mode requires confirmation. Binance key connection status reflects correctly.

---

### Task 23 — Frontend: News Feed Page

**Goal:** Display latest crypto news used by the agent.

**Files:** `apps/web/src/pages/dashboard/news/`

**Layout:**
- Grid of news cards
- Each card: headline, source, published time (relative), sentiment badge (POSITIVE/NEUTRAL/NEGATIVE with color)
- Filter by sentiment
- Filter by source (CryptoPanic, CoinGecko, Reddit, RSS)
- Link to original article
- "Used by agent" badge if the news appeared in a recent decision

**Done when:** News loads and refreshes every 10 minutes. Filters work. Sentiment badges colored correctly.

---

### Task 24 — Frontend: Analytics Page

**Goal:** Trading performance dashboard with charts and metrics.

**Files:** `apps/web/src/pages/dashboard/analytics/`

**Sections:**
- **Summary cards**: Win rate %, Total P&L, Avg P&L per trade, Best trade, Worst trade, Current drawdown, Sharpe ratio
- **P&L over time**: line chart (daily P&L, last 30 days)
- **Asset breakdown**: donut chart (BTC vs ETH P&L contribution)
- **Trade frequency**: bar chart (trades per day, last 30 days)
- **Mode comparison**: side-by-side LIVE vs SANDBOX stats

**Done when:** All charts render with real data from `/analytics/*` endpoints. Empty states handled gracefully.

---

### Task 25 — Frontend: Admin Panel

**Goal:** Admin interface for platform management.

**Files:** `apps/web/src/pages/admin/`

**Sections:**
- **Kill-switch**: large red button "Stop All Agents" with confirmation modal. Shows last kill event if any.
- **Platform stats**: total users, total trades (today/all-time), total P&L across platform
- **Users table**: email, role, agent status, last active, trades count, total P&L, activate/deactivate toggle
- **Agent status grid**: each active user's agent status, current asset, last decision time

**Done when:** Kill-switch calls API and shows confirmation. User table loads and activate/deactivate works. Accessible only to ADMIN role (redirect to dashboard otherwise).

---

### Task 26 — Frontend: Real-time WebSocket Integration

**Goal:** Connect Socket.io client and wire events to all relevant UI components.

**Files:** `apps/web/src/providers/SocketProvider.tsx`, `apps/web/src/hooks/useSocket.ts`

**Events to handle:**
- `trade:executed` → invalidate React Query cache for positions + history + analytics, trigger toast notification
- `position:updated` → update position P&L in Overview and Chart
- `agent:decision` → push to decisions list, update agent status in sidebar
- `price:tick` → update price display in top bar, update open positions unrealized P&L, update chart
- `notification:new` → increment bell badge, push to notification center
- `agent:killed` → update agent status to stopped, show global toast

**Reconnection:** automatic reconnect with exponential backoff. Show "reconnecting…" indicator in sidebar.

**Done when:** All events update correct UI components. Reconnection works after simulated disconnect. No memory leaks (listeners cleaned up on unmount).

---

### Task 27 — Frontend: Notification System

**Goal:** Toast notifications and notification center.

**Files:** `apps/web/src/components/notifications/`

**Toast component:**
- Variants: success (green), error (red), warning (amber), info (blue)
- Auto-dismiss after 5s (configurable)
- Stacked (up to 3 visible, older ones shift down)
- Slide-in from top-right, slide-out on dismiss
- Accessible: `role="alert"`, `aria-live="polite"`

**Notification center (dropdown from bell icon):**
- List of all notifications (most recent first)
- Unread highlighted
- Mark as read on click
- "Mark all as read" button
- Empty state illustration

**Done when:** Toasts appear for all WebSocket events. Notification center opens and loads from API. Mark as read works.

---

### Task 28 — CI/CD: GitHub Actions

**Goal:** Automated lint, test, build, and deploy pipeline.

**Files:** `.github/workflows/`

**Workflows:**

`ci.yml` (on every PR and push to main):
1. `nx affected --target=lint`
2. `nx affected --target=test`
3. `nx affected --target=build`

`deploy-web.yml` (on push to main, only if `apps/web` affected):
1. Build: `nx build web --configuration=production`
2. Deploy to GitHub Pages: `peaceiris/actions-gh-pages@v4`

`deploy-api.yml` (on push to main, only if `apps/api` affected):
1. Trigger Railway deploy via webhook (`RAILWAY_WEBHOOK_URL` secret)

**Secrets needed:** `ANTHROPIC_API_KEY`, `RAILWAY_WEBHOOK_URL`, `GITHUB_TOKEN` (auto)

**Done when:** PR opens → CI runs and passes. Merge to main → web deploys to GitHub Pages, API deploy webhook fires.

---

### Task 29 — Docker Compose for Local Dev

**Goal:** Single `docker-compose.yml` to run the full stack locally.

**File:** `docker-compose.yml` + `docker-compose.override.yml`

**Services:**
- `postgres`: `postgres:16-alpine`, port 5432, volume for data persistence, env vars for DB name/user/password
- `redis`: `redis:7-alpine`, port 6379
- `api`: NestJS app, built from `apps/api/Dockerfile`, port 3000, depends on postgres + redis, hot reload via volume mount
- `web`: Vite dev server, port 5173, hot reload, proxies `/api` to `api:3000`

**`apps/api/Dockerfile`**: multi-stage — builder installs deps + builds, runner copies dist only.

**`.env.example`**: template with all required env vars documented.

**Done when:** `docker-compose up` starts all services. `http://localhost:5173` loads the frontend. API health check `GET /health` returns 200. Database migrations run automatically on api startup.

---

### Task 30 — E2E Integration Tests (Critical Flows)

**Goal:** Test the most critical user flows end-to-end.

**Files:** `apps/api/test/e2e/`

**Test flows (Supertest + Jest):**

1. **Auth flow**: register → login → refresh token → access protected route
2. **Binance keys**: connect keys → verify status → disconnect
3. **Trading config**: create config → update thresholds → get config
4. **Agent lifecycle**: start agent (sandbox) → verify status → stop agent
5. **Kill-switch**: start 2 users' agents → admin kill-switch → verify both stopped
6. **Trade execution (sandbox)**: start agent → mock LLM decision (BUY, confidence 90) → verify trade created + position opened → mock SELL decision → verify position closed with P&L
7. **Notifications**: execute trade → verify notification created → mark as read

**Done when:** All 7 flows pass. Tests run in CI. Database is reset between test suites.

---

## Post-Implementation

After all 30 tasks are complete, run `superpowers:finishing-a-development-branch`:
1. Final code review subagent
2. Update CHANGELOG
3. Create PR from `feature/initial-implementation` → `main`
4. Link PR to GitHub Project
