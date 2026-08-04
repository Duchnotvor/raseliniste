import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { MEET_REQUIRED_SCOPE } from "@/lib/google-oauth";
import { syncMeetNotes } from "@/lib/meet-sync";

export const prerender = false;

/**
 * POST /api/cron/meet-sync — Google Meet nahrávky → přepisy (Gideon 2026-08-04)
 * Auth: x-cron-key. Schedule: každých 30 min (cron-schedule.ts).
 * Uživatelé bez Meet scope se přeskočí (reauth banner v /settings/integrations/google).
 */
export const POST: APIRoute = async ({ request }) => {
  const secret = env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_NOT_CONFIGURED" }, { status: 503 });
  if (request.headers.get("x-cron-key") !== secret) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const integrations = await prisma.userIntegration.findMany({
    where: { provider: "google" },
    select: { userId: true, config: true },
  });

  const results: Array<{ userId: string; ok: boolean; skipped?: string; stats?: unknown; error?: string }> = [];
  for (const i of integrations) {
    const scopes = ((i.config as { scopes?: string[] } | null)?.scopes) ?? [];
    if (!scopes.includes(MEET_REQUIRED_SCOPE)) {
      results.push({ userId: i.userId, ok: true, skipped: "missing-meet-scope" });
      continue;
    }
    try {
      const stats = await syncMeetNotes(i.userId);
      results.push({ userId: i.userId, ok: true, stats });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[cron.meet-sync] ${i.userId}:`, msg);
      results.push({ userId: i.userId, ok: false, error: msg.slice(0, 300) });
    }
  }

  return Response.json({ ok: true, results });
};
