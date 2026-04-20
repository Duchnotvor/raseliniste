-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[];
