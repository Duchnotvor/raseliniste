import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { syncPlaud } from "@/lib/plaud";

export const prerender = false;

/**
 * POST /api/cron/plaud-sync — nové Plaud nahrávky → Studánka inbox.
 * Auth: x-cron-key. Schedule: každých 30 min. Uživatelé bez plaud
 * integrace se tiše přeskočí.
 */
export const POST: APIRoute = async ({ request }) => {
  const secret = env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_NOT_CONFIGURED" }, { status: 503 });
  if (request.headers.get("x-cron-key") !== secret) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const integrations = await prisma.userIntegration.findMany({
    where: { provider: "plaud" },
    select: { userId: true },
  });

  const results: Array<{ userId: string; ok: boolean; stats?: unknown; error?: string }> = [];
  for (const i of integrations) {
    try {
      const stats = await syncPlaud(i.userId);
      results.push({ userId: i.userId, ok: true, stats });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[cron.plaud-sync] ${i.userId}:`, msg);
      results.push({ userId: i.userId, ok: false, error: msg.slice(0, 300) });
    }
  }
  return Response.json({ ok: true, results });
};
