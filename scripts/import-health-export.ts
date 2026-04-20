/**
 * Jednorázový import Health Auto Export JSON souboru do DB.
 *
 * Použití:
 *   npm run health:import -- /cesta/k/HealthAutoExport-...json
 *   npm run health:import -- ~/Downloads/HealthAutoExport-2025-04-13-2026-04-20.json Gideon
 *
 * Argumenty:
 *   1. cesta k JSON (povinně)
 *   2. username (volitelné, default = první user v DB, typicky Gideon)
 *
 * Skript načte soubor streamem není potřeba — JSON.parse na 100 MB sežere
 * paměť, ale 2.6 MB roční export je triviální. Pokud někdy přijde větší
 * soubor, parser je stream-friendly a lze ho přepracovat na JSONStream.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { parseHaePayload } from "@/lib/health-parser";
import { importHealthRows } from "@/lib/health-import";
import { prisma } from "@/lib/db";

function expandHome(p: string): string {
  if (p.startsWith("~")) return resolve(homedir(), p.slice(2));
  return resolve(p);
}

async function main() {
  const rawPath = process.argv[2];
  const usernameArg = process.argv[3];

  if (!rawPath) {
    console.error("Usage: npm run health:import -- <path-to-json> [username]");
    process.exit(1);
  }
  const path = expandHome(rawPath);

  console.log(`[health-import] Reading ${path}...`);
  const started = Date.now();
  const raw = readFileSync(path, "utf8");
  const payload = JSON.parse(raw);
  console.log(`[health-import] JSON parsed in ${Date.now() - started}ms`);

  const parsed = parseHaePayload(payload);
  console.log(`[health-import] Parsed: ${parsed.metrics.length} metrics, ${parsed.ecgs.length} ECG`);
  console.log(`[health-import] By type:`);
  for (const [type, count] of Object.entries(parsed.stats.metricsByType).sort()) {
    console.log(`    ${type.padEnd(30)} ${count}`);
  }
  if (parsed.stats.skippedMissingDate > 0) {
    console.log(`[health-import] WARNING: ${parsed.stats.skippedMissingDate} záznamů bez data — přeskočeno.`);
  }

  const user = usernameArg
    ? await prisma.user.findUnique({ where: { username: usernameArg }, select: { id: true, username: true } })
    : await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, username: true } });

  if (!user) {
    console.error(`[health-import] Uživatel ${usernameArg ?? "(default)"} nenalezen. Nejprve spusť db:seed.`);
    process.exit(1);
  }
  console.log(`[health-import] Importing pro uživatele: ${user.username} (${user.id})`);

  const stats = await importHealthRows(user.id, parsed.metrics, parsed.ecgs);
  const total = Date.now() - started;

  console.log(`[health-import] Hotovo za ${(total / 1000).toFixed(2)}s:`);
  console.log(`    Metriky:  ${stats.metricsInserted} vloženo, ${stats.metricsSkippedDuplicate} duplikátů přeskočeno`);
  console.log(`    EKG:      ${stats.ecgsInserted} vloženo, ${stats.ecgsSkippedDuplicate} duplikátů přeskočeno`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[health-import] Selhalo:", err);
  await prisma.$disconnect();
  process.exit(1);
});
