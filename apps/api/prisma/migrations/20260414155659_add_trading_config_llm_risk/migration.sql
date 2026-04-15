-- CreateEnum
CREATE TYPE "RiskProfile" AS ENUM ('CONSERVATIVE', 'MODERATE', 'AGGRESSIVE');

-- AlterTable
ALTER TABLE "trading_configs" ADD COLUMN     "fallbackModel" TEXT,
ADD COLUMN     "fallbackProvider" "LLMProvider",
ADD COLUMN     "primaryModel" TEXT,
ADD COLUMN     "primaryProvider" "LLMProvider",
ADD COLUMN     "riskProfile" "RiskProfile" NOT NULL DEFAULT 'MODERATE';
