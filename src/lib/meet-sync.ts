import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "./db";
import { getAuthorizedClient } from "./google-oauth";
import { transcribeAudioOnly } from "./audio-transcribe";
import { getGemini, DEFAULT_MODEL } from "./gemini";
import { callTracked } from "./gemini-usage";

/**
 * Google Meet přepisy → Studánka inbox (Gideon 2026-08-04).
 *
 * Pipeline dle návodu meet-prepis (jiný projekt), adaptace pro Rašeliniště:
 *  - OAuth uživatele místo Service Account + DWD (single-user, token máme)
 *  - Gemini API místo Vertexu; >14 MB audio řeší Files API v audio-transcribe
 *  - ffmpeg je v kontejneru (audio-clean.ts ho už používá)
 *
 * Převzaté lekce z návodu:
 *  - idempotence přes UNIQUE conferenceRecord
 *  - nahrávka není hned po schůzce → pending + retry příštím cronem
 *  - tombstone (deleted) — smazaný zápis sync nevzkřísí
 *
 * DEPLOY GOTCHA: v GCP Console zapnout Google Meet API + Google Drive API
 * (scope ≠ enabled API — stejná past jako Gmail).
 */

const MEET_API = "https://meet.googleapis.com/v2";
const SYNC_WINDOW_DAYS = 21;

// Fire-and-forget guard (viz process-recording.ts — GC pattern)
interface InFlight { noteId: string; startedAt: number; promise: Promise<void> }
const inFlight = new Set<InFlight>();
export function getInFlightMeetSnapshot() {
  return Array.from(inFlight).map((f) => ({ noteId: f.noteId, ageSec: Math.round((Date.now() - f.startedAt) / 1000) }));
}

async function meetFetch(token: string, url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Meet API ${res.status} ${url.slice(0, 120)}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export interface MeetSyncStats {
  conferences: number;
  created: number;
  processed: number;
  stillPending: number;
  errors: number;
}

/**
 * Projde conference records za posledních SYNC_WINDOW_DAYS, založí MeetNote
 * pro nové, a pro pending záznamy s hotovou nahrávkou spustí zpracování
 * (fire-and-forget — cron endpoint se nevrací až po přepisu).
 */
export async function syncMeetNotes(userId: string): Promise<MeetSyncStats> {
  const stats: MeetSyncStats = { conferences: 0, created: 0, processed: 0, stillPending: 0, errors: 0 };

  const client = await getAuthorizedClient(userId);
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Google access token se nepodařilo získat.");

  // Self-heal: zaseknuté processing >30 min (restart kontejneru) → pending
  await prisma.meetNote.updateMany({
    where: { userId, status: "processing", updatedAt: { lt: new Date(Date.now() - 30 * 60 * 1000) } },
    data: { status: "pending" },
  });

  const since = new Date(Date.now() - SYNC_WINDOW_DAYS * 86400000).toISOString();
  let pageToken: string | undefined;
  interface ConfRecord { name: string; space?: string; startTime?: string; endTime?: string }
  const records: ConfRecord[] = [];
  do {
    const url = new URL(`${MEET_API}/conferenceRecords`);
    url.searchParams.set("filter", `start_time>="${since}"`);
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await meetFetch(token, url.toString());
    records.push(...((data.conferenceRecords as ConfRecord[] | undefined) ?? []));
    pageToken = data.nextPageToken as string | undefined;
  } while (pageToken && records.length < 500);
  stats.conferences = records.length;

  for (const rec of records) {
    if (!rec.name || !rec.startTime) continue;
    const existing = await prisma.meetNote.findUnique({
      where: { conferenceRecord: rec.name },
      select: { id: true, status: true, deleted: true },
    });
    if (existing?.deleted) continue; // tombstone
    if (existing && (existing.status === "done" || existing.status === "processing")) continue;

    let noteId = existing?.id;
    if (!noteId) {
      const created = await prisma.meetNote.create({
        data: {
          userId,
          conferenceRecord: rec.name,
          spaceName: rec.space ?? null,
          startedAt: new Date(rec.startTime),
          endedAt: rec.endTime ? new Date(rec.endTime) : null,
        },
      });
      noteId = created.id;
      stats.created++;
    }

    // Nahrávka už existuje? (Google ji dogenerovává pár minut po konci)
    let driveFileId: string | null = null;
    try {
      const recData = await meetFetch(token, `${MEET_API}/${rec.name}/recordings`);
      interface Rec { state?: string; driveDestination?: { file?: string } }
      const items = (recData.recordings as Rec[] | undefined) ?? [];
      const ready = items.find((r) => r.state === "FILE_GENERATED" && r.driveDestination?.file);
      driveFileId = ready?.driveDestination?.file ?? null;
    } catch (e) {
      console.warn(`[meet-sync] recordings.list ${rec.name}:`, e instanceof Error ? e.message : e);
    }

    if (!driveFileId) {
      // Konference bez nahrávky: pokud skončila před >24 h, nahrávka už
      // nepřijde (nebylo zapnuté nahrávání) → smaž note, ať nestraší v inboxu.
      const endedAgo = rec.endTime ? Date.now() - new Date(rec.endTime).getTime() : 0;
      if (endedAgo > 24 * 3600 * 1000) {
        await prisma.meetNote.delete({ where: { id: noteId } }).catch(() => null);
      } else {
        stats.stillPending++;
      }
      continue;
    }

    await prisma.meetNote.update({ where: { id: noteId }, data: { driveFileId, status: "processing" } });

    // Fire-and-forget zpracování (stažení + ffmpeg + Gemini trvá minuty)
    const entry: InFlight = { noteId, startedAt: Date.now(), promise: Promise.resolve() };
    entry.promise = processMeetNote(userId, noteId, token, driveFileId)
      .catch((e) => {
        console.error(`[meet-sync] zpracování ${noteId} selhalo:`, e instanceof Error ? e.message : e);
        return prisma.meetNote.update({
          where: { id: noteId },
          data: { status: "error", processingError: e instanceof Error ? e.message.slice(0, 500) : String(e) },
        }).then(() => undefined).catch(() => undefined);
      })
      .finally(() => { inFlight.delete(entry); });
    inFlight.add(entry);
    stats.processed++;
  }

  return stats;
}

/** Stáhne mp4 z Drive, vytáhne audio, přepíše a udělá strukturovaný zápis. */
async function processMeetNote(userId: string, noteId: string, token: string, driveFileId: string): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "meet-"));
  try {
    // 1) Download mp4 z Drive
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media&supportsAllDrives=true`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`Drive download ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const mp4 = Buffer.from(await res.arrayBuffer());
    if (mp4.byteLength < 10_000) throw new Error(`Nahrávka je podezřele malá (${mp4.byteLength} B).`);
    const inPath = join(dir, "in.mp4");
    const outPath = join(dir, "out.mp3");
    await writeFile(inPath, mp4);

    // 2) ffmpeg: mp4 → mono mp3 64 kbps (malé pro Gemini, hodina ≈ 28 MB
    //    → nad 14 MB inline limit jde přes Files API v transcribeAudioOnly)
    await new Promise<void>((resolve, reject) => {
      const p = spawn("ffmpeg", ["-y", "-i", inPath, "-vn", "-ac", "1", "-b:a", "64k", outPath], { stdio: ["ignore", "ignore", "pipe"] });
      let err = "";
      p.stderr.on("data", (d) => { err += String(d); });
      p.on("error", reject);
      p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${err.slice(-300)}`))));
    });
    const audio = await readFile(outPath);

    // 3) Přepis (Gemini; Files API pro velké soubory)
    const note = await prisma.meetNote.findUnique({ where: { id: noteId }, select: { startedAt: true, endedAt: true } });
    const { transcript } = await transcribeAudioOnly({ audio, mimeType: "audio/mpeg" });

    // 4) Strukturovaný zápis (markdown — dle vzoru z návodu)
    const summaryMd = await buildMeetSummary(transcript);

    // 5) Nápověda pro přiřazení: kalendářová událost překrývající schůzku
    let eventTitle: string | null = null;
    if (note) {
      const end = note.endedAt ?? new Date(note.startedAt.getTime() + 3600000);
      const ev = await prisma.calendarEvent.findFirst({
        where: {
          deletedRemotely: false,
          allDay: false,
          source: { not: "LOCAL_ICS" },
          startsAt: { lt: end },
          endsAt: { gt: note.startedAt },
        },
        orderBy: { startsAt: "asc" },
        select: { title: true },
      });
      eventTitle = ev?.title ?? null;
    }

    await prisma.meetNote.update({
      where: { id: noteId },
      data: { status: "done", processingError: null, transcript, summaryMd, eventTitle },
    });
    console.log(`[meet-sync] ${noteId} hotovo (${transcript.length} znaků přepisu)`);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => null);
  }
}

async function buildMeetSummary(transcript: string): Promise<string> {
  const prompt = `Jsi asistent, který dělá české zápisy ze schůzek. Z následujícího přepisu Google Meet schůzky udělej strukturovaný zápis v markdownu přesně v této osnově:

## Účastníci
(jména/role, pokud jdou z přepisu poznat; jinak "nerozpoznáno")

## Shrnutí
(3–8 vět, věcně)

## Rozhodnutí
(odrážky; pokud žádná, napiš "—")

## Úkoly
(odrážky ve tvaru "- [kdo] co, do kdy pokud zaznělo"; pokud žádné, "—")

## Otevřené otázky
(odrážky; pokud žádné, "—")

Piš česky, stručně, bez vaty. Nic si nevymýšlej — jen co je v přepisu.

PŘEPIS:
${transcript.slice(0, 180_000)}`;

  const ai = getGemini();
  const response = await callTracked({
    module: "meet-zapis",
    modelName: DEFAULT_MODEL,
    fn: () => ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: { temperature: 0.2, maxOutputTokens: 8000 },
    }),
  });
  const text = response.text?.trim();
  if (!text) throw new Error("Gemini nevrátil zápis.");
  return text;
}
