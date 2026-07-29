import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

const CreateBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clientKey: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
});

const MoveBody = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** POST /api/planovani/blok — vytvoří klientský blok na dni (idempotentní) */
export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = CreateBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });

  const date = new Date(`${parsed.data.date}T00:00:00`);
  const block = await prisma.planningBlock.upsert({
    where: { userId_date_clientKey: { userId: session.uid, date, clientKey: parsed.data.clientKey } },
    create: { userId: session.uid, date, clientKey: parsed.data.clientKey, label: parsed.data.label },
    update: { label: parsed.data.label },
  });
  return Response.json({ ok: true, block: { id: block.id, date: parsed.data.date, clientKey: block.clientKey, label: block.label } });
};

/** PATCH /api/planovani/blok — přesun bloku na jiný den */
export const PATCH: APIRoute = async ({ request, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = MoveBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });

  const owned = await prisma.planningBlock.findFirst({ where: { id: parsed.data.id, userId: session.uid } });
  if (!owned) return Response.json({ error: "Blok nenalezen." }, { status: 404 });

  const date = new Date(`${parsed.data.date}T00:00:00`);
  // Kolize (stejný klient už na cílovém dni) → starý smaž, zůstane jeden
  await prisma.planningBlock.deleteMany({
    where: { userId: session.uid, date, clientKey: owned.clientKey, id: { not: owned.id } },
  });
  await prisma.planningBlock.update({ where: { id: owned.id }, data: { date } });
  return Response.json({ ok: true });
};

/** DELETE /api/planovani/blok?id=… — odstranění bloku */
export const DELETE: APIRoute = async ({ url, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Chybí id." }, { status: 400 });

  const r = await prisma.planningBlock.deleteMany({ where: { id, userId: session.uid } });
  if (r.count === 0) return Response.json({ error: "Blok nenalezen." }, { status: 404 });
  return Response.json({ ok: true });
};
