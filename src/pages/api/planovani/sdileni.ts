import type { APIRoute } from "astro";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

/**
 * POST /api/planovani/sdileni — vytvoří (nebo vrátí existující) read-only
 * odkaz na trencadís board pro kolegyni: /b/<token>.
 * DELETE — odvolá sdílení (token se zneplatní).
 * Gideon 2026-08-04.
 */
export const POST: APIRoute = async ({ cookies, url }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const existing = await prisma.planningSettings.findUnique({
    where: { userId: session.uid },
    select: { shareToken: true },
  });

  let token = existing?.shareToken ?? null;
  if (!token) {
    token = randomBytes(16).toString("base64url"); // 22 znaků, stejně jako booking
    await prisma.planningSettings.upsert({
      where: { userId: session.uid },
      create: { userId: session.uid, shareToken: token },
      update: { shareToken: token },
    });
  }

  return Response.json({ ok: true, url: `${url.origin}/b/${token}` });
};

export const DELETE: APIRoute = async ({ cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  await prisma.planningSettings.updateMany({
    where: { userId: session.uid },
    data: { shareToken: null },
  });
  return Response.json({ ok: true });
};
