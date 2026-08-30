-- Gideon 2026-08-30: výjimečné povolení večerních slotů (do 23:00) per pozvánka
ALTER TABLE "BookingInvite" ADD COLUMN "allowEvening" BOOLEAN NOT NULL DEFAULT false;
