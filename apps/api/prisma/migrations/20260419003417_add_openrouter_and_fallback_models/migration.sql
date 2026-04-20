-- AlterEnum
ALTER TYPE "LLMProvider" ADD VALUE 'OPENROUTER';

-- AlterTable
ALTER TABLE "llm_credentials" ADD COLUMN     "fallbackModels" TEXT[] DEFAULT ARRAY[]::TEXT[];
