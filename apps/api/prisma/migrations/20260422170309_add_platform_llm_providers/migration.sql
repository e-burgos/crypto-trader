-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'LLM_PROVIDER_DISABLED';

-- CreateTable
CREATE TABLE "platform_llm_providers" (
    "id" TEXT NOT NULL,
    "provider" "LLMProvider" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "platform_llm_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_llm_providers_provider_key" ON "platform_llm_providers"("provider");
