import type { APIRoute } from "astro";
import { marked } from "marked";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { analyzeHealth } from "@/lib/health-analyze";
import { sendMail, wrapAnalysisHtml } from "@/lib/mailer";

export const prerender = false;

/**
 * Měsíční automatický health report.
 *
 * Spouští Synology Task Scheduler:
 *   - Poslední den v měsíci, 23:00
 *   - curl -X POST https://www.raseliniste.cz/api/cron/monthly-health-report
 *          -H "x-cron-key: <CRON_SECRET>"
 *
 * Pro každého uživatele:
 *   1. spočte předchozí kalendářní měsíc (1. → poslední den)
 *   2. pustí analyzeHealth() — stejný kód jako manuální analýza
 *   3. uloží HealthAnalysis s trigger=MONTHLY_AUTO
 *   4. pošle e-mail na NOTIFICATION_EMAIL (pokud je nastaven)
 *
 * Pokud spustíš 1.11. 23:00, analyzuje se říjen. Pokud 31.10. 23:00, taky říjen
 * (protože to byl celý říjen). Pokud spustíš uprostřed měsíce, bere předchozí
 * celý měsíc (= předvídatelné chování bez ohledu na to, kdy scheduler zapálí).
 */

function previousFullMonth(now: Date): { from: Date; to: Date; label: string } {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  // pokud je `now` poslední den aktuálního měsíce, analyzujeme tento měsíc,
  // jinak předchozí. Určíme to detekcí "tomorrow je 1. den jiného měsíce".
  const tomorrow = new Date(year, month, now.getDate() + 1);
  const isLastDayOfMonth = tomorrow.getMonth() !== month;

  let targetYear = year;
  let targetMonth = month;
  if (!isLastDayOfMonth) {
    targetMonth = month - 1;
    if (targetMonth < 0) { targetMonth = 11; targetYear = year - 1; }
  }

  const from = new Date(targetYear, targetMonth, 1, 0, 0, 0);
  const to = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
  const label = from.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });
  return { from, to, label };
}

export const POST: APIRoute = async ({ request, url }) => {
  // --- Auth: CRON_SECRET v x-cron-key header ---
  const secret = env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_NOT_CONFIGURED" }, { status: 503 });
  }
  const provided = request.headers.get("x-cron-key");
  if (provided !== secret) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // --- Volitelný override období přes query (pro testy / backfill) ---
  const qFrom = url.searchParams.get("from");
  const qTo = url.searchParams.get("to");
  const now = new Date();

  let from: Date, to: Date, label: string;
  if (qFrom && qTo) {
    from = new Date(qFrom);
    to = new Date(qTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return Response.json({ error: "INVALID_DATE" }, { status: 400 });
    }
    label = `${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`;
  } else {
    const m = previousFullMonth(now);
    from = m.from; to = m.to; label = m.label;
  }

  // --- Pro všechny uživatele s health daty ---
  const users = await prisma.user.findMany({
    where: { healthMetrics: { some: {} } },
    select: { id: true, username: true, notificationEmail: true },
  });

  const results: Array<{
    userId: string;
    username: string;
    analysisId?: string;
    ok: boolean;
    emailProvider?: string;
    emailId?: string;
    error?: string;
  }> = [];

  for (const user of users) {
    try {
      const result = await analyzeHealth(user.id, from, to, null);

      const saved = await prisma.healthAnalysis.create({
        data: {
          userId: user.id,
          periodFrom: from,
          periodTo: to,
          focus: null,
          trigger: "MONTHLY_AUTO",
          text: result.text,
          model: result.meta.model,
          promptChars: result.meta.promptChars,
          totalSamples: result.meta.totalSamples,
          metricsWithData: result.meta.metricsWithData,
        },
        select: { id: true },
      });

      // Odeslat mail — priorita: per-user `User.notificationEmail`,
      // fallback na env NOTIFICATION_EMAIL (globální default).
      const mailTo = user.notificationEmail ?? env.NOTIFICATION_EMAIL;
      if (mailTo) {
        const bodyHtml = marked.parse(result.text) as string;
        const html = wrapAnalysisHtml({
          title: `Zdravotní report · ${label}`,
          periodFrom: from,
          periodTo: to,
          bodyHtml,
          meta: {
            days: result.meta.days,
            totalSamples: result.meta.totalSamples,
            metricsWithData: result.meta.metricsWithData,
            model: result.meta.model,
          },
        });

        const mail = await sendMail({
          to: mailTo,
          subject: `🌱 Rašeliniště · Zdravotní report ${label}`,
          html,
          text: result.text,
        });

        if (mail.ok) {
          await prisma.healthAnalysis.update({
            where: { id: saved.id },
            data: { emailSentAt: new Date() },
          });
        } else {
          await prisma.healthAnalysis.update({
            where: { id: saved.id },
            data: { emailError: mail.error.slice(0, 500) },
          });
        }

        results.push({
          userId: user.id,
          username: user.username,
          analysisId: saved.id,
          ok: true,
          emailProvider: mail.ok ? mail.provider : undefined,
          emailId: mail.ok && "id" in mail ? mail.id : undefined,
          error: !mail.ok ? mail.error : undefined,
        });
      } else {
        results.push({
          userId: user.id,
          username: user.username,
          analysisId: saved.id,
          ok: true,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      results.push({ userId: user.id, username: user.username, ok: false, error: msg });
    }
  }

  return Response.json({
    ok: true,
    period: { from: from.toISOString(), to: to.toISOString(), label },
    processed: results.length,
    results,
  });
};
