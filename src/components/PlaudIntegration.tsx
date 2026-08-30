import { useEffect, useState } from "react";
import { Check, Loader2, Mic, Trash2 } from "lucide-react";
import { Button } from "./ui/Button";

/**
 * Nastavení Plaud integrace (Gideon 2026-08-09) — /settings/integrations/plaud.
 * Přihlášení jednorázově na Macu (`npx @plaud-ai/cli login`), pak sem vložit
 * obsah ~/.plaud/tokens.json. Refresh tokenů pak řeší server sám.
 */

interface Status { connected: boolean; lastUsedAt: string | null; lastError: string | null }

export default function PlaudIntegration() {
  const [status, setStatus] = useState<Status | null>(null);
  const [tokens, setTokens] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/settings/plaud").catch(() => null);
    if (res?.ok) setStatus(await res.json());
    else setStatus({ connected: false, lastUsedAt: null, lastError: null });
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/plaud", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokens }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { setError(d.error ?? `HTTP ${res.status}`); return; }
      setMessage(`Připojeno. První sync: ${d.stats?.listed ?? 0} nahrávek nalezeno, ${d.stats?.created ?? 0} zápisů staženo${d.stats?.transcribing ? `, ${d.stats.transcribing} se přepisuje u nás` : ""} — koukni do Studánky.`);
      setTokens("");
      await load();
    } catch { setError("Síťová chyba."); }
    finally { setSaving(false); }
  }

  // Gideon 2026-09-03: window.confirm v PWA (standalone) nefunguje — tlačítko
  // pak „nic nedělá". Potvrzení dvouklikem přímo v UI.
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  async function disconnect() {
    if (!confirmDisconnect) { setConfirmDisconnect(true); setTimeout(() => setConfirmDisconnect(false), 4000); return; }
    setConfirmDisconnect(false);
    await fetch("/api/settings/plaud", { method: "DELETE" }).catch(() => null);
    await load();
  }

  if (status === null) {
    return <div className="glass rounded-xl p-5 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Načítám…</div>;
  }

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Mic className="size-5 text-muted-foreground" />
        <h2 className="font-medium text-lg">Plaud diktafon</h2>
        {status.connected && (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-[var(--tint-sage)] ml-auto"><Check className="size-3.5" /> připojeno</span>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Nahrávky z Plaud diktafonu se automaticky stahují do Studánky (každých
        30 minut) a přepisují se u nás (Gemini) včetně souhrnu — Plaudu se za nic neplatí.
      </p>

      {status.connected && (
        <div className="text-sm space-y-1">
          <div className="font-mono text-xs text-muted-foreground">
            Poslední sync: {status.lastUsedAt ? new Date(status.lastUsedAt).toLocaleString("cs-CZ") : "zatím neproběhl"}
          </div>
          {status.lastError && (
            <div className="rounded-md border border-[color:var(--c-signal)]/40 bg-[color:var(--c-signal)]/5 px-3 py-2 text-sm">
              {status.lastError}
            </div>
          )}
        </div>
      )}

      {(!status.connected || status.lastError) && (
        <div className="space-y-3">
          <div className="text-sm space-y-1.5">
            <div className="font-medium">{status.connected ? "Obnovit připojení:" : "Jak připojit:"}</div>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Na Macu v Terminálu spusť: <code className="font-mono text-xs bg-black/20 rounded px-1.5 py-0.5">npx @plaud-ai/cli login</code> (otevře prohlížeč, přihlas se Plaud účtem)</li>
              <li>Pak spusť: <code className="font-mono text-xs bg-black/20 rounded px-1.5 py-0.5">cat ~/.plaud/tokens.json</code></li>
              <li>Celý výstup (JSON) zkopíruj a vlož sem:</li>
            </ol>
          </div>
          <textarea
            value={tokens}
            onChange={(e) => setTokens(e.target.value)}
            placeholder='{"access_token":"…","refresh_token":"…","expires_at":…}'
            rows={4}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-mono"
          />
          <Button onClick={() => void save()} disabled={saving || tokens.trim().length < 10}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? "Připojuji + první sync…" : "Připojit"}
          </Button>
        </div>
      )}

      {error && <div className="text-sm text-[var(--destructive,#e5484d)]">{error}</div>}
      {message && <div className="text-sm text-[var(--tint-sage)]">{message}</div>}

      {status.connected && (
        <div className="pt-2 border-t border-border">
          <Button onClick={() => void disconnect()} variant="ghost" size="sm" className="text-muted-foreground">
            <Trash2 className="size-4" /> {confirmDisconnect ? "Opravdu odpojit? (klikni znovu)" : "Odpojit Plaud"}
          </Button>
        </div>
      )}
    </div>
  );
}
