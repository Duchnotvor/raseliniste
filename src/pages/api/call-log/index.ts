import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

export const GET: APIRoute = async ({ cookies, url }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const unseen = url.searchParams.get("unseen") === "1";

  const logs = await prisma.callLog.findMany({
    where: {
      userId: session.uid,
      ...(unseen ? { seenAt: null } : {}),
    },
    include: { contact: { select: { id: true, displayName: true, isVip: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return Response.json({ logs });
};
