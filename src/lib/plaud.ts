import { prisma } from "./db";
import { encryptSecret, decryptSecret } from "./crypto";

/**
 * Plaud nahrávky → Studánka inbox (Gideon 2026-08-09).
 *
 * Používá REST API pod oficiálním @plaud-ai/cli (žádné spouštění CLI
 * v kontejneru — endpointy vyčtené z jeho zdrojáku):
 *   base   https://platform.plaud.ai/developer/api
 *   list   GET /open/third-party/files/?page&page_size → { data: [{id,name,created_at,duration}] }
 *   detail GET /open/third-party/files/{id} → { source_list: [{data_type, data_content?, data_link?}],
 *                                              note_list: [{data_type:"auto_sum_note", data_content}] }
 *   refresh POST /oauth/third-party/access-token/refresh (form refresh_token=…)
 *
 * Přihlášení: jednorázově na Macu `npx @plaud-ai/cli login`, pak obsah
 * ~/.plaud/tokens.json vložit do /settings/integrations/plaud. TokenSet
 * ({access_token, refresh_token, expires_at}) se drží ŠIFROVANĚ
 * v UserIntegration(provider="plaud").tokenEnc; refresh řešíme sami.
 *
 * Přepis i souhrn dodává Plaud — žádné Gemini, žádné náklady na tokeny.
 */

const API_BASE = "https://platform.plaud.ai/developer/api";
const REFRESH_URL = `${API_BASE}/oauth/third-party/access-token/refresh`;

export interface PlaudTokenSet {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_at?: number; // epoch ms (CLI ukládá takto)
}

export async function savePlaudTokens(userId: string, tokens: PlaudTokenSet): Promise<void> {
  const enc = encryptSecret(JSON.stringify(tokens));
  await prisma.userIntegration.upsert({
    where: { userId_provider: { userId, provider: "plaud" } },
    create: {
      userId, provider: "plaud",
      tokenEnc: enc.enc, tokenIv: enc.iv, tokenTag: enc.tag,
      config: { connectedAt: new Date().toISOString() },
    },
    update: { tokenEnc: enc.enc, tokenIv: enc.iv, tokenTag: enc.tag, lastError: null },
  });
}

async function loadPlaudTokens(userId: string): Promise<PlaudTokenSet | null> {
  const row = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId, provider: "plaud" } },
  });
  if (!row) return null;
  try {
    return JSON.parse(decryptSecret({ enc: row.tokenEnc, iv: row.tokenIv, tag: row.tokenTag })) as PlaudTokenSet;
  } catch {
    return null;
  }
}

/** Access token s auto-refreshem (refresh 5 min před expirací / při chybějícím expires_at vždy zkusit rovnou použít). */
async function getAccessToken(userId: string): Promise<string> {
  const tokens = await loadPlaudTokens(userId);
  if (!tokens?.refresh_token) throw new Error("Plaud není připojený — vlož tokens.json v /settings/integrations/plaud.");

  const needsRefresh = !tokens.expires_at || tokens.expires_at < Date.now() + 5 * 60 * 1000;
  if (!needsRefresh && tokens.access_token) return tokens.access_token;

  const res = await fetch(REFRESH_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ refresh_token: tokens.refresh_token }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    await prisma.userIntegration.updateMany({
      where: { userId, provider: "plaud" },
      data: { lastError: `Token refresh selhal (${res.status}) — nejspíš je potřeba nový login + vložit tokens.json.` },
    }).catch(() => null);
    throw new Error(`Plaud token refresh selhal (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = await res.json() as { access_token: string; refresh_token?: string; token_type?: string; expires_at?: number; expires_in?: number };
  const next: PlaudTokenSet = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    token_type: data.token_type ?? "Bearer",
    expires_at: data.expires_at ?? (data.expires_in ? Date.now() + data.expires_in * 1000 : Date.now() + 30 * 60 * 1000),
  };
  await savePlaudTokens(userId, next);
  return next.access_token;
}

async function apiGet(userId: string, path: string): Promise<Record<string, unknown>> {
  const token = await getAccessToken(userId);
  const res = await fetch(`${API_BASE}${path}`, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Plaud API ${res.status} ${path.slice(0, 60)}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

interface PlaudBlock { data_type?: string; data_content?: string; data_link?: string }

async function loadBlockContent(block: PlaudBlock | undefined): Promise<string> {
  if (!block) return "";
  if (block.data_content) return block.data_content;
  if (block.data_link) {
    const res = await fetch(block.data_link);
    if (!res.ok) throw new Error(`Plaud data_link HTTP ${res.status}`);
    return res.text();
  }
  return "";
}

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/** Segmenty → čitelný přepis (stejný formát jako CLI: [čas] mluvčí: text) */
function segmentsToText(raw: string): string {
  try {
    const segments = JSON.parse(raw) as Array<{ start_time?: number; end_time?: number; speaker?: string; content?: string; topic?: string }>;
    return segments
      .map((seg) => {
        const time = seg.start_time !== undefined ? `[${fmtTime(seg.start_time)}] ` : "";
        const speaker = seg.speaker ? `${seg.speaker}: ` : "";
        return `${time}${speaker}${seg.content ?? seg.topic ?? ""}`;
      })
      .filter((l) => l.trim())
      .join("\n");
  } catch {
    return raw; // fallback — kdyby formát nebyl JSON segmenty
  }
}

export interface PlaudSyncStats { listed: number; created: number; errors: number }

const SYNC_WINDOW_DAYS = 21;

/** Stáhne nové Plaud nahrávky (okno 21 dní) → PlaudNote (done, s přepisem i souhrnem). */
export async function syncPlaud(userId: string): Promise<PlaudSyncStats> {
  const stats: PlaudSyncStats = { listed: 0, created: 0, errors: 0 };
  const since = Date.now() - SYNC_WINDOW_DAYS * 86400000;

  interface FileRow { id: string; name?: string; created_at?: string; duration?: number }
  const files: FileRow[] = [];
  for (let page = 1; page <= 3; page++) {
    const data = await apiGet(userId, `/open/third-party/files/?page=${page}&page_size=50`);
    const rows = (data.data as FileRow[] | undefined) ?? [];
    files.push(...rows);
    if (rows.length < 50) break;
    // seznam je řazený od nejnovějších — jakmile jsme za oknem, stop
    const last = rows[rows.length - 1];
    if (last.created_at && new Date(last.created_at).getTime() < since) break;
  }
  stats.listed = files.length;

  for (const f of files) {
    if (!f.id) continue;
    const createdAt = f.created_at ? new Date(f.created_at) : new Date();
    if (createdAt.getTime() < since) continue;

    const existing = await prisma.plaudNote.findUnique({ where: { plaudFileId: f.id }, select: { id: true } });
    if (existing) continue; // idempotence (deleted řeší unique — tombstone řádek zůstává)

    try {
      const detail = await apiGet(userId, `/open/third-party/files/${encodeURIComponent(f.id)}`);
      const sources = (detail.source_list as PlaudBlock[] | undefined) ?? [];
      const notes = (detail.note_list as PlaudBlock[] | undefined) ?? [];

      // Preferuj AI-vyčištěný přepis, fallback surový
      const source = sources.find((s) => s.data_type === "transaction_polish") ?? sources.find((s) => s.data_type === "transaction");
      const rawContent = await loadBlockContent(source);
      const transcript = rawContent ? segmentsToText(rawContent) : null;
      const summary = notes.find((n) => n.data_type === "auto_sum_note")?.data_content ?? null;

      if (!transcript && !summary) continue; // ještě nezpracováno v Plaud cloudu — vezme příští běh

      await prisma.plaudNote.create({
        data: {
          userId,
          plaudFileId: f.id,
          title: f.name?.trim() || null,
          recordedAt: createdAt,
          durationSec: typeof f.duration === "number" ? Math.round(f.duration) : null,
          status: "done",
          transcript,
          summaryMd: summary,
        },
      });
      stats.created++;
    } catch (e) {
      stats.errors++;
      console.warn(`[plaud-sync] file ${f.id}:`, e instanceof Error ? e.message : e);
    }
  }

  await prisma.userIntegration.updateMany({
    where: { userId, provider: "plaud" },
    data: { lastUsedAt: new Date(), ...(stats.errors === 0 ? { lastError: null } : {}) },
  }).catch(() => null);

  console.log(`[plaud-sync] userId=${userId} listed=${stats.listed} created=${stats.created} errors=${stats.errors}`);
  return stats;
}

/** Přiřazení Plaud zápisu do projektu — stejný vzor jako Meet (ProjectRecording + analýza + RAG). */
export async function assignPlaudNoteToProject(userId: string, noteId: string, projectId: string): Promise<{ ok: boolean; error?: string; recordingId?: string }> {
  const note = await prisma.plaudNote.findFirst({ where: { id: noteId, userId, deleted: false } });
  if (!note) return { ok: false, error: "Zápis nenalezen." };
  if (!note.transcript && !note.summaryMd) return { ok: false, error: "Zápis nemá obsah." };
  if (note.recordingId) return { ok: false, error: "Už je přiřazený." };

  const project = await prisma.projectBox.findFirst({
    where: { id: projectId, userId },
    select: { id: true, description: true, studnaStandardPrompt: true, analysisModel: true },
  });
  if (!project) return { ok: false, error: "Projekt nenalezen." };

  const dateLabel = note.recordedAt.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
  const title = `Plaud ${dateLabel}${note.title ? ` — ${note.title}` : ""}`;
  const fullText = note.summaryMd
    ? `${note.summaryMd}\n\n---\n\n## Plný přepis\n\n${note.transcript ?? "(bez přepisu)"}`
    : (note.transcript as string);

  const recording = await prisma.projectRecording.create({
    data: {
      projectId: project.id,
      isOwner: true,
      authorName: "Plaud",
      type: "UPLOAD",
      transcript: fullText,
      uploadedFilename: title,
      status: "processing",
    },
  });
  await prisma.plaudNote.update({
    where: { id: note.id },
    data: { projectId: project.id, recordingId: recording.id },
  });

  const { processRecordingFromText } = await import("./process-recording");
  void processRecordingFromText({
    recordingId: recording.id,
    transcript: fullText,
    type: "STANDARD",
    projectContext: project.description,
    customStandardPrompt: project.studnaStandardPrompt,
    analysisModel: project.analysisModel,
  });
  return { ok: true, recordingId: recording.id };
}

export async function plaudStatus(userId: string): Promise<{ connected: boolean; lastUsedAt: Date | null; lastError: string | null }> {
  const row = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId, provider: "plaud" } },
    select: { lastUsedAt: true, lastError: true },
  });
  return row ? { connected: true, lastUsedAt: row.lastUsedAt, lastError: row.lastError } : { connected: false, lastUsedAt: null, lastError: null };
}
