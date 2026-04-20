import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

type TagRow = { tag: string; count: bigint };

/**
 * GET /api/journal/tags
 * Vrací všechny unikátní hashtagy deníku daného uživatele s počtem použití,
 * seřazené sestupně podle četnosti, pak abecedně.
 *
 * Implementace: Postgres `unnest()` rozbalí pole hashtagů z každé Entry
 * na samostatné řádky, pak GROUP BY + COUNT.
 */
export const GET: APIRoute = async ({ cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const rows = await prisma.$queryRaw<TagRow[]>`
    SELECT tag, COUNT(*)::bigint AS count
    FROM (
      SELECT unnest(e.hashtags) AS tag
      FROM "Entry" e
      JOIN "Recording" r ON r.id = e."recordingId"
      WHERE e.type = 'JOURNAL'
        AND e.status <> 'DISCARDED'
        AND r."userId" = ${session.uid}
    ) t
    GROUP BY tag
    ORDER BY count DESC, tag ASC
  `;

  const tags = rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
  return Response.json({ tags, total: tags.length });
};
