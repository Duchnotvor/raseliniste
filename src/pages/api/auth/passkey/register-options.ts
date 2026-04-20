import type { APIRoute } from "astro";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { prisma } from "@/lib/db";
import { getRpInfo, issueChallenge, readPreauth } from "@/lib/webauthn";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const preauth = await readPreauth(cookies);
  if (!preauth) return Response.json({ error: "PREAUTH_MISSING" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: preauth.uid },
    include: {
      passkeys: { select: { credentialId: true, transports: true } },
    },
  });
  if (!user) return Response.json({ error: "USER_NOT_FOUND" }, { status: 404 });

  const { rpName, rpID } = getRpInfo();
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.username,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    // Blokujeme re-enrollment už registrovaných klíčů
    excludeCredentials: user.passkeys.map((p) => ({
      id: p.credentialId,
      transports: p.transports as AuthenticatorTransport[] | undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await issueChallenge(cookies, options.challenge, "register");
  return Response.json(options);
};
