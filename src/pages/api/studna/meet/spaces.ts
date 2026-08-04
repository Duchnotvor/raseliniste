import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

/**
 * Registrované Meet místnosti s auto-recordingem (Gideon 2026-08-04).
 * GET list · POST přidat (meeting code nebo celý link) · DELETE ?id= odebrat.
 * Self-heal (spaces.patch → auto-recording ON) dělá cron meet-sync;
 * POST ho rovnou zkusí, ať je výsledek vidět hned.
 */

const AddBody = z.object({ code: z.string().min(3).max(200), label: z.string().max(120).optional() });

/** "https://meet.google.com/abc-defg-hij?x=1" | "abc-defg-hij" → "abc-defg-hij" */
function parseMeetingCode(input: string): string | null {
  const m = input.trim().match(/(?:meet\.google\.com\/)?([a-z]{3}-[a-z]{4}-[a-z]{3})\b/i);
  return m ? m[1].toLowerCase() : null;
}

export const GET: APIRoute = async ({ cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const spaces = await prisma.meetSpace.findMany({
    where: { userId: session.uid },
    orderBy: { createdAt: "asc" },
  });
  return Response.json({ ok: true, spaces });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = AddBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  const code = parseMeetingCode(parsed.data.code);
  if (!code) return Response.json({ error: "Nepoznávám meeting kód — vlož link meet.google.com/xxx-xxxx-xxx nebo samotný kód." }, { status: 400 });

  const space = await prisma.meetSpace.upsert({
    where: { userId_meetingCode: { userId: session.uid, meetingCode: code } },
    create: { userId: session.uid, meetingCode: code, label: parsed.data.label?.trim() || null },
    update: { label: parsed.data.label?.trim() || undefined },
  });

  // Zkus heal hned — ať Gideon vidí výsledek bez čekání na cron
  try {
    const { getAuthorizedClient } = await import("@/lib/google-oauth");
    const { healMeetSpaces } = await import("@/lib/meet-sync");
    const client = await getAuthorizedClient(session.uid);
    const { token } = await client.getAccessToken();
    if (token) await healMeetSpaces(session.uid, token);
  } catch (e) {
    console.warn("[meet-spaces] okamžitý heal selhal:", e instanceof Error ? e.message : e);
  }

  const fresh = await prisma.meetSpace.findUnique({ where: { id: space.id } });
  return Response.json({ ok: true, space: fresh });
};

export const DELETE: APIRoute = async ({ url, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Chybí id." }, { status: 400 });
  const r = await prisma.meetSpace.deleteMany({ where: { id, userId: session.uid } });
  if (r.count === 0) return Response.json({ error: "Místnost nenalezena." }, { status: 404 });
  return Response.json({ ok: true });
};
