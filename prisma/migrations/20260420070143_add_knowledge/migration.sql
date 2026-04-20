-- AlterEnum
ALTER TYPE "EntryType" ADD VALUE 'KNOWLEDGE';

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "knowledgeCategory" TEXT,
ADD COLUMN     "knowledgeTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "knowledgeUrl" TEXT;
