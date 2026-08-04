import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { isConnected, MEET_REQUIRED_SCOPE } from "@/lib/google-oauth";

export const prerender = false;

/**
 * GET /api/studna/meet — inbox Meet zápisů (Gideon 2026-08-04).
 * Vrací i hasMeetScope, ať UI umí ukázat reauth hint.
 */
export const GET: APIRoute = async ({ cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const [notes, google] = await Promise.all([
    prisma.meetNote.findMany({
      where: { userId: session.uid, deleted: false },
      orderBy: { startedAt: "desc" },
      take: 50,
      include: { project: { select: { id: true, name: true } } },
    }),
    isConnected(session.uid),
  ]);
  const scopes = ((google?.config as { scopes?: string[] } | null)?.scopes) ?? [];

  return Response.json({
    ok: true,
    hasMeetScope: scopes.includes(MEET_REQUIRED_SCOPE),
    notes: notes.map((n) => ({
      id: n.id,
      startedAt: n.startedAt.toISOString(),
      endedAt: n.endedAt?.toISOString() ?? null,
      status: n.status,
      processingError: n.processingError,
      eventTitle: n.eventTitle,
      summaryMd: n.summaryMd,
      transcriptChars: n.transcript?.length ?? 0,
      project: n.project ? { id: n.project.id, name: n.project.name } : null,
      recordingId: n.recordingId,
    })),
  });
};

/**
 * POST /api/studna/meet — ruční spuštění syncu (tlačítko v UI).
 */
export const POST: APIRoute = async ({ cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { syncMeetNotes } = await import("@/lib/meet-sync");
  try {
    const stats = await syncMeetNotes(session.uid);
    return Response.json({ ok: true, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: msg.slice(0, 400) }, { status: 500 });
  }
};
