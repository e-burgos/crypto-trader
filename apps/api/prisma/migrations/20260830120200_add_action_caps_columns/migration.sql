-- AlterTable
ALTER TABLE "trading_configs"
  ADD COLUMN "maxActionsPerHour"    INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN "minActionIntervalSec" INTEGER NOT NULL DEFAULT 60;
