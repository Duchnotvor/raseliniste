-- Plaud nahrávky → Studánka inbox (Gideon 2026-08-09)
CREATE TABLE "PlaudNote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "plaudFileId" TEXT NOT NULL,
  "title" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  "durationSec" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'done',
  "processingError" TEXT,
  "transcript" TEXT,
  "summaryMd" TEXT,
  "projectId" TEXT,
  "recordingId" TEXT,
  "deleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlaudNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlaudNote_plaudFileId_key" ON "PlaudNote"("plaudFileId");
CREATE UNIQUE INDEX "PlaudNote_recordingId_key" ON "PlaudNote"("recordingId");
CREATE INDEX "PlaudNote_userId_status_recordedAt_idx" ON "PlaudNote"("userId", "status", "recordedAt");

ALTER TABLE "PlaudNote" ADD CONSTRAINT "PlaudNote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaudNote" ADD CONSTRAINT "PlaudNote_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
