-- Gideon 2026-08-13: rituály — vestavěné jako řádky, upozornění, Google sync
ALTER TABLE "CustomRitual" ADD COLUMN "builtinType" TEXT;
ALTER TABLE "CustomRitual" ADD COLUMN "reminderMinutes" INTEGER;
ALTER TABLE "CustomRitual" ADD COLUMN "syncToGoogle" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CustomRitual" ADD COLUMN "googleEventId" TEXT;
CREATE UNIQUE INDEX "CustomRitual_builtinType_key" ON "CustomRitual"("builtinType");
