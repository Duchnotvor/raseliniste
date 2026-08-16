/**
 * Server-only logika rituálů (Prisma + Google) — ODDĚLENĚ od week-rituals.ts,
 * který importují klientské komponenty (CustomRitualsManager). Import db tady
 * by jinak zatáhl Prisma do browser bundle a build spadne.
 */
import { prisma } from "./db";
import { ritualDescription, type RitualTemplates, type RitualType } from "./week-rituals";

/**
 * Gideon 2026-08-13: 3 vestavěné rituály se přesouvají z hardcoded generování
 * do CustomRitual řádků — editovatelné časy/dny/obsah/upozornění + Google sync.
 * Tahle funkce je jednorázově založí (idempotentní přes builtinType @unique);
 * texty vezme z User.ritualTemplates (Gideonovy úpravy), jinak z defaults.
 * Volá se ze stránek, které rituály zobrazují nebo spravují.
 */
export async function ensureBuiltinRituals(userId: string): Promise<void> {
  const count = await prisma.customRitual.count({ where: { builtinType: { not: null } } });
  if (count > 0) return;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { ritualTemplates: true } });
  const templates = (user?.ritualTemplates ?? null) as RitualTemplates | null;

  const builtins = [
    { builtinType: "morning_day", title: "Ranní pohled na den", daysOfWeek: [0, 1, 2, 3, 4], startHour: 7, startMinute: 0, durationMin: 60 },
    { builtinType: "friday_reflection", title: "Páteční reflexe", daysOfWeek: [4], startHour: 17, startMinute: 0, durationMin: 15 },
    { builtinType: "weekly_review", title: "Nedělní pohled na týden", daysOfWeek: [6], startHour: 18, startMinute: 0, durationMin: 15 },
  ] as const;

  for (const b of builtins) {
    await prisma.customRitual.upsert({
      where: { builtinType: b.builtinType },
      update: {},
      create: {
        userId,
        builtinType: b.builtinType,
        title: b.title,
        description: ritualDescription(b.builtinType as RitualType, templates),
        daysOfWeek: [...b.daysOfWeek],
        startHour: b.startHour,
        startMinute: b.startMinute,
        durationMin: b.durationMin,
        active: true,
      },
    });
  }
  console.log("[rituals] vestavěné rituály převedeny na CustomRitual řádky");
}

/**
 * Srovná Google stav rituálu podle DB: syncToGoogle+active+dny → upsert
 * recurring eventu, jinak smazání. Vrací případnou Google chybu jako string
 * (DB uložení nesmí spadnout kvůli Googlu — chyba se ukáže v UI).
 */
export async function syncRitualToGoogle(userId: string, ritualId: string): Promise<string | null> {
  const ritual = await prisma.customRitual.findUnique({ where: { id: ritualId } });
  if (!ritual) return "Rituál nenalezen.";

  const wantSync = ritual.syncToGoogle && ritual.active && ritual.daysOfWeek.length > 0;
  try {
    if (wantSync) {
      const { upsertRitualRecurringEvent } = await import("./google-calendar");
      const eventId = await upsertRitualRecurringEvent(userId, {
        title: ritual.title,
        description: ritual.description,
        daysOfWeek: ritual.daysOfWeek,
        startHour: ritual.startHour,
        startMinute: ritual.startMinute,
        durationMin: ritual.durationMin,
        reminderMinutes: ritual.reminderMinutes,
        googleEventId: ritual.googleEventId,
      });
      if (eventId !== ritual.googleEventId) {
        await prisma.customRitual.update({ where: { id: ritual.id }, data: { googleEventId: eventId } });
      }
    } else if (ritual.googleEventId) {
      const { deleteRitualRecurringEvent } = await import("./google-calendar");
      await deleteRitualRecurringEvent(userId, ritual.googleEventId);
      await prisma.customRitual.update({ where: { id: ritual.id }, data: { googleEventId: null } });
    }
    return null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[rituals] Google sync rituálu ${ritual.id} selhal:`, msg);
    return `Google sync selhal: ${msg.slice(0, 200)}`;
  }
}
