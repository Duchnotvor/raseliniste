-- Registrované Meet místnosti s auto-recordingem (Gideon 2026-08-04)
CREATE TABLE "MeetSpace" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "meetingCode" TEXT NOT NULL,
  "label" TEXT,
  "autoRecordOk" BOOLEAN NOT NULL DEFAULT false,
  "lastHealAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MeetSpace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MeetSpace_userId_meetingCode_key" ON "MeetSpace"("userId", "meetingCode");

ALTER TABLE "MeetSpace" ADD CONSTRAINT "MeetSpace_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
