-- Ruční override blokování booking slotů per událost (Petr 2026-07-30)
-- null = automatika, true = vždy blokuje, false = nikdy neblokuje

ALTER TABLE "CalendarEvent" ADD COLUMN "blocksBooking" BOOLEAN;
