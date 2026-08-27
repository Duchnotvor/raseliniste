-- Gideon 2026-08-24: firemní Meet linky + volba zdroje Meetu u pozvánky
CREATE TABLE "CompanyMeetLink" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "meetLink" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyMeetLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanyMeetLink_userId_company_key" ON "CompanyMeetLink"("userId", "company");
ALTER TABLE "CompanyMeetLink" ADD CONSTRAINT "CompanyMeetLink_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingInvite" ADD COLUMN "meetSource" TEXT;
