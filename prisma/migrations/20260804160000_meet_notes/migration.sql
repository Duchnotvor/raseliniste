-- Google Meet přepisy → Studánka (Gideon 2026-08-04)
CREATE TABLE "MeetNote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conferenceRecord" TEXT NOT NULL,
  "spaceName" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "driveFileId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "processingError" TEXT,
  "transcript" TEXT,
  "summaryMd" TEXT,
  "eventTitle" TEXT,
  "projectId" TEXT,
  "recordingId" TEXT,
  "deleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MeetNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MeetNote_conferenceRecord_key" ON "MeetNote"("conferenceRecord");
CREATE UNIQUE INDEX "MeetNote_recordingId_key" ON "MeetNote"("recordingId");
CREATE INDEX "MeetNote_userId_status_startedAt_idx" ON "MeetNote"("userId", "status", "startedAt");

ALTER TABLE "MeetNote" ADD CONSTRAINT "MeetNote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetNote" ADD CONSTRAINT "MeetNote_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
