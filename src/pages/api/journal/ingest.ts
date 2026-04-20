import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { extractBearer, verifyApiToken } from "@/lib/tokens";
import { readSession } from "@/lib/session";
import { redactJournal } from "@/lib/journal-redact";

export const prerender = false;

/**
 * Direct journal ingest s AI redakcí.
 *
 * Flow:
 *  1. Ulož Recording.rawText (surový text — fallback, nikdy nezmizí)
 *  2. Pošli na Gemini Flash → cleanedText + hashtags
 *  3. Ulož Entry s cleanedText (JOURNAL, CONFIRMED)
 *     - Při selhání Gemini: Entry.text = rawText (deník se neztratí)
 *     - processingError se zaloguje do Recording
 *
 * Auth: x-api-key / Bearer (Shortcut) nebo session cookie (web UI)
 */

const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  name: z.string().max(200).optional(),
  accuracy: z.number().nonnegative().optional(),
});

const Body = z.object({
  text: z.string().min(1).max(20_000),
  source: z.enum(["SHORTCUT", "WEB", "MANUAL"]).optional().default("SHORTCUT"),
  // Volitelná GPS lokace z iPhone Shortcutu.
  location: LocationSchema.optional(),
  // Pokud klient explicitně nechce redakci (např. user už si text ručně napsal
  // a chce ho uložit 1:1), pošle skipRedact: true.
  skipRedact: z.boolean().optional().default(false),
});

const DAILY_LIMIT = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

export const POST: APIRoute = async ({ request, cookies }) => {
  // Auth: Bearer/x-api-key (Shortcut) nebo session cookie (web)
  let userId: string | null = null;
  const apiKey = request.headers.get("x-api-key");
  const bearer = extractBearer(request.headers.get("authorization"));
  const token = apiKey ?? bearer;

  if (token) {
    const auth = await verifyApiToken(token);
    if (!auth) return Response.json({ error: "INVALID_TOKEN" }, { status: 401 });
    userId = auth.userId;
  } else {
    const session = await readSession(cookies);
    if (session) userId = session.uid;
  }
  if (!userId) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 422 });
  }

  // Rate limit
  const since = new Date(Date.now() - DAY_MS);
  const recentCount = await prisma.recording.count({
    where: { userId, createdAt: { gte: since } },
  });
  if (recentCount >= DAILY_LIMIT) {
    return Response.json(
      { error: "RATE_LIMITED", limit: DAILY_LIMIT, window: "24h" },
      { status: 429 }
    );
  }

  const now = new Date();
  const rawText = body.text.trim();

  // 1) Ulož Recording s raw textem. Vždy. I kdyby cokoli dál selhalo.
  const recording = await prisma.recording.create({
    data: {
      userId,
      source: body.source,
      rawText,
      processedAt: now,
    },
    select: { id: true },
  });

  // 2) AI redakce (pokud není skipRedact)
  let finalText = rawText;
  let hashtags: string[] = [];
  let redactedByAi = false;
  let redactError: string | null = null;

  if (!body.skipRedact) {
    const redacted = await redactJournal(rawText);
    if (redacted) {
      finalText = redacted.cleanedText;
      hashtags = redacted.hashtags;
      redactedByAi = true;
    } else {
      // Gemini selhala — použij raw, zaloguj do Recording.processingError
      redactError = "Redakce selhala — uloženo v původním znění";
      await prisma.recording.update({
        where: { id: recording.id },
        data: { processingError: redactError },
      }).catch(() => null);
    }
  }

  // 3) Ulož Entry (JOURNAL, CONFIRMED)
  const entry = await prisma.entry.create({
    data: {
      recordingId: recording.id,
      type: "JOURNAL",
      text: finalText,
      // rawExcerpt není potřeba — plný raw je v Recording.rawText
      hashtags,
      location: body.location ?? undefined,
      status: "CONFIRMED",
      confirmedAt: now,
    },
    select: { id: true },
  });

  return Response.json({
    ok: true,
    recordingId: recording.id,
    entryId: entry.id,
    redactedByAi,
    hashtagsCount: hashtags.length,
    ...(redactError ? { warning: redactError } : {}),
  });
};
