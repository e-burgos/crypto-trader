# CryptoTrader Documentation — Content Source of Truth

> This document serves as the single source of truth for all documentation pages.
> Each H2 (`##`) maps to a docs page. Each H3 (`###`) maps to a TOC entry (scroll-spy "On this page").
> Content is in English. Spanish translations go in `es.ts` i18n file.

---

## Quickstart

> **Route:** `/docs/quickstart`
> **Group:** Getting Started
> **Description:** Get up and running with CryptoTrader in minutes

### What is CryptoTrader?

CryptoTrader is an AI-powered cryptocurrency trading platform that uses a multi-agent system to analyze markets, manage risk, and execute trades on Binance. The platform supports three operation modes (Sandbox, Testnet, Live) and integrates with 7 LLM providers to power its 8 specialized AI agents.

**Key capabilities:**

- Automated trading decisions powered by AI agents
- Real-time market analysis with technical indicators
- Risk management with stop-loss and take-profit
- Multi-agent architecture: each agent specializes in a domain (market analysis, risk, blockchain, operations)
- Support for BTC and ETH trading against USDT/USDC
- Sandbox mode for risk-free testing with virtual funds

### Create your account

1. Navigate to the registration page at `/register`
2. Enter your email address and create a password
3. You'll be redirected to the onboarding wizard
4. Complete the onboarding steps to configure your first agent

### Complete the onboarding

The onboarding wizard guides you through initial setup:

1. **Welcome** — overview of the platform capabilities
2. **Operation Mode** — choose Sandbox (recommended for new users), Testnet, or Live
3. **Exchange Setup** — configure Binance API keys (skip for Sandbox mode)
4. **LLM Provider** — set up at least one AI provider (OpenRouter recommended)
5. **First Agent** — create your first trading agent with a recommended configuration

### Configure your LLM provider

The AI agents need an LLM provider to function. OpenRouter is the recommended default because it provides access to 300+ models from a single API key, including free models.

1. Go to **Settings → LLM Providers**
2. Enter your OpenRouter API key (get one at [openrouter.ai/keys](https://openrouter.ai/keys))
3. Use the **Presets** system to auto-assign recommended models to all agents:
   - **Free** — $0 cost models (great for testing)
   - **Balanced** — good price/performance ratio
   - **Optimized** — best models for each agent role

### Create your first trading agent

1. Go to **Agent Config** in the dashboard
2. Click **"New Agent"** to open the creation wizard
3. Choose a name, trading pair (e.g., BTCUSDT), and operation mode
4. Configure parameters or use defaults:
   - Buy/Sell Threshold: 70% (confidence required from AI)
   - Stop Loss: 3%
   - Take Profit: 5%
   - Max Trade: 5% of capital per trade
5. Click **Create** — the agent is ready to start

### Start the agent

1. On the Agent Config page, find your agent card
2. Click the **Play** button to start the agent
3. The agent will begin its analysis cycle:
   - Fetch market data and technical indicators
   - Consult the AI multi-agent system for a BUY/SELL/HOLD decision
   - Execute trades automatically based on the decision and your thresholds
4. Monitor activity in the **Agent Log** and **Positions** pages

---

## Platform Behavior

> **Route:** `/docs/platform-behavior`
> **Group:** Getting Started
> **Description:** Important behaviors and warnings about the platform

### Stop All mechanism

The **Stop All** button (visible in the top navigation) is a safety mechanism that immediately stops all running trading agents. When activated:

- All agents stop their analysis cycles
- No new trades are placed
- Existing open positions are **NOT** automatically closed — they remain open
- You must manually close positions or restart agents

**When to use Stop All:**

- Emergency situations where market conditions are extreme
- Before changing operation mode
- When you want to pause all automated trading

### Auto-stop on configuration changes

The platform automatically stops an agent when you modify its configuration. This prevents the agent from trading with outdated parameters. After saving changes, you must manually restart the agent.

### Position lifecycle

Positions follow a strict lifecycle:

1. **OPEN** — Created when a BUY trade is executed
2. The agent monitors the position on each cycle
3. The agent may recommend SELL based on market conditions
4. **CLOSED** — When a SELL trade is executed (manual or automatic)

Automatic sell conditions:

- Take-profit threshold reached
- Stop-loss threshold reached
- AI agent recommends SELL with sufficient confidence AND minimum profit threshold is met (default 0.3%)

**Important:** The agent never sells autonomously at a loss via LLM decision. Only stop-loss triggers can close a position at a loss.

### Rate limiting

The platform respects Binance API rate limits:

- Each agent has a configurable minimum interval between analysis cycles (default: 5 minutes)
- In **AGENT** interval mode, the AI itself suggests the optimal wait time based on market volatility
- In **CUSTOM** mode, a fixed interval is used

### Data refresh

- Market prices update via WebSocket in real-time
- Portfolio data refreshes every 30 seconds
- Agent decisions appear in the Agent Log immediately after each cycle

---

## Agents

> **Route:** `/docs/agents`
> **Group:** Platform
> **Description:** Meet the 8 AI agents powering CryptoTrader

### Multi-agent architecture

CryptoTrader uses a multi-agent system where each agent is a specialized AI with a specific role. The agents collaborate through an orchestration layer to produce trading decisions.

The system has three layers:

1. **Routing Layer** — classifies user intent and routes to the right agent
2. **Specialist Agents** — domain experts that analyze specific aspects
3. **Synthesis Layer** — combines agent outputs into a final decision

### KRYPTO — The Orchestrator (3 roles)

KRYPTO operates in three distinct roles:

**Routing (KRYPTO-R)**

- Classifies incoming requests and user messages
- Routes to the appropriate specialist agent
- Ultra-fast model recommended (e.g., Gemma 4, Qwen 3.5)

**Orchestrator (KRYPTO-O)**

- Coordinates multi-agent workflows
- Determines which specialists to consult for a given decision
- Manages the conversation flow between agents

**Synthesis (KRYPTO-S)**

- Combines outputs from multiple agents into a coherent decision
- Generates the final BUY/SELL/HOLD recommendation with confidence score
- Produces the reasoning explanation shown in the Agent Log

### NEXUS — Platform Expert

- **Role:** Expert in CryptoTrader platform functionality
- **Domain:** Helps users understand features, settings, and configuration
- **Used in:** Chat interface, onboarding guidance
- **Specialty:** Knows the platform inside-out, can explain any feature or setting

### FORGE — Operations Assistant

- **Role:** Operations and trade execution specialist
- **Domain:** Order execution, position management, portfolio operations
- **Used in:** Trading decisions, position monitoring
- **Specialty:** Understands order types, execution timing, and operational constraints

### SIGMA — Market Analyst

- **Role:** Market data analysis expert
- **Domain:** Technical indicators, price patterns, market trends, volume analysis
- **Used in:** Every trading cycle — provides market context
- **Specialty:** Interprets RSI, MACD, Bollinger Bands, volume profiles, support/resistance levels

### CIPHER — Blockchain Expert

- **Role:** On-chain and blockchain technology specialist
- **Domain:** Blockchain metrics, network health, whale movements, DeFi trends
- **Used in:** Deep analysis cycles, macro decisions
- **Specialty:** Analyzes on-chain data that traditional technical analysis misses

### AEGIS — Risk Manager

- **Role:** Risk assessment and portfolio protection
- **Domain:** Position sizing, exposure limits, correlation risk, drawdown management
- **Used in:** Every trading decision — provides risk evaluation
- **Specialty:** Ensures no single trade or position exceeds risk parameters

### Agent configuration

Each agent can be individually configured with:

- **LLM Provider** — which AI service powers this agent (OpenRouter, Claude, OpenAI, etc.)
- **Model** — specific model within that provider
- **Recommended models** — the admin can set recommended models per agent, displayed as click-to-apply suggestions

---

## Agent Decision Flow

> **Route:** `/docs/agent-flow`
> **Group:** Platform
> **Description:** How the agent makes trading decisions step by step

### The decision cycle

Every trading agent follows this cycle at each interval:

1. **Data Collection** — Fetch latest market data, OHLCV candles, and technical indicators for the configured pair
2. **Multi-Agent Consultation** — The orchestrator (KRYPTO) routes the market data to relevant specialist agents (SIGMA for market analysis, AEGIS for risk, CIPHER for blockchain)
3. **Synthesis** — KRYPTO synthesizes the specialist opinions into a single recommendation: BUY, SELL, or HOLD
4. **Confidence Check** — The recommendation includes a confidence score (0-100%). This is compared against the agent's buy/sell thresholds
5. **Execution** — If confidence exceeds the threshold AND all safety checks pass, the trade is executed
6. **Wait** — The agent waits for the next cycle (fixed interval or AI-suggested)

### Decision outcomes

| Scenario          | Decision | Confidence | Threshold | Result                                         |
| ----------------- | -------- | ---------- | --------- | ---------------------------------------------- |
| Strong buy signal | BUY      | 85%        | 70%       | ✅ Trade executed                              |
| Weak buy signal   | BUY      | 55%        | 70%       | ❌ Skipped — below threshold                   |
| Sell with profit  | SELL     | 80%        | 70%       | ✅ Trade executed (if min profit met)          |
| Sell at loss      | SELL     | 90%        | 70%       | ❌ Blocked — agent never sells at loss via LLM |
| Market neutral    | HOLD     | N/A        | N/A       | No action — wait for next cycle                |

### The wait time

After each decision, the agent determines when to analyze again:

- **AGENT mode** (default): The AI suggests a wait time based on market volatility. High volatility = shorter wait (2-5 min). Low volatility = longer wait (10-30 min).
- **CUSTOM mode**: Fixed interval set by the user (minimum 5 minutes).

The suggested wait time (called `suggestedWait`) appears in the Agent Log for each decision cycle.

### Decision flow diagram

The visual diagram shows the complete flow:

```
Market Data → Agent Analyzes → [BUY/SELL/HOLD]
                                    ↓
                            Check Confidence
                                    ↓
                    [Above Threshold?] → NO → HOLD → Wait
                            ↓ YES
                    [Safety Checks] → FAIL → Log Warning → Wait
                            ↓ PASS
                    Execute Trade → Log Result → Wait
```

---

## Agent Configuration

> **Route:** `/docs/agent-config`
> **Group:** Platform
> **Description:** Configure agent parameters, presets, and understand key concepts

### Strategy presets

CryptoTrader offers three built-in presets that configure all agent parameters at once:

| Preset       | Risk Level | Buy Threshold | Sell Threshold | Stop Loss | Take Profit | Best For                             |
| ------------ | ---------- | ------------- | -------------- | --------- | ----------- | ------------------------------------ |
| Conservative | Low        | 80%           | 80%            | 2%        | 3%          | Minimal risk, fewer but safer trades |
| Moderate     | Medium     | 70%           | 70%            | 3%        | 5%          | Balanced approach (default)          |
| Aggressive   | High       | 60%           | 60%            | 5%        | 8%          | More trades, higher risk/reward      |

### Configuration parameters

Every trading agent has these configurable parameters:

**Buy/Sell Thresholds** (0-100%)

- The minimum confidence score required from the AI to execute a BUY or SELL
- Higher = more conservative (fewer trades, higher conviction required)
- Lower = more aggressive (more trades, accepts lower conviction)
- Default: 70% for both

**Stop Loss** (0-100%)

- Maximum loss percentage before automatically closing a position
- Triggered independently of the AI — this is a hard safety limit
- Example: 3% stop loss on a $85,000 BTC buy triggers at $82,450
- Default: 3%

**Take Profit** (0-100%)

- Target profit percentage to automatically close a position
- When reached, the position is closed to lock in gains
- Example: 5% take profit on a $85,000 BTC buy triggers at $89,250
- Default: 5%

**Minimum Profit Percentage** (minProfitPct)

- Minimum profit required before the AI agent can recommend a SELL
- Prevents premature selling of positions with tiny gains
- This does NOT apply to stop-loss or take-profit triggers
- Default: 0.3%

**Max Trade Percentage** (maxTradePct)

- Maximum percentage of available capital to use in a single trade
- Prevents over-concentration in a single position
- Example: 5% of $10,000 balance = max $500 per trade
- Default: 5%

**Max Concurrent Positions**

- Maximum number of open positions allowed simultaneously
- Prevents over-exposure to the market
- Default: 2

**Minimum Interval** (minIntervalMinutes)

- Minimum time between analysis cycles
- In AGENT mode, the AI can suggest longer waits but never shorter than this
- Default: 5 minutes

**Interval Mode**

- **AGENT** (default): AI determines optimal analysis frequency based on market conditions
- **CUSTOM**: Fixed interval specified by the user

**Order Price Offset** (orderPriceOffsetPct)

- Percentage offset applied to market price when placing orders
- 0% = execute at exact market price
- Positive = slightly higher than market (for limit orders)
- Default: 0%

**Risk Profile**

- Influences the AI model's behavior and prompt tone
- **CONSERVATIVE**: More cautious analysis, emphasizes protection
- **MODERATE**: Balanced analysis (default)
- **AGGRESSIVE**: More opportunity-seeking analysis

### Key concepts explained

**Thresholds — The confidence gate**
Think of thresholds as a quality filter. The AI analyzes the market and says "I'm 75% confident this is a good buy." If your threshold is 70%, the trade goes through. If your threshold is 80%, it's rejected. Higher thresholds = fewer but more confident trades.

**Stop Loss — Your safety net**
Stop loss is the only mechanism that can close a position at a loss. It's a hard circuit breaker — no AI decision needed. When the price drops by the configured percentage from your entry price, the position is immediately closed to prevent further loss.

**Capital management — Position sizing**
The `maxTradePct` parameter controls how much of your available balance goes into each trade. Combined with `maxConcurrentPositions`, this limits your total market exposure. Example: 5% per trade × 2 max positions = maximum 10% of capital at risk.

**Interval — How often the agent thinks**
In AGENT mode, the AI itself decides how frequently to check the market. During high-volatility periods, it checks more often. During quiet markets, it waits longer. The `minIntervalMinutes` sets the floor — the AI can wait longer but never shorter.

**Order Price Offset — Slippage control**
When the agent decides to buy at $85,000, the actual order might execute at a slightly different price due to market movement. The offset allows you to account for this. Most users leave this at 0% for market orders.

---

## Trade Execution

> **Route:** `/docs/trade-execution`
> **Group:** Platform
> **Description:** How trades are executed, buy/sell rules, and real examples

### Buy execution flow

When the AI agent decides to BUY:

1. **Confidence check** — Agent confidence must exceed the buy threshold
2. **Capital check** — Verify sufficient balance (available × maxTradePct)
3. **Position check** — Verify open positions < maxConcurrentPositions
4. **Execute order** — Place market order on Binance (LIVE/TESTNET) or simulate (SANDBOX)
5. **Create position** — Record the new position with entry price, quantity, and fees
6. **Log decision** — Record the decision with reasoning in the Agent Log

### Sell execution paths

There are four ways a position can be sold:

**1. AI-recommended SELL**

- The agent analyzes market conditions and recommends selling
- Requires: confidence > sell threshold AND profit > minProfitPct (0.3%)
- The agent will NEVER sell at a loss via LLM decision

**2. Take-profit trigger**

- Automatic: when price rises by takeProfitPct from entry price
- No AI decision needed — triggers on price alone
- Closes the position immediately to lock in gains

**3. Stop-loss trigger**

- Automatic: when price drops by stopLossPct from entry price
- The only mechanism that can close a position at a loss
- Hard safety limit — overrides everything

**4. Manual close**

- User clicks "Close Position" in the Positions page
- No restrictions — can close at any price, profit or loss
- Useful for emergency exits or when you disagree with the agent

### Trade execution priority

| Priority    | Mechanism              | Can close at loss?     | Needs AI? |
| ----------- | ---------------------- | ---------------------- | --------- |
| 1 (highest) | Stop Loss              | ✅ Yes                 | No        |
| 2           | Take Profit            | No (always profit)     | No        |
| 3           | AI SELL recommendation | ❌ No (minProfit gate) | Yes       |
| 4           | Manual close           | ✅ Yes                 | No        |

### Fee calculation

All trades on Binance incur a 0.1% fee (taker fee for market orders):

```
Entry fee = entryPrice × quantity × 0.001
Exit fee  = exitPrice × quantity × 0.001
Net PnL   = (exitPrice − entryPrice) × quantity − (entryFee + exitFee)
```

**Example:** Buy 0.01 BTC at $85,000, sell at $87,000:

- Gross PnL: ($87,000 − $85,000) × 0.01 = $20.00
- Entry fee: $85,000 × 0.01 × 0.001 = $0.85
- Exit fee: $87,000 × 0.01 × 0.001 = $0.87
- Net PnL: $20.00 − $0.85 − $0.87 = **$18.28**

> If you pay fees with BNB on Binance (25% discount), the platform-calculated PnL will be slightly conservative compared to your actual result. The platform does not detect or manage the BNB discount.

---

## Binance Integration

> **Route:** `/docs/binance`
> **Group:** Integrations
> **Description:** How CryptoTrader connects to Binance for trading

### Supported trading

CryptoTrader operates exclusively on the **Binance Spot Market** using **Market Orders**. This means:

- Only spot trading (no futures, no margin, no leverage)
- Orders execute immediately at current market price
- No order book management or limit orders

### Supported trading pairs

| Asset | Quote | Symbol  | Description          |
| ----- | ----- | ------- | -------------------- |
| BTC   | USDT  | BTCUSDT | Bitcoin vs Tether    |
| BTC   | USDC  | BTCUSDC | Bitcoin vs USD Coin  |
| ETH   | USDT  | ETHUSDT | Ethereum vs Tether   |
| ETH   | USDC  | ETHUSDC | Ethereum vs USD Coin |

### Connection modes

**Sandbox** — No Binance connection needed

- Simulated trading with a virtual wallet ($10,000 default balance)
- All trades are simulated locally
- Perfect for learning and testing strategies

**Testnet** — Connects to Binance Testnet

- Uses Binance's test environment with fake funds
- Real API calls, real order flow, fake money
- Get testnet keys at [testnet.binance.vision](https://testnet.binance.vision)
- Validates your API integration without risk

**Live** — Connects to Binance Production

- Real trading with real funds
- Market orders execute instantly
- Requires production Binance API keys with Spot trading permission
- ⚠️ **Real money is at risk**

### Fee structure

Binance charges 0.1% per trade (taker fee for market orders). The platform calculates fees automatically for all PnL displays.

Formulas used:

```
entry_fee  = entry_price × quantity × 0.001
exit_fee   = exit_price × quantity × 0.001
net_pnl    = gross_pnl − entry_fee − exit_fee
```

### API key security

Your Binance API credentials are handled with strict security:

1. **Encrypted at rest** — API Key and Secret are encrypted with AES-256 before database storage
2. **Decrypted in memory** — Only decrypted when executing an order, immediately discarded after
3. **Signed requests** — Every Binance request is signed with HMAC-SHA256 (required by Binance API)
4. **Never exposed** — Credentials never appear in logs, WebSocket messages, or the UI

### Required Binance permissions

When creating your Binance API key, configure these permissions:

| Permission               | Status          | Purpose                                    |
| ------------------------ | --------------- | ------------------------------------------ |
| Read account information | ✅ Required     | Fetch balances and order history           |
| Spot trading             | ✅ Required     | Execute buy/sell orders                    |
| Withdrawals              | ❌ NEVER enable | CryptoTrader never needs withdrawal access |

> **Security tip:** Restrict your API key to your server's IP address for additional protection.

---

## Operation Modes

> **Route:** `/docs/operation-modes`
> **Group:** Integrations
> **Description:** Understand Sandbox, Testnet, and Live modes

### Three modes of operation

CryptoTrader supports three distinct operation modes. Each mode changes how the trading engine processes orders and where funds come from.

### Sandbox mode

- **Purpose:** Risk-free testing and learning
- **Funds:** Virtual wallet with $10,000 simulated balance
- **Trading:** All trades are simulated locally — no exchange connection
- **API Keys:** Not required
- **Best for:** New users, strategy testing, learning the platform

In Sandbox mode, the AI agents still analyze real market data and make real decisions. The only difference is that trade execution is simulated. This gives you a realistic testing environment without any financial risk.

### Testnet mode

- **Purpose:** Validate exchange integration
- **Funds:** Fake funds from Binance Testnet
- **Trading:** Real API calls to Binance Testnet — real order flow with fake money
- **API Keys:** Testnet API keys required (from testnet.binance.vision)
- **Best for:** Validating API key setup, testing order execution flow

Testnet mode is the bridge between Sandbox and Live. It uses real Binance API calls but against their test environment. This validates that your API keys work, orders execute correctly, and the full integration functions before going live.

### Live mode

- **Purpose:** Real trading with real money
- **Funds:** Your actual Binance account balance
- **Trading:** Market orders on Binance production — executes instantly
- **API Keys:** Production Binance API keys with Spot trading permission
- **Best for:** Actual trading with proven strategies
- ⚠️ **Real money at risk** — only use after thorough testing in Sandbox/Testnet

### Switching between modes

- You can switch modes at any time in **Settings → Exchange**
- When switching from Sandbox/Testnet to Live, you must have valid Binance production API keys
- Open positions in the previous mode are preserved but paused
- Each mode has its own set of agents and positions — they don't mix

---

## LLM Providers

> **Route:** `/docs/llm-providers`
> **Group:** Integrations
> **Description:** AI providers, model recommendations, and smart presets

### Supported providers

CryptoTrader integrates with 7 LLM providers:

| Provider           | Type                     | Highlight                                          |
| ------------------ | ------------------------ | -------------------------------------------------- |
| **OpenRouter**     | Aggregator (recommended) | 300+ models, single API key, free models available |
| Claude (Anthropic) | Direct                   | High reasoning, best for complex analysis          |
| OpenAI             | Direct                   | GPT-4o, GPT-4 Turbo, versatile                     |
| Groq               | Direct                   | Ultra-fast inference, great for routing            |
| Gemini (Google)    | Direct                   | Strong reasoning, large context                    |
| Mistral            | Direct                   | European provider, efficient models                |
| Together           | Direct                   | Open-source model hosting                          |

### Why OpenRouter is recommended

OpenRouter acts as a unified gateway to 300+ AI models from multiple providers. Benefits:

- **Single API key** — one key accesses all models
- **Free models** — many models have $0 cost (perfect for testing)
- **Automatic fallbacks** — if one provider is down, traffic routes to another
- **Cost optimization** — choose the best price/performance for each agent
- **Model diversity** — access Llama, Qwen, DeepSeek, Gemma, and more

### Smart Presets

The preset system auto-assigns recommended models to all 8 agents at once:

**Free preset ($0 cost)**
All agents use free models available through OpenRouter. Great for testing and learning.

**Balanced preset**
Optimizes price/performance. Uses efficient models that provide good results at reasonable cost.

**Optimized preset**
Best available model for each agent role. Higher cost but maximum quality.

### Recommended models by agent

| Agent                 | Role                  | Free                  | Balanced          | Optimized         |
| --------------------- | --------------------- | --------------------- | ----------------- | ----------------- |
| KRYPTO (routing)      | Intent classification | gemma-4-26b:free      | qwen3.5-9b        | deepseek-v4-flash |
| KRYPTO (orchestrator) | Workflow coordination | nemotron-3-super:free | deepseek-v4-flash | kimi-k2.6         |
| KRYPTO (synthesis)    | Final decision        | nemotron-3-super:free | deepseek-v4-pro   | kimi-k2.6         |
| NEXUS (platform)      | Platform expertise    | gemma-4-31b:free      | qwen3.5-35b       | deepseek-v4-flash |
| FORGE (operations)    | Trade execution       | qwen3-next-80b:free   | deepseek-v4-flash | qwen3.6-plus      |
| SIGMA (market)        | Market analysis       | nemotron-3-super:free | deepseek-v4-flash | deepseek-v4-pro   |
| CIPHER (blockchain)   | Blockchain analysis   | minimax-m2.5:free     | minimax-m2.7      | qwen3.6-plus      |
| AEGIS (risk)          | Risk management       | nemotron-3-super:free | deepseek-v4-pro   | kimi-k2.6         |

### Admin provider management

Administrators can enable/disable LLM providers at the platform level. When a provider is disabled:

- Users cannot select that provider for their agents
- Existing agents using that provider continue to work (graceful degradation)
- A notification is sent to affected users

---

## API Keys

> **Route:** `/docs/api-keys`
> **Group:** Integrations
> **Description:** How to set up API keys for LLM providers and Binance

### OpenRouter (recommended)

OpenRouter is the recommended LLM provider. One API key gives access to 300+ models.

1. Create an account at [openrouter.ai](https://openrouter.ai)
2. Go to **Keys → Create Key**
3. Copy the key (starts with `sk-or-`)
4. In CryptoTrader: go to **Settings → LLM Providers → OpenRouter**
5. Paste the key and save

```
sk-or-v1-XXXXXXXXXXXXXXXXXXXX
```

> **Tip:** Many models on OpenRouter are free. Use the "Free" preset to configure all agents with $0 cost models — perfect for getting started.

### Binance

Required for Testnet and Live modes. Not needed for Sandbox.

**Production keys (Live mode):**

1. Log in to [Binance](https://www.binance.com)
2. Go to **Account → API Management**
3. Create a new API key with a label (e.g., "CryptoTrader")
4. Enable: Read Info ✅, Spot Trading ✅
5. **NEVER enable Withdrawals** ❌
6. Copy the API Key and Secret
7. In CryptoTrader: go to **Settings → Exchange → Binance**
8. Paste both values and save

**Testnet keys (Testnet mode):**

1. Go to [testnet.binance.vision](https://testnet.binance.vision)
2. Log in with GitHub
3. Generate HMAC_SHA256 keys
4. In CryptoTrader: go to **Settings → Exchange → Testnet**
5. Paste both values and save

### Claude (Anthropic)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. In CryptoTrader: **Settings → LLM Providers → Claude**
4. Paste the key (starts with `sk-ant-`)

### OpenAI

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create a new secret key
3. In CryptoTrader: **Settings → LLM Providers → OpenAI**
4. Paste the key (starts with `sk-`)

### Groq

1. Go to [console.groq.com/keys](https://console.groq.com/keys)
2. Create an API key
3. In CryptoTrader: **Settings → LLM Providers → Groq**
4. Paste the key (starts with `gsk_`)

---

## FAQ

> **Route:** `/docs/faq`
> **Group:** Support
> **Description:** Frequently asked questions

### General

**What is CryptoTrader?**
An AI-powered cryptocurrency trading platform that uses multiple specialized AI agents to analyze markets and execute trades on Binance automatically.

**Is it free to use?**
The platform itself is free. Costs come from LLM API usage (can be $0 with free models on OpenRouter) and Binance trading fees (0.1% per trade).

**Do I need programming knowledge?**
No. The platform is entirely UI-driven. You configure agents through forms and toggle settings — no code required.

### Trading

**Can the agent lose money?**
Yes. Cryptocurrency trading carries inherent risk. The stop-loss mechanism limits losses per trade, but there is no guarantee of profit. Always start with Sandbox mode to understand the platform before using real funds.

**What happens if my internet goes down?**
The agents run on the server, not in your browser. If your browser closes, agents keep running. If the server goes down, agents stop and positions remain open — you'll need to manage them manually on Binance.

**What trading pairs are supported?**
BTC/USDT, BTC/USDC, ETH/USDT, and ETH/USDC on Binance Spot market.

**Can I run multiple agents simultaneously?**
Yes. You can create multiple agent configurations for different pairs or strategies. Each agent runs independently with its own parameters and positions.

### AI & Models

**Which LLM provider should I use?**
OpenRouter is recommended. It provides access to 300+ models (including free ones) with a single API key. Use the preset system to auto-assign optimal models to each agent.

**What if an LLM provider goes down?**
The agent will log an error and retry on the next cycle. If using OpenRouter, it has built-in provider fallbacks. For direct providers, the agent waits until the provider is back.

**Can I change models while agents are running?**
Yes, but the agent must be stopped and restarted for the new model to take effect.

### Security

**Are my API keys safe?**
Yes. All API keys (Binance and LLM providers) are encrypted with AES-256 before storage and only decrypted in memory when needed. They are never exposed in logs, WebSocket messages, or the UI.

**Can CryptoTrader withdraw from my Binance account?**
No. The platform only needs Read and Spot Trading permissions. You should NEVER enable withdrawal permissions on your API key.

**Who can see my trading data?**
Only you and administrators have access to your account data. The platform does not share trading data with third parties.

---

## Dashboard Overview

> **Route:** `/docs/dashboard`
> **Group:** Platform
> **Description:** Tour of the main dashboard and its key metrics

### KPI Metrics

The dashboard header shows four at-a-glance cards that summarize your trading performance:

| Metric         | Description                                                            |
| -------------- | ---------------------------------------------------------------------- |
| Net PnL        | Realized profit and loss across all closed trades in the selected mode |
| Win Rate       | Percentage of winning trades vs total trades                           |
| Open Positions | Number of currently active positions                                   |
| Total Trades   | Total trades executed since account creation                           |

> All metrics are mode-aware — switching between Sandbox, Testnet, and Live filters the data to that environment.

### PnL Chart

The PnL chart shows cumulative profit/loss over time. It updates as trades are closed. You can switch between time ranges (1D, 1W, 1M) using the selector above the chart.

### Asset Breakdown

The asset breakdown section shows your portfolio distribution across active trading pairs (BTC/USDT, BTC/USDC, ETH/USDT, ETH/USDC). Each slice represents the allocation as a percentage of total deployed capital.

### Quick Navigation

| Section       | Path                      | What you'll find                         |
| ------------- | ------------------------- | ---------------------------------------- |
| Market        | `/dashboard/market`       | Live prices and technical indicators     |
| Bot Analysis  | `/dashboard/bot-analysis` | AI composite score and indicator summary |
| Agent Log     | `/dashboard/agent-log`    | History of every AI decision             |
| Positions     | `/dashboard/positions`    | Open and closed positions                |
| Trade History | `/dashboard/history`      | Complete list of executed trades         |
| Chat          | `/dashboard/chat`         | Direct conversation with AI agents       |

### Balance Display

The balance widget shows available funds per mode:

- **SANDBOX** — Virtual $10,000 USD. Resets to $10,000 if you reset sandbox data.
- **TESTNET** — Real Binance Testnet balance (refillable via Binance Testnet faucet).
- **LIVE** — Real balance from your connected Binance account.

---

## Market

> **Route:** `/docs/market`
> **Group:** Platform
> **Description:** Real-time market data, charts, and technical indicators

### Live Ticker

The market page streams live price data for the four supported pairs:

| Field          | Description                                        |
| -------------- | -------------------------------------------------- |
| Last Price     | Most recent trade price on Binance                 |
| 24h Change     | Price change and percentage over the last 24 hours |
| 24h High / Low | Highest and lowest prices in the current session   |
| 24h Volume     | Total volume traded in the current 24-hour window  |

### Pair Selector

Use the four pair buttons — `BTC/USDT`, `BTC/USDC`, `ETH/USDT`, `ETH/USDC` — to switch the active chart and ticker.

### OHLCV Chart

The candlestick chart displays Open, High, Low, Close, and Volume bars. The AI agents use this data along with technical indicators to make trading decisions.

### Technical Indicators

| Indicator       | Description                                                       |
| --------------- | ----------------------------------------------------------------- |
| RSI (14)        | Relative Strength Index — overbought above 70, oversold below 30  |
| MACD            | Moving Average Convergence Divergence — trend and momentum signal |
| Bollinger Bands | Volatility envelope — price near upper band = overbought          |
| Volume          | Bar volume relative to 20-period moving average                   |
| EMA 9 / EMA 21  | Short and medium-term trend direction                             |
| Stochastic RSI  | Smoothed RSI oscillator, more sensitive to recent price action    |

> SIGMA (market analyst agent) uses all six indicator groups when generating its trading signal. The final composite score shown on Bot Analysis combines SIGMA's signal with news sentiment and risk assessment.

---

## Bot Analysis

> **Route:** `/docs/bot-analysis`
> **Group:** Platform
> **Description:** AI composite score combining technical analysis, news sentiment, and risk

### Combined Score

The large banner shows the current composite AI score:

- **BULLISH** (green) — Agents favor a BUY signal for the selected pair
- **BEARISH** (red) — Agents favor a SELL or close signal
- **NEUTRAL** (yellow) — Insufficient signal or mixed conditions

The score is recalculated on every agent cycle (configurable interval, default 15 minutes).

### Technical Summary

The Technical Summary panel shows the latest indicator readings that fed into the score, including RSI value, MACD histogram direction, Bollinger Band position, EMA crossover status, and Stochastic RSI momentum.

### News Sentiment Panel

Summarizes the last N news articles processed by SIGMA. Each article is classified as Positive, Negative, or Neutral. The aggregate sentiment percentage contributes to the composite score.

### Agent Input Summary

| Agent  | Input                                 |
| ------ | ------------------------------------- |
| SIGMA  | Technical indicators + news sentiment |
| NEXUS  | Platform-level risk and context       |
| CIPHER | On-chain/blockchain signals           |
| AEGIS  | Risk management veto                  |

### Next Decision Countdown

A countdown timer shows when the next analysis cycle will run. You can trigger a manual analysis cycle from the agent control panel in Config.

---

## Agent Decisions

> **Route:** `/docs/agent-decisions`
> **Group:** Platform
> **Description:** Full history of every AI trading decision with reasoning

### Decision Card Anatomy

Each entry in the Agent Log contains:

| Field      | Description                            |
| ---------- | -------------------------------------- |
| Timestamp  | When the decision was made (UTC)       |
| Agent      | Which agent made the decision          |
| Asset      | Trading pair analyzed                  |
| Decision   | BUY, SELL, or HOLD                     |
| Confidence | 0–100 score indicating agent certainty |
| Reasoning  | Full text explanation from the LLM     |
| Mode       | SANDBOX, TESTNET, or LIVE              |

### Decision Types

- **BUY** — Agent recommends opening or increasing a long position.
- **SELL** — Agent recommends closing or reducing a position.
- **HOLD** — Agent recommends no action for this cycle.

### Filters

| Filter        | Options                              |
| ------------- | ------------------------------------ |
| Decision type | All, BUY, SELL, HOLD                 |
| Asset         | All pairs, or a specific pair        |
| Agent         | All agents, or a specific agent role |

### Decision Detail Modal

Click any log entry to open a full-screen modal with the complete LLM reasoning, indicator values at the time of the decision, and the news headlines that were factored in.

---

## Chat

> **Route:** `/docs/chat`
> **Group:** Platform
> **Description:** Direct conversation interface with AI trading agents

### Chat Sessions

The Chat page lets you have multi-turn conversations with the platform's AI agents.

1. **Start a session** — Click "New Chat" to begin. Each session is isolated with its own context window.
2. **Ask anything** — Type a question in natural language. The orchestrator routes it to the right specialist agent.
3. **Review response** — Responses include citations from the agent's knowledge base (market data, news, trade history).

### Capability Shortcuts

| Shortcut        | What it does                                        |
| --------------- | --------------------------------------------------- |
| Market Analysis | Triggers SIGMA to analyze current market conditions |
| News Analysis   | Asks SIGMA for latest news sentiment on your pair   |
| Trade History   | Asks FORGE to summarize recent trade performance    |

### Agent Selection

| Agent  | Chat Specialty                                           |
| ------ | -------------------------------------------------------- |
| KRYPTO | General orchestration, routing complex questions         |
| SIGMA  | Market conditions, technical indicators, news sentiment  |
| NEXUS  | Platform health, trade monitoring, operational questions |
| CIPHER | On-chain analysis, blockchain data, wallet activity      |
| FORGE  | Execution history, order management, performance stats   |

### Orchestrating Indicator

When KRYPTO routes your question to multiple agents before answering, a "Consulting agents..." indicator appears. The response will aggregate findings from all queried agents.

---

## News Feed

> **Route:** `/docs/news-feed`
> **Group:** Platform
> **Description:** AI-curated crypto news with sentiment analysis

### Analysis Summary Card

| Field                | Description                                        |
| -------------------- | -------------------------------------------------- |
| Positive sentiment % | Share of articles classified as positive           |
| Negative sentiment % | Share of articles classified as negative           |
| Neutral sentiment %  | Remaining articles with no clear signal            |
| Keyword analysis     | Top tokens extracted from headlines                |
| AI analysis          | SIGMA's natural language summary of the news cycle |

### Sentiment Filters

Use the filter row to show All, Positive, Negative, or Neutral articles.

### News Card Anatomy

Each article card contains the headline, source name, publication time (relative), sentiment badge, and a link to the original article.

### Connection to SIGMA

The SIGMA agent automatically reads the latest news on each analysis cycle. The headlines and their sentiment scores are passed as context to the LLM along with technical indicator data — news events can directly trigger BUY, SELL, or HOLD decisions.

---

## Settings — Agents

> **Route:** `/docs/settings-agents`
> **Group:** Configuration
> **Description:** Configure LLM models and presets for each AI agent

### Configurable Agents

| Agent              | Role                          | Default tier |
| ------------------ | ----------------------------- | ------------ |
| KRYPTO (Routing)   | Orchestrator / request router | Balanced     |
| KRYPTO (Synthesis) | Response synthesizer          | Balanced     |
| NEXUS              | Platform operations monitor   | Balanced     |
| FORGE              | Trade execution coordinator   | Balanced     |
| SIGMA              | Market & news analyst         | Balanced     |
| CIPHER             | Blockchain / on-chain analyst | Balanced     |
| AEGIS              | Risk management (locked)      | Optimized    |

> AEGIS is locked to an Optimized-tier model and cannot be downgraded.

### Smart Preset System

| Preset        | Cost     | Best for                                      |
| ------------- | -------- | --------------------------------------------- |
| **Free**      | $0/month | Testing, development, evaluating the platform |
| **Balanced**  | Low–Mid  | Daily trading with good quality/cost ratio    |
| **Optimized** | Higher   | Production trading where accuracy matters     |

### Validation Badges

| Badge                   | Meaning                                              |
| ----------------------- | ---------------------------------------------------- |
| **Available** (green)   | Model ID is valid and responding                     |
| **Deprecated** (orange) | Model scheduled for removal; switch to a newer model |
| Invalid                 | Model ID not found; check name on OpenRouter.ai      |

### Per-Agent Model Override

1. Find the agent card.
2. Click the model input field and type the full model ID (e.g. `deepseek/deepseek-v4-flash`).
3. Click **Save** or press Enter.
4. Wait for the validation badge to confirm availability.
5. Stop and restart the agent for the change to take effect.
