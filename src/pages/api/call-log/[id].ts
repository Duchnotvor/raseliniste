import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

const Body = z.object({
  seen: z.boolean(),
});

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_ID" }, { status: 400 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const owned = await prisma.callLog.findFirst({
    where: { id, userId: session.uid },
  });
  if (!owned) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  await prisma.callLog.update({
    where: { id },
    data: { seenAt: body.seen ? new Date() : null },
  });

  return Response.json({ ok: true });
};
