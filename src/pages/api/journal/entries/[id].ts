import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

const PatchBody = z.object({
  text: z.string().min(1).max(20_000),
});

async function checkOwnership(id: string, userId: string): Promise<boolean> {
  const entry = await prisma.entry.findUnique({
    where: { id },
    select: { type: true, recording: { select: { userId: true } } },
  });
  return Boolean(entry && entry.type === "JOURNAL" && entry.recording.userId === userId);
}

export const PATCH: APIRoute = async ({ params, cookies, request }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });

  if (!(await checkOwnership(id, session.uid))) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await request.json());
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 422 });
  }

  const updated = await prisma.entry.update({
    where: { id },
    data: { text: body.text.trim() },
    select: {
      id: true, text: true, status: true, createdAt: true, confirmedAt: true,
      recording: { select: { source: true, createdAt: true } },
    },
  });
  return Response.json({ entry: updated });
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });

  if (!(await checkOwnership(id, session.uid))) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Soft delete — použijeme DISCARDED status (zůstane v DB pro audit)
  await prisma.entry.update({
    where: { id },
    data: { status: "DISCARDED" },
  });
  return Response.json({ ok: true });
};
