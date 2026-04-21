import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { normalizePhone } from "@/lib/phone";
import { parseVCardFile } from "@/lib/vcard";

export const prerender = false;

/**
 * POST /api/contacts/import
 * Body: multipart/form-data s polem `file` (.vcf)
 *    nebo JSON { text: string } s raw obsahem vCard.
 *
 * Dedup: shoda podle externalId (UID), jinak podle displayName + prvního telefonu.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let text = "";
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const fd = await request.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Nahraj .vcf soubor." }, { status: 400 });
    }
    text = await file.text();
  } else {
    const body = await request.json().catch(() => null);
    if (!body?.text || typeof body.text !== "string") {
      return Response.json({ error: "Chybí text vCard." }, { status: 400 });
    }
    text = body.text;
  }

  const parsed = parseVCardFile(text);
  if (parsed.length === 0) {
    return Response.json({ error: "Žádné kontakty ve vCard souboru." }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const p of parsed) {
    // Normalizuj telefony
    const phones = p.phones
      .map((ph) => {
        const n = normalizePhone(ph.number);
        return n ? { number: n, label: ph.label ?? null } : null;
      })
      .filter((x): x is { number: string; label: string | null } => x !== null);

    // Dedup: nejdřív zkus externalId, pak display+first phone
    let existing = p.externalId
      ? await prisma.contact.findFirst({
          where: { userId: session.uid, externalId: p.externalId },
        })
      : null;

    if (!existing && phones[0]) {
      existing = await prisma.contact.findFirst({
        where: {
          userId: session.uid,
          phones: { some: { number: phones[0].number } },
        },
      });
    }

    if (existing) {
      // Update: sloučit pokud jsou nové telefony/emaily
      const existingPhones = await prisma.phone.findMany({
        where: { contactId: existing.id },
        select: { number: true },
      });
      const existingNums = new Set(existingPhones.map((x) => x.number));
      const newPhones = phones.filter((ph) => !existingNums.has(ph.number));

      const existingEmails = await prisma.contactEmail.findMany({
        where: { contactId: existing.id },
        select: { email: true },
      });
      const existingEmSet = new Set(existingEmails.map((x) => x.email.toLowerCase()));
      const newEmails = p.emails.filter((e) => !existingEmSet.has(e.email.toLowerCase()));

      if (newPhones.length > 0) {
        await prisma.phone.createMany({
          data: newPhones.map((ph) => ({ contactId: existing!.id, ...ph })),
          skipDuplicates: true,
        });
      }
      if (newEmails.length > 0) {
        await prisma.contactEmail.createMany({
          data: newEmails.map((e) => ({
            contactId: existing!.id,
            email: e.email,
            label: e.label ?? null,
          })),
          skipDuplicates: true,
        });
      }
      if (newPhones.length > 0 || newEmails.length > 0) {
        updated += 1;
      } else {
        skipped += 1;
      }
    } else {
      if (phones.length === 0 && p.emails.length === 0) {
        skipped += 1;
        continue;
      }
      await prisma.contact.create({
        data: {
          userId: session.uid,
          displayName: p.displayName,
          firstName: p.firstName ?? null,
          lastName: p.lastName ?? null,
          note: p.note ?? null,
          importedFrom: "vcard",
          externalId: p.externalId ?? null,
          phones: { create: phones },
          emails: {
            create: p.emails.map((e) => ({ email: e.email, label: e.label ?? null })),
          },
        },
      });
      created += 1;
    }
  }

  return Response.json({
    ok: true,
    total: parsed.length,
    created,
    updated,
    skipped,
  });
};
