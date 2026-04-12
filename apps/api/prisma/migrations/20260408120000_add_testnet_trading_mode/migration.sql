-- AlterEnum
ALTER TYPE "TradingMode" ADD VALUE 'TESTNET';

-- DropIndex
DROP INDEX "binance_credentials_userId_key";

-- AlterTable
ALTER TABLE "binance_credentials" ADD COLUMN "isTestnet" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "binance_credentials_userId_isTestnet_key" ON "binance_credentials"("userId", "isTestnet");
