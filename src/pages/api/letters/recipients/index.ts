import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

const Body = z.object({
  name: z.string().min(1).max(200),
  addressLines: z.array(z.string().max(200)).max(8).optional(),
});

export const GET: APIRoute = async ({ cookies, url }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const q = url.searchParams.get("q")?.trim() ?? "";

  const recipients = await prisma.letterRecipient.findMany({
    where: {
      userId: session.uid,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    take: 200,
  });
  return Response.json({ recipients });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const recipient = await prisma.letterRecipient.create({
    data: {
      userId: session.uid,
      name: body.name,
      addressLines: body.addressLines ?? [],
    },
  });
  return Response.json({ recipient });
};
