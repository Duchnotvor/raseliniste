-- Klientský blok na plánovacím boardu (Petr 2026-07-24)
-- Kontejner time-blocking: den se vyhradí celému klientovi.

CREATE TABLE "PlanningBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "clientKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanningBlock_userId_date_clientKey_key" ON "PlanningBlock"("userId", "date", "clientKey");
CREATE INDEX "PlanningBlock_userId_date_idx" ON "PlanningBlock"("userId", "date");

ALTER TABLE "PlanningBlock" ADD CONSTRAINT "PlanningBlock_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
