-- Phase 28 Fase B — AgentDefinitions + RAG pipeline
-- Adds AgentId enum, DocumentStatus enum, and three new tables

-- Enums
CREATE TYPE "AgentId" AS ENUM ('platform', 'operations', 'market', 'blockchain', 'risk', 'orchestrator');
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERROR');

-- Agent definitions (one row per agent, configurable by Admin)
CREATE TABLE "agent_definitions" (
  "id"           "AgentId"   NOT NULL,
  "displayName"  TEXT        NOT NULL,
  "description"  TEXT        NOT NULL,
  "systemPrompt" TEXT        NOT NULL,
  "skills"       JSONB       NOT NULL DEFAULT '[]',
  "isActive"     BOOLEAN     NOT NULL DEFAULT TRUE,
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "agent_definitions_pkey" PRIMARY KEY ("id")
);

-- Knowledge documents uploaded by Admin per agent
CREATE TABLE "agent_documents" (
  "id"          TEXT           NOT NULL,
  "agentId"     "AgentId"      NOT NULL,
  "title"       TEXT           NOT NULL,
  "fileName"    TEXT           NOT NULL,
  "mimeType"    TEXT           NOT NULL,
  "sizeBytes"   INTEGER        NOT NULL,
  "status"      "DocumentStatus" NOT NULL DEFAULT 'PENDING',
  "errorMsg"    TEXT,
  "uploadedAt"  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  "processedAt" TIMESTAMPTZ,
  "uploadedBy"  TEXT           NOT NULL,
  CONSTRAINT "agent_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agent_documents_agentId_status_idx" ON "agent_documents" ("agentId", "status");
ALTER TABLE "agent_documents" ADD CONSTRAINT "agent_documents_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "agent_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Document chunks with vector embeddings
CREATE TABLE "agent_document_chunks" (
  "id"         TEXT    NOT NULL,
  "documentId" TEXT    NOT NULL,
  "agentId"    "AgentId" NOT NULL,
  "content"    TEXT    NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "embedding"  JSONB   NOT NULL DEFAULT '[]',
  CONSTRAINT "agent_document_chunks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agent_document_chunks_agentId_idx" ON "agent_document_chunks" ("agentId");
CREATE INDEX "agent_document_chunks_documentId_idx" ON "agent_document_chunks" ("documentId");
ALTER TABLE "agent_document_chunks" ADD CONSTRAINT "agent_document_chunks_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "agent_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable pgvector extension and add native vector column for semantic search
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "agent_document_chunks" ADD COLUMN IF NOT EXISTS "embedding_vec" vector(1024);
CREATE INDEX ON "agent_document_chunks" USING ivfflat ("embedding_vec" vector_cosine_ops) WITH (lists = 100);
