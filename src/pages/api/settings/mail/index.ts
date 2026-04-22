import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { encryptSecret } from "@/lib/crypto";
import { testSmtpConnection } from "@/lib/mailer";

export const prerender = false;

const Body = z.object({
  host: z.string().min(2).max(200),
  port: z.number().int().positive().max(65535),
  secure: z.boolean(),
  user: z.string().min(2).max(200),
  password: z.string().min(1).max(500),
  from: z.string().email().max(200),
});

export const GET: APIRoute = async ({ cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const integration = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId: session.uid, provider: "smtp" } },
    select: { config: true, lastUsedAt: true, lastError: true, updatedAt: true },
  });

  if (!integration) {
    return Response.json({ configured: false });
  }

  const cfg = (integration.config ?? {}) as {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    from?: string;
  };

  return Response.json({
    configured: true,
    host: cfg.host ?? "",
    port: cfg.port ?? 465,
    secure: cfg.secure ?? true,
    user: cfg.user ?? "",
    from: cfg.from ?? "",
    lastUsedAt: integration.lastUsedAt?.toISOString() ?? null,
    lastError: integration.lastError ?? null,
    updatedAt: integration.updatedAt.toISOString(),
  });
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

  // Otestuj login před uložením (nepouštěj mail ven, jen verify).
  const verify = await testSmtpConnection(
    { host: body.host, port: body.port, secure: body.secure, user: body.user, from: body.from },
    body.password
  );
  if (!verify.ok) {
    return Response.json({ error: `Přihlášení selhalo: ${verify.error}` }, { status: 400 });
  }

  const { enc, iv, tag } = encryptSecret(body.password);

  await prisma.userIntegration.upsert({
    where: { userId_provider: { userId: session.uid, provider: "smtp" } },
    create: {
      userId: session.uid,
      provider: "smtp",
      tokenEnc: enc,
      tokenIv: iv,
      tokenTag: tag,
      config: {
        host: body.host,
        port: body.port,
        secure: body.secure,
        user: body.user,
        from: body.from,
      },
    },
    update: {
      tokenEnc: enc,
      tokenIv: iv,
      tokenTag: tag,
      config: {
        host: body.host,
        port: body.port,
        secure: body.secure,
        user: body.user,
        from: body.from,
      },
      lastError: null,
    },
  });

  return Response.json({ ok: true });
};

export const DELETE: APIRoute = async ({ cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  await prisma.userIntegration.deleteMany({
    where: { userId: session.uid, provider: "smtp" },
  });

  return Response.json({ ok: true });
};
