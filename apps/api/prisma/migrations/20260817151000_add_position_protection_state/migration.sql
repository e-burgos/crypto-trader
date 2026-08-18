-- CreateEnum
CREATE TYPE "PositionProtectionStatus" AS ENUM ('NONE', 'PENDING', 'PROTECTED', 'UNPROTECTED', 'RELEASED');

-- CreateEnum
CREATE TYPE "PositionExitReason" AS ENUM ('LLM_SIGNAL', 'LOSS_CUT', 'STOP_LOSS', 'TAKE_PROFIT', 'TRAILING_STOP', 'TIME_EXIT', 'PARTIAL_TP', 'EXCHANGE_STOP', 'EXCHANGE_TAKE_PROFIT', 'PROTECTION_FAILURE', 'MANUAL');

-- AlterTable
ALTER TABLE "positions"
  ADD COLUMN "protectionStatus"       "PositionProtectionStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "protectionOrderListId"  TEXT,
  ADD COLUMN "protectionStopOrderId"  TEXT,
  ADD COLUMN "protectionLimitOrderId" TEXT,
  ADD COLUMN "protectionPlacedAt"     TIMESTAMP(3),
  ADD COLUMN "protectionFailureCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "protectionLastError"    TEXT,
  ADD COLUMN "stopPrice"              DOUBLE PRECISION,
  ADD COLUMN "takeProfitPrice"        DOUBLE PRECISION,
  ADD COLUMN "highWaterPrice"         DOUBLE PRECISION,
  ADD COLUMN "trailingActive"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "initialQuantity"        DOUBLE PRECISION,
  ADD COLUMN "partialExitCount"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "realizedPnl"            DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "exitReason"             "PositionExitReason";

-- CreateIndex
CREATE INDEX "positions_userId_status_protectionStatus_idx"
  ON "positions"("userId", "status", "protectionStatus");
