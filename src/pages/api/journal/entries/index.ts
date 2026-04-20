import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { redactJournal } from "@/lib/journal-redact";

export const prerender = false;

/**
 * GET /api/journal/entries?from&to&q&limit&offset
 * List všech JOURNAL entries (status CONFIRMED nebo PENDING — obojí zobrazujeme)
 * aktuálního uživatele, chronologicky sestupně.
 */
export const GET: APIRoute = async ({ cookies, url }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const limitRaw = Number(url.searchParams.get("limit"));
  const offsetRaw = Number(url.searchParams.get("offset"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const q = url.searchParams.get("q")?.trim();
  const tag = url.searchParams.get("tag")?.trim().toLowerCase();

  const where = {
    type: "JOURNAL" as const,
    status: { not: "DISCARDED" as const },
    recording: { userId: session.uid },
    ...(fromRaw || toRaw
      ? {
          createdAt: {
            ...(fromRaw ? { gte: new Date(fromRaw) } : {}),
            ...(toRaw ? { lte: new Date(toRaw) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          text: {
            contains: q,
            mode: "insensitive" as const,
          },
        }
      : {}),
    ...(tag ? { hashtags: { has: tag } } : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.entry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      select: {
        id: true,
        text: true,
        rawExcerpt: true,
        hashtags: true,
        location: true,
        status: true,
        createdAt: true,
        confirmedAt: true,
        recording: { select: { source: true, createdAt: true, rawText: true } },
      },
    }),
    prisma.entry.count({ where }),
  ]);

  return Response.json({ entries, total, limit, offset });
};

/**
 * POST /api/journal/entries
 * Ruční přidání deníkového zápisu přes web UI (session auth).
 * Pro Shortcut flow se používá /api/journal/ingest (Bearer).
 */
const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  name: z.string().max(200).optional(),
  accuracy: z.number().nonnegative().optional(),
});

const CreateBody = z.object({
  text: z.string().min(1).max(20_000),
  // Default false — user na webu píše sám, nechceme mu text měnit.
  // Pokud chce učesání, pošle redact: true (tlačítko v UI).
  redact: z.boolean().optional().default(false),
  location: LocationSchema.optional(),
});

export const POST: APIRoute = async ({ cookies, request }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: z.infer<typeof CreateBody>;
  try {
    body = CreateBody.parse(await request.json());
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 422 });
  }

  const rawText = body.text.trim();
  let finalText = rawText;
  let hashtags: string[] = [];
  let redactedByAi = false;

  if (body.redact) {
    const redacted = await redactJournal(rawText);
    if (redacted) {
      finalText = redacted.cleanedText;
      hashtags = redacted.hashtags;
      redactedByAi = true;
    }
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const recording = await tx.recording.create({
      data: {
        userId: session.uid,
        source: "WEB",
        rawText,
        processedAt: now,
      },
      select: { id: true },
    });
    const entry = await tx.entry.create({
      data: {
        recordingId: recording.id,
        type: "JOURNAL",
        text: finalText,
        rawExcerpt: null,
        hashtags,
        location: body.location ?? undefined,
        status: "CONFIRMED",
        confirmedAt: now,
      },
      select: {
        id: true,
        text: true,
        hashtags: true,
        location: true,
        status: true,
        createdAt: true,
        confirmedAt: true,
        recording: { select: { source: true, createdAt: true } },
      },
    });
    return entry;
  });

  return Response.json({ entry: result, redactedByAi });
};
