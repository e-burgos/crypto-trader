# Crypto Trader — Implementation Plan

**Spec:** `docs/specs/crypto-trader-spec.md` (v1.2 — Approved)
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
| 5 | Backend: Users module + credential encryption (Binance + LLM keys) | 2–3 files | sonnet |
| 6 | Backend: Data fetcher lib (Binance OHLCV + WebSocket) | 1 lib | sonnet |
| 7 | Backend: News fetcher (CryptoPanic, CoinGecko, Reddit, RSS) | 1 lib | sonnet |
| 8 | Backend: Analysis lib — technical indicators | 1 lib | sonnet |
| 9 | Backend: Analysis lib — Multi-LLM integration (Claude/OpenAI/Groq) | 1 lib | sonnet |
| 10 | Backend: Trading engine lib — order execution + position tracking | 1 lib | sonnet |
| 11 | Backend: Trading module — agent lifecycle + adaptive interval | 1 module | sonnet |
| 12 | Backend: Admin module — kill-switch + platform management | 1 module | sonnet |
| 13 | Backend: Notifications module + WebSocket gateway | 1 module | haiku |
| 14 | Backend: Analytics module — P&L, win rate, Sharpe | 1 module | haiku |
| 15 | Frontend: Project setup + design system + GSAP + routing | scaffolding | sonnet |
| 16 | Frontend: Landing / showcase page (GSAP animations) | 1 page | sonnet |
| 17 | Frontend: Auth pages (login, register) | 2 pages | haiku |
| 18 | Frontend: Onboarding wizard (3-step: wallet → API keys → trade) | 1 flow | sonnet |
| 19 | Frontend: Dashboard layout + navigation | layout | haiku |
| 20 | Frontend: Overview page (portfolio, P&L, agent status) — animated | 1 page | sonnet |
| 21 | Frontend: Live chart page (candlestick + indicator overlays) | 1 page | sonnet |
| 22 | Frontend: Trade history page | 1 page | haiku |
| 23 | Frontend: Agent log page (decisions + reasoning + news) | 1 page | haiku |
| 24 | Frontend: Configuration panel (thresholds, all API keys, sandbox toggle) | 1 page | sonnet |
| 25 | Frontend: News feed page | 1 page | haiku |
| 26 | Frontend: Analytics page (animated performance metrics) | 1 page | sonnet |
| 27 | Frontend: Admin panel (kill-switch, user management) | 1 page | haiku |
| 28 | Frontend: Real-time WebSocket integration | cross-cutting | sonnet |
| 29 | Frontend: Notification system (GSAP toasts + notification center) | component | haiku |
| 30 | Frontend: API client (Axios + interceptors) + React Query hooks | cross-cutting | sonnet |
| 31 | CI/CD: GitHub Actions (lint → test → build → deploy) | config | haiku |
| 32 | Docker Compose for local dev | config | haiku |
| 33 | E2E integration tests (critical flows) | tests | sonnet |

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

### Task 5 — Backend: Users Module + Credential Encryption (Binance + LLM Keys)

**Goal:** User profile management and secure storage of Binance API credentials AND LLM provider API keys (Claude/OpenAI/Groq).

**Files:** `apps/api/src/users/`

**Endpoints:**
- `GET /users/me` — return profile (no sensitive fields)
- `PUT /users/me` — update email/password
- `POST /users/me/binance-keys` — encrypt and store Binance API key + secret
- `DELETE /users/me/binance-keys` — remove Binance credentials
- `GET /users/me/binance-keys/status` — returns `{ connected: boolean }`
- `POST /users/me/llm-keys` — encrypt and store LLM provider API key. Body: `{ provider: CLAUDE|OPENAI|GROQ, apiKey, selectedModel }`
- `DELETE /users/me/llm-keys/:provider` — remove LLM credentials for a provider
- `GET /users/me/llm-keys/status` — returns `{ providers: [{ provider, connected, selectedModel }] }`
- `GET /admin/users` — list all users (ADMIN only)
- `PATCH /admin/users/:id/status` — activate/deactivate user (ADMIN only)

**Encryption:** AES-256-GCM. Master key from `BINANCE_KEY_ENCRYPTION_KEY` env var. Each credential gets a random 12-byte IV stored alongside the ciphertext. Service method: `encrypt(plaintext): { iv, ciphertext }` / `decrypt(iv, ciphertext): string`. Same encryption used for both Binance and LLM keys.

**Done when:** Binance and LLM API keys saved/retrieved correctly. Unit tests verify encryption roundtrip for both credential types. Plaintext never appears in DB records.

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

### Task 9 — Backend: Analysis Lib — Multi-LLM Integration (Claude/OpenAI/Groq)

**Goal:** Produce a structured trading decision using the user's chosen LLM provider (Claude, OpenAI, or Groq).

**Files:** `libs/analysis/src/llm/`

**Architecture — Strategy pattern:**
- `LLMProvider` interface: `analyze(input: LLMAnalysisInput): Promise<LLMDecision>`
- `ClaudeProvider` — uses `@anthropic-ai/sdk`. Models: `claude-sonnet-4-6`, `claude-haiku-4-5`
- `OpenAIProvider` — uses `openai` SDK. Models: `gpt-4o`, `gpt-4o-mini`
- `GroqProvider` — uses `groq-sdk`. Models: `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`
- `LLMProviderFactory` — creates the right provider from `{ provider, apiKey, model }`

**Exports:**
- `LLMAnalyzer` class:
  - `analyze(input: LLMAnalysisInput, credentials: LLMCredential)` → `LLMDecision`
  - Input: `{ asset, pair, indicatorSnapshot, recentCandles (last 5 summary), newsItems (last 10), recentTrades (last 10), userConfig }`
  - Output: `{ decision: BUY | SELL | HOLD, confidence: number (0-100), reasoning: string, suggestedWaitMinutes: number }`

**Prompt design (same across providers):**
- System prompt: role as a crypto trading analyst, instructions for structured JSON output, risk management rules
- User prompt: formatted snapshot of all inputs
- Response: parsed and validated with Zod schema
- Max tokens: 1024
- Temperature: 0.3 (low randomness for consistency)
- Retry on parse failure (up to 2 retries)
- On provider error: pause agent, notify user (NO silent fallback to another provider)

**Done when:** Unit tests with mocked SDKs for all 3 providers verify prompt construction, JSON parsing, Zod validation, retry logic, and error handling. Factory correctly instantiates each provider.

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

### Task 15 — Frontend: Project Setup + Design System + GSAP + Routing

**Goal:** Configure React 19 app with Tailwind, GSAP, design tokens, routing, and global providers.

**Files:** `apps/web/src/`

**Steps:**
1. Install GSAP: `gsap`, `@gsap/react`. Register GSAP plugins: `ScrollTrigger`, `TextPlugin`.
2. Configure Tailwind with custom design tokens (colors, spacing, typography) following UI/UX Pro Max skill guidelines.
3. Set up React Router v7 with routes:
   - `/` — landing page (public)
   - `/login`, `/register` (public)
   - `/onboarding` — 3-step wizard (authenticated, first-time users)
   - `/dashboard` → redirect to `/dashboard/overview`
   - `/dashboard/overview`, `/dashboard/chart`, `/dashboard/history`
   - `/dashboard/decisions`, `/dashboard/config`, `/dashboard/news`, `/dashboard/analytics`
   - `/admin` (admin only)
4. Global providers: `QueryClientProvider`, `AuthProvider`, `SocketProvider`, `NotificationProvider`.
5. Auth guard: protected routes redirect to `/login` if not authenticated. First-time users (no Binance keys) redirect to `/onboarding`.
6. Zustand stores: `useAuthStore`, `useAgentStore`, `usePriceStore`.

**Design system (`libs/ui/src/`):**
- Color palette: dark theme (charcoal/slate base), green for gains, red for losses, amber for warnings, electric blue for accents
- Typography: Inter font
- Components: Button, Input, Badge, Card, Modal, Spinner, Tooltip, Dropdown, Stepper, AnimatedNumber
- `AnimatedNumber` component: uses GSAP to count up/down numbers smoothly
- Animations: GSAP + Emil Kowalski principles — fast (150–300ms), purposeful easing, `prefers-reduced-motion` respected
- GSAP utilities: `useFadeIn()`, `useSlideIn()`, `useStaggerChildren()`, `useCountUp()` custom hooks

**Done when:** All routes render without errors. Design system components render correctly. GSAP animations work. Auth guard and onboarding redirect work.

---

### Task 16 — Frontend: Landing / Showcase Page (GSAP Animations)

**Goal:** Public landing page that showcases the platform with stunning GSAP animations.

**Files:** `apps/web/src/pages/landing/`

**Sections (top to bottom):**
1. **Hero**: animated background with floating crypto icons (GSAP), headline "Trade Smarter with AI", sub-headline explaining the hybrid agent, CTA button with hover animation → register.
2. **Live ticker**: real-time BTC/ETH prices from public Binance API, scrolling marquee with GSAP.
3. **How it works**: 3-step animated flow (Connect → Configure → Trade). Each step animates in on scroll with `ScrollTrigger`. Icons/illustrations animate with `gsap.from()`.
4. **Feature cards**: 6 cards (AI Analysis, Multi-LLM, Sandbox Mode, Real-time Charts, Smart Thresholds, News Sentiment). Staggered reveal on scroll, hover tilt effect.
5. **Dashboard preview**: animated screenshot/mockup of the dashboard with GSAP parallax layers.
6. **Stats counter**: "X trades executed, Y% average win rate, Z users" with GSAP CountUp on scroll.
7. **CTA section**: "Start Trading in Minutes" with register button. Background gradient animation.
8. **Footer**: links, social, copyright.

**Tech:** GSAP ScrollTrigger for all scroll animations, `prefers-reduced-motion` respected (disable animations).

**Done when:** Landing page renders at `/`. All scroll animations trigger correctly. Mobile responsive. Performance: no layout shift, smooth 60fps animations.

---

### Task 17 — Frontend: Auth Pages (Login + Register)

**Goal:** Login and register forms with validation and JWT storage.

**Files:** `apps/web/src/pages/auth/`

**Login page:**
- Email + password form (React Hook Form + Zod)
- Submit → `POST /auth/login` → store tokens in memory (access) + httpOnly cookie (refresh, handled by backend) or localStorage
- Error states: wrong credentials, network error
- Link to register
- Background: subtle animated gradient (GSAP)

**Register page:**
- Email + password + confirm password
- Submit → `POST /auth/register` → auto-login → redirect to `/onboarding`
- Validation: email format, password min 8 chars, passwords match

**UX:** smooth form transitions (Emil Kowalski), clear error messages inline, loading state on submit button. GSAP entrance animation for form card.

**Done when:** Login and register work end-to-end with the running backend. Form validation shows errors without submitting. Register redirects to onboarding. Login redirects to dashboard.

---

### Task 18 — Frontend: Onboarding Wizard (3-step)

**Goal:** Guided 3-step setup for new users, especially non-technical ones.

**Files:** `apps/web/src/pages/onboarding/`

**Component:** `<OnboardingWizard>` with `<Stepper>` component (animated progress bar).

**Step 1 — Connect Binance Wallet:**
- Clear instructions: "How to create a Binance API key" with collapsible screenshot guide
- Input fields: API Key + Secret (masked by default, eye icon to reveal)
- "Test Connection" button → calls backend to verify credentials → shows balance if OK
- Animated success state (green checkmark with GSAP)
- Skip option: "I'll do this later" (proceeds but can't start live trading)

**Step 2 — Add AI Provider:**
- Card selection: Claude / OpenAI / Groq (each with logo, brief description, recommended model)
- Recommended badge: "Recommended" on Claude card
- Input: API key for selected provider
- Model selector dropdown (per provider)
- "What is this?" tooltip explaining why an LLM key is needed
- Skip option: "I'll use defaults" (if platform has a fallback key configured by admin, or proceed without)

**Step 3 — Start Trading:**
- Mode selector: SANDBOX (recommended, highlighted) vs LIVE
- Pre-configured conservative defaults shown (readonly):
  - Max trade: 5%, Stop-loss: 3%, Take-profit: 5%, Interval: 15min
- "These defaults are safe for beginners. You can customize later."
- Asset selection: BTC ✓, ETH ✓ (pre-checked)
- Big "Start Agent" button with animated pulse (GSAP)
- Confetti animation on agent start (GSAP particles or canvas)

**Transitions:** each step slides in from right (GSAP), progress bar animates smoothly.

**Done when:** Full wizard flow works. Credentials saved. Agent starts on step 3. Skipping steps works gracefully. First-time users are redirected here after register.

---

### Task 19 — Frontend: Dashboard Layout + Navigation

**Goal:** Persistent shell with sidebar navigation, top bar, and animated route transitions.

**Files:** `apps/web/src/layouts/`

**Sidebar:**
- Logo + app name (GSAP hover animation)
- Nav links: Overview, Chart, History, Decisions, Configuration, News, Analytics
- Admin link (visible only for ADMIN role)
- Agent status indicator (running / stopped / error) with GSAP pulsing dot
- User menu (profile, logout)

**Top bar:**
- Current asset prices (BTC/USDT, ETH/USDT) — WebSocket updated, animated number changes (GSAP)
- Notification bell with unread count badge (GSAP bounce on new)
- Trading mode badge (LIVE red glow / SANDBOX blue glow)

**Responsive:** collapsible sidebar with GSAP slide animation.

**Route transitions:** page content fades in with GSAP on route change (200ms).

**Done when:** Layout renders on all dashboard routes. Active nav item highlighted. Agent status updates in real-time. Animations smooth at 60fps.

---

### Task 20 — Frontend: Overview Page

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

### Task 21 — Frontend: Live Chart Page

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

### Task 22 — Frontend: Trade History Page

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

### Task 23 — Frontend: Agent Log Page

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

### Task 24 — Frontend: Configuration Panel

**Goal:** User configures trading parameters, manages API keys, and toggles modes.

**Files:** `apps/web/src/pages/dashboard/config/`

**Sections:**

**Binance API Keys:**
- Input fields for API Key + Secret (masked)
- Connect / Disconnect button
- Status: connected ✓ / disconnected

**LLM Provider Keys:**
- Card per provider: Claude / OpenAI / Groq
- Each: API key input (masked), model selector dropdown, connect/disconnect
- Active provider highlighted
- Status badges: connected ✓ / disconnected

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

**Done when:** Form saves to API. All credential types work (Binance + LLM). Switching to LIVE mode requires confirmation. Connection statuses reflect correctly.

---

### Task 25 — Frontend: News Feed Page

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

### Task 26 — Frontend: Analytics Page (Animated Performance Metrics)

**Goal:** Trading performance dashboard with animated charts and metrics.

**Files:** `apps/web/src/pages/dashboard/analytics/`

**Sections:**
- **Summary cards**: Win rate %, Total P&L, Avg P&L per trade, Best trade, Worst trade, Current drawdown, Sharpe ratio — all with GSAP CountUp animation on mount
- **P&L over time**: line chart (daily P&L, last 30 days) with GSAP draw-in effect
- **Asset breakdown**: donut chart (BTC vs ETH P&L contribution) with animated arc fill
- **Trade frequency**: bar chart (trades per day, last 30 days) with staggered bar grow animation
- **Mode comparison**: side-by-side LIVE vs SANDBOX stats with animated highlight on hover

**Done when:** All charts render with real data from `/analytics/*` endpoints. All animations smooth at 60fps. Empty states handled gracefully with animated illustrations.

---

### Task 27 — Frontend: Admin Panel

**Goal:** Admin interface for platform management.

**Files:** `apps/web/src/pages/admin/`

**Sections:**
- **Kill-switch**: large red button "Stop All Agents" with confirmation modal. Shows last kill event if any.
- **Platform stats**: total users, total trades (today/all-time), total P&L across platform
- **Users table**: email, role, agent status, last active, trades count, total P&L, activate/deactivate toggle
- **Agent status grid**: each active user's agent status, current asset, last decision time

**Done when:** Kill-switch calls API and shows confirmation. User table loads and activate/deactivate works. Accessible only to ADMIN role (redirect to dashboard otherwise).

---

### Task 28 — Frontend: Real-time WebSocket Integration

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

### Task 29 — Frontend: Notification System (GSAP Toasts)

**Goal:** Toast notifications and notification center with GSAP animations.

**Files:** `apps/web/src/components/notifications/`

**Toast component:**
- Variants: success (green), error (red), warning (amber), info (blue)
- Auto-dismiss after 5s (configurable)
- Stacked (up to 3 visible, older ones shift down)
- GSAP slide-in from top-right, slide-out on dismiss
- Accessible: `role="alert"`, `aria-live="polite"`

**Notification center (dropdown from bell icon):**
- GSAP scale+fade animation on open
- List of all notifications (most recent first)
- Unread highlighted with subtle glow
- Mark as read on click (GSAP fade transition)
- "Mark all as read" button
- Animated empty state illustration

**Done when:** Toasts appear for all WebSocket events with smooth animations. Notification center opens and loads from API. Mark as read works.

---

### Task 30 — Frontend: API Client (Axios + Interceptors) + React Query Hooks

**Goal:** Centralized API client layer and React Query hooks for all backend endpoints.

**Files:** `apps/web/src/api/`, `apps/web/src/hooks/`

**API Client (`apps/web/src/api/client.ts`):**
- Axios instance with `baseURL` from env
- Request interceptor: attach `Authorization: Bearer <token>` from Zustand auth store
- Response interceptor: on 401 → attempt refresh token → retry original request. If refresh fails → logout + redirect to `/login`
- Error transformer: normalize error shapes into `{ message, code, details }`

**API modules (`apps/web/src/api/`):**
- `auth.api.ts` — register, login, refresh, logout
- `users.api.ts` — profile, binance keys, LLM keys
- `trading.api.ts` — config, start/stop, positions, history, decisions
- `market.api.ts` — OHLCV, news
- `analytics.api.ts` — summary, P&L chart, breakdown
- `admin.api.ts` — kill-switch, users, stats
- `notifications.api.ts` — list, mark read

**React Query hooks (`apps/web/src/hooks/`):**
- `useAuth()` — `useLoginMutation`, `useRegisterMutation`, `useRefreshMutation`
- `useProfile()` — `useProfileQuery`, `useUpdateProfileMutation`
- `useBinanceKeys()` — `useBinanceStatusQuery`, `useConnectBinanceMutation`, `useDisconnectBinanceMutation`
- `useLLMKeys()` — `useLLMStatusQuery`, `useConnectLLMMutation`, `useDisconnectLLMMutation`
- `useTradingConfig()` — `useTradingConfigQuery`, `useUpdateConfigMutation`
- `useAgent()` — `useAgentStatusQuery`, `useStartAgentMutation`, `useStopAgentMutation`
- `usePositions()` — `useOpenPositionsQuery`
- `useTradeHistory(filters)` — `useTradeHistoryQuery` with pagination
- `useDecisions()` — `useDecisionsQuery` with pagination
- `useMarketData(asset, interval)` — `useOHLCVQuery`
- `useNews(filters)` — `useNewsQuery`
- `useAnalytics()` — `useAnalyticsSummaryQuery`, `usePnlChartQuery`, `useBreakdownQuery`
- `useAdmin()` — `useAdminUsersQuery`, `useKillSwitchMutation`, `useToggleUserMutation`
- `useNotifications()` — `useNotificationsQuery`, `useMarkReadMutation`

**Query key conventions:** `['entity', params]` — e.g., `['positions', { status: 'open' }]`
**Stale times:** market data 30s, analytics 60s, profile 5min, news 10min

**Done when:** All API modules have typed functions. All hooks are typed and tested. Interceptors work (auth header, refresh, error normalization). No raw Axios calls outside `api/` directory.

---

### Task 31 — CI/CD: GitHub Actions

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

**Secrets needed:** `RAILWAY_WEBHOOK_URL`, `GITHUB_TOKEN` (auto)

**Done when:** PR opens → CI runs and passes. Merge to main → web deploys to GitHub Pages, API deploy webhook fires.

---

### Task 32 — Docker Compose for Local Dev

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

### Task 33 — E2E Integration Tests (Critical Flows)

**Goal:** Test the most critical user flows end-to-end.

**Files:** `apps/api/test/e2e/`

**Test flows (Supertest + Jest):**

1. **Auth flow**: register → login → refresh token → access protected route
2. **Binance keys**: connect keys → verify status → disconnect
3. **LLM keys**: connect Claude key → connect OpenAI key → switch active provider → disconnect
4. **Trading config**: create config → update thresholds → get config
5. **Agent lifecycle**: start agent (sandbox) → verify status → stop agent
6. **Kill-switch**: start 2 users' agents → admin kill-switch → verify both stopped
7. **Trade execution (sandbox)**: start agent → mock LLM decision (BUY, confidence 90) → verify trade created + position opened → mock SELL decision → verify position closed with P&L
8. **Onboarding flow**: register → verify redirect to onboarding → complete 3 steps → verify config created
9. **Notifications**: execute trade → verify notification created → mark as read
10. **Admin user management**: admin enables/disables user → verify user agent stops on disable

**Done when:** All 10 flows pass. Tests run in CI. Database is reset between test suites.

---

## Post-Implementation

After all 33 tasks are complete, run `superpowers:finishing-a-development-branch`:
1. Final code review subagent
2. Update CHANGELOG
3. Create PR from `feature/initial-implementation` → `main`
4. Link PR to GitHub Project
