import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { deleteUpload } from "@/lib/uploads";

export const prerender = false;

/**
 * Audio cleanup pro Studnu.
 *
 * Synology Task Scheduler:
 *   - Denně 03:00
 *   - curl -X POST https://www.raseliniste.cz/api/cron/cleanup-audio
 *          -H "x-cron-key: <CRON_SECRET>"
 *
 * Logika:
 *   - Smaže `audioPath` soubor z disku pro recordings, kde:
 *     * type = STANDARD
 *     * isPinned = false
 *     * createdAt < now - 14 dní
 *     * audioPath != null (ještě tam je)
 *   - Transkripty + analýza zůstávají v DB navždy
 *   - Briefy se nemažou nikdy
 */

const RETENTION_DAYS = 14;

export const POST: APIRoute = async ({ request }) => {
  const secret = env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_NOT_CONFIGURED" }, { status: 503 });
  if (request.headers.get("x-cron-key") !== secret) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await prisma.projectRecording.findMany({
    where: {
      type: "STANDARD",
      isPinned: false,
      createdAt: { lt: cutoff },
      audioPath: { not: null },
    },
    select: { id: true, audioPath: true },
  });

  let deleted = 0;
  for (const r of candidates) {
    await deleteUpload(r.audioPath);
    await prisma.projectRecording.update({
      where: { id: r.id },
      data: { audioPath: null },
    });
    deleted++;
  }

  return Response.json({ ok: true, retentionDays: RETENTION_DAYS, deleted, scanned: candidates.length });
};
