import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const session = await readSession(cookies);
  if (!session) {
    return Response.json({ user: null }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { id: true, username: true, lastLoginAt: true },
  });
  return Response.json({ user });
};
