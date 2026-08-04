import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

const AssignBody = z.object({ projectId: z.string().min(1) });

/**
 * POST /api/studna/meet/:id — přiřazení Meet zápisu k projektu (Studánce).
 * Vytvoří ProjectRecording (transcript) a spustí analýzu + RAG index
 * (processRecordingFromText — stejná cesta jako ruční přepis).
 */
export const POST: APIRoute = async ({ params, request, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = AssignBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });

  const note = await prisma.meetNote.findFirst({
    where: { id: params.id, userId: session.uid, deleted: false },
  });
  if (!note) return Response.json({ error: "Zápis nenalezen." }, { status: 404 });
  if (note.status !== "done" || !note.transcript) {
    return Response.json({ error: "Zápis ještě není zpracovaný." }, { status: 400 });
  }
  if (note.recordingId) return Response.json({ error: "Už je přiřazený." }, { status: 400 });

  const project = await prisma.projectBox.findFirst({
    where: { id: parsed.data.projectId, userId: session.uid },
    select: { id: true, description: true, studnaStandardPrompt: true, analysisModel: true },
  });
  if (!project) return Response.json({ error: "Projekt nenalezen." }, { status: 404 });

  const dateLabel = note.startedAt.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
  const title = `Meet ${dateLabel}${note.eventTitle ? ` — ${note.eventTitle}` : ""}`;

  // Přepis + zápis dohromady — analýza i RAG pak vidí obojí
  const fullText = note.summaryMd
    ? `${note.summaryMd}\n\n---\n\n## Plný přepis\n\n${note.transcript}`
    : note.transcript;

  const recording = await prisma.projectRecording.create({
    data: {
      projectId: project.id,
      isOwner: true,
      authorName: "Google Meet",
      type: "UPLOAD",
      transcript: fullText,
      uploadedFilename: title,
      status: "processing",
    },
  });

  await prisma.meetNote.update({
    where: { id: note.id },
    data: { projectId: project.id, recordingId: recording.id },
  });

  const { processRecordingFromText } = await import("@/lib/process-recording");
  // DB typ je UPLOAD (soubor bez audia), ale analýza běží STANDARD promptem —
  // RecordingTypeStr zná jen STANDARD | BRIEF.
  void processRecordingFromText({
    recordingId: recording.id,
    transcript: fullText,
    type: "STANDARD",
    projectContext: project.description,
    customStandardPrompt: project.studnaStandardPrompt,
    analysisModel: project.analysisModel,
  });

  return Response.json({ ok: true, recordingId: recording.id });
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
