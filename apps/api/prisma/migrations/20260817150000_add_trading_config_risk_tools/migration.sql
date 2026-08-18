-- AlterTable
ALTER TABLE "trading_configs"
  ADD COLUMN "lossCutEnabled"                  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lossCutConfidenceThreshold"      DOUBLE PRECISION NOT NULL DEFAULT 0.85,
  ADD COLUMN "lossCutMinLossPct"               DOUBLE PRECISION NOT NULL DEFAULT 0.005,
  ADD COLUMN "lossCutMinEdgeRatio"             DOUBLE PRECISION NOT NULL DEFAULT 2,
  ADD COLUMN "smartSizingEnabled"              BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reduceSizeFactor"                DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  ADD COLUMN "nativeProtectionEnabled"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "closeOnProtectionFailure"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stopLimitOffsetPct"              DOUBLE PRECISION NOT NULL DEFAULT 0.002,
  ADD COLUMN "trailingStopEnabled"             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "trailingStopPct"                 DOUBLE PRECISION NOT NULL DEFAULT 0.02,
  ADD COLUMN "trailingActivationPct"           DOUBLE PRECISION NOT NULL DEFAULT 0.01,
  ADD COLUMN "partialTpEnabled"                BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "partialTpTriggerPct"             DOUBLE PRECISION NOT NULL DEFAULT 0.02,
  ADD COLUMN "partialTpSellPct"                DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  ADD COLUMN "moveStopToBreakevenAfterPartial" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "maxPositionHoldMinutes"          INTEGER;
