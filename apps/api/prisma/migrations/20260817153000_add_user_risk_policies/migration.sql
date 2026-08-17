-- CreateTable
CREATE TABLE "user_risk_policies" (
  "id"                    TEXT NOT NULL,
  "userId"                TEXT NOT NULL,
  "enabled"               BOOLEAN NOT NULL DEFAULT false,
  "maxAssetExposureUsd"   DOUBLE PRECISION,
  "maxAssetExposurePct"   DOUBLE PRECISION,
  "maxDailyLossUsd"       DOUBLE PRECISION,
  "maxDrawdownPct"        DOUBLE PRECISION,
  "pauseAgentsOnDrawdown" BOOLEAN NOT NULL DEFAULT true,
  "pausedAt"              TIMESTAMP(3),
  "pausedReason"          TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_risk_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_risk_policies_userId_key" ON "user_risk_policies"("userId");

-- AddForeignKey
ALTER TABLE "user_risk_policies"
  ADD CONSTRAINT "user_risk_policies_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
