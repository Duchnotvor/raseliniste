import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { env } from "./env";

/**
 * AES-256-GCM šifrování pro citlivá data v DB (Todoist token apod.).
 *
 * Klíč je odvozený ze SESSION_SECRET přes SHA-256 (32 B = 256 bit).
 * IV je náhodný 12 B per záznam. Authentication tag je 16 B.
 *
 * Formát uložení:
 *   { tokenEnc, tokenIv, tokenTag } — vše base64.
 */

function getKey(): Buffer {
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET missing or too short");
  }
  // SHA-256 odvozený klíč (32 B = AES-256)
  return createHash("sha256").update(String(secret)).digest();
}

export interface EncryptedPayload {
  enc: string; // base64
  iv: string;  // base64
  tag: string; // base64
}

export function encryptSecret(plain: string): EncryptedPayload {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    enc: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptSecret(payload: EncryptedPayload): string {
  const key = getKey();
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const ciphertext = Buffer.from(payload.enc, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}
