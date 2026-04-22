import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

/**
 * GET /api/notes
 * Vrátí KNOWLEDGE + THOUGHT entries (confirmed).
 * Query:
 *   q=       — fulltext v text/rationale/knowledgeUrl/hashtags
 *   type=    — "KNOWLEDGE" | "THOUGHT" (jinak oboje)
 *   category — filter knowledgeCategory (jen KNOWLEDGE)
 *   tag      — filter hashtag/knowledgeTag
 *   includeCompleted=1
 */
export const GET: APIRoute = async ({ cookies, url }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const q = url.searchParams.get("q")?.trim() ?? "";
  const typeFilter = url.searchParams.get("type");
  const category = url.searchParams.get("category")?.trim();
  const tag = url.searchParams.get("tag")?.trim().replace(/^#/, "");
  const includeCompleted = url.searchParams.get("includeCompleted") === "1";

  const types =
    typeFilter === "KNOWLEDGE"
      ? ["KNOWLEDGE" as const]
      : typeFilter === "THOUGHT"
        ? ["THOUGHT" as const]
        : (["KNOWLEDGE", "THOUGHT"] as const);

  const entries = await prisma.entry.findMany({
    where: {
      type: { in: [...types] },
      status: "CONFIRMED",
      ...(includeCompleted ? {} : { completedAt: null }),
      recording: { userId: session.uid },
      ...(q
        ? {
            OR: [
              { text: { contains: q, mode: "insensitive" } },
              { rationale: { contains: q, mode: "insensitive" } },
              { knowledgeUrl: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(category ? { knowledgeCategory: { equals: category, mode: "insensitive" } } : {}),
      ...(tag
        ? {
            OR: [{ knowledgeTags: { has: tag } }, { hashtags: { has: tag } }],
          }
        : {}),
    },
    select: {
      id: true,
      type: true,
      text: true,
      rationale: true,
      knowledgeCategory: true,
      knowledgeUrl: true,
      knowledgeTags: true,
      hashtags: true,
      completedAt: true,
      createdAt: true,
    },
    orderBy: [{ completedAt: "asc" }, { createdAt: "desc" }],
    take: 300,
  });

  // Pro filter UI vrátíme i seznam unikátních kategorií a tagů.
  const allCategories = new Set<string>();
  const allTags = new Set<string>();
  for (const e of entries) {
    if (e.knowledgeCategory) allCategories.add(e.knowledgeCategory);
    for (const t of e.knowledgeTags ?? []) allTags.add(t);
    for (const h of e.hashtags ?? []) allTags.add(h);
  }

  return Response.json({
    entries,
    categories: Array.from(allCategories).sort(),
    tags: Array.from(allTags).sort().slice(0, 50),
  });
};
