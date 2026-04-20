import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { extractBearer, verifyApiToken } from "@/lib/tokens";
import { classify } from "@/lib/classifier";
import { readSession } from "@/lib/session";

export const prerender = false;

const Body = z.object({
  text: z.string().min(1).max(20_000),
  source: z.enum(["SHORTCUT", "WEB", "MANUAL"]),
});

const DAILY_LIMIT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

export const POST: APIRoute = async ({ request, cookies }) => {
  // Dual auth: Bearer token (Shortcut) NEBO session cookie (web /capture).
  let userId: string | null = null;
  const bearer = extractBearer(request.headers.get("authorization"));
  if (bearer) {
    const auth = await verifyApiToken(bearer);
    if (!auth) return Response.json({ error: "INVALID_TOKEN" }, { status: 401 });
    userId = auth.userId;
  } else {
    const session = await readSession(cookies);
    if (session) userId = session.uid;
  }
  if (!userId) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const auth = { userId };

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 422 });
  }

  // Rate limit: 100 ingest requests per user per 24h (per Recording row).
  const since = new Date(Date.now() - DAY_MS);
  const recentCount = await prisma.recording.count({
    where: { userId: auth.userId, createdAt: { gte: since } },
  });
  if (recentCount >= DAILY_LIMIT) {
    return Response.json({ error: "RATE_LIMITED", limit: DAILY_LIMIT, window: "24h" }, { status: 429 });
  }

  // 1) Ulož raw recording.
  const recording = await prisma.recording.create({
    data: { userId: auth.userId, source: body.source, rawText: body.text },
    select: { id: true },
  });

  // 2) Zavolej Gemini synchronně — triage UI čeká na pending entries.
  try {
    const entries = await classify(body.text);

    if (entries.length > 0) {
      await prisma.entry.createMany({
        data: entries.map((e) => ({
          recordingId: recording.id,
          type: e.type,
          text: e.text,
          rawExcerpt: e.rawExcerpt,
          suggestedProject: e.type === "TASK" ? e.suggestedProject : null,
          suggestedWhen: e.type === "TASK" ? e.suggestedWhen : null,
          rationale: e.type === "TASK" ? e.rationale : null,
          knowledgeCategory: e.type === "KNOWLEDGE" ? e.knowledgeCategory : null,
          knowledgeUrl: e.type === "KNOWLEDGE" ? e.knowledgeUrl : null,
          knowledgeTags: e.type === "KNOWLEDGE" ? e.knowledgeTags : [],
        })),
      });
    }

    await prisma.recording.update({
      where: { id: recording.id },
      data: { processedAt: new Date() },
    });

    return Response.json({ recordingId: recording.id, entriesCount: entries.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Klasifikace selhala";
    await prisma.recording.update({
      where: { id: recording.id },
      data: { processingError: msg.slice(0, 500) },
    });
    return Response.json(
      { recordingId: recording.id, error: "CLASSIFY_FAILED", message: msg },
      { status: 500 }
    );
  }
};
