-- CreateEnum
CREATE TYPE "PricingSource" AS ENUM ('LIVE_OPENROUTER', 'STALE_CACHE', 'STATIC_TABLE', 'UNPRICED');

-- AlterTable
ALTER TABLE "llm_usage_logs" ADD COLUMN     "pricingSource" "PricingSource";
