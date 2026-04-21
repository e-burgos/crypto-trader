-- AlterTable
ALTER TABLE "chat_sessions" ALTER COLUMN "provider" DROP NOT NULL,
ALTER COLUMN "model" DROP NOT NULL;
