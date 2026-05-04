-- CreateEnum
CREATE TYPE "DataSourceCategory" AS ENUM ('TECHNICAL', 'SENTIMENT', 'DERIVATIVES', 'DEFI_ONCHAIN', 'NEWS', 'MARKET_DATA', 'PREDICTION', 'TOKEN_UNLOCKS');

-- CreateTable
CREATE TABLE "data_source_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" "DataSourceCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "targetAgents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiresApiKey" BOOLEAN NOT NULL DEFAULT false,
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "rateLimitPerMin" INTEGER NOT NULL DEFAULT 60,
    "pollingIntervalMs" INTEGER NOT NULL DEFAULT 1800000,
    "monthlyCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "consecutiveErrors" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_source_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_source_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "apiKeyIv" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_source_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "data_source_configs_name_key" ON "data_source_configs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "data_source_credentials_userId_dataSourceId_key" ON "data_source_credentials"("userId", "dataSourceId");

-- AddForeignKey
ALTER TABLE "data_source_credentials" ADD CONSTRAINT "data_source_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_source_credentials" ADD CONSTRAINT "data_source_credentials_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "data_source_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
