import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { readSession } from "@/lib/session";

export const prerender = false;

const PatchBody = z.object({
  notificationEmail: z.union([z.string().email(), z.literal("")]).nullable().optional(),
});

export const GET: APIRoute = async ({ cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { notificationEmail: true },
  });

  return Response.json({
    notificationEmail: user?.notificationEmail ?? null,
    // Env hodnoty (read-only, informativní — uživatel je nastavuje v .env / docker compose)
    envDefaults: {
      notificationFrom: env.NOTIFICATION_FROM ?? null,
      envNotificationEmail: env.NOTIFICATION_EMAIL ?? null,
      resendConfigured: Boolean(env.RESEND_API_KEY),
    },
  });
};

export const PATCH: APIRoute = async ({ cookies, request }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await request.json());
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 422 });
  }

  const emailRaw = body.notificationEmail;
  const notificationEmail =
    emailRaw == null || emailRaw === "" ? null : emailRaw.trim();

  const updated = await prisma.user.update({
    where: { id: session.uid },
    data: { notificationEmail },
    select: { notificationEmail: true },
  });

  return Response.json({ notificationEmail: updated.notificationEmail });
};
