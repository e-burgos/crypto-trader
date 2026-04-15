-- AlterTable
ALTER TABLE "news_configs" ADD COLUMN     "fallbackModel" TEXT,
ADD COLUMN     "fallbackProvider" "LLMProvider",
ADD COLUMN     "primaryModel" TEXT,
ADD COLUMN     "primaryProvider" "LLMProvider";
