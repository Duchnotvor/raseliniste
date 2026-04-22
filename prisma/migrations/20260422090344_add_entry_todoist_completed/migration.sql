-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "todoistProjectId" TEXT,
ADD COLUMN     "todoistTaskId" TEXT;

-- CreateIndex
CREATE INDEX "Entry_type_status_completedAt_idx" ON "Entry"("type", "status", "completedAt");
