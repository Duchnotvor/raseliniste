-- Read-only sdílení plánovacího boardu pro kolegyni (/b/<token>)
ALTER TABLE "PlanningSettings" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "PlanningSettings_shareToken_key" ON "PlanningSettings"("shareToken");
