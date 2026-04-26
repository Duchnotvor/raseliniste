import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

/**
 * POST /api/letters/:id/regenerate
 *   Vytvoří NOVOU verzi z existujícího dopisu — zkopíruje obsah + senderId
 *   + recipient snapshot, ale parentLetterId míří na původní (nebo na root,
 *   pokud původní už byl verzí).
 *
 *   Tahle nová verze začne jako kopie — uživatel ji v editoru upraví,
 *   učesá, vygeneruje nové PDF. Stará verze zůstává v archivu netknutá.
 */
export const POST: APIRoute = async ({ cookies, params }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_ID" }, { status: 400 });

  const original = await prisma.letter.findFirst({
    where: { id, userId: session.uid },
  });
  if (!original) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  // Najdi root (kořen verzovacího řetězce)
  const rootId = original.parentLetterId ?? original.id;

  // Spočítej nejvyšší existující verzi
  const maxVersion = await prisma.letter.aggregate({
    where: {
      userId: session.uid,
      OR: [{ id: rootId }, { parentLetterId: rootId }],
    },
    _max: { version: true },
  });
  const nextVersion = (maxVersion._max.version ?? 1) + 1;

  const created = await prisma.letter.create({
    data: {
      userId: session.uid,
      senderId: original.senderId,
      recipientId: original.recipientId,
      recipientNameSnapshot: original.recipientNameSnapshot,
      recipientAddressLinesSnapshot: original.recipientAddressLinesSnapshot,
      showRecipientAddress: original.showRecipientAddress,
      letterDate: new Date(), // nová verze = nové datum
      place: original.place,
      bodyRaw: original.bodyRaw,
      bodyFinal: original.bodyFinal,
      promptOverride: original.promptOverride,
      parentLetterId: rootId,
      version: nextVersion,
    },
    include: { sender: true, recipient: true },
  });

  return Response.json({ letter: created });
};
