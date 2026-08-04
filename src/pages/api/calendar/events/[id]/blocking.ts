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

  // Gideon 2026-08-04: u opakované akce se override propíše na CELOU sérii
  // (všechny výskyty v DB; budoucí výskyty dědí při syncu — calendar-series).
  const { seriesUidOf } = await import("@/lib/calendar-series");
  const seriesUid = seriesUidOf(event.externalId);
  let updatedCount = 1;
  if (seriesUid) {
    const r = await prisma.calendarEvent.updateMany({
      where: {
        source: event.source,
        OR: [{ externalId: seriesUid }, { externalId: { startsWith: `${seriesUid}_` } }],
      },
      data: { blocksBooking: parsed.data.blocks },
    });
    updatedCount = r.count;
  } else {
    await prisma.calendarEvent.update({
      where: { id: event.id },
      data: { blocksBooking: parsed.data.blocks },
    });
  }
  return Response.json({ ok: true, blocksBooking: parsed.data.blocks, updatedCount, series: Boolean(seriesUid) });
};
