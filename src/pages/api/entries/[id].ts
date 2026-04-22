import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { pushEntryToTodoist } from "@/lib/todoist-push";

export const prerender = false;

const Body = z
  .object({
    text: z.string().min(1).max(20_000).optional(),
    type: z.enum(["TASK", "JOURNAL", "THOUGHT", "CONTEXT", "KNOWLEDGE"]).optional(),
    // TASK fields
    suggestedProject: z.string().max(100).nullable().optional(),
    suggestedWhen: z.enum(["TODAY", "THIS_WEEK", "SOMEDAY"]).nullable().optional(),
    // KNOWLEDGE fields
    knowledgeCategory: z.string().max(100).nullable().optional(),
    knowledgeUrl: z.string().max(2000).nullable().optional(),
    knowledgeTags: z.array(z.string().min(1).max(60)).max(10).optional(),
    // status transition
    status: z.enum(["CONFIRMED", "DISCARDED"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty" });

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });

  let patch: z.infer<typeof Body>;
  try {
    patch = Body.parse(await request.json());
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 422 });
  }

  // Ownership check: Entry → Recording → userId
  const entry = await prisma.entry.findUnique({
    where: { id },
    select: { id: true, status: true, type: true, recording: { select: { userId: true } } },
  });
  if (!entry || entry.recording.userId !== session.uid) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Status transitions: PENDING → CONFIRMED/DISCARDED povoleno; jinak blokováno.
  if (patch.status && entry.status !== "PENDING") {
    return Response.json({ error: "INVALID_TRANSITION", currentStatus: entry.status }, { status: 409 });
  }

  // Apply patch přesně jak přijde. Podle dodatku:
  // "Klasifikační údaje předchozího typu se zachovávají v DB (nejsou mazány
  // při změně typu, jen přestávají být relevantní)."
  const data: Record<string, unknown> = {};
  if (patch.text !== undefined) data.text = patch.text;
  if (patch.type !== undefined) data.type = patch.type;
  if (patch.suggestedProject !== undefined) data.suggestedProject = patch.suggestedProject;
  if (patch.suggestedWhen !== undefined) data.suggestedWhen = patch.suggestedWhen;
  if (patch.knowledgeCategory !== undefined) data.knowledgeCategory = patch.knowledgeCategory;
  if (patch.knowledgeUrl !== undefined) data.knowledgeUrl = patch.knowledgeUrl;
  if (patch.knowledgeTags !== undefined) data.knowledgeTags = patch.knowledgeTags;

  if (patch.status) {
    data.status = patch.status;
    if (patch.status === "CONFIRMED") data.confirmedAt = new Date();
  }

  const updated = await prisma.entry.update({
    where: { id },
    data,
    select: {
      id: true,
      type: true,
      text: true,
      rawExcerpt: true,
      suggestedProject: true,
      suggestedWhen: true,
      rationale: true,
      knowledgeCategory: true,
      knowledgeUrl: true,
      knowledgeTags: true,
      hashtags: true,
      status: true,
      confirmedAt: true,
      todoistTaskId: true,
    },
  });

  // ==== Auto-push TASK do Todoistu při confirm ====
  // Když právě potvrzuješ úkol a máš uložený Todoist token, pošleme tam task
  // rovnou — ušetří krok na /tasks. Když to selže, entry zůstane CONFIRMED
  // a user ho může pushnout manuálně z /tasks později.
  let todoistPush: { ok: boolean; taskId?: string; error?: string } | undefined;
  if (patch.status === "CONFIRMED" && updated.type === "TASK" && !updated.todoistTaskId) {
    try {
      const res = await pushEntryToTodoist({
        userId: session.uid,
        text: updated.text,
        type: "TASK",
        when: updated.suggestedWhen as "TODAY" | "THIS_WEEK" | "SOMEDAY" | null,
        suggestedProject: updated.suggestedProject,
        rationale: updated.rationale,
        hashtags: updated.hashtags ?? [],
      });
      await prisma.entry.update({
        where: { id },
        data: { todoistTaskId: res.taskId, todoistProjectId: res.projectId },
      });
      todoistPush = { ok: true, taskId: res.taskId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Když Todoist není nakonfigurovaný, neberem to jako chybu — jen info.
      if (!msg.includes("není nakonfigurovaná")) {
        todoistPush = { ok: false, error: msg };
      }
    }
  }

  return Response.json({ entry: updated, todoist: todoistPush });
};
