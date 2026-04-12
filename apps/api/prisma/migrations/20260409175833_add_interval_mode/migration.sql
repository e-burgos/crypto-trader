-- CreateEnum
CREATE TYPE "IntervalMode" AS ENUM ('AGENT', 'CUSTOM');

-- AlterTable
ALTER TABLE "trading_configs" ADD COLUMN     "intervalMode" "IntervalMode" NOT NULL DEFAULT 'AGENT';
