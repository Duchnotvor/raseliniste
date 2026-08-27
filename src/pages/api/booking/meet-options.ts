import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

/**
 * GET /api/booking/meet-options?contactId=… (Gideon 2026-08-24)
 * Vrátí dostupné Meet zdroje pro pozvánku: link kontaktu + firemní link
 * (dle Contact.company). InviteCreator z toho staví výběr „čí Meet použít".
 */
export const GET: APIRoute = async ({ url, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const contactId = url.searchParams.get("contactId");
  if (!contactId) return Response.json({ error: "MISSING_CONTACT" }, { status: 400 });

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, userId: session.uid },
    select: { defaultMeetLink: true, company: true },
  });
  if (!contact) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const companyRow = contact.company
    ? await prisma.companyMeetLink.findUnique({
        where: { userId_company: { userId: session.uid, company: contact.company } },
      })
    : null;

  return Response.json({
    ok: true,
    contactMeetLink: contact.defaultMeetLink,
    company: contact.company,
    companyMeetLink: companyRow?.meetLink ?? null,
  });
};
