-- AlterEnum
ALTER TYPE "AgentOutcomeStatus" ADD VALUE 'NOT_EVALUABLE';

-- CreateIndex
CREATE UNIQUE INDEX "agent_decision_evaluations_decisionId_horizonMinutes_key" ON "agent_decision_evaluations"("decisionId", "horizonMinutes");
