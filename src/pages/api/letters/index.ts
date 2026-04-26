import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

const Body = z.object({
  senderId: z.string().min(1),
  recipientId: z.string().nullable().optional(),
  // Pokud se zadá ad-hoc adresát (bez uložení do knihovny):
  recipientName: z.string().max(200).nullable().optional(),
  recipientAddressLines: z.array(z.string().max(200)).max(8).optional(),
  showRecipientAddress: z.boolean().optional(),

  letterDate: z.string().datetime().optional(), // ISO
  place: z.string().max(80).nullable().optional(),

  bodyRaw: z.string().min(1).max(20000),
  promptOverride: z.string().max(2000).nullable().optional(),
});

export const GET: APIRoute = async ({ cookies, url }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const q = url.searchParams.get("q")?.trim() ?? "";
  const senderId = url.searchParams.get("senderId");

  const letters = await prisma.letter.findMany({
    where: {
      userId: session.uid,
      // Jen "nejnovější verze" — letter, který nemá children versions.
      // Jednoduše: zobrazíme všechny, ale parentLetterId !== this.id si v UI poradí.
      // Pro jednoduchost: ukážeme všechny, frontend ukáže verzi.
      ...(senderId ? { senderId } : {}),
      ...(q
        ? {
            OR: [
              { bodyFinal: { contains: q, mode: "insensitive" } },
              { bodyRaw: { contains: q, mode: "insensitive" } },
              { recipientNameSnapshot: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      sender: { select: { id: true, name: true } },
      recipient: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return Response.json({ letters });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues.map((i) => i.message).join("; ") : "INVALID_INPUT";
    return Response.json({ error: msg }, { status: 400 });
  }

  // Ověř, že odesílatel patří uživateli
  const sender = await prisma.letterSender.findFirst({
    where: { id: body.senderId, userId: session.uid },
  });
  if (!sender) return Response.json({ error: "Odesílatel nenalezen." }, { status: 404 });

  // Recipient — buď z knihovny, nebo ad-hoc
  let recipientNameSnapshot: string | null = null;
  let recipientAddressLinesSnapshot: string[] = [];
  if (body.recipientId) {
    const rec = await prisma.letterRecipient.findFirst({
      where: { id: body.recipientId, userId: session.uid },
    });
    if (!rec) return Response.json({ error: "Adresát nenalezen." }, { status: 404 });
    recipientNameSnapshot = rec.name;
    recipientAddressLinesSnapshot = rec.addressLines;
  } else if (body.recipientName) {
    recipientNameSnapshot = body.recipientName;
    recipientAddressLinesSnapshot = body.recipientAddressLines ?? [];
  }

  const letter = await prisma.letter.create({
    data: {
      userId: session.uid,
      senderId: body.senderId,
      recipientId: body.recipientId ?? null,
      recipientNameSnapshot,
      recipientAddressLinesSnapshot,
      showRecipientAddress: body.showRecipientAddress ?? true,
      letterDate: body.letterDate ? new Date(body.letterDate) : new Date(),
      place: body.place ?? null,
      bodyRaw: body.bodyRaw,
      bodyFinal: body.bodyRaw, // dokud uživatel neklikne Učesat
      promptOverride: body.promptOverride ?? null,
    },
    include: {
      sender: true,
      recipient: true,
    },
  });

  return Response.json({ letter });
};
