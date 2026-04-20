import type { APIRoute } from "astro";
import { destroySession } from "@/lib/session";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  await destroySession(cookies);
  return Response.json({ ok: true });
};
