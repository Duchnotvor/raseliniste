-- Meet místnost per studánka/prskavka + auto-přiřazování (Gideon 2026-08-05)
ALTER TABLE "MeetSpace" ADD COLUMN "projectId" TEXT;
ALTER TABLE "MeetSpace" ADD COLUMN "spaceName" TEXT;
CREATE INDEX "MeetSpace_userId_spaceName_idx" ON "MeetSpace"("userId", "spaceName");
ALTER TABLE "MeetSpace" ADD CONSTRAINT "MeetSpace_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
