import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

const Body = z.object({
  name: z.string().min(1).max(200),
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

export const GET: APIRoute = async ({ cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const senders = await prisma.letterSender.findMany({
    where: { userId: session.uid },
    orderBy: { name: "asc" },
  });
  return Response.json({ senders });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues.map((i) => i.message).join("; ") : "INVALID_INPUT";
    return Response.json({ error: msg }, { status: 400 });
  }

  const sender = await prisma.letterSender.create({
    data: {
      userId: session.uid,
      name: body.name,
      legalName: body.legalName ?? null,
      ico: body.ico ?? null,
      dic: body.dic ?? null,
      addressLines: body.addressLines ?? [],
      email: body.email ?? null,
      phone: body.phone ?? null,
      web: body.web ?? null,
      bankAccount: body.bankAccount ?? null,
      ...(body.redactPrompt ? { redactPrompt: body.redactPrompt } : {}),
      ...(body.pdfTheme ? { pdfTheme: body.pdfTheme } : {}),
    },
  });
  return Response.json({ sender });
};
