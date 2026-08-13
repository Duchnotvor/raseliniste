-- Gideon 2026-08-10: výjimečné povolení víkendových slotů per pozvánka
ALTER TABLE "BookingInvite" ADD COLUMN "allowWeekend" BOOLEAN NOT NULL DEFAULT false;
