import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { deleteUpload } from "@/lib/uploads";

export const prerender = false;

const PatchBody = z.object({
  isPinned: z.boolean().optional(),
});

async function own(userId: string, recId: string) {
  return prisma.projectRecording.findFirst({
    where: { id: recId, project: { userId } },
    include: { project: { select: { userId: true } } },
  });
}

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_ID" }, { status: 400 });

  const owned = await own(session.uid, id);
  if (!owned) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await request.json());
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.isPinned !== undefined) data.isPinned = body.isPinned;

  const recording = await prisma.projectRecording.update({
    where: { id },
    data,
  });
  return Response.json({ recording });
};

export const DELETE: APIRoute = async ({ cookies, params }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_ID" }, { status: 400 });

  const owned = await own(session.uid, id);
  if (!owned) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  await deleteUpload(owned.audioPath);
  await prisma.projectRecording.delete({ where: { id } });

  return Response.json({ ok: true });
};
