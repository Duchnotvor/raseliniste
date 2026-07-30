import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

const Body = z.object({
  // true = vždy blokuje, false = nikdy, null = automatika
  blocks: z.boolean().nullable(),
});

/**
 * POST /api/calendar/events/:id/blocking — ruční override blokování
 * booking slotů (Petr 2026-07-30: „Matějův program mě neblokuje, ale
 * lékař s ním ano"). Rašeliniště-only pole, sync se ho nedotýká.
 */
export const POST: APIRoute = async ({ request, params, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });

  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } });
  if (!event) return Response.json({ error: "Událost nenalezena." }, { status: 404 });

  await prisma.calendarEvent.update({
    where: { id: event.id },
    data: { blocksBooking: parsed.data.blocks },
  });
  return Response.json({ ok: true, blocksBooking: parsed.data.blocks });
};
