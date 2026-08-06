import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

const AssignBody = z.object({ projectId: z.string().min(1) });

/**
 * POST /api/studna/meet/:id — ruční přiřazení Meet zápisu k projektu.
 * Logika sdílená s auto-přiřazením (lib/meet-sync.assignMeetNoteToProject).
 */
export const POST: APIRoute = async ({ params, request, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = AssignBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });

  const { assignMeetNoteToProject } = await import("@/lib/meet-sync");
  const r = await assignMeetNoteToProject(session.uid, params.id!, parsed.data.projectId);
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
  return Response.json({ ok: true, recordingId: r.recordingId });
};

/**
 * DELETE /api/studna/meet/:id — tombstone (sync ho nevzkřísí).
 */
export const DELETE: APIRoute = async ({ params, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const r = await prisma.meetNote.updateMany({
    where: { id: params.id, userId: session.uid },
    data: { deleted: true },
  });
  if (r.count === 0) return Response.json({ error: "Zápis nenalezen." }, { status: 404 });
  return Response.json({ ok: true });
};
