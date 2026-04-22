import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { pushEntryToTodoist } from "@/lib/todoist-push";

export const prerender = false;

/**
 * POST /api/tasks/:id/todoist
 * Pošle TASK entry do Todoistu (projekt config.mojeUkoly nebo Inbox).
 * Idempotentní — pokud už je pushnutá, vrátí cachovaný taskId.
 */
export const POST: APIRoute = async ({ cookies, params }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_ID" }, { status: 400 });

  const entry = await prisma.entry.findFirst({
    where: { id, recording: { userId: session.uid } },
  });
  if (!entry) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  if (entry.todoistTaskId) {
    return Response.json({
      ok: true,
      taskId: entry.todoistTaskId,
      projectId: entry.todoistProjectId,
      already: true,
    });
  }

  try {
    const { taskId, projectId } = await pushEntryToTodoist({
      userId: session.uid,
      text: entry.text,
      type: entry.type as "TASK" | "JOURNAL" | "THOUGHT" | "CONTEXT" | "KNOWLEDGE",
      when: entry.suggestedWhen as "TODAY" | "THIS_WEEK" | "SOMEDAY" | null,
      suggestedProject: entry.suggestedProject,
      rationale: entry.rationale,
      hashtags: entry.hashtags ?? [],
    });

    await prisma.entry.update({
      where: { id },
      data: { todoistTaskId: taskId, todoistProjectId: projectId },
    });

    return Response.json({ ok: true, taskId, projectId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
};
