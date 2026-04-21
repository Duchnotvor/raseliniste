import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { encryptSecret } from "@/lib/crypto";
import { testConnection } from "@/lib/todoist";

export const prerender = false;

const Body = z.object({
  token: z.string().min(10).max(200),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  // Ověř token proti Todoist API před uložením
  const test = await testConnection(body.token);
  if (!test.ok) {
    return Response.json({ error: `Token nefunguje: ${test.error}` }, { status: 400 });
  }

  const { enc, iv, tag } = encryptSecret(body.token);

  await prisma.userIntegration.upsert({
    where: { userId_provider: { userId: session.uid, provider: "todoist" } },
    create: {
      userId: session.uid,
      provider: "todoist",
      tokenEnc: enc,
      tokenIv: iv,
      tokenTag: tag,
      lastUsedAt: new Date(),
    },
    update: {
      tokenEnc: enc,
      tokenIv: iv,
      tokenTag: tag,
      lastError: null,
      lastUsedAt: new Date(),
    },
  });

  return Response.json({ ok: true, projectCount: test.projectCount });
};

export const DELETE: APIRoute = async ({ cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  await prisma.userIntegration.deleteMany({
    where: { userId: session.uid, provider: "todoist" },
  });

  return Response.json({ ok: true });
};
