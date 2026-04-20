import type { APIRoute } from "astro";
import { readSession } from "@/lib/session";
import { revokeApiToken } from "@/lib/tokens";

export const prerender = false;

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });

  const ok = await revokeApiToken(session.uid, id);
  if (!ok) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  return Response.json({ ok: true });
};
