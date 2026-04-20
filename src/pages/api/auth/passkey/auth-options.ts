import type { APIRoute } from "astro";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { prisma } from "@/lib/db";
import { getRpInfo, issueChallenge, readPreauth } from "@/lib/webauthn";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const preauth = await readPreauth(cookies);
  if (!preauth) return Response.json({ error: "PREAUTH_MISSING" }, { status: 401 });

  const creds = await prisma.webauthnCredential.findMany({
    where: { userId: preauth.uid },
    select: { credentialId: true, transports: true },
  });

  if (creds.length === 0) {
    return Response.json({ error: "NO_PASSKEYS" }, { status: 400 });
  }

  const { rpID } = getRpInfo();
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: creds.map((c) => ({
      id: c.credentialId,
      transports: c.transports as AuthenticatorTransport[] | undefined,
    })),
    userVerification: "preferred",
  });

  await issueChallenge(cookies, options.challenge, "auth");
  return Response.json(options);
};
