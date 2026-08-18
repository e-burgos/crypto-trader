-- AlterTable
ALTER TABLE "trades" ADD COLUMN "decisionId" TEXT;

-- CreateIndex
CREATE INDEX "trades_decisionId_idx" ON "trades"("decisionId");

-- AddForeignKey
ALTER TABLE "trades"
  ADD CONSTRAINT "trades_decisionId_fkey"
  FOREIGN KEY ("decisionId") REFERENCES "agent_decisions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
