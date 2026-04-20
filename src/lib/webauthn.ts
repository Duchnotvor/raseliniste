import { SignJWT, jwtVerify } from "jose";
import type { AstroCookies } from "astro";
import { env } from "./env";

// ---- Relying Party info ----
export function getRpInfo() {
  const url = new URL(env.APP_URL);
  return {
    rpName: "Rašeliniště",
    rpID: url.hostname, // "localhost" | "www.raseliniste.cz"
    origin: url.origin, // "http://localhost:3000" | "https://www.raseliniste.cz"
  };
}

// ---- Cookies: pre-auth (po ověření hesla, před passkey) + challenge ----
export const PREAUTH_COOKIE = "rs_preauth";
export const CHALLENGE_COOKIE = "rs_wa_challenge";
const PREAUTH_TTL_SECONDS = 300; // 5 min
const CHALLENGE_TTL_SECONDS = 300;

let cachedSecret: Uint8Array | null = null;
function secret(): Uint8Array {
  if (!cachedSecret) cachedSecret = new TextEncoder().encode(env.SESSION_SECRET);
  return cachedSecret;
}

function cookieOpts(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

// ---- Pre-auth: JWT signalizující "heslo OK, čeká na passkey" ----
export async function issuePreauth(cookies: AstroCookies, uid: string, requireEnrollment: boolean) {
  const token = await new SignJWT({ uid, enroll: requireEnrollment })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + PREAUTH_TTL_SECONDS)
    .sign(secret());
  cookies.set(PREAUTH_COOKIE, token, cookieOpts(PREAUTH_TTL_SECONDS));
}

export async function readPreauth(
  cookies: AstroCookies
): Promise<{ uid: string; enroll: boolean } | null> {
  const token = cookies.get(PREAUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { uid: String(payload.uid), enroll: Boolean(payload.enroll) };
  } catch {
    return null;
  }
}

export function clearPreauth(cookies: AstroCookies) {
  cookies.delete(PREAUTH_COOKIE, { path: "/" });
}

// ---- Challenge cookie: JWT s WebAuthn challenge stringem ----
export async function issueChallenge(
  cookies: AstroCookies,
  challenge: string,
  purpose: "register" | "auth"
) {
  const token = await new SignJWT({ c: challenge, p: purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SECONDS)
    .sign(secret());
  cookies.set(CHALLENGE_COOKIE, token, cookieOpts(CHALLENGE_TTL_SECONDS));
}

export async function consumeChallenge(
  cookies: AstroCookies,
  purpose: "register" | "auth"
): Promise<string | null> {
  const token = cookies.get(CHALLENGE_COOKIE)?.value;
  if (!token) return null;
  cookies.delete(CHALLENGE_COOKIE, { path: "/" });
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.p !== purpose) return null;
    return String(payload.c);
  } catch {
    return null;
  }
}
