import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { deleteUpload } from "@/lib/uploads";

export const prerender = false;

const PatchBody = z.object({
  name: z.string().min(1).max(200).optional(),
  legalName: z.string().max(200).nullable().optional(),
  ico: z.string().max(20).nullable().optional(),
  dic: z.string().max(20).nullable().optional(),
  addressLines: z.array(z.string().max(200)).max(8).optional(),
  email: z.string().email().max(200).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  web: z.string().max(200).nullable().optional(),
  bankAccount: z.string().max(60).nullable().optional(),
  redactPrompt: z.string().max(4000).optional(),
  pdfTheme: z.string().max(40).optional(),
});

async function own(userId: string, id: string) {
  return prisma.letterSender.findFirst({ where: { id, userId } });
}

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_ID" }, { status: 400 });

  const owned = await own(session.uid, id);
  if (!owned) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await request.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues.map((i) => i.message).join("; ") : "INVALID_INPUT";
    return Response.json({ error: msg }, { status: 400 });
  }

  const sender = await prisma.letterSender.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.legalName !== undefined ? { legalName: body.legalName } : {}),
      ...(body.ico !== undefined ? { ico: body.ico } : {}),
      ...(body.dic !== undefined ? { dic: body.dic } : {}),
      ...(body.addressLines !== undefined ? { addressLines: body.addressLines } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.web !== undefined ? { web: body.web } : {}),
      ...(body.bankAccount !== undefined ? { bankAccount: body.bankAccount } : {}),
      ...(body.redactPrompt !== undefined ? { redactPrompt: body.redactPrompt } : {}),
      ...(body.pdfTheme !== undefined ? { pdfTheme: body.pdfTheme } : {}),
    },
  });
  return Response.json({ sender });
};

export const DELETE: APIRoute = async ({ cookies, params }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_ID" }, { status: 400 });

  const owned = await own(session.uid, id);
  if (!owned) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  // Smaž logo + podpis z disku, pak DB.
  await deleteUpload(owned.logoPath);
  await deleteUpload(owned.signaturePath);

  await prisma.letterSender.delete({ where: { id } });
  return Response.json({ ok: true });
};
