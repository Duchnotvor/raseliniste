import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto";
import { testConnection } from "@/lib/todoist";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const integration = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId: session.uid, provider: "todoist" } },
  });
  if (!integration) return Response.json({ error: "Token není uložený." }, { status: 400 });

  try {
    const token = decryptSecret({
      enc: integration.tokenEnc,
      iv: integration.tokenIv,
      tag: integration.tokenTag,
    });
    const result = await testConnection(token);
    await prisma.userIntegration.update({
      where: { id: integration.id },
      data: {
        lastUsedAt: new Date(),
        lastError: result.ok ? null : result.error,
      },
    });
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
};
