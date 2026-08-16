import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

const PatchBody = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(8000).nullable().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(0).max(7).optional(),
  startHour: z.number().int().min(0).max(23).optional(),
  startMinute: z.number().int().min(0).max(59).optional(),
  durationMin: z.number().int().min(5).max(480).optional(),
  active: z.boolean().optional(),
  // Gideon 2026-08-13: upozornění + propis do Google kalendáře
  reminderMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  syncToGoogle: z.boolean().optional(),
});

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_ID" }, { status: 400 });

  const owned = await prisma.customRitual.findFirst({
    where: { id, userId: session.uid },
  });
  if (!owned) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await request.json());
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.daysOfWeek !== undefined) data.daysOfWeek = [...new Set(body.daysOfWeek)].sort();
  if (body.startHour !== undefined) data.startHour = body.startHour;
  if (body.startMinute !== undefined) data.startMinute = body.startMinute;
  if (body.durationMin !== undefined) data.durationMin = body.durationMin;
  if (body.active !== undefined) data.active = body.active;
  if (body.reminderMinutes !== undefined) data.reminderMinutes = body.reminderMinutes;
  if (body.syncToGoogle !== undefined) data.syncToGoogle = body.syncToGoogle;

  await prisma.customRitual.update({ where: { id }, data });

  // Srovnej Google stav (upsert / smazání dle syncToGoogle+active+dny)
  const { syncRitualToGoogle } = await import("@/lib/rituals-server");
  const googleError = await syncRitualToGoogle(session.uid, id);
  const updated = await prisma.customRitual.findUnique({ where: { id } });
  return Response.json({ ritual: updated, googleError });
};

export const DELETE: APIRoute = async ({ cookies, params }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_ID" }, { status: 400 });

  const ritual = await prisma.customRitual.findFirst({ where: { id, userId: session.uid } });
  if (!ritual) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  // Vestavěné rituály se nemažou (seed by je vzkřísil) — jen deaktivují
  if (ritual.builtinType) {
    return Response.json(
      { error: "Vestavěný rituál nejde smazat — vypni ho přepínačem Aktivní." },
      { status: 400 },
    );
  }

  // Propsaný do Googlu → nejdřív uklidit recurring event
  if (ritual.googleEventId) {
    const { deleteRitualRecurringEvent } = await import("@/lib/google-calendar");
    await deleteRitualRecurringEvent(session.uid, ritual.googleEventId).catch((e) => {
      console.warn(`[rituals] smazání Google eventu ${ritual.googleEventId} selhalo:`, e instanceof Error ? e.message : e);
    });
  }

  await prisma.customRitual.delete({ where: { id } });
  return Response.json({ ok: true });
};
