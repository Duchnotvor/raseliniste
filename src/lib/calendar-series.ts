import { prisma } from "./db";

/**
 * Série opakovaných událostí (Gideon 2026-08-04: „když to vybloknu u
 * opakované akce, ať to platí i pro opakování").
 *
 * Opakované akce jsou v DB jako samostatné řádky s externalId ve tvaru
 * `<uid>_<čas výskytu>`:
 *  - iCloud (icloud-calendar.ts): `${uid}_${occStart.toISOString()}`
 *  - Google (singleEvents): `<seriesId>_20260804T070000Z`
 */
export function seriesUidOf(externalId: string | null | undefined): string | null {
  if (!externalId) return null;
  const m = externalId.match(/^(.+)_(\d{4}-\d{2}-\d{2}T[^_]+|\d{8}T[^_]+)$/);
  return m ? m[1] : null;
}

/**
 * Zdědit ruční blocksBooking override pro NOVÝ výskyt série — sync okno
 * jede dopředu a nové týdny by jinak spadly zpět na „auto". Bere se
 * naposledy změněný sourozenec s nastaveným override.
 */
export async function inheritSeriesBlocksBooking(
  source: string,
  externalId: string,
): Promise<boolean | null> {
  const uid = seriesUidOf(externalId);
  if (!uid) return null;
  const sibling = await prisma.calendarEvent.findFirst({
    where: {
      source: source as never,
      NOT: { blocksBooking: null },
      OR: [{ externalId: uid }, { externalId: { startsWith: `${uid}_` } }],
    },
    orderBy: { updatedAt: "desc" },
    select: { blocksBooking: true },
  });
  return sibling?.blocksBooking ?? null;
}
