/*
  Warnings:

  - You are about to drop the column `embedding_vec` on the `agent_document_chunks` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "agent_document_chunks_embedding_vec_idx";

-- AlterTable
ALTER TABLE "agent_definitions" ALTER COLUMN "skills" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "agent_document_chunks" DROP COLUMN "embedding_vec",
ALTER COLUMN "embedding" DROP DEFAULT;

-- AlterTable
ALTER TABLE "agent_documents" ALTER COLUMN "uploadedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "processedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "platformOperationMode" "TradingMode" NOT NULL DEFAULT 'SANDBOX';
