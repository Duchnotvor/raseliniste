import type { APIRoute } from "astro";
import { readSession } from "@/lib/session";
import {
  AGGREGATION_MAP,
  queryBloodPressure,
  querySimpleMetric,
  querySleep,
} from "@/lib/health-query";

export const prerender = false;

function parseDate(s: string | null, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export const GET: APIRoute = async ({ cookies, url }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  // Default: posledních 30 dní končících latest data pointem (ne "dnes")
  // — naše data končí 2026-04-19, "dnes" může být později.
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = parseDate(url.searchParams.get("from"), defaultFrom);
  const to = parseDate(url.searchParams.get("to"), now);

  // Paralelní query všech metrik
  const simpleTypes = Object.keys(AGGREGATION_MAP);
  const [simples, bp, sleep] = await Promise.all([
    Promise.all(
      simpleTypes.map(async (type) => {
        const result = await querySimpleMetric(session.uid, type, from, to, AGGREGATION_MAP[type]);
        return { type, ...result };
      })
    ),
    queryBloodPressure(session.uid, from, to),
    querySleep(session.uid, from, to),
  ]);

  const series: Record<string, unknown> = {};
  const stats: Record<string, unknown> = {};
  const units: Record<string, string | null> = {};

  for (const s of simples) {
    series[s.type] = s.points;
    stats[s.type] = s.stats;
    units[s.type] = s.unit;
  }

  series.blood_pressure = bp.points;
  stats.blood_pressure = { systolic: bp.systolicStats, diastolic: bp.diastolicStats };

  series.sleep_analysis = sleep.points;
  stats.sleep_analysis = { total: sleep.totalStats, deep: sleep.deepStats, rem: sleep.remStats };

  return Response.json({
    from: from.toISOString(),
    to: to.toISOString(),
    series,
    stats,
    units,
  });
};
