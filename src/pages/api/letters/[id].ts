import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { deleteUpload } from "@/lib/uploads";

export const prerender = false;

const PatchBody = z.object({
  recipientId: z.string().nullable().optional(),
  recipientName: z.string().max(200).nullable().optional(),
  recipientAddressLines: z.array(z.string().max(200)).max(8).optional(),
  showRecipientAddress: z.boolean().optional(),
  letterDate: z.string().datetime().optional(),
  place: z.string().max(80).nullable().optional(),
  bodyRaw: z.string().min(1).max(20000).optional(),
  bodyFinal: z.string().min(1).max(20000).optional(),
  promptOverride: z.string().max(2000).nullable().optional(),
});

async function own(userId: string, id: string) {
  return prisma.letter.findFirst({
    where: { id, userId },
    include: { sender: true, recipient: true },
  });
}

export const GET: APIRoute = async ({ cookies, params }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_ID" }, { status: 400 });

  const letter = await own(session.uid, id);
  if (!letter) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  // Najdi všechny verze (pokud je toto cokoliv ve verzovacím řetězci)
  const rootId = letter.parentLetterId ?? letter.id;
  const versions = await prisma.letter.findMany({
    where: {
      userId: session.uid,
      OR: [{ id: rootId }, { parentLetterId: rootId }],
    },
    select: { id: true, version: true, createdAt: true, parentLetterId: true },
    orderBy: { version: "asc" },
  });

  return Response.json({ letter, versions });
};

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

  // Pokud se mění obsah / recipient, invaliduj cachované PDF.
  const contentChanged =
    body.bodyRaw !== undefined ||
    body.bodyFinal !== undefined ||
    body.recipientId !== undefined ||
    body.recipientName !== undefined ||
    body.recipientAddressLines !== undefined ||
    body.showRecipientAddress !== undefined ||
    body.letterDate !== undefined ||
    body.place !== undefined;

  let recipientFields: {
    recipientNameSnapshot?: string | null;
    recipientAddressLinesSnapshot?: string[];
    recipientId?: string | null;
  } = {};
  if (body.recipientId !== undefined) {
    if (body.recipientId) {
      const rec = await prisma.letterRecipient.findFirst({
        where: { id: body.recipientId, userId: session.uid },
      });
      if (!rec) return Response.json({ error: "Adresát nenalezen." }, { status: 404 });
      recipientFields = {
        recipientId: rec.id,
        recipientNameSnapshot: rec.name,
        recipientAddressLinesSnapshot: rec.addressLines,
      };
    } else {
      recipientFields = { recipientId: null };
    }
  }
  if (body.recipientName !== undefined) {
    recipientFields.recipientNameSnapshot = body.recipientName;
  }
  if (body.recipientAddressLines !== undefined) {
    recipientFields.recipientAddressLinesSnapshot = body.recipientAddressLines;
  }

  const data: Record<string, unknown> = { ...recipientFields };
  if (body.showRecipientAddress !== undefined) data.showRecipientAddress = body.showRecipientAddress;
  if (body.letterDate !== undefined) data.letterDate = new Date(body.letterDate);
  if (body.place !== undefined) data.place = body.place;
  if (body.bodyRaw !== undefined) data.bodyRaw = body.bodyRaw;
  if (body.bodyFinal !== undefined) data.bodyFinal = body.bodyFinal;
  if (body.promptOverride !== undefined) data.promptOverride = body.promptOverride;

  if (contentChanged && owned.pdfPath) {
    await deleteUpload(owned.pdfPath);
    data.pdfPath = null;
    data.pdfGeneratedAt = null;
  }

  const letter = await prisma.letter.update({
    where: { id },
    data,
    include: { sender: true, recipient: true },
  });

  return Response.json({ letter });
};

export const DELETE: APIRoute = async ({ cookies, params }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_ID" }, { status: 400 });

  const owned = await own(session.uid, id);
  if (!owned) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  await deleteUpload(owned.pdfPath);
  await prisma.letter.delete({ where: { id } });
  return Response.json({ ok: true });
};
