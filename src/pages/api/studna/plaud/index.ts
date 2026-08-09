import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { plaudStatus, syncPlaud } from "@/lib/plaud";

export const prerender = false;

/** GET /api/studna/plaud — inbox Plaud zápisů (nepřiřazené + posledních 30 dní). */
export const GET: APIRoute = async ({ cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const status = await plaudStatus(session.uid);
  const notes = await prisma.plaudNote.findMany({
    where: {
      userId: session.uid,
      deleted: false,
      OR: [
        { recordingId: null },
        { recordedAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      ],
    },
    orderBy: { recordedAt: "desc" },
    take: 50,
    select: {
      id: true, title: true, recordedAt: true, durationSec: true,
      status: true, processingError: true, summaryMd: true,
      transcript: true, recordingId: true,
      project: { select: { id: true, name: true } },
    },
  });

  return Response.json({
    ok: true,
    connected: status.connected,
    lastUsedAt: status.lastUsedAt,
    lastError: status.lastError,
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      recordedAt: n.recordedAt,
      durationSec: n.durationSec,
      status: n.status,
      processingError: n.processingError,
      summaryMd: n.summaryMd,
      transcriptChars: n.transcript?.length ?? 0,
      recordingId: n.recordingId,
      project: n.project,
    })),
  });
};

/** POST /api/studna/plaud — manuální „Zkontrolovat teď". */
export const POST: APIRoute = async ({ cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  try {
    const stats = await syncPlaud(session.uid);
    return Response.json({ ok: true, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg.slice(0, 300) }, { status: 500 });
  }
};
