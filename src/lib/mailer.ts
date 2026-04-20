import { env } from "./env";

/**
 * Thin wrapper nad Resend HTTP API (https://resend.com/docs/api-reference/emails/send-email).
 * - V dev / bez klíče pouze loguje; nebrání flow.
 * - Produkce: vyžaduje RESEND_API_KEY + NOTIFICATION_FROM + NOTIFICATION_EMAIL.
 *
 * Resend free tier: 3 000 mailů / měsíc, 100 / den — více než dost pro single-user.
 */

export type MailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type MailResult =
  | { ok: true; provider: "resend" | "log"; id?: string }
  | { ok: false; error: string };

export async function sendMail(input: MailInput): Promise<MailResult> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.NOTIFICATION_FROM;

  if (!apiKey || !from) {
    console.log(
      `[mailer] RESEND_API_KEY nebo NOTIFICATION_FROM není nastaveno. Mail by šel na ${input.to}:\n  subject: ${input.subject}\n  (html ${input.html.length} chars)`
    );
    return { ok: true, provider: "log" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, provider: "resend", id: data.id as string | undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown mailer error" };
  }
}

/**
 * HTML obálka pro analýzy — používá inline styly, aby fungovala ve všech
 * klientech (Gmail mobile, Apple Mail, Outlook).
 */
export function wrapAnalysisHtml(params: {
  title: string;
  periodFrom: Date;
  periodTo: Date;
  bodyHtml: string;
  meta: { days: number; totalSamples: number; metricsWithData: number; model: string };
}): string {
  const { title, periodFrom, periodTo, bodyHtml, meta } = params;
  const fmt = (d: Date) => d.toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });

  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#1a1714;color:#e8e3d9;font-family:-apple-system,BlinkMacSystemFont,'Geist','Segoe UI',sans-serif;line-height:1.55;">
  <div style="max-width:640px;margin:0 auto;padding:24px 20px;">
    <div style="background:#241f1b;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:28px;">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#b8763c;font-family:ui-monospace,monospace;margin-bottom:6px;">
        Rašeliniště · Zdraví
      </div>
      <h1 style="font-family:Georgia,serif;font-size:26px;margin:0 0 6px 0;color:#fff;letter-spacing:-0.01em;">
        ${title}
      </h1>
      <div style="font-size:13px;color:#9a8f82;font-family:ui-monospace,monospace;">
        ${fmt(periodFrom)} → ${fmt(periodTo)} · ${meta.days} dní · ${meta.totalSamples.toLocaleString("cs-CZ")} záznamů · ${meta.metricsWithData} metrik
      </div>

      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:20px 0;">

      <div style="font-size:15px;color:#e8e3d9;">
        ${bodyHtml}
      </div>

      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0 16px;">
      <div style="font-size:11px;color:#6b665f;font-family:ui-monospace,monospace;">
        Generováno ${meta.model} · automatický měsíční report z Rašeliniště
      </div>
    </div>
  </div>
</body>
</html>`;
}
