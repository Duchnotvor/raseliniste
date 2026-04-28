import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Disk persistence pro uploady (loga odesílatelů, skeny podpisů,
 * vygenerovaná PDF dopisů).
 *
 * Cesta:
 *   - dev:  ./uploads/                          (gitignored)
 *   - prod: /app/uploads/  (mount z NAS:        /volume1/docker/raseliniste/uploads/)
 *
 * V DB ukládáme jen **relativní** cestu (typu "letter-senders/abc.png"),
 * full path skládáme až za běhu přes resolveUpload().
 */

// Sjednoceno s docker-compose.yml — používá konvenci UPLOADS_PATH (volume mount).
const UPLOADS_DIR =
  process.env.UPLOADS_PATH ??
  process.env.UPLOADS_DIR ??
  (process.env.NODE_ENV === "production" ? "/data/uploads" : "./uploads");

export async function ensureUploadDir(subdir: string): Promise<string> {
  const full = path.join(UPLOADS_DIR, subdir);
  await fs.mkdir(full, { recursive: true });
  return full;
}

/**
 * Bezpečné rozšíření z mime typu (whitelist — žádný .exe).
 * Tolerantní k codec parametrům: "audio/webm; codecs=opus" → "audio/webm"
 */
function extFromMime(mime: string): string | null {
  // Strip parametry (codecs=opus, charset=, …)
  const base = mime.toLowerCase().split(";")[0].trim();
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "application/pdf": "pdf",
    // Audio (Studna)
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/aac": "aac",
    "audio/flac": "flac",
  };
  return map[base] ?? null;
}

/**
 * Uloží binární data na disk pod náhodným jménem v daném podadresáři.
 * Vrací **relativní** cestu, kterou ulož do DB.
 */
export async function saveUpload(
  subdir: string,
  data: Buffer,
  mime: string,
): Promise<{ relativePath: string; absolutePath: string; bytes: number }> {
  const ext = extFromMime(mime);
  if (!ext) throw new Error(`Nepodporovaný typ souboru: ${mime}`);

  await ensureUploadDir(subdir);

  const filename = `${randomBytes(12).toString("hex")}.${ext}`;
  const relativePath = path.posix.join(subdir, filename);
  const absolutePath = path.join(UPLOADS_DIR, subdir, filename);

  await fs.writeFile(absolutePath, data, { mode: 0o600 });

  return { relativePath, absolutePath, bytes: data.byteLength };
}

/**
 * Smaž soubor podle relativní cesty (ignoruje "neexistuje").
 */
export async function deleteUpload(relativePath: string | null | undefined): Promise<void> {
  if (!relativePath) return;
  const full = path.join(UPLOADS_DIR, relativePath);
  await fs.unlink(full).catch(() => null);
}

export function resolveUpload(relativePath: string): string {
  return path.join(UPLOADS_DIR, relativePath);
}

export async function readUpload(relativePath: string): Promise<Buffer> {
  return fs.readFile(resolveUpload(relativePath));
}

export async function uploadExists(relativePath: string | null | undefined): Promise<boolean> {
  if (!relativePath) return false;
  try {
    await fs.access(resolveUpload(relativePath));
    return true;
  } catch {
    return false;
  }
}
