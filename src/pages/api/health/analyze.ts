import type { APIRoute } from "astro";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { analyzeHealth } from "@/lib/health-analyze";

export const prerender = false;

const Body = z.object({
  from: z.string(),
  to: z.string(),
  focus: z.string().max(1000).nullable().optional(),
});

const DAILY_LIMIT = 10;
const rateLimitMap = new Map<string, number[]>();
const DAY_MS = 24 * 60 * 60 * 1000;

function checkRate(userId: string): boolean {
  const now = Date.now();
  const list = (rateLimitMap.get(userId) ?? []).filter((t) => now - t < DAY_MS);
  if (list.length >= DAILY_LIMIT) {
    rateLimitMap.set(userId, list);
    return false;
  }
  list.push(now);
  rateLimitMap.set(userId, list);
  return true;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const from = new Date(body.from);
  const to = new Date(body.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return Response.json({ error: "INVALID_DATE" }, { status: 400 });
  }
  if (to.getTime() < from.getTime()) {
    return Response.json({ error: "INVALID_RANGE" }, { status: 400 });
  }
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (days > 400) {
    return Response.json({ error: "RANGE_TOO_LONG", maxDays: 400 }, { status: 400 });
  }

  if (!checkRate(session.uid)) {
    return Response.json({ error: "RATE_LIMITED", limit: DAILY_LIMIT, window: "24h" }, { status: 429 });
  }

  try {
    const result = await analyzeHealth(session.uid, from, to, body.focus ?? null);

    // Persist — i manuální analýzy si ukládáme, uživatel se k nim může vracet.
    const saved = await prisma.healthAnalysis.create({
      data: {
        userId: session.uid,
        periodFrom: from,
        periodTo: to,
        focus: body.focus ?? null,
        trigger: "MANUAL",
        text: result.text,
        model: result.meta.model,
        promptChars: result.meta.promptChars,
        totalSamples: result.meta.totalSamples,
        metricsWithData: result.meta.metricsWithData,
      },
      select: { id: true, createdAt: true },
    });

    return Response.json({
      id: saved.id,
      createdAt: saved.createdAt,
      ...result,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analýza selhala";
    return Response.json({ error: "ANALYZE_FAILED", message: msg }, { status: 500 });
  }
};
