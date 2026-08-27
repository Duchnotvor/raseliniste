import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

/**
 * Firemní Meet linky (Gideon 2026-08-24) — jeden trvalý link per firma
 * (Contact.company). GET ?company=X vrátí link; PUT { company, meetLink }
 * upsertne, meetLink null/prázdný = smazat.
 */
export const GET: APIRoute = async ({ url, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const company = url.searchParams.get("company")?.trim();
  if (!company) return Response.json({ error: "MISSING_COMPANY" }, { status: 400 });
  const row = await prisma.companyMeetLink.findUnique({
    where: { userId_company: { userId: session.uid, company } },
  });
  return Response.json({ ok: true, company, meetLink: row?.meetLink ?? null });
};

const Body = z.object({
  company: z.string().min(1).max(200),
  meetLink: z.string().max(300).nullable(),
});

export const PUT: APIRoute = async ({ request, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });

  const company = parsed.data.company.trim();
  const meetLink = parsed.data.meetLink?.trim() || null;

  if (!meetLink) {
    await prisma.companyMeetLink.deleteMany({ where: { userId: session.uid, company } });
    return Response.json({ ok: true, company, meetLink: null });
  }
  if (!/^https:\/\//.test(meetLink)) {
    return Response.json({ error: "Meet link musí začínat https://" }, { status: 400 });
  }
  const row = await prisma.companyMeetLink.upsert({
    where: { userId_company: { userId: session.uid, company } },
    create: { userId: session.uid, company, meetLink },
    update: { meetLink },
  });
  return Response.json({ ok: true, company, meetLink: row.meetLink });
};
