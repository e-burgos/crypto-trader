-- Phase 28 — Spec 28: OrchestratorModule Fase A
-- Adds orchestration metadata to AgentDecision and news enrichment fields to NewsAnalysis

-- AgentDecision: add metadata column for orchestration results
ALTER TABLE "agent_decisions" ADD COLUMN "metadata" JSONB;

-- NewsAnalysis: add orchestration enrichment columns
ALTER TABLE "news_analyses" ADD COLUMN "technicalRelevance" DOUBLE PRECISION;
ALTER TABLE "news_analyses" ADD COLUMN "ecosystemImpact" TEXT;
ALTER TABLE "news_analyses" ADD COLUMN "orchestratedTags" JSONB;
