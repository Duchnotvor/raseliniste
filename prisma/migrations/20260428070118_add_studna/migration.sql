-- CreateEnum
CREATE TYPE "RecordingType" AS ENUM ('STANDARD', 'BRIEF');

-- CreateTable
CREATE TABLE "ProjectBox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "homeTitle" TEXT,
    "description" TEXT,
    "extractionPrompt" TEXT,
    "includeInDigest" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestUser" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "guestToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "GuestUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectInvitation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "guestUserId" TEXT NOT NULL,
    "canRecordBrief" BOOLEAN NOT NULL DEFAULT false,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRecording" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "guestUserId" TEXT,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "authorName" TEXT NOT NULL,
    "type" "RecordingType" NOT NULL DEFAULT 'STANDARD',
    "audioPath" TEXT,
    "audioMime" TEXT,
    "audioBytes" INTEGER,
    "audioDurationSec" INTEGER,
    "transcript" TEXT NOT NULL,
    "analysis" JSONB,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "processingError" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectRecording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSummary" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "recordingsIncluded" INTEGER NOT NULL,
    "briefsIncluded" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectBox_userId_idx" ON "ProjectBox"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestUser_guestToken_key" ON "GuestUser"("guestToken");

-- CreateIndex
CREATE INDEX "GuestUser_ownerUserId_idx" ON "GuestUser"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestUser_ownerUserId_email_key" ON "GuestUser"("ownerUserId", "email");

-- CreateIndex
CREATE INDEX "ProjectInvitation_guestUserId_idx" ON "ProjectInvitation"("guestUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectInvitation_projectId_guestUserId_key" ON "ProjectInvitation"("projectId", "guestUserId");

-- CreateIndex
CREATE INDEX "ProjectRecording_projectId_createdAt_idx" ON "ProjectRecording"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectRecording_guestUserId_idx" ON "ProjectRecording"("guestUserId");

-- CreateIndex
CREATE INDEX "ProjectRecording_type_createdAt_idx" ON "ProjectRecording"("type", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectSummary_projectId_createdAt_idx" ON "ProjectSummary"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProjectBox" ADD CONSTRAINT "ProjectBox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestUser" ADD CONSTRAINT "GuestUser_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInvitation" ADD CONSTRAINT "ProjectInvitation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInvitation" ADD CONSTRAINT "ProjectInvitation_guestUserId_fkey" FOREIGN KEY ("guestUserId") REFERENCES "GuestUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRecording" ADD CONSTRAINT "ProjectRecording_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRecording" ADD CONSTRAINT "ProjectRecording_guestUserId_fkey" FOREIGN KEY ("guestUserId") REFERENCES "GuestUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSummary" ADD CONSTRAINT "ProjectSummary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
