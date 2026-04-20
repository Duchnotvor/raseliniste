import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

export const GET: APIRoute = async ({ params, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });

  const analysis = await prisma.healthAnalysis.findUnique({
    where: { id },
  });
  if (!analysis || analysis.userId !== session.uid) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return Response.json({ analysis });
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });

  const result = await prisma.healthAnalysis.deleteMany({
    where: { id, userId: session.uid },
  });
  if (result.count === 0) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true });
};
