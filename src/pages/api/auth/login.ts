import type { APIRoute } from "astro";
import { z } from "zod";
import argon2 from "argon2";
import { prisma } from "@/lib/db";
import { checkLoginRateLimit, recordLoginAttempt } from "@/lib/rate-limit";
import { issuePreauth } from "@/lib/webauthn";

export const prerender = false;

const Body = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

// Konstantní-čas placeholder (hash prázdného stringu) — aby neexistující user
// trval stejně dlouho jako existující. Nikdy neprojde jako validní.
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$YWFhYWFhYWFhYWFhYWFhYQ$jJ6tTnZSSqXJYU0wIIG6M4P1hY/1p1v1iSiXDQjnNyo";

function clientIp(request: Request, clientAddress: string | undefined): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return clientAddress ?? "unknown";
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const ip = clientIp(request, clientAddress);

  const limit = await checkLoginRateLimit(body.username, ip);
  if (limit) {
    return Response.json({ error: "RATE_LIMITED", scope: limit }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { username: body.username },
    include: { passkeys: { select: { id: true } } },
  });
  const hashToCheck = user?.passwordHash ?? DUMMY_HASH;

  let valid = false;
  try {
    valid = await argon2.verify(hashToCheck, body.password);
  } catch {
    valid = false;
  }

  if (!user || !valid) {
    await recordLoginAttempt(body.username, ip, false);
    return Response.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  // Heslo OK — NESPOUŠTĚJ full session. Vystav preauth cookie a pošli klienta
  // na passkey krok: buď přihlášení stávajícím passkey, nebo enrollment.
  const needsEnrollment = user.passkeys.length === 0;
  await issuePreauth(cookies, user.id, needsEnrollment);

  return Response.json({
    ok: true,
    next: needsEnrollment ? "enroll_passkey" : "verify_passkey",
  });
};
