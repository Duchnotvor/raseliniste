import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { saveUpload, deleteUpload } from "@/lib/uploads";

export const prerender = false;

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB pro logo / podpis

/**
 * POST /api/letters/senders/:id/upload
 * Body: multipart/form-data
 *   field "kind": "logo" | "signature"
 *   field "file": image/png|jpeg|webp
 */
export const POST: APIRoute = async ({ request, cookies, params }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_ID" }, { status: 400 });

  const sender = await prisma.letterSender.findFirst({
    where: { id, userId: session.uid },
  });
  if (!sender) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const form = await request.formData();
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");

  if (kind !== "logo" && kind !== "signature") {
    return Response.json({ error: "kind musí být 'logo' nebo 'signature'." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return Response.json({ error: "Chybí soubor (file)." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: `Soubor je moc velký (max ${MAX_BYTES / 1024 / 1024} MB).` }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let saved;
  try {
    saved = await saveUpload(`letter-senders/${id}`, buf, file.type);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }

  // Zlikviduj starý soubor (pokud byl)
  const oldPath = kind === "logo" ? sender.logoPath : sender.signaturePath;
  await deleteUpload(oldPath);

  const updated = await prisma.letterSender.update({
    where: { id },
    data: kind === "logo" ? { logoPath: saved.relativePath } : { signaturePath: saved.relativePath },
  });

  return Response.json({ ok: true, sender: updated, bytes: saved.bytes });
};

/**
 * DELETE odstraní logo / signature.
 * Body: { kind: "logo" | "signature" }
 */
export const DELETE: APIRoute = async ({ request, cookies, params }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_ID" }, { status: 400 });

  const sender = await prisma.letterSender.findFirst({
    where: { id, userId: session.uid },
  });
  if (!sender) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const kind = body.kind;
  if (kind !== "logo" && kind !== "signature") {
    return Response.json({ error: "INVALID_KIND" }, { status: 400 });
  }

  const oldPath = kind === "logo" ? sender.logoPath : sender.signaturePath;
  await deleteUpload(oldPath);

  const updated = await prisma.letterSender.update({
    where: { id },
    data: kind === "logo" ? { logoPath: null } : { signaturePath: null },
  });
  return Response.json({ ok: true, sender: updated });
};
