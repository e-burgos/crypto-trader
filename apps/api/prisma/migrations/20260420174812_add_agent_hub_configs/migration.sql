/*
  Warnings:

  - You are about to drop the column `fallbackModel` on the `news_configs` table. All the data in the column will be lost.
  - You are about to drop the column `fallbackProvider` on the `news_configs` table. All the data in the column will be lost.
  - You are about to drop the column `primaryModel` on the `news_configs` table. All the data in the column will be lost.
  - You are about to drop the column `primaryProvider` on the `news_configs` table. All the data in the column will be lost.
  - You are about to drop the column `fallbackModel` on the `trading_configs` table. All the data in the column will be lost.
  - You are about to drop the column `fallbackProvider` on the `trading_configs` table. All the data in the column will be lost.
  - You are about to drop the column `primaryModel` on the `trading_configs` table. All the data in the column will be lost.
  - You are about to drop the column `primaryProvider` on the `trading_configs` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AgentId" ADD VALUE 'routing';
ALTER TYPE "AgentId" ADD VALUE 'synthesis';

-- CreateTable (before data migration so we can insert)
CREATE TABLE "agent_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" "AgentId" NOT NULL,
    "provider" "LLMProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_agent_configs" (
    "id" TEXT NOT NULL,
    "agentId" "AgentId" NOT NULL,
    "provider" "LLMProvider" NOT NULL DEFAULT 'OPENROUTER',
    "model" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "admin_agent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_configs_userId_agentId_key" ON "agent_configs"("userId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_agent_configs_agentId_key" ON "admin_agent_configs"("agentId");

-- AddForeignKey
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data Migration: Move LLM config from trading_configs to agent_configs (market agent)
INSERT INTO "agent_configs" ("id", "userId", "agentId", "provider", "model", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  tc."userId",
  'market'::"AgentId",
  tc."primaryProvider",
  tc."primaryModel",
  NOW(), NOW()
FROM "trading_configs" tc
WHERE tc."primaryProvider" IS NOT NULL AND tc."primaryModel" IS NOT NULL
ON CONFLICT ("userId", "agentId") DO NOTHING;

-- Data Migration: Move LLM config from news_configs to agent_configs (market agent)
INSERT INTO "agent_configs" ("id", "userId", "agentId", "provider", "model", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  nc."userId",
  'market'::"AgentId",
  nc."primaryProvider",
  nc."primaryModel",
  NOW(), NOW()
FROM "news_configs" nc
WHERE nc."primaryProvider" IS NOT NULL AND nc."primaryModel" IS NOT NULL
ON CONFLICT ("userId", "agentId") DO NOTHING;

-- Now drop the old columns
-- AlterTable
ALTER TABLE "news_configs" DROP COLUMN "fallbackModel",
DROP COLUMN "fallbackProvider",
DROP COLUMN "primaryModel",
DROP COLUMN "primaryProvider";

-- AlterTable
ALTER TABLE "trading_configs" DROP COLUMN "fallbackModel",
DROP COLUMN "fallbackProvider",
DROP COLUMN "primaryModel",
DROP COLUMN "primaryProvider";
