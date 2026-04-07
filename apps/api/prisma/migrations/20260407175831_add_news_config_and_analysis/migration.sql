-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TRADER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Asset" AS ENUM ('BTC', 'ETH');

-- CreateEnum
CREATE TYPE "QuoteCurrency" AS ENUM ('USDT', 'USDC');

-- CreateEnum
CREATE TYPE "TradingMode" AS ENUM ('LIVE', 'SANDBOX');

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "TradeType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('BUY', 'SELL', 'HOLD');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TRADE_EXECUTED', 'STOP_LOSS_TRIGGERED', 'TAKE_PROFIT_HIT', 'AGENT_ERROR', 'AGENT_STARTED', 'AGENT_STOPPED', 'AGENT_KILLED');

-- CreateEnum
CREATE TYPE "LLMProvider" AS ENUM ('CLAUDE', 'OPENAI', 'GROQ');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NewsApiProvider" AS ENUM ('CRYPTOPANIC', 'NEWSDATA');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TRADER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "binance_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "apiKeyIv" TEXT NOT NULL,
    "secretIv" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "binance_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "LLMProvider" NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "apiKeyIv" TEXT NOT NULL,
    "selectedModel" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_api_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "NewsApiProvider" NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "apiKeyIv" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_api_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asset" "Asset" NOT NULL,
    "pair" "QuoteCurrency" NOT NULL,
    "buyThreshold" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "sellThreshold" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "stopLossPct" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
    "takeProfitPct" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "maxTradePct" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "maxConcurrentPositions" INTEGER NOT NULL DEFAULT 2,
    "minIntervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "orderPriceOffsetPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mode" "TradingMode" NOT NULL DEFAULT 'SANDBOX',
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trading_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "asset" "Asset" NOT NULL,
    "pair" "QuoteCurrency" NOT NULL,
    "mode" "TradingMode" NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "entryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitPrice" DOUBLE PRECISION,
    "exitAt" TIMESTAMP(3),
    "status" "PositionStatus" NOT NULL DEFAULT 'OPEN',
    "pnl" DOUBLE PRECISION,
    "fees" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "type" "TradeType" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" "TradingMode" NOT NULL,
    "binanceOrderId" TEXT,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_decisions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asset" "Asset" NOT NULL,
    "pair" "QuoteCurrency" NOT NULL,
    "decision" "Decision" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasoning" TEXT NOT NULL,
    "indicators" JSONB NOT NULL,
    "newsHeadlines" JSONB NOT NULL,
    "waitMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_items" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sentiment" "Sentiment" NOT NULL DEFAULT 'NEUTRAL',
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "newsCount" INTEGER NOT NULL DEFAULT 40,
    "enabledSources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "onlySummary" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_analyses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "newsCount" INTEGER NOT NULL,
    "positiveCount" INTEGER NOT NULL,
    "negativeCount" INTEGER NOT NULL,
    "neutralCount" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "overallSentiment" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "headlines" JSONB NOT NULL,
    "aiAnalyzedAt" TIMESTAMP(3),
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "aiPositiveCount" INTEGER,
    "aiNegativeCount" INTEGER,
    "aiNeutralCount" INTEGER,
    "aiScore" INTEGER,
    "aiOverallSentiment" TEXT,
    "aiSummary" TEXT,
    "aiHeadlines" JSONB,

    CONSTRAINT "news_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_actions" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sandbox_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" "QuoteCurrency" NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sandbox_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "provider" "LLMProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "binance_credentials_userId_key" ON "binance_credentials"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "llm_credentials_userId_provider_key" ON "llm_credentials"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "news_api_credentials_userId_provider_key" ON "news_api_credentials"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "trading_configs_userId_asset_pair_key" ON "trading_configs"("userId", "asset", "pair");

-- CreateIndex
CREATE INDEX "positions_userId_status_idx" ON "positions"("userId", "status");

-- CreateIndex
CREATE INDEX "positions_userId_asset_status_idx" ON "positions"("userId", "asset", "status");

-- CreateIndex
CREATE INDEX "trades_userId_executedAt_idx" ON "trades"("userId", "executedAt");

-- CreateIndex
CREATE INDEX "trades_userId_mode_idx" ON "trades"("userId", "mode");

-- CreateIndex
CREATE INDEX "agent_decisions_userId_createdAt_idx" ON "agent_decisions"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "news_items_url_key" ON "news_items"("url");

-- CreateIndex
CREATE INDEX "news_items_publishedAt_idx" ON "news_items"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "news_configs_userId_key" ON "news_configs"("userId");

-- CreateIndex
CREATE INDEX "news_analyses_userId_analyzedAt_idx" ON "news_analyses"("userId", "analyzedAt");

-- CreateIndex
CREATE INDEX "notifications_userId_read_createdAt_idx" ON "notifications"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "admin_actions_adminId_createdAt_idx" ON "admin_actions"("adminId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sandbox_wallets_userId_currency_key" ON "sandbox_wallets"("userId", "currency");

-- CreateIndex
CREATE INDEX "chat_sessions_userId_createdAt_idx" ON "chat_sessions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_sessionId_createdAt_idx" ON "chat_messages"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "binance_credentials" ADD CONSTRAINT "binance_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_credentials" ADD CONSTRAINT "llm_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_api_credentials" ADD CONSTRAINT "news_api_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_configs" ADD CONSTRAINT "trading_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_configId_fkey" FOREIGN KEY ("configId") REFERENCES "trading_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_configs" ADD CONSTRAINT "news_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_analyses" ADD CONSTRAINT "news_analyses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sandbox_wallets" ADD CONSTRAINT "sandbox_wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
