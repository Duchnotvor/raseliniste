import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

const Body = z.object({
  completed: z.boolean().optional(),
});

async function ownEntry(userId: string, id: string) {
  return prisma.entry.findFirst({
    where: { id, recording: { userId } },
  });
}

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_ID" }, { status: 400 });

  const owned = await ownEntry(session.uid, id);
  if (!owned) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const data: { completedAt?: Date | null } = {};
  if (body.completed === true) data.completedAt = new Date();
  if (body.completed === false) data.completedAt = null;

  const updated = await prisma.entry.update({ where: { id }, data });
  return Response.json({ entry: updated });
};

export const DELETE: APIRoute = async ({ cookies, params }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_ID" }, { status: 400 });

  const owned = await ownEntry(session.uid, id);
  if (!owned) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  await prisma.entry.delete({ where: { id } });
  return Response.json({ ok: true });
};
