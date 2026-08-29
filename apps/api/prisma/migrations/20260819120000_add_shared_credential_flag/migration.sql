-- AlterTable
ALTER TABLE "data_source_credentials" ADD COLUMN "shared" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "news_api_credentials" ADD COLUMN "shared" BOOLEAN NOT NULL DEFAULT false;
