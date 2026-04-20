import type { APIRoute } from "astro";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
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

const Body = z.object({ id: z.string() }).passthrough();

function clientIp(request: Request, clientAddress: string | undefined): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return clientAddress ?? "unknown";
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const preauth = await readPreauth(cookies);
  if (!preauth) return Response.json({ error: "PREAUTH_MISSING" }, { status: 401 });

  const challenge = await consumeChallenge(cookies, "auth");
  if (!challenge) return Response.json({ error: "CHALLENGE_MISSING" }, { status: 400 });

  let raw: { id: string };
  try {
    raw = Body.parse(await request.json()) as { id: string };
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const cred = await prisma.webauthnCredential.findUnique({
    where: { credentialId: raw.id },
  });
  if (!cred || cred.userId !== preauth.uid) {
    return Response.json({ error: "UNKNOWN_CREDENTIAL" }, { status: 400 });
  }

  const { rpID, origin } = getRpInfo();

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: raw as unknown as AuthenticationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.credentialId,
        publicKey: new Uint8Array(cred.publicKey),
        counter: Number(cred.counter),
        transports: cred.transports as AuthenticatorTransport[] | undefined,
      },
      requireUserVerification: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "verify failed";
    return Response.json({ error: "VERIFY_FAILED", message: msg }, { status: 400 });
  }

  if (!verification.verified) {
    return Response.json({ error: "NOT_VERIFIED" }, { status: 400 });
  }

  await prisma.webauthnCredential.update({
    where: { id: cred.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
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
