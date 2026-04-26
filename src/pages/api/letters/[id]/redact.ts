import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { redactLetter } from "@/lib/letter-redact";
import { deleteUpload } from "@/lib/uploads";

export const prerender = false;

const Body = z.object({
  // Volitelně přepsat raw text před učesáním
  bodyRaw: z.string().min(1).max(20000).optional(),
  promptOverride: z.string().max(2000).nullable().optional(),
});

export const POST: APIRoute = async ({ request, cookies, params }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const id = params.id;
  if (!id) return Response.json({ error: "INVALID_ID" }, { status: 400 });

  const letter = await prisma.letter.findFirst({
    where: { id, userId: session.uid },
    include: { sender: true },
  });
  if (!letter) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: z.infer<typeof Body> = {};
  try {
    body = Body.parse(await request.json().catch(() => ({})));
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const rawText = body.bodyRaw ?? letter.bodyRaw;
  const override = body.promptOverride ?? letter.promptOverride ?? null;

  let result;
  try {
    result = await redactLetter({
      rawText,
      basePrompt: letter.sender.redactPrompt,
      override,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  // Invaliduj PDF (pokud bylo)
  if (letter.pdfPath) await deleteUpload(letter.pdfPath);

  const updated = await prisma.letter.update({
    where: { id },
    data: {
      bodyRaw: rawText,
      bodyFinal: result.text,
      promptOverride: override,
      pdfPath: null,
      pdfGeneratedAt: null,
    },
    include: { sender: true, recipient: true },
  });

  return Response.json({
    ok: true,
    letter: updated,
    meta: { model: result.model, promptChars: result.promptChars },
  });
};
