import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { prisma } from "./db";

// Token format: `rasel_<48 hex chars>` → user vidí/zná plný string,
// server drží jen argon2 hash a 8znakový prefix pro UI identifikaci.
const TOKEN_BYTES = 24; // 48 hex chars

export type IssuedToken = {
  id: string;
  plain: string; // jen jednorázově — vrací se uživateli, nikdy neukládat
  prefix: string;
};

export async function issueApiToken(userId: string, name: string): Promise<IssuedToken> {
  const plain = "rasel_" + randomBytes(TOKEN_BYTES).toString("hex");
  const prefix = plain.slice(0, 8);
  const tokenHash = await argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const row = await prisma.apiToken.create({
    data: { userId, name, tokenHash, prefix },
    select: { id: true },
  });

  return { id: row.id, plain, prefix };
}

export async function revokeApiToken(userId: string, id: string): Promise<boolean> {
  const result = await prisma.apiToken.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

/**
 * Ověří Bearer token a vrátí userId nebo null.
 * Lineárně projde non-revoked tokeny s daným prefixem a verifikuje argon2.
 * Jeden uživatel bude mít typicky 1–3 tokeny, takže scan je OK.
 */
export async function verifyApiToken(plain: string): Promise<{ userId: string; tokenId: string } | null> {
  if (!plain || !plain.startsWith("rasel_") || plain.length < 20) return null;
  const prefix = plain.slice(0, 8);

  const candidates = await prisma.apiToken.findMany({
    where: { prefix, revokedAt: null },
    select: { id: true, userId: true, tokenHash: true },
  });

  for (const c of candidates) {
    try {
      if (await argon2.verify(c.tokenHash, plain)) {
        // best-effort lastUsedAt; nechceme kvůli tomu failnout request
        prisma.apiToken
          .update({ where: { id: c.id }, data: { lastUsedAt: new Date() } })
          .catch(() => null);
        return { userId: c.userId, tokenId: c.id };
      }
    } catch {
      // ignore, zkus další kandidát
    }
  }
  return null;
}

export function extractBearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
