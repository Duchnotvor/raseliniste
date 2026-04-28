import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/mailer";

export const prerender = false;

/**
 * Denní souhrn aktivit ve Studně.
 *
 * Synology Task Scheduler:
 *   - Každý den 18:00
 *   - curl -X POST https://www.raseliniste.cz/api/cron/daily-projects-digest
 *          -H "x-cron-key: <CRON_SECRET>"
 *
 * Logika:
 *   1. Vezme všechny záznamy z dnešního dne (00:00 → teď)
 *   2. Sgrupuje podle projektu (jen těch, co mají includeInDigest=true)
 *   3. Pokud nic nepřibylo → e-mail se neposílá
 *   4. Jinak: pošle souhrn na User.notificationEmail / env.NOTIFICATION_EMAIL
 */

interface RecordingForDigest {
  authorName: string;
  isOwner: boolean;
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analysis: any;
  createdAt: Date;
}

function dayBoundsToday(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  return { from, to: now };
}

export const POST: APIRoute = async ({ request, url }) => {
  const secret = env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_NOT_CONFIGURED" }, { status: 503 });
  if (request.headers.get("x-cron-key") !== secret) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Volitelně override datumu přes ?date=YYYY-MM-DD (pro testování)
  const qDate = url.searchParams.get("date");
  let from: Date, to: Date;
  if (qDate) {
    from = new Date(`${qDate}T00:00:00`);
    to = new Date(`${qDate}T23:59:59`);
  } else {
    ({ from, to } = dayBoundsToday());
  }

  const users = await prisma.user.findMany({
    select: { id: true, username: true, notificationEmail: true },
  });

  const summaries: Array<{ user: string; sent: boolean; reason?: string }> = [];

  for (const user of users) {
    const projects = await prisma.projectBox.findMany({
      where: {
        userId: user.id,
        archivedAt: null,
        includeInDigest: true,
      },
      select: { id: true, name: true },
    });
    if (projects.length === 0) {
      summaries.push({ user: user.username, sent: false, reason: "no_projects" });
      continue;
    }

    const projectIds = projects.map((p) => p.id);
    const recordings = await prisma.projectRecording.findMany({
      where: {
        projectId: { in: projectIds },
        createdAt: { gte: from, lte: to },
        status: "processed",
      },
      select: {
        projectId: true,
        authorName: true,
        isOwner: true,
        type: true,
        analysis: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (recordings.length === 0) {
      summaries.push({ user: user.username, sent: false, reason: "no_activity_today" });
      continue;
    }

    // Sgrupuj per projekt
    const byProject = new Map<string, RecordingForDigest[]>();
    for (const r of recordings) {
      const arr = byProject.get(r.projectId) ?? [];
      arr.push(r);
      byProject.set(r.projectId, arr);
    }

    const to_email = user.notificationEmail ?? env.NOTIFICATION_EMAIL;
    if (!to_email) {
      summaries.push({ user: user.username, sent: false, reason: "no_email" });
      continue;
    }

    const html = renderDigestHtml(projects, byProject);
    const dateLabel = from.toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
    const subject = `[Rašeliniště · Studna] Denní souhrn — ${dateLabel}`;

    const result = await sendMail({
      to: to_email,
      subject,
      html,
      text: `Souhrn projektů ke dni ${dateLabel}. ${recordings.length} nových záznamů.`,
    });
    summaries.push({ user: user.username, sent: result.ok, reason: result.ok ? undefined : (result as { error: string }).error });
  }

  return Response.json({ ok: true, processed: summaries });
};

function renderDigestHtml(
  projects: { id: string; name: string }[],
  byProject: Map<string, RecordingForDigest[]>,
): string {
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const rows: string[] = [];

  for (const [projectId, recs] of byProject) {
    const projectName = projectMap.get(projectId) ?? "Neznámý projekt";
    const standard = recs.filter((r) => r.type === "STANDARD");
    const briefs = recs.filter((r) => r.type === "BRIEF");

    const authors = new Map<string, number>();
    for (const r of recs) authors.set(r.authorName, (authors.get(r.authorName) ?? 0) + 1);
    const authorsList = Array.from(authors.entries())
      .map(([n, c]) => `${escapeHtml(n)} (${c}×)`)
      .join(", ");

    const topBullets: string[] = [];
    for (const r of recs.slice(0, 3)) {
      const thoughts = r.analysis?.thoughts;
      if (Array.isArray(thoughts) && thoughts.length > 0) {
        const high = thoughts.filter((t: { importance?: string }) => t.importance === "high");
        const top = (high.length > 0 ? high : thoughts).slice(0, 2);
        for (const t of top) {
          topBullets.push(`<li><em>${escapeHtml(r.authorName)}:</em> ${escapeHtml(t.text)}</li>`);
        }
      }
    }

    rows.push(`
      <div style="border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:18px;margin-bottom:14px;background:#241f1b;">
        <div style="font-family:Georgia,serif;font-size:18px;color:#fff;margin-bottom:6px;">${escapeHtml(projectName)}</div>
        <div style="font-size:13px;color:#9a8f82;margin-bottom:10px;font-family:ui-monospace,monospace;">
          ${standard.length} záznam${countWord(standard.length)}${briefs.length > 0 ? ` · ${briefs.length} brief${countWord(briefs.length)}` : ""} · ${escapeHtml(authorsList)}
        </div>
        ${topBullets.length > 0 ? `<ul style="margin:0;padding-left:18px;color:#e8e3d9;font-size:14px;line-height:1.55;">${topBullets.join("")}</ul>` : ""}
      </div>
    `);
  }

  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#1a1714;color:#e8e3d9;font-family:-apple-system,BlinkMacSystemFont,'Geist','Segoe UI',sans-serif;line-height:1.55;">
  <div style="max-width:640px;margin:0 auto;padding:24px 20px;">
    <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#b8763c;font-family:ui-monospace,monospace;margin-bottom:6px;">
      Rašeliniště · Studna
    </div>
    <h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 18px;color:#fff;letter-spacing:-0.01em;">
      Denní souhrn projektů
    </h1>
    ${rows.join("")}
    <div style="font-size:11px;color:#6b665f;font-family:ui-monospace,monospace;margin-top:18px;">
      Otevři <a href="https://www.raseliniste.cz/studna" style="color:#b8763c;">/studna</a> pro detail.
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function countWord(n: number): string {
  if (n === 1) return "";
  if (n >= 2 && n <= 4) return "y";
  return "ů";
}
