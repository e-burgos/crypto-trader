-- CreateEnum
CREATE TYPE "BotActionKind"    AS ENUM ('BUY','SELL_FULL','SELL_PARTIAL','PROTECTION_REARM');
CREATE TYPE "BotActionSource"  AS ENUM ('FAST_PATH','LLM_CYCLE');
CREATE TYPE "BotActionOutcome" AS ENUM ('EXECUTED','BLOCKED','DEFERRED','SUPERSEDED');
CREATE TYPE "BotActionCap"     AS ENUM ('ACTIONS_PER_HOUR','MIN_INTERVAL','DAILY_LOSS');

-- CreateTable
CREATE TABLE "bot_actions" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "configId"   TEXT NOT NULL,
  "kind"       "BotActionKind"    NOT NULL,
  "source"     "BotActionSource"  NOT NULL,
  "outcome"    "BotActionOutcome" NOT NULL,
  "blockedBy"  "BotActionCap",
  "positionId" TEXT,
  "decisionId" TEXT,
  "detail"     TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bot_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_bot_actions_config_occurred" ON "bot_actions" ("configId", "occurredAt");
CREATE INDEX "idx_bot_actions_user_occurred"   ON "bot_actions" ("userId", "occurredAt");

-- AddForeignKey
ALTER TABLE "bot_actions"
  ADD CONSTRAINT "bot_actions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bot_actions"
  ADD CONSTRAINT "bot_actions_configId_fkey"
  FOREIGN KEY ("configId") REFERENCES "trading_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
