-- Trencadís board je Po–Pá (Gideon 2026-08-01: víkendové plánování → pátek).
-- Sloupce jsou timestamp(3) v UTC; den v týdnu se musí počítat v Europe/Prague
-- (00:00 Prague = 22:00/23:00 UTC předchozího dne — DOW nad UTC by lhal).

-- Task.plannedFor: sobota (DOW 6) → -1 den, neděle (DOW 0) → -2 dny
UPDATE "Task"
SET "plannedFor" = "plannedFor" - make_interval(days => (EXTRACT(DOW FROM (("plannedFor" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Prague'))::int + 2) % 7)
WHERE "plannedFor" IS NOT NULL
  AND EXTRACT(DOW FROM (("plannedFor" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Prague'))::int IN (0, 6);

-- PlanningBlock: nejdřív smazat víkendové bloky, které by po posunu kolidovaly
-- s existujícím pátečním blokem téhož klienta (unique userId+date+clientKey)
DELETE FROM "PlanningBlock" b
USING "PlanningBlock" f
WHERE EXTRACT(DOW FROM ((b."date" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Prague'))::int IN (0, 6)
  AND f."userId" = b."userId"
  AND f."clientKey" = b."clientKey"
  AND f."date" = b."date" - make_interval(days => (EXTRACT(DOW FROM ((b."date" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Prague'))::int + 2) % 7);

UPDATE "PlanningBlock"
SET "date" = "date" - make_interval(days => (EXTRACT(DOW FROM (("date" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Prague'))::int + 2) % 7)
WHERE EXTRACT(DOW FROM (("date" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Prague'))::int IN (0, 6);
