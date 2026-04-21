import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

const Body = z.object({
  vyruseni: z.string().nullable().optional(),
  vip: z.string().nullable().optional(),
});

export const PATCH: APIRoute = async ({ request, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const integration = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId: session.uid, provider: "todoist" } },
  });
  if (!integration) {
    return Response.json({ error: "Nejdřív ulož token." }, { status: 400 });
  }

  const config = {
    vyruseni: body.vyruseni ?? undefined,
    vip: body.vip ?? undefined,
  };

  await prisma.userIntegration.update({
    where: { id: integration.id },
    data: { config },
  });

  return Response.json({ ok: true });
};
