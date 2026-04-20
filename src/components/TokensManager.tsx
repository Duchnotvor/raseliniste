import { useEffect, useState } from "react";
import { Copy, Key, Loader2, Plus, Trash2, CheckCheck, X, Check } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

type Token = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type JustCreated = { id: string; name: string; prefix: string; token: string };

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("cs-CZ");
}

export default function TokensManager() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<JustCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/tokens");
      const data = await res.json();
      if (res.ok) setTokens(data.tokens);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createToken(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Nepodařilo se vytvořit token.");
        return;
      }
      setJustCreated(data);
      setShowNew(false);
      setNewName("");
      await refresh();
    } catch {
      setError("Síťová chyba.");
    } finally {
      setCreating(false);
    }
  }

  async function revokeToken(id: string) {
    if (!confirm("Opravdu odvolat tento token? Shortcut s ním přestane fungovat.")) return;
    await fetch(`/api/tokens/${id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
    });
    await refresh();
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl">API tokeny</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tokeny pro iOS Shortcut a další integrace, které posílají do <code className="font-mono text-xs">/api/ingest</code>.
          </p>
        </div>
        <Button onClick={() => { setShowNew(true); setError(null); }} size="sm">
          <Plus /> Nový token
        </Button>
      </div>

      {/* Just created — zobraz jednou plain token */}
      {justCreated && (
        <div
          className="glass-strong rounded-xl p-5"
          style={{ borderColor: "color-mix(in oklch, var(--tint-butter) 40%, transparent)" }}
        >
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] font-mono" style={{ color: "var(--tint-butter)" }}>
                Token vytvořen
              </div>
              <h3 className="font-serif text-lg mt-1">{justCreated.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Ulož si ho teď. Už se znovu nezobrazí — server drží jen hash.
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setJustCreated(null)} aria-label="Zavřít">
              <X />
            </Button>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border bg-black/30 px-3 py-2 font-mono text-sm">
            <Key className="size-4 shrink-0 text-muted-foreground" />
            <code className="flex-1 overflow-x-auto whitespace-nowrap">{justCreated.token}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(justCreated.token)}
              className="shrink-0"
            >
              {copied ? <CheckCheck /> : <Copy />}
              {copied ? "Zkopírováno" : "Kopírovat"}
            </Button>
          </div>
        </div>
      )}

      {/* Nový token — inline formulář */}
      {showNew && (
        <form onSubmit={createToken} className="glass rounded-xl p-4 space-y-3">
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-mono">
              Název tokenu
            </div>
            <Input
              placeholder="iOS Shortcut"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={creating}
              autoFocus
              required
              maxLength={100}
            />
          </div>
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 text-sm px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={creating || !newName}>
              {creating ? <><Loader2 className="animate-spin" /> Vytvářím…</> : <><Check /> Vytvořit</>}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowNew(false)} disabled={creating}>
              Zrušit
            </Button>
          </div>
        </form>
      )}

      {/* Seznam */}
      <div className="glass rounded-xl">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-serif text-lg">Aktivní tokeny</h3>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
            {tokens.filter((t) => !t.revokedAt).length} aktivních · {tokens.length} celkem
          </span>
        </div>

        {loading && (
          <div className="px-5 py-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Načítám…
          </div>
        )}

        {!loading && tokens.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-muted-foreground text-sm">
              Zatím žádné tokeny. Vytvoř první, abys mohl posílat data z iPhone Shortcutu.
            </p>
          </div>
        )}

        {!loading && tokens.length > 0 && (
          <ul className="divide-y divide-white/5">
            {tokens.map((t) => {
              const revoked = Boolean(t.revokedAt);
              return (
                <li key={t.id} className="px-5 py-3 flex items-center gap-4">
                  <div className={`size-8 rounded-md grid place-items-center shrink-0 ${revoked ? "bg-white/5 text-muted-foreground" : ""}`}
                       style={!revoked ? { background: "color-mix(in oklch, var(--tint-lavender) 14%, transparent)", color: "var(--tint-lavender)" } : undefined}>
                    <Key className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${revoked ? "line-through text-muted-foreground" : ""}`}>{t.name}</span>
                      <code className="font-mono text-xs text-muted-foreground">{t.prefix}…</code>
                      {revoked && (
                        <span className="text-[9px] uppercase tracking-widest font-mono rounded px-1.5 py-0.5 bg-destructive/15 text-destructive">
                          odvolán
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono tabular mt-0.5">
                      vytvořen {fmt(t.createdAt)} · naposledy {fmt(t.lastUsedAt)}
                      {revoked && <> · odvolán {fmt(t.revokedAt)}</>}
                    </div>
                  </div>
                  {!revoked && (
                    <Button variant="ghost" size="icon" onClick={() => revokeToken(t.id)} aria-label="Odvolat">
                      <Trash2 />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
