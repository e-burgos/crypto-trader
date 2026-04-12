-- DropIndex
DROP INDEX "trading_configs_userId_asset_pair_key";

-- AlterTable
ALTER TABLE "agent_decisions" ADD COLUMN     "configId" TEXT,
ADD COLUMN     "configName" TEXT;

-- AlterTable
ALTER TABLE "trading_configs" ADD COLUMN     "name" TEXT NOT NULL DEFAULT '';
