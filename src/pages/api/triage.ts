import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export const GET: APIRoute = async ({ cookies, url }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const limitRaw = Number(url.searchParams.get("limit"));
  const offsetRaw = Number(url.searchParams.get("offset"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

  const where = {
    status: "PENDING" as const,
    recording: { userId: session.uid },
  };

  const [entries, total] = await Promise.all([
    prisma.entry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      select: {
        id: true,
        type: true,
        text: true,
        rawExcerpt: true,
        suggestedProject: true,
        suggestedWhen: true,
        rationale: true,
        knowledgeCategory: true,
        knowledgeUrl: true,
        knowledgeTags: true,
        status: true,
        createdAt: true,
        recording: {
          select: { id: true, source: true, createdAt: true },
        },
      },
    }),
    prisma.entry.count({ where }),
  ]);

  return Response.json({ entries, total, limit, offset });
};
