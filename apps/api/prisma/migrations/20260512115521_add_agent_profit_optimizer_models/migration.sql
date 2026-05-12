-- CreateEnum
CREATE TYPE "AgentToolName" AS ENUM ('PORTFOLIO_CONTEXT', 'MARKET_EDGE', 'TRADE_SIMULATION', 'RISK_BUDGET', 'DECISION_MEMORY', 'TOKEN_BUDGET');

-- CreateEnum
CREATE TYPE "AgentOutcomeStatus" AS ENUM ('PENDING', 'WIN', 'LOSS', 'NEUTRAL', 'MISSED_OPPORTUNITY', 'AVOIDED_LOSS');

-- AlterTable
ALTER TABLE "agent_decisions" ADD COLUMN     "dataCostUsd" DOUBLE PRECISION,
ADD COLUMN     "expectedNetValueUsd" DOUBLE PRECISION,
ADD COLUMN     "llmCostUsd" DOUBLE PRECISION,
ADD COLUMN     "modelRoutingReason" TEXT;

-- AlterTable
ALTER TABLE "llm_usage_logs" ADD COLUMN     "actualModel" TEXT,
ADD COLUMN     "agentId" "AgentId",
ADD COLUMN     "decisionId" TEXT,
ADD COLUMN     "requestId" TEXT;

-- CreateTable
CREATE TABLE "agent_budget_policies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyTokenBudget" INTEGER NOT NULL DEFAULT 200000,
    "dailyUsdBudget" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "maxCostPerDecisionUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "livePremiumOnly" BOOLEAN NOT NULL DEFAULT true,
    "minEvToCostRatio" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_budget_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_model_policies" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "agentId" "AgentId" NOT NULL,
    "mode" "TradingMode",
    "riskProfile" "RiskProfile",
    "provider" "LLMProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "maxInputTokens" INTEGER NOT NULL DEFAULT 8000,
    "maxOutputTokens" INTEGER NOT NULL DEFAULT 768,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_model_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_tool_invocations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "decisionId" TEXT,
    "agentId" "AgentId" NOT NULL,
    "toolName" "AgentToolName" NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outputHash" TEXT,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "freshnessMs" INTEGER,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_tool_invocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_decision_evaluations" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "horizonMinutes" INTEGER NOT NULL,
    "status" "AgentOutcomeStatus" NOT NULL DEFAULT 'PENDING',
    "priceAtDecision" DOUBLE PRECISION NOT NULL,
    "priceAtEvaluation" DOUBLE PRECISION,
    "realizedPnlUsd" DOUBLE PRECISION,
    "hypotheticalPnlUsd" DOUBLE PRECISION,
    "missedOpportunityUsd" DOUBLE PRECISION,
    "maxAdverseMovePct" DOUBLE PRECISION,
    "maxFavorableMovePct" DOUBLE PRECISION,
    "marketRegime" TEXT,
    "evaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_decision_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_budget_policies_userId_key" ON "agent_budget_policies"("userId");

-- CreateIndex
CREATE INDEX "agent_model_policies_userId_agentId_idx" ON "agent_model_policies"("userId", "agentId");

-- CreateIndex
CREATE INDEX "agent_model_policies_agentId_mode_riskProfile_idx" ON "agent_model_policies"("agentId", "mode", "riskProfile");

-- CreateIndex
CREATE INDEX "agent_tool_invocations_userId_createdAt_idx" ON "agent_tool_invocations"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "agent_tool_invocations_decisionId_idx" ON "agent_tool_invocations"("decisionId");

-- CreateIndex
CREATE INDEX "agent_tool_invocations_agentId_toolName_idx" ON "agent_tool_invocations"("agentId", "toolName");

-- CreateIndex
CREATE INDEX "agent_decision_evaluations_userId_decisionId_idx" ON "agent_decision_evaluations"("userId", "decisionId");

-- CreateIndex
CREATE INDEX "agent_decision_evaluations_status_createdAt_idx" ON "agent_decision_evaluations"("status", "createdAt");

-- CreateIndex
CREATE INDEX "llm_usage_logs_agentId_createdAt_idx" ON "llm_usage_logs"("agentId", "createdAt");

-- AddForeignKey
ALTER TABLE "agent_budget_policies" ADD CONSTRAINT "agent_budget_policies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_model_policies" ADD CONSTRAINT "agent_model_policies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tool_invocations" ADD CONSTRAINT "agent_tool_invocations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_decision_evaluations" ADD CONSTRAINT "agent_decision_evaluations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
