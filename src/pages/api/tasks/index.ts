import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

/**
 * GET /api/tasks
 * Query:
 *   ?includeCompleted=1  — zahrnout i hotové (default: skryté)
 *   ?includePushed=1     — zahrnout i v Todoistu (default: zahrnuto)
 */
export const GET: APIRoute = async ({ cookies, url }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const includeCompleted = url.searchParams.get("includeCompleted") === "1";

  const entries = await prisma.entry.findMany({
    where: {
      type: "TASK",
      status: "CONFIRMED",
      ...(includeCompleted ? {} : { completedAt: null }),
      recording: { userId: session.uid },
    },
    select: {
      id: true,
      text: true,
      suggestedProject: true,
      suggestedWhen: true,
      rationale: true,
      hashtags: true,
      location: true,
      todoistTaskId: true,
      todoistProjectId: true,
      completedAt: true,
      createdAt: true,
      confirmedAt: true,
    },
    orderBy: [{ completedAt: "asc" }, { createdAt: "desc" }],
    take: 500,
  });

  return Response.json({ entries });
};
