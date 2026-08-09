import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { savePlaudTokens, plaudStatus, syncPlaud } from "@/lib/plaud";

export const prerender = false;

/**
 * Plaud integrace (Gideon 2026-08-09).
 * GET status · POST { tokens } = obsah ~/.plaud/tokens.json (z Macu po
 * `npx @plaud-ai/cli login`) — uloží se šifrovaně a rovnou se zkusí sync.
 * DELETE = odpojit.
 */
export const GET: APIRoute = async ({ cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  return Response.json({ ok: true, ...(await plaudStatus(session.uid)) });
};

const Body = z.object({ tokens: z.string().min(10).max(10000) });

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });

  let tokenSet: { access_token?: string; refresh_token?: string };
  try {
    tokenSet = JSON.parse(parsed.data.tokens);
  } catch {
    return Response.json({ error: "Tohle není platný JSON — vlož celý obsah souboru ~/.plaud/tokens.json." }, { status: 400 });
  }
  if (!tokenSet.refresh_token) {
    return Response.json({ error: "V JSONu chybí refresh_token — vlož celý obsah ~/.plaud/tokens.json po `plaud login`." }, { status: 400 });
  }

  await savePlaudTokens(session.uid, tokenSet as never);

  // Ověření + první sync hned — ať je vidět výsledek
  try {
    const stats = await syncPlaud(session.uid);
    return Response.json({ ok: true, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: `Tokeny uloženy, ale první sync selhal: ${msg.slice(0, 300)}` }, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  await prisma.userIntegration.deleteMany({ where: { userId: session.uid, provider: "plaud" } });
  return Response.json({ ok: true });
};
