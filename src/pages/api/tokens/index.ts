import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { issueApiToken } from "@/lib/tokens";

export const prerender = false;

const CreateBody = z.object({
  name: z.string().min(1).max(100),
});

export const GET: APIRoute = async ({ cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const tokens = await prisma.apiToken.findMany({
    where: { userId: session.uid },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });

  return Response.json({ tokens });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: z.infer<typeof CreateBody>;
  try {
    body = CreateBody.parse(await request.json());
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const issued = await issueApiToken(session.uid, body.name);
  return Response.json({
    id: issued.id,
    name: body.name,
    prefix: issued.prefix,
    token: issued.plain, // jen jednou — klient to musí uložit sám
  });
};
