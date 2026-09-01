-- AlterTable
ALTER TABLE "trading_configs"
  ADD COLUMN "entryOrderMode"        "EntryOrderMode" NOT NULL DEFAULT 'MARKET',
  ADD COLUMN "entryOrderTtlMinutes"  INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN "entryTrailingDeltaBips" INTEGER;
