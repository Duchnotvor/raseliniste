import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

const PatchBody = z.object({
  name: z.string().min(1).max(200).optional(),
  addressLines: z.array(z.string().max(200)).max(8).optional(),
});

async function own(userId: string, id: string) {
  return prisma.letterRecipient.findFirst({ where: { id, userId } });
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

  const recipient = await prisma.letterRecipient.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.addressLines !== undefined ? { addressLines: body.addressLines } : {}),
    },
  });
  return Response.json({ recipient });
};

export const DELETE: APIRoute = async ({ cookies, params }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_ID" }, { status: 400 });

  const owned = await own(session.uid, id);
  if (!owned) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  // Recipients in letters use snapshot fields, takže smazání recipientu
  // je bezpečné — odpojíme ho přes nullable FK.
  await prisma.letter.updateMany({
    where: { recipientId: id },
    data: { recipientId: null },
  });
  await prisma.letterRecipient.delete({ where: { id } });
  return Response.json({ ok: true });
};
