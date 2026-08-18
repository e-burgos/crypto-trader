-- AlterTable
ALTER TABLE "trading_configs"
  ADD COLUMN "deterministicGateEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "gatePriceChangePct"       DOUBLE PRECISION NOT NULL DEFAULT 0.005;

-- AlterTable
ALTER TABLE "agent_decisions"
  ADD COLUMN "llmCallCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "agent_decisions_createdAt_idx" ON "agent_decisions"("createdAt");
