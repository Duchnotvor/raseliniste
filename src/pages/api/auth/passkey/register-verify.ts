import type { APIRoute } from "astro";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import {
  clearPreauth,
  consumeChallenge,
  getRpInfo,
  readPreauth,
} from "@/lib/webauthn";

export const prerender = false;

// Vstup je `RegistrationResponseJSON` z browser — neověřujeme strukturu,
// necháme to na @simplewebauthn/server. Ale aspoň to musí být objekt.
const Body = z.object({}).passthrough();

function clientIp(request: Request, clientAddress: string | undefined): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return clientAddress ?? "unknown";
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const preauth = await readPreauth(cookies);
  if (!preauth) return Response.json({ error: "PREAUTH_MISSING" }, { status: 401 });

  const challenge = await consumeChallenge(cookies, "register");
  if (!challenge) return Response.json({ error: "CHALLENGE_MISSING" }, { status: 400 });

  let raw: unknown;
  try {
    raw = Body.parse(await request.json());
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const { rpID, origin } = getRpInfo();

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: raw as RegistrationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "verify failed";
    return Response.json({ error: "VERIFY_FAILED", message: msg }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return Response.json({ error: "NOT_VERIFIED" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  await prisma.webauthnCredential.create({
    data: {
      userId: preauth.uid,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter),
      transports: credential.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    },
  });

  await prisma.user.update({
    where: { id: preauth.uid },
    data: { lastLoginAt: new Date() },
  });

  clearPreauth(cookies);

  const ip = clientIp(request, clientAddress);
  const ua = request.headers.get("user-agent") ?? undefined;
  await createSession(cookies, preauth.uid, ip, ua);

  return Response.json({ ok: true });
};
