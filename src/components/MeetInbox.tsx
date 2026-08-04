import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Video, X, Check } from "lucide-react";
import { Button } from "./ui/Button";

/**
 * Inbox přepisů Google Meet schůzek (Gideon 2026-08-04) — sekce na /studna.
 * Cron je plní automaticky; tady se zápis přečte a přiřadí k projektu
 * (vznikne ProjectRecording s analýzou + RAG). Nechtěné se zahodí (tombstone).
 */

interface MeetNoteRow {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: string;
  processingError: string | null;
  eventTitle: string | null;
  summaryMd: string | null;
  transcriptChars: number;
  project: { id: string; name: string } | null;
  recordingId: string | null;
}

interface ProjectOpt { id: string; name: string }

export default function MeetInbox() {
  const [notes, setNotes] = useState<MeetNoteRow[] | null>(null);
  const [hasScope, setHasScope] = useState(true);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const [meetRes, projRes] = await Promise.all([
      fetch("/api/studna/meet"),
      fetch("/api/studna"),
    ]);
    if (meetRes.ok) {
      const d = await meetRes.json();
      setNotes(d.notes ?? []);
      setHasScope(d.hasMeetScope ?? false);
    }
    if (projRes.ok) {
      const d = await projRes.json();
      setProjects((d.projects ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
    }
  }
  useEffect(() => { void load(); }, []);

  async function syncNow() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/studna/meet", { method: "POST" });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Sync selhal."); return; }
      setMessage(`Nalezeno ${d.stats?.conferences ?? 0} schůzek · ${d.stats?.processed ?? 0} se zpracovává · ${d.stats?.stillPending ?? 0} čeká na nahrávku`);
      setTimeout(() => setMessage(null), 8000);
      await load();
    } catch { setError("Síťová chyba."); }
    finally { setSyncing(false); }
  }

  async function assign(noteId: string, projectId: string) {
    if (!projectId) return;
    setError(null);
    const res = await fetch(`/api/studna/meet/${noteId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) { setError(d?.error ?? "Přiřazení selhalo."); return; }
    await load();
  }

  async function remove(noteId: string) {
    if (!confirm("Zahodit tento zápis? Sync ho už nevrátí.")) return;
    const res = await fetch(`/api/studna/meet/${noteId}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) setNotes((ns) => ns?.filter((n) => n.id !== noteId) ?? null);
  }

  const fmtWhen = (n: MeetNoteRow) => {
    const s = new Date(n.startedAt);
    const dur = n.endedAt ? Math.round((new Date(n.endedAt).getTime() - s.getTime()) / 60000) : null;
    return `${s.toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "numeric" })} ${s.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}${dur ? ` · ${dur} min` : ""}`;
  };

  if (notes === null) return null;

  return (
    <div className="glass-subtle rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Video className="size-4 text-muted-foreground" />
        <span className="font-medium">Zápisy ze schůzek (Meet)</span>
        <span className="text-xs text-muted-foreground">— nahrané schůzky se přepisují samy à 30 min</span>
        <Button onClick={syncNow} disabled={syncing} variant="ghost" size="sm" className="ml-auto">
          {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Zkontrolovat teď
        </Button>
      </div>

      {!hasScope && (
        <div className="text-sm rounded-md border border-[color:var(--c-signal)]/40 bg-[color:var(--c-signal)]/5 px-3 py-2">
          Google napojení nemá oprávnění pro Meet. <a href="/settings/integrations/google" className="underline font-medium">Rozšířit oprávnění →</a>
          <span className="block text-xs text-muted-foreground mt-1">Po reauthorizaci navíc v GCP Console zapni Google Meet API a Google Drive API (jednorázově).</span>
        </div>
      )}

      {error && <div className="text-sm text-[var(--destructive,#e5484d)]">{error}</div>}
      {message && <div className="text-sm text-muted-foreground">{message}</div>}

      {notes.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">Žádné zápisy — až proběhne nahraná Meet schůzka, objeví se tady.</div>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => {
            const isOpen = open.has(n.id);
            return (
              <div key={n.id} className="rounded-lg border border-border bg-card/50">
                <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setOpen((s) => { const x = new Set(s); if (x.has(n.id)) x.delete(n.id); else x.add(n.id); return x; })}
                    className="flex items-center gap-2 text-sm text-left flex-1 min-w-0"
                  >
                    {isOpen ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                    <span className="font-mono text-xs text-muted-foreground tabular shrink-0">{fmtWhen(n)}</span>
                    <span className="truncate font-medium">{n.eventTitle ?? "Schůzka bez názvu"}</span>
                  </button>
                  {n.status === "pending" && <span className="text-[11px] font-mono text-muted-foreground">čeká na nahrávku…</span>}
                  {n.status === "processing" && <span className="text-[11px] font-mono text-[var(--tint-sky)]">přepisuje se…</span>}
                  {n.status === "error" && <span className="text-[11px] font-mono text-[color:var(--c-signal)]" title={n.processingError ?? ""}>chyba</span>}
                  {n.recordingId && n.project ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--tint-sage)]">
                      <Check className="size-3" /> {n.project.name}
                    </span>
                  ) : n.status === "done" ? (
                    <select
                      defaultValue=""
                      onChange={(e) => void assign(n.id, e.target.value)}
                      className="rounded-md border border-border bg-card px-2 py-1 text-xs"
                    >
                      <option value="">→ přiřadit k projektu…</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  ) : null}
                  <button type="button" onClick={() => void remove(n.id)} title="Zahodit zápis" className="p-1 rounded text-muted-foreground hover:text-foreground">
                    <X className="size-3.5" />
                  </button>
                </div>
                {isOpen && (
                  <div className="px-4 pb-3 space-y-2">
                    {n.status === "error" && n.processingError && (
                      <div className="text-xs text-[color:var(--c-signal)]">{n.processingError}</div>
                    )}
                    {n.summaryMd ? (
                      <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed rounded-md bg-black/10 p-3 max-h-96 overflow-y-auto">{n.summaryMd}</pre>
                    ) : (
                      <div className="text-xs text-muted-foreground italic">Zápis zatím není.</div>
                    )}
                    {n.transcriptChars > 0 && (
                      <div className="text-[11px] font-mono text-muted-foreground">plný přepis: {Math.round(n.transcriptChars / 1000)} tis. znaků (uloží se do projektu při přiřazení)</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
